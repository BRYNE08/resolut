import { createHmac } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import { PasswordAuthError } from "./password-service.server.ts";

export async function enforcePasswordRateLimit(
  db: PrismaClient,
  secret: string,
  scope: string,
  identity: string,
  ip: string,
) {
  for (const [bucket, limit, seconds] of [
    [`ip:${ip}`, 60, 900],
    [`${scope}:${identity}`, scope === "signin" ? 8 : 3, scope === "signin" ? 900 : 3600],
  ] as const) {
    const key = createHmac("sha256", secret).update(bucket).digest("hex");
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "AuthRateLimit" ("key", "count", "expiresAt") VALUES (${key}, 1, NOW() + ${seconds} * INTERVAL '1 second')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "AuthRateLimit"."expiresAt" <= NOW() THEN 1 ELSE "AuthRateLimit"."count" + 1 END,
        "expiresAt" = CASE WHEN "AuthRateLimit"."expiresAt" <= NOW() THEN NOW() + ${seconds} * INTERVAL '1 second' ELSE "AuthRateLimit"."expiresAt" END
      RETURNING "count"`;
    if (rows[0].count > limit)
      throw new PasswordAuthError("Too many attempts. Please wait before trying again.");
  }
}
