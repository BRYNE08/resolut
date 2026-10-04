import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emailConfigured,
  sendResendEmail,
  emailFailureDetails,
  EmailDeliveryError,
} from "../src/lib/email-templates/resend.server.ts";
const env = { RESEND_API_KEY: "test-key-never-live", EMAIL_FROM: "Resolut <noreply@example.test>" };
const message = {
  to: "buyer@example.test",
  subject: "Verify email",
  html: '<a href="https://example.test/verify-email#token=private">Verify</a>',
  text: "Verify https://example.test/verify-email#token=private",
  replyTo: "support@example.test",
  idempotencyKey: "logical-send-1",
};

test("configuration requires a Resend key and sender, without a Lovable dependency", async () => {
  assert.equal(emailConfigured({}), false);
  assert.equal(emailConfigured({ ...env, EMAIL_FROM: " " }), false);
  assert.equal(emailConfigured({ LOVABLE_API_KEY: "old" }), false);
  assert.equal(emailConfigured(env), true);
  await assert.rejects(
    sendResendEmail(message, {}, () => {
      throw new Error("Must not send");
    }),
    /required/,
  );
});
test("sends existing HTML and plain text with server authentication and idempotency", async () => {
  const result = await sendResendEmail(message, env, async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer test-key-never-live");
    assert.equal(options.headers["Idempotency-Key"], message.idempotencyKey);
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), {
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: message.replyTo,
    });
    return Response.json({ id: "accepted-id" });
  });
  assert.deepEqual(result, { sent: true });
});
test("rate limits and provider errors never masquerade as successful delivery or expose bodies", async () => {
  for (const status of [401, 403, 422, 429, 500]) {
    await assert.rejects(
      sendResendEmail(message, env, async () =>
        Response.json({ message: "private-recipient-and-token" }, { status }),
      ),
      (error) => {
        assert.match(error.message, new RegExp(`HTTP ${status}`));
        assert.ok(!error.message.includes("private"));
        return true;
      },
    );
  }
});
test("network failures and malformed responses are safe failures", async () => {
  await assert.rejects(
    sendResendEmail(message, env, async () => {
      throw new Error("secret upstream payload");
    }),
    /could not be confirmed/,
  );
  for (const data of [null, {}, { id: "" }, { id: 42 }])
    await assert.rejects(
      sendResendEmail(message, env, async () => Response.json(data)),
      /invalid response/,
    );
});

test("delivery diagnostics expose categories and HTTP status, never raw error messages", () => {
  assert.deepEqual(emailFailureDetails(new Error("private-token-and-recipient")), {
    code: "template_or_configuration",
  });
  assert.deepEqual(
    emailFailureDetails(new EmailDeliveryError("provider_rejected", "private upstream body", 403)),
    { code: "provider_rejected", status: 403 },
  );
});
