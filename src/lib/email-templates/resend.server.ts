/** Server-only Resend transport. Never include provider response bodies in errors. */
export type ResendMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
};

type DeliveryFailureCode =
  | "configuration"
  | "network_or_timeout"
  | "provider_rejected"
  | "invalid_response";
export class EmailDeliveryError extends Error {
  code: DeliveryFailureCode;
  status?: number;
  constructor(code: DeliveryFailureCode, message: string, status?: number) {
    super(message);
    this.name = "EmailDeliveryError";
    this.code = code;
    this.status = status;
  }
}

/** Only local error categories/status codes are safe for server logs. */
export function emailFailureDetails(error: unknown) {
  return error instanceof EmailDeliveryError
    ? { code: error.code, status: error.status }
    : { code: "template_or_configuration" };
}

export function emailConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env["RESEND_API_KEY"]?.trim() && env["EMAIL_FROM"]?.trim());
}

export async function sendResendEmail(
  message: ResendMessage,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<{ sent: true }> {
  if (!emailConfigured(env))
    throw new EmailDeliveryError("configuration", "RESEND_API_KEY and EMAIL_FROM are required.");
  let response: Response;
  try {
    response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env["RESEND_API_KEY"]!.trim()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey || crypto.randomUUID(),
      },
      body: JSON.stringify({
        from: env["EMAIL_FROM"]!.trim(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new EmailDeliveryError("network_or_timeout", "Email delivery could not be confirmed.");
  }
  // Delivery failures must propagate; callers decide whether to offer a resend.
  if (!response.ok)
    throw new EmailDeliveryError(
      "provider_rejected",
      `Email provider rejected the request (HTTP ${response.status}).`,
      response.status,
    );
  const data: unknown = await response.json().catch(() => null);
  if (
    !data ||
    typeof data !== "object" ||
    !("id" in data) ||
    typeof data.id !== "string" ||
    !data.id
  ) {
    throw new EmailDeliveryError(
      "invalid_response",
      "Email provider returned an invalid response.",
    );
  }
  // Accepted by Resend, not proof that the recipient's mailbox has received it.
  return { sent: true };
}
