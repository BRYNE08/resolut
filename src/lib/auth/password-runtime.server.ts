import { emailConfigured, emailFailureDetails } from "../email-templates/resend.server";
import { enforcePasswordRateLimit } from "./password-rate-limit.server";
import { isIP } from "node:net";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";
import type { PrismaClient } from "../../generated/prisma/client";
import { getPrisma } from "../data/prisma.server";
import { authSecret } from "./secret.server";
import { passwordService, PasswordAuthError, type AuthMailer } from "./password-service.server";

export async function passwordRuntime(scope: string, identity: string, mailRequired = false) {
  const db = (await getPrisma()) as PrismaClient | null;
  if (!db || (process.env["AUTH_SECRET"]?.length ?? 0) < 32)
    throw new PasswordAuthError(
      "Account sign-in is temporarily unavailable. Please try again later.",
    );
  const origin = process.env["PUBLIC_SITE_URL"] || process.env["AUTH_URL"];
  if (
    mailRequired &&
    (!emailConfigured() ||
      !origin ||
      (process.env["NODE_ENV"] === "production" && !origin.startsWith("https://")))
  )
    throw new PasswordAuthError(
      "Account emails are temporarily unavailable. Please try again later.",
    );
  // Configure only a header your reverse proxy overwrites; never trust arbitrary forwarded input.
  const header = process.env["AUTH_TRUSTED_IP_HEADER"];
  const candidate = header ? getRequest().headers.get(header) : getRequestIP();
  const ip = candidate && isIP(candidate) ? candidate : "unknown";
  await enforcePasswordRateLimit(db, authSecret(), scope, identity, ip);
  // Bound retention of hashed abuse keys and expired email tokens.
  if (Math.random() < 0.01) {
    await db.authRateLimit.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
    });
    await db.verificationToken.deleteMany({ where: { expires: { lt: new Date() } } });
  }
  const mail: AuthMailer = async (email, purpose, token) => {
    const { sendTemplateEmail } = await import("../email-templates/send-email");
    try {
      if (!origin || !emailConfigured()) throw new Error("Email unavailable");
      const url = new URL(
        purpose === "changed"
          ? "/forgot-password"
          : purpose === "verify"
            ? "/verify-email"
            : "/reset-password",
        origin,
      );
      if (token) url.hash = `token=${token}`;
      await sendTemplateEmail("customer-auth", email, { templateData: { purpose, url: url.href } });
    } catch (error) {
      // Never log raw tokens, recipient addresses, provider responses or secrets.
      console.error(
        "[auth] Customer authentication email delivery failed.",
        emailFailureDetails(error),
      );
    }
  };
  return passwordService(db, mail);
}

export async function publicAuthAction<T>(
  action: () => Promise<T>,
  concealTiming = false,
): Promise<T> {
  const started = Date.now();
  try {
    return await action();
  } catch (error) {
    if (error instanceof PasswordAuthError) throw error;
    console.error("[auth] Customer password operation failed.");
    throw new Error("This request could not be completed. Please try again later.");
  } finally {
    if (concealTiming)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 1200 - (Date.now() - started))),
      );
  }
}
