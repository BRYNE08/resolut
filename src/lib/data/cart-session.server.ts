/**
 * Anonymous cart identity — a sealed, http-only cookie holding a cart id.
 *
 * No account is required: the first cart mutation mints an id and every
 * subsequent request reads it back. Sealed with AUTH_SECRET when present and
 * a development fallback otherwise, mirroring the auth session.
 */
import { getSession, updateSession } from "@tanstack/react-start/server";
import { randomUUID } from "crypto";

const COOKIE_NAME = "resolut_cart";
const MAX_AGE_SECONDS = 60 * 24 * 60 * 60; // 60 days
/** Only used when AUTH_SECRET is unset — carts reset on redeploy, by design. */
const DEV_KEY = "resolut-development-cart-key-change-me";

type Stored = { cartId?: string };

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

/** Returns the visitor's cart id, minting and sealing one on first use. */
export async function ensureCartId(): Promise<string> {
  try {
    const stored = await getSession<Stored>(sessionConfig());
    if (stored.data.cartId) return stored.data.cartId;
  } catch {
    // Tampered or stale cookie (e.g. AUTH_SECRET rotated) — mint a fresh cart.
  }
  const cartId = `cart_${randomUUID()}`;
  await updateSession<Stored>(sessionConfig(), { cartId });
  return cartId;
}
