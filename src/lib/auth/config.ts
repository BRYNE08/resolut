/** Public session shapes and customer provider availability. No secrets leave this module. */

export type UserRole = "customer" | "studio" | "admin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
  /** Provider currently proves ownership of this email, not just the account identity. */
  emailVerified?: boolean;
  sessionVersion?: number;
  hasPassword?: boolean;
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
  const origin = env["PUBLIC_SITE_URL"] || env["AUTH_URL"];
  const ready = Boolean(
    env["DATABASE_URL"] &&
    (env["AUTH_SECRET"]?.length ?? 0) >= 32 &&
    (env["NODE_ENV"] !== "production" || origin?.startsWith("https://")),
  );
  return [
    {
      id: "google",
      name: "Google",
      type: "oauth",
      configured: ready && Boolean(env["AUTH_GOOGLE_ID"] && env["AUTH_GOOGLE_SECRET"]),
    },
    {
      id: "apple",
      name: "Apple",
      type: "oauth",
      configured:
        ready &&
        Boolean(
          env["AUTH_APPLE_ID"] &&
          env["AUTH_APPLE_TEAM_ID"] &&
          env["AUTH_APPLE_KEY_ID"] &&
          env["AUTH_APPLE_PRIVATE_KEY"] &&
          (env["PUBLIC_SITE_URL"] || env["AUTH_URL"])?.startsWith("https://"),
        ),
    },
  ];
}

/** True when at least one customer identity provider is configured. */
export function isAuthConfigured(env: Record<string, string | undefined> = {}) {
  return (
    (env["AUTH_SECRET"]?.length ?? 0) >= 32 &&
    (Boolean(env["DATABASE_URL"]) || listProviders(env).some((p) => p.configured))
  );
}

export const AUTH_ROUTES = {
  signIn: "/signin",
  studioSignIn: "/admin/signin",
  signOut: "/",
  callback: "/api/auth/customer",
} as const;

export function canAccessStudio(session: Session) {
  return session?.user.role === "studio" || session?.user.role === "admin";
}
