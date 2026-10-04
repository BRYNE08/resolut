/**
 * Credential accounts for the studio sign-in.
 *
 * Plug-and-play: with no environment set the two demo accounts below work, and
 * the sign-in page shows them. Set STUDIO_EMAIL / STUDIO_PASSWORD (and
 * optionally ADMIN_EMAIL / ADMIN_PASSWORD) to replace them, or swap the body of
 * `verifyCredentials()` for an Auth.js Credentials provider / Prisma user
 * lookup — every caller keeps working unchanged.
 */
import type { SessionUser } from "./config";

type Account = SessionUser & { password: string };

export const DEMO_ACCOUNTS: { email: string; password: string; role: string }[] = [
  { email: "studio@resolutdesign.co.za", password: "resolut-studio", role: "studio" },
  { email: "admin@resolutdesign.co.za", password: "resolut-admin", role: "admin" },
];

function accounts(env: Record<string, string | undefined>): Account[] {
  const list: Account[] = [];

  if (env["STUDIO_EMAIL"] && env["STUDIO_PASSWORD"]) {
    list.push({
      id: "studio-user",
      name: env["STUDIO_NAME"] ?? "Studio",
      email: env["STUDIO_EMAIL"].toLowerCase(),
      password: env["STUDIO_PASSWORD"],
      role: "studio",
    });
  }
  if (env["ADMIN_EMAIL"] && env["ADMIN_PASSWORD"]) {
    list.push({
      id: "admin-user",
      name: env["ADMIN_NAME"] ?? "Administrator",
      email: env["ADMIN_EMAIL"].toLowerCase(),
      password: env["ADMIN_PASSWORD"],
      role: "admin",
    });
  }

  if (list.length > 0) return list;

  if (env["NODE_ENV"] === "production") return [];

  // Demo accounts — only used while no credentials are configured.
  return [
    {
      id: "demo-studio-user",
      name: "R. Botha",
      email: DEMO_ACCOUNTS[0]!.email,
      password: DEMO_ACCOUNTS[0]!.password,
      role: "studio",
    },
    {
      id: "demo-admin-user",
      name: "Studio Admin",
      email: DEMO_ACCOUNTS[1]!.email,
      password: DEMO_ACCOUNTS[1]!.password,
      role: "admin",
    },
  ];
}

/** True once real credentials replace the demo accounts. */
export function hasRealAccounts(env: Record<string, string | undefined> = {}) {
  return Boolean(
    (env["STUDIO_EMAIL"] && env["STUDIO_PASSWORD"]) || (env["ADMIN_EMAIL"] && env["ADMIN_PASSWORD"]),
  );
}

/** Length-safe comparison so a wrong password never leaks timing information. */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyCredentials(email: string, password: string): SessionUser | null {
  const env = process.env as Record<string, string | undefined>;
  const wanted = email.trim().toLowerCase();

  for (const account of accounts(env)) {
    if (account.email === wanted && sameSecret(account.password, password)) {
      const { password: _password, ...user } = account;
      return user;
    }
  }
  return null;
}
