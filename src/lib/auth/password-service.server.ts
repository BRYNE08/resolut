import type { PrismaClient, User } from "../../generated/prisma/client";
import type { SessionUser } from "./config";
import {
  hashPassword,
  verifyPassword,
  newEmailToken,
  emailTokenHash,
} from "./password-crypto.server.ts";

export class PasswordAuthError extends Error {}
export type MailPurpose = "verify" | "reset";
export type AuthMailer = (
  email: string,
  purpose: MailPurpose | "changed",
  token: string,
) => Promise<void>;
const invalid = () =>
  new PasswordAuthError("This link is invalid or expired. Request a new email.");
export function passwordSession(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email!,
    name: user.name || "Customer",
    role: "customer",
    emailVerified: Boolean(user.emailVerified),
    sessionVersion: user.sessionVersion,
  };
}

function tokenIdentifier(user: User, purpose: MailPurpose) {
  return `${purpose}:${user.id}:${user.sessionVersion}:${emailTokenHash(user.email || "")}`;
}

export function passwordService(db: PrismaClient, mail: AuthMailer) {
  async function notifyChanged(user: User) {
    try {
      await mail(user.email!, "changed", "");
    } catch {
      console.error("[auth] Password change notification failed.");
    }
  }
  const find = (email: string) =>
    db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  async function issue(user: User, purpose: MailPurpose) {
    const token = newEmailToken();
    // Multiple requested links can coexist; changing the version invalidates all of them.
    await db.verificationToken.create({
      data: {
        identifier: tokenIdentifier(user, purpose),
        token: emailTokenHash(token),
        expires: new Date(Date.now() + (purpose === "verify" ? 24 : 1) * 3600000),
      },
    });
    await mail(user.email!, purpose, token);
  }
  async function tokenUser(token: string, purpose: MailPurpose) {
    const record = await db.verificationToken.findUnique({
      where: { token: emailTokenHash(token) },
    });
    if (!record || record.expires.getTime() <= Date.now()) throw invalid();
    const [kind, id, version, emailDigest] = record.identifier.split(":");
    const user = id ? await db.user.findUnique({ where: { id } }) : null;
    if (
      kind !== purpose ||
      !user ||
      user.role !== "CUSTOMER" ||
      !user.passwordHash ||
      String(user.sessionVersion) !== version ||
      emailTokenHash(user.email || "") !== emailDigest
    )
      throw invalid();
    return { record, user };
  }
  async function consume(token: string, purpose: MailPurpose, password: string) {
    const { record, user } = await tokenUser(token, purpose);
    if (
      purpose === "verify" &&
      (user.emailVerified || !(await verifyPassword(password, user.passwordHash)))
    )
      throw invalid();
    const passwordHash = purpose === "reset" ? await hashPassword(password) : user.passwordHash;
    await db.$transaction(async (tx) => {
      const consumed = await tx.verificationToken.deleteMany({
        where: { token: record.token, expires: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw invalid();
      // Compare-and-swap ensures simultaneous links cannot both change credentials.
      const updated = await tx.user.updateMany({
        where: {
          id: user.id,
          email: user.email,
          role: "CUSTOMER",
          sessionVersion: user.sessionVersion,
          passwordHash: user.passwordHash,
        },
        data: { passwordHash, emailVerified: new Date(), sessionVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw invalid();
      await tx.verificationToken.deleteMany({
        where: {
          identifier: {
            in: [tokenIdentifier(user, "verify"), tokenIdentifier(user, "reset")],
          },
        },
      });
    });
    if (purpose === "reset") await notifyChanged(user);
  }
  return {
    async signup(input: { name: string; email: string; password: string }) {
      // Always derive a hash, including duplicate addresses.
      const passwordHash = await hashPassword(input.password);
      if (await find(input.email)) return;
      let user: User;
      try {
        user = await db.user.create({
          data: { name: input.name, email: input.email, passwordHash, role: "CUSTOMER" },
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") return;
        throw error;
      }
      await issue(user, "verify");
    },
    async signin(email: string, password: string) {
      const user = await find(email);
      const valid = await verifyPassword(
        password,
        user?.role === "CUSTOMER" ? user.passwordHash : null,
      );
      if (!valid || !user)
        throw new PasswordAuthError(
          "Email or password is incorrect. If you registered with Google or Apple, use that option.",
        );
      if (!user.emailVerified)
        throw new PasswordAuthError(
          "Verify your email before signing in. You can request another verification email below.",
        );
      return passwordSession(user);
    },
    async request(email: string, purpose: MailPurpose) {
      const user = await find(email);
      if (
        user?.role === "CUSTOMER" &&
        user.passwordHash &&
        (purpose === "reset" || !user.emailVerified)
      )
        await issue(user, purpose);
    },
    verify: (token: string, password: string) => consume(token, "verify", password),
    reset: (token: string, password: string) => consume(token, "reset", password),
    async change(userId: string, currentPassword: string, password: string) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (
        !user ||
        user.role !== "CUSTOMER" ||
        !user.emailVerified ||
        !(await verifyPassword(currentPassword, user.passwordHash))
      )
        throw new PasswordAuthError(
          "Your current password is incorrect. Social accounts must use their original sign-in provider.",
        );
      if (currentPassword === password)
        throw new PasswordAuthError("Choose a different new password.");
      const passwordHash = await hashPassword(password);
      const updated = await db.user.updateMany({
        where: {
          id: user.id,
          email: user.email,
          role: "CUSTOMER",
          sessionVersion: user.sessionVersion,
          passwordHash: user.passwordHash,
        },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new PasswordAuthError("Your account changed. Please sign in again.");
      await notifyChanged(user);
      return passwordSession({ ...user, sessionVersion: user.sessionVersion + 1 });
    },
  };
}
