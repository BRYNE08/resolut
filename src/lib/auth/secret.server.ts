import { randomBytes } from "node:crypto";

// Development sessions/links deliberately expire on a server restart.
let developmentSecret: string | undefined;

export function authSecret() {
  const secret = process.env["AUTH_SECRET"];
  if (secret && secret.length >= 32) return secret;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("AUTH_SECRET must contain at least 32 characters in production.");
  }
  return (developmentSecret ??= randomBytes(32).toString("hex"));
}
