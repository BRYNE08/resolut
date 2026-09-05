/**
 * Server-side session handling — an encrypted, http-only cookie.
 *
 * The cookie is sealed with AUTH_SECRET when it exists, and with a development
 * fallback key otherwise, so the flow is real either way: nobody reaches the
 * studio without signing in. Swap the three functions below for the Auth.js
 * session read/write once `@auth/core` is installed; every caller (server
 * functions, route gates, the `useSession()` hook) keeps working unchanged.
 */
import { getSession, updateSession, clearSession } from "@tanstack/react-start/server";

import type { Session, SessionUser } from "./config";

const COOKIE_NAME = "resolut_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
/** Only used when AUTH_SECRET is unset — sessions reset on redeploy, by design. */
const DEV_KEY = "resolut-development-session-key-change-me";

type Stored = { user?: SessionUser; expires?: string };

function sessionConfig() {
  const env = process.env as Record<string, string | undefined>;
  return {
    name: COOKIE_NAME,
    password: env["AUTH_SECRET"] || DEV_KEY,
    maxAge: MAX_AGE_SECONDS,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: (env["NODE_ENV"] ?? "development") === "production",
    },
  };
}

export type SessionResult = {
  session: Session;
  /** false while the session cookie is sealed with the development key. */
  live: boolean;
};

export async function readSession(): Promise<SessionResult> {
  const env = process.env as Record<string, string | undefined>;
  const live = Boolean(env["AUTH_SECRET"]);

  try {
    const stored = await getSession<Stored>(sessionConfig());
    const user = stored.data.user;
    const expires = stored.data.expires;

    if (!user || !expires || new Date(expires).getTime() < Date.now()) {
      return { session: null, live };
    }
    return { session: { user, expires }, live };
  } catch {
    // Tampered or stale cookie (e.g. AUTH_SECRET rotated) — treat as signed out.
    return { session: null, live };
  }
}

/** Writes the signed-in session cookie and returns the session it created. */
export async function startSession(user: SessionUser): Promise<Session> {
  const expires = new Date(Date.now() + MAX_AGE_SECONDS * 1000).toISOString();
  await updateSession<Stored>(sessionConfig(), { user, expires });
  return { user, expires };
}

export async function endSession(): Promise<void> {
  await clearSession(sessionConfig());
}
