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

export function payfastConfig(): PayfastConfig {
  const merchantId = process.env["PAYFAST_MERCHANT_ID"]?.trim() ?? "";
  const merchantKey = process.env["PAYFAST_MERCHANT_KEY"]?.trim() ?? "";
  const passphrase = process.env["PAYFAST_PASSPHRASE"]?.trim() ?? "";
  const configured = Boolean(merchantId && merchantKey);
  const forced = process.env["PAYFAST_SANDBOX"]?.trim();
  const sandbox = forced ? forced !== "false" : !configured;
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

/**
 * PayFast signs with PHP's urlencode(): spaces become "+", hex digits are
 * uppercase, and !'()*@~ are escaped too (encodeURIComponent leaves those).
 */
function encode(value: string) {
  return encodeURIComponent(value.trim())
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
  amount: number;
  itemName: string;
  itemDescription?: string;
  customerName: string;
  email: string;
  phone?: string;
}): PayfastCheckout {
  const cfg = payfastConfig();
  const [firstName, ...rest] = input.customerName.trim().split(/\s+/);
  const pairs: [string, string][] = [
    ["merchant_id", cfg.merchantId],
    ["merchant_key", cfg.merchantKey],
    ["return_url", `${input.origin}/order/${input.reference}?status=complete`],
    ["cancel_url", `${input.origin}/order/${input.reference}?status=cancelled`],
    ["notify_url", `${input.origin}/api/public/payfast-itn`],
    ["name_first", firstName ?? ""],
    ["name_last", rest.join(" ")],
    ["email_address", input.email],
    ["cell_number", input.phone ?? ""],
    ["m_payment_id", input.reference],
    ["amount", input.amount.toFixed(2)],
    ["item_name", input.itemName],
    ["item_description", input.itemDescription ?? ""],
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

  if (!received || signature(pairs, cfg.passphrase) !== received) {
    return { ok: false, reason: "signature mismatch" };
  }

  const validation = await fetch(cfg.validateUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
    .then((r) => r.text())
    .catch(() => "");
  if (!validation.trim().toUpperCase().startsWith("VALID")) {
    return { ok: false, reason: `PayFast validation returned "${validation.trim()}"` };
  }

  const reference = params.get("m_payment_id") ?? "";
  const paymentStatus = (params.get("payment_status") ?? "").toUpperCase();
  if (!reference) return { ok: false, reason: "missing m_payment_id" };

  return {
    ok: true,
    reference,
    status: paymentStatus === "COMPLETE" ? "paid" : "cancelled",
    amount: Number(params.get("amount_gross") ?? 0),
    pfPaymentId: params.get("pf_payment_id") ?? "",
  };
}

export function isPayfastHost(host: string | null) {
  if (!host) return false;
  return ITN_HOSTS.some((h) => host === h || host.endsWith(".payfast.co.za"));
}
