/**
 * Auth.js configuration — shaped exactly the way `@auth/core` / NextAuth
 * expects, but not yet wired to a live provider. Nothing here performs network
 * calls, so the app runs with zero credentials.
 *
 * To go live:
 *   1. bun add @auth/core @auth/prisma-adapter
 *   2. set AUTH_SECRET plus provider credentials (see .env.example)
 *   3. in src/lib/auth/session.server.ts, replace `readDemoSession()` with the
 *      Auth.js session read — the rest of the app already consumes `Session`.
 */

export type UserRole = "customer" | "studio" | "admin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
};

export type Session = {
  user: SessionUser;
  expires: string;
} | null;

export type ProviderDescriptor = {
  id: string;
  name: string;
  type: "oauth" | "email" | "credentials";
  configured: boolean;
};

/** Which providers the deployment has credentials for. */
export function listProviders(env: Record<string, string | undefined> = {}): ProviderDescriptor[] {
  return [
    {
      id: "google",
      name: "Google",
      type: "oauth",
      configured: Boolean(env["AUTH_GOOGLE_ID"] && env["AUTH_GOOGLE_SECRET"]),
    },
    {
      id: "github",
      name: "GitHub",
      type: "oauth",
      configured: Boolean(env["AUTH_GITHUB_ID"] && env["AUTH_GITHUB_SECRET"]),
    },
    {
      id: "resend",
      name: "Email link",
      type: "email",
      configured: Boolean(env["AUTH_RESEND_KEY"]),
    },
  ];
}

/** True once Auth.js has enough configuration to run for real. */
export function isAuthConfigured(env: Record<string, string | undefined> = {}) {
  return Boolean(env["AUTH_SECRET"]) && listProviders(env).some((p) => p.configured);
}

export const AUTH_ROUTES = {
  signIn: "/admin",
  signOut: "/",
  callback: "/api/auth/callback",
} as const;

export function canAccessStudio(session: Session) {
  return session?.user.role === "studio" || session?.user.role === "admin";
}
