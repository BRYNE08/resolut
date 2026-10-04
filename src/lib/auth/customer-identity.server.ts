import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { CustomerProvider } from "./customer-auth";
import type { SessionUser } from "./config";
import type { PrismaClient } from "../../generated/prisma/client";

export class CustomerAuthError extends Error {
  code: "cancelled" | "expired" | "unavailable" | "account_exists" | "failed";
  constructor(code: "cancelled" | "expired" | "unavailable" | "account_exists" | "failed") {
    super(code);
    this.code = code;
  }
}

const keys = {
  google: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
  apple: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
};

export type CustomerIdentity = {
  provider: CustomerProvider;
  subject: string;
  email: string;
  emailOwnershipVerified: boolean;
  name: string;
  image?: string;
};

export async function verifyCustomerIdentity(
  provider: CustomerProvider,
  token: string,
  clientId: string,
  nonce: string,
  key: JWTVerifyGetKey = keys[provider],
): Promise<CustomerIdentity> {
  const { payload } = await jwtVerify(token, key, {
    issuer:
      provider === "google"
        ? ["https://accounts.google.com", "accounts.google.com"]
        : "https://appleid.apple.com",
    audience: clientId,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "iat", "exp", "nonce", "email", "email_verified"],
    maxTokenAge: "10m",
    clockTolerance: 5,
  });
  if (
    !nonce ||
    payload.nonce !== nonce ||
    (payload.azp !== undefined && payload.azp !== clientId) ||
    (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId)
  ) {
    throw new CustomerAuthError("failed");
  }
  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new CustomerAuthError("failed");
  }
  if (
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 255 ||
    typeof payload.email !== "string" ||
    payload.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
  ) {
    throw new CustomerAuthError("failed");
  }
  const email = payload.email.trim().toLowerCase();
  return {
    provider,
    subject: payload.sub,
    email,
    // A third-party Google email may have changed owners since Google verified it.
    // Those users still sign in and see purchases linked to their stable user ID.
    emailOwnershipVerified:
      provider === "apple" ||
      email.endsWith("@gmail.com") ||
      (typeof payload.hd === "string" && payload.hd.length > 0),
    name: typeof payload.name === "string" ? payload.name.trim().slice(0, 100) : "",
    image:
      typeof payload.picture === "string" && payload.picture.startsWith("https://")
        ? payload.picture.slice(0, 2048)
        : undefined,
  };
}

/** Provider + subject is the identity key. Matching email never auto-links accounts. */
export async function resolveCustomer(
  db: PrismaClient,
  identity: CustomerIdentity,
): Promise<SessionUser> {
  try {
    return await db.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: identity.provider,
            providerAccountId: identity.subject,
          },
        },
        include: { user: true },
      });
      let user = account?.user;
      if (!user) {
        const existing = await tx.user.findFirst({
          where: { email: { equals: identity.email, mode: "insensitive" } },
        });
        if (existing) throw new CustomerAuthError("account_exists");
        user = await tx.user.create({
          data: {
            email: identity.email,
            emailVerified: identity.emailOwnershipVerified ? new Date() : null,
            name: identity.name || "Customer",
            image: identity.image,
            role: "CUSTOMER",
            accounts: {
              create: {
                type: "oidc",
                provider: identity.provider,
                providerAccountId: identity.subject,
              },
            },
          },
        });
      }
      if (user.role !== "CUSTOMER" || !user.email) throw new CustomerAuthError("failed");
      return {
        id: user.id,
        email: user.email,
        name: user.name || "Customer",
        image: user.image ?? undefined,
        role: "customer",
        sessionVersion: user.sessionVersion,
        emailVerified:
          identity.emailOwnershipVerified &&
          identity.email === user.email.toLowerCase() &&
          Boolean(user.emailVerified),
      };
    });
  } catch (error) {
    // A simultaneous first login may hit the unique email/provider constraint.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new CustomerAuthError("account_exists");
    }
    throw error;
  }
}
