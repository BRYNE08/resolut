import { getSession, updateSession, clearSession } from "@tanstack/react-start/server";
import type { Session, SessionUser } from "./config";
import { authSecret } from "./secret.server";

type Audience = "customer" | "studio";
type Stored = { user?: SessionUser; expires?: string };
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sessionConfig(audience: Audience) {
  return {
    name: `resolut_${audience}_session`,
    sessionHeader: false as const,
    password: authSecret(),
    maxAge: MAX_AGE_SECONDS,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure:
        process.env["NODE_ENV"] === "production" ||
        (process.env["PUBLIC_SITE_URL"] || process.env["AUTH_URL"])?.startsWith("https://") ===
          true,
    },
  };
}

export type SessionResult = { session: Session; live: boolean };

async function read(audience: Audience): Promise<SessionResult> {
  const live = (process.env["AUTH_SECRET"]?.length ?? 0) >= 32;
  try {
    const stored = await getSession<Stored>(sessionConfig(audience));
    const { user, expires } = stored.data;
    if (!user || !expires || !(Date.parse(expires) > Date.now())) return { session: null, live };
    if (audience === "studio") {
      if (user.role !== "studio" && user.role !== "admin") return { session: null, live };
      return { session: { user, expires }, live };
    }
    if (user.role !== "customer") return { session: null, live };
    // A deleted or promoted account cannot retain a customer session until cookie expiry.
    const { getPrisma } = await import("../data/prisma.server");
    const db = await getPrisma();
    if (!db) return { session: null, live };
    const current = await db.user.findUnique({ where: { id: user.id } });
    if (
      !current ||
      current.role !== "CUSTOMER" ||
      current.email !== user.email ||
      current.sessionVersion !== (user.sessionVersion ?? 0)
    ) {
      return { session: null, live };
    }
    return {
      session: {
        user: {
          ...user,
          hasPassword: Boolean(current.passwordHash),
          name: current.name || "Customer",
          image: current.image ?? undefined,
          emailVerified: user.emailVerified === true && Boolean(current.emailVerified),
        },
        expires,
      },
      live,
    };
  } catch {
    return { session: null, live };
  }
}

/** Customer-facing APIs never accept the independent staff session. */
export const readSession = () => read("customer");
export const readStudioSession = () => read("studio");

async function start(user: SessionUser, audience: Audience): Promise<Session> {
  const expires = new Date(Date.now() + MAX_AGE_SECONDS * 1000).toISOString();
  const config = sessionConfig(audience);
  const stored = await getSession<Stored>(config);
  // Rotate the sealed session rather than re-reading an inbound cookie after clearSession.
  stored.id = crypto.randomUUID();
  stored.createdAt = Date.now();
  stored.data = {};
  await updateSession<Stored>(config, { user, expires });
  return { user, expires };
}

export async function startSession(user: SessionUser) {
  if (user.role !== "customer") throw new Error("Customer session required.");
  return start(user, "customer");
}

export async function startStudioSession(user: SessionUser) {
  if (user.role !== "studio" && user.role !== "admin") throw new Error("Studio session required.");
  return start(user, "studio");
}

export const endSession = () => clearSession(sessionConfig("customer"));
export const endStudioSession = () => clearSession(sessionConfig("studio"));
