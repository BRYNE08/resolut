/**
 * PayFast (payfast.io) hosted checkout — server only.
 *
 * We never touch card or bank numbers: we sign a payment request, redirect the
 * buyer to PayFast's own page, and wait for the ITN (Instant Transaction
 * Notification) callback to mark the order paid.
 *
 * Credentials come from the environment. With none set we fall back to
 * PayFast's public sandbox merchant so the flow is testable end to end.
 */
import { createHash } from "crypto";
import { privateOrderUrl } from "../auth/order-access.server.ts";

/** PayFast's documented sandbox merchant — safe to ship as a default. */
const SANDBOX = {
  merchantId: "10000100",
  merchantKey: "46f0cd694581a",
  passphrase: "jt7NOE43FZPn",
};

export type PayfastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  /** true when running against sandbox.payfast.co.za */
  sandbox: boolean;
  processUrl: string;
  validateUrl: string;
};

export class PayfastConfigurationError extends Error {}

export function payfastConfig(): PayfastConfig {
  const merchantId = process.env["PAYFAST_MERCHANT_ID"]?.trim() ?? "";
  const merchantKey = process.env["PAYFAST_MERCHANT_KEY"]?.trim() ?? "";
  const passphrase = process.env["PAYFAST_PASSPHRASE"]?.trim() ?? "";
  const configured = Boolean(merchantId && merchantKey);
  if (Boolean(merchantId) !== Boolean(merchantKey)) {
    throw new PayfastConfigurationError("Set both PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY before starting checkout.");
  }
  const forced = process.env["PAYFAST_SANDBOX"]?.trim().toLowerCase();
  if (forced && forced !== "true" && forced !== "false") {
    throw new PayfastConfigurationError("PAYFAST_SANDBOX must be true or false.");
  }
  const sandbox = forced ? forced === "true" : !configured || merchantId === SANDBOX.merchantId;
  if (!sandbox && (!configured || merchantId === SANDBOX.merchantId)) {
    throw new PayfastConfigurationError("Live checkout requires live PayFast merchant credentials.");
  }
  const host = sandbox ? "sandbox.payfast.co.za" : "www.payfast.co.za";
  return {
    merchantId: configured ? merchantId : SANDBOX.merchantId,
    merchantKey: configured ? merchantKey : SANDBOX.merchantKey,
    passphrase: configured ? passphrase : SANDBOX.passphrase,
    sandbox,
    processUrl: `https://${host}/eng/process`,
    validateUrl: `https://${host}/eng/query/validate`,
  };
}

/** PayFast rejects localhost URLs; sandbox browser returns can use loopback IPs. */
export function checkoutOrigin(value: string, sandbox = payfastConfig().sandbox) {
  let url: URL;
  try { url = new URL(value); } catch {
    throw new PayfastConfigurationError("Set PUBLIC_SITE_URL to a valid site URL for checkout.");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new PayfastConfigurationError("PUBLIC_SITE_URL must be an HTTP or HTTPS site URL.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!sandbox && (local || url.protocol !== "https:")) {
    throw new PayfastConfigurationError("Live checkout requires a public HTTPS PUBLIC_SITE_URL.");
  }
  if (local) url.hostname = "127.0.0.1";
  return url.origin;
}

/**
 * PayFast signs with PHP's urlencode(): spaces become "+", hex digits are
 * uppercase, and !'()*@~ are escaped too (encodeURIComponent leaves those).
 */
function encode(value: string, trim = true) {
  return encodeURIComponent(trim ? value.trim() : value)
    .replace(/[!'()*~@]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+")
    .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

/**
 * Signature = md5 of the fields in the given order (empty ones skipped) with
 * the passphrase appended. Order matters, so always pass an array of pairs.
 */
export function signature(pairs: [string, string][], passphrase: string) {
  const body = pairs
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${k}=${encode(String(v))}`)
    .join("&");
  const withPass = passphrase ? `${body}&passphrase=${encode(passphrase)}` : body;
  return createHash("md5").update(withPass).digest("hex");
}

export type PayfastCheckout = {
  processUrl: string;
  sandbox: boolean;
  /** Ordered form fields — POST them to processUrl in this exact order. */
  fields: { name: string; value: string }[];
};

export function buildCheckout(input: {
  origin: string;
  reference: string;
  accessToken: string;
  amount: number;
  itemName: string;
  itemDescription?: string;
  customerName: string;
  email: string;
  phone?: string;
}): PayfastCheckout {
  const cfg = payfastConfig();
  const origin = checkoutOrigin(input.origin, cfg.sandbox);
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Invalid checkout amount.");
  const [firstName, ...rest] = input.customerName.trim().split(/\s+/);
  const returnUrl = new URL(privateOrderUrl(origin, input.reference, input.accessToken));
  returnUrl.searchParams.set("status", "complete");
  const cancelUrl = new URL(returnUrl);
  cancelUrl.searchParams.set("status", "cancelled");
  const pairs: [string, string][] = [
    ["merchant_id", cfg.merchantId],
    ["merchant_key", cfg.merchantKey],
    ["return_url", returnUrl.toString()],
    ["cancel_url", cancelUrl.toString()],
    ["notify_url", new URL(origin).hostname === "127.0.0.1" ? "" : `${origin}/api/public/payfast-itn`],
    ["name_first", (firstName ?? "").slice(0, 100)],
    ["name_last", rest.join(" ").slice(0, 100)],
    ["email_address", input.email.trim()],
    ["m_payment_id", input.reference],
    ["amount", input.amount.toFixed(2)],
    ["item_name", input.itemName.trim().slice(0, 100)],
    ["item_description", (input.itemDescription ?? "").trim().slice(0, 255)],
  ];
  const sig = signature(pairs, cfg.passphrase);
  return {
    processUrl: cfg.processUrl,
    sandbox: cfg.sandbox,
    fields: [...pairs, ["signature", sig] as [string, string]]
      .filter(([, v]) => v !== "")
      .map(([name, value]) => ({ name, value })),
  };
}

/** PayFast's published ITN source ranges (hostnames resolved at runtime). */
const ITN_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

export type ItnResult =
  | { ok: true; reference: string; status: "paid" | "cancelled"; amount: number; pfPaymentId: string }
  | { ok: false; reason: string };

/**
 * Verifies an ITN post: signature first, then a server-to-server confirmation
 * with PayFast so a forged callback can never flip an order to paid.
 */
export async function verifyItn(body: string): Promise<ItnResult> {
  const cfg = payfastConfig();
  const params = new URLSearchParams(body);
  const received = params.get("signature") ?? "";
  const pairs: [string, string][] = [];
  for (const [k, v] of params.entries()) if (k !== "signature") pairs.push([k, v]);

  // ITNs include empty fields in their signature and preserve posted values.
  // Checkout signatures use a different rule that skips empty fields.
  const parameterString = pairs.map(([key, value]) => `${key}=${encode(value, false)}`).join("&");
  const signedString = cfg.passphrase
    ? `${parameterString}&passphrase=${encode(cfg.passphrase, false)}`
    : parameterString;
  const expectedSignature = createHash("md5").update(signedString).digest("hex");
  if (!received || expectedSignature !== received) {
    return { ok: false, reason: "signature mismatch" };
  }

  const validation = await fetch(cfg.validateUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: parameterString,
    signal: AbortSignal.timeout(10_000),
  })
    .then((r) => r.ok ? r.text() : "")
    .catch(() => "");
  if (validation.trim() !== "VALID") {
    return { ok: false, reason: `PayFast validation returned "${validation.trim()}"` };
  }

  const reference = params.get("m_payment_id") ?? "";
  const paymentStatus = (params.get("payment_status") ?? "").toUpperCase();
  if (!reference) return { ok: false, reason: "missing m_payment_id" };
  if (params.get("merchant_id") !== cfg.merchantId) return { ok: false, reason: "merchant mismatch" };
  const amount = Number(params.get("amount_gross"));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "invalid amount_gross" };
  if (!["COMPLETE", "CANCELLED"].includes(paymentStatus)) return { ok: false, reason: "unsupported payment status" };
  if (!params.get("pf_payment_id")) return { ok: false, reason: "missing pf_payment_id" };

  return {
    ok: true,
    reference,
    status: paymentStatus === "COMPLETE" ? "paid" : "cancelled",
    amount,
    pfPaymentId: params.get("pf_payment_id") ?? "",
  };
}

export function isPayfastHost(host: string | null) {
  if (!host) return false;
  return ITN_HOSTS.some((h) => host === h || host.endsWith(".payfast.co.za"));
}
