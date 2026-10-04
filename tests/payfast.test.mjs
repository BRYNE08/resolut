import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { buildCheckout, checkoutOrigin, payfastConfig, signature, verifyItn } from "../src/lib/payments/payfast.server.ts";

const keys = ["PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY", "PAYFAST_PASSPHRASE", "PAYFAST_SANDBOX"];
const input = {
  origin: "https://shop.example.test", reference: "RSL-test", accessToken: "token",
  amount: 123.45, itemName: "Test lamp", customerName: "Test Buyer", email: "buyer@example.test",
};

test("PayFast checkout configuration, signed form and ITN validation", async () => {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(payfastConfig().sandbox, true);
    const local = buildCheckout({ ...input, origin: "http://localhost:5173" });
    const fields = Object.fromEntries(local.fields.map(({ name, value }) => [name, value]));
    assert.equal(new URL(fields.return_url).hostname, "127.0.0.1");
    assert.equal(fields.notify_url, undefined);
    assert.equal(new URLSearchParams(new URL(fields.return_url).hash.slice(1)).get("access"), "token");
    const publicCheckout = buildCheckout({ ...input, itemDescription: "a".repeat(300), phone: "+27 12 345 6789" });
    const posted = publicCheckout.fields.map(({ name, value }) => [name, value]);
    assert.equal(posted.find(([key]) => key === "item_description")[1].length, 255);
    assert.equal(posted.find(([key]) => key === "notify_url")[1], `${input.origin}/api/public/payfast-itn`);
    assert.equal(posted.at(-1)[1], signature(posted.slice(0, -1), payfastConfig().passphrase));
    process.env.PAYFAST_SANDBOX = "false";
    assert.throws(() => payfastConfig(), /live PayFast merchant credentials/);
    process.env.PAYFAST_MERCHANT_ID = "12345678";
    assert.throws(() => payfastConfig(), /both PAYFAST/);
    process.env.PAYFAST_MERCHANT_KEY = "test-key";
    assert.throws(() => checkoutOrigin("http://localhost:5173"), /public HTTPS/);
    for (const key of keys) delete process.env[key];

    const pairs = [
      ["merchant_id", "10000100"], ["m_payment_id", "RSL-test"],
      ["pf_payment_id", "12345"], ["payment_status", "COMPLETE"], ["amount_gross", "123.45"],
    ];
    const notification = (values) => new URLSearchParams([...values, ["signature", signature(values, payfastConfig().passphrase)]]).toString();
    let validationCalls = 0;
    globalThis.fetch = async (url, options) => {
      validationCalls++;
      assert.equal(url, payfastConfig().validateUrl);
      assert.equal(new URLSearchParams(options.body).has("signature"), false);
      return new Response("VALID");
    };
    assert.equal((await verifyItn(notification(pairs))).ok, true);
    assert.equal(validationCalls, 1);
    const completePairs = [...pairs, ["item_description", ""], ["custom_str1", ""], ["name_first", " Test Buyer "]];
    const completeBody = new URLSearchParams(completePairs).toString();
    const completeSignature = createHash("md5")
      .update(`${completeBody}&passphrase=${encodeURIComponent(payfastConfig().passphrase)}`)
      .digest("hex");
    assert.equal((await verifyItn(`${completeBody}&signature=${completeSignature}`)).ok, true);
    assert.equal(validationCalls, 2);
    const badSignature = new URLSearchParams(notification(pairs));
    badSignature.set("signature", "bad");
    assert.equal((await verifyItn(badSignature.toString())).ok, false);
    assert.equal(validationCalls, 2);
    const invalidAmount = pairs.map(([key, value]) => [key, key === "amount_gross" ? "NaN" : value]);
    assert.equal((await verifyItn(notification(invalidAmount))).ok, false);
    globalThis.fetch = async () => new Response("VALID-looking failure");
    assert.equal((await verifyItn(notification(pairs))).ok, false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
