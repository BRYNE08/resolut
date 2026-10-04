import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Order } from "../data/types";
import type { Session } from "./config";
import { authSecret } from "./secret.server.ts";

const LINK_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export function createOrderReference() {
  return `RSL-${randomBytes(12).toString("hex").toUpperCase()}`;
}

function digest(reference: string, expires: string) {
  return createHmac("sha256", authSecret())
    .update(JSON.stringify(["resolut-order-access-v1", reference, expires]))
    .digest();
}

export function issueOrderAccessToken(reference: string, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + LINK_LIFETIME_SECONDS);
  return `${expires}.${digest(reference, expires).toString("hex")}`;
}

export function verifyOrderAccessToken(reference: string, token?: string, now = Date.now()) {
  if (!token || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, signature] = token.split(".");
  if (Number(expires) <= Math.floor(now / 1000)) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), digest(reference, expires));
}

/** A reference is an identifier, never proof that the caller owns the order. */
export function canReadOrder(order: Order, session: Session, token?: string, now = Date.now()) {
  if (session && Date.parse(session.expires) > now) {
    if (session.user.role === "studio" || session.user.role === "admin") return true;
    if (order.userId && order.userId === session.user.id) return true;
    // Only unclaimed guest orders can be matched by a currently verified email.
    const email = session.user.email.trim().toLowerCase();
    if (
      !order.userId &&
      session.user.emailVerified === true &&
      email &&
      email === order.email.trim().toLowerCase()
    )
      return true;
  }
  return verifyOrderAccessToken(order.reference, token, now);
}

export async function readAccessibleOrder(
  repository: { getOrder(reference: string): Promise<Order | null> },
  reference: string,
  session: Session,
  token?: string,
) {
  const authenticated = session && Date.parse(session.expires) > Date.now();
  if (!authenticated && !verifyOrderAccessToken(reference, token)) return null;
  const order = await repository.getOrder(reference);
  return order && canReadOrder(order, session, token) ? order : null;
}

/** Fragment tokens are not sent in page requests, referrers or access logs. */
export function privateOrderUrl(
  origin: string,
  reference: string,
  token = issueOrderAccessToken(reference),
) {
  const url = new URL(`/order/${encodeURIComponent(reference)}`, origin);
  url.hash = new URLSearchParams({ access: token }).toString();
  return url.toString();
}
