import * as React from "react";
import { render } from "@react-email/render";
import { sendResendEmail } from "./resend.server";
import { TEMPLATES } from "./registry";

// Server-only: renders existing templates and sends through Resend.
export type SendTemplateEmailResult = { sent: true };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, unknown>;
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string;
  replyTo?: string;
}

/** Render HTML and plain text using the shared template registry. */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  return sendResendEmail({
    to: recipient,
    subject,
    html,
    text,
    idempotencyKey: options.idempotencyKey,
    replyTo: options.replyTo,
  });
}
