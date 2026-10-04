import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canReadOrder,
  createOrderReference,
  issueOrderAccessToken,
  privateOrderUrl,
  readAccessibleOrder,
  verifyOrderAccessToken,
} from "../src/lib/auth/order-access.server.ts";
import { authSecret } from "../src/lib/auth/secret.server.ts";
import { verifyCredentials } from "../src/lib/auth/credentials.server.ts";
import { buildCheckout } from "../src/lib/payments/payfast.server.ts";

const order = {
  reference: "RSL-1184",
  email: "buyer@example.com",
  customerName: "Private buyer",
  shipping: { addressLine: "Private address" },
};
const session = (email, role = "customer", expires = Date.now() + 60_000) => ({
  user: { id: "account", email, role, emailVerified: true },
  expires: new Date(expires).toISOString(),
});

test("reference alone never grants access, including legacy short references", async () => {
  let reads = 0;
  const repository = {
    getOrder: async (reference) => {
      reads += 1;
      return reference === order.reference ? order : null;
    },
  };
  assert.equal(await readAccessibleOrder(repository, order.reference, null), null);
  assert.equal(await readAccessibleOrder(repository, "RSL-unknown", null), null);
  assert.equal(reads, 0, "unauthenticated reference guessing must not query the database");
  assert.equal(
    await readAccessibleOrder(repository, order.reference, session("other@example.com")),
    null,
  );
  assert.deepEqual(
    await readAccessibleOrder(repository, order.reference, session(order.email)),
    order,
  );
  assert.deepEqual(
    await readAccessibleOrder(
      repository,
      order.reference,
      null,
      issueOrderAccessToken(order.reference),
    ),
    order,
  );
});

test("owner and staff sessions are accepted; other or expired sessions are rejected", () => {
  assert.equal(canReadOrder(order, session(" BUYER@EXAMPLE.COM ")), true);
  assert.equal(canReadOrder(order, session("other@example.com")), false);
  assert.equal(canReadOrder(order, session("staff@example.com", "studio")), true);
  assert.equal(canReadOrder(order, session("staff@example.com", "admin")), true);
  assert.equal(canReadOrder(order, session(order.email, "customer", Date.now() - 1000)), false);
  assert.equal(canReadOrder(order, { ...session(order.email), expires: "invalid" }), false);
});

test("guest tokens are order-bound, signed and expire at the 30-day boundary", () => {
  const now = 1_800_000_000_000;
  const token = issueOrderAccessToken(order.reference, now);
  assert.equal(verifyOrderAccessToken(order.reference, token, now), true);
  assert.equal(verifyOrderAccessToken("RSL-another-order", token, now), false);
  const [expires, signature] = token.split(".");
  assert.equal(
    verifyOrderAccessToken(order.reference, `${Number(expires) + 1}.${signature}`, now),
    false,
  );
  const tampered = `${expires}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  assert.equal(verifyOrderAccessToken(order.reference, tampered, now), false);
  assert.equal(verifyOrderAccessToken(order.reference, token, Number(expires) * 1000 - 1), true);
  assert.equal(verifyOrderAccessToken(order.reference, token, Number(expires) * 1000), false);
  for (const invalid of [
    undefined,
    "",
    "123",
    `${expires}.xx`,
    `${token}.extra`,
    "x".repeat(200),
  ]) {
    assert.equal(verifyOrderAccessToken(order.reference, invalid, now), false);
  }
});

test("private links keep tokens in the fragment, outside page requests", () => {
  const url = new URL(privateOrderUrl("https://shop.example", order.reference));
  assert.equal(url.pathname, `/order/${order.reference}`);
  assert.equal(url.search, "");
  const token = new URLSearchParams(url.hash.slice(1)).get("access");
  assert.equal(verifyOrderAccessToken(order.reference, token), true);
});

test("PayFast return and cancel URLs preserve guest access; notification URL has no token", () => {
  const accessToken = issueOrderAccessToken(order.reference);
  const payment = buildCheckout({
    origin: "https://shop.example",
    reference: order.reference,
    accessToken,
    amount: 100,
    itemName: "Lamp",
    customerName: "Buyer",
    email: order.email,
  });
  const fields = Object.fromEntries(payment.fields.map(({ name, value }) => [name, value]));
  for (const [field, status] of [
    ["return_url", "complete"],
    ["cancel_url", "cancelled"],
  ]) {
    const url = new URL(fields[field]);
    assert.equal(url.searchParams.get("status"), status);
    assert.equal(new URLSearchParams(url.hash.slice(1)).get("access"), accessToken);
    assert.equal(url.searchParams.has("access"), false);
  }
  assert.equal(fields.notify_url, "https://shop.example/api/public/payfast-itn");
});

test("new references have 96 bits of randomness and do not repeat in a sample", () => {
  const references = Array.from({ length: 1000 }, createOrderReference);
  assert.equal(new Set(references).size, references.length);
  assert.ok(references.every((reference) => /^RSL-[A-F0-9]{24}$/.test(reference)));
});

test("production cannot use demo accounts or a missing/short signing secret; rotation revokes tokens", () => {
  const keys = [
    "NODE_ENV",
    "AUTH_SECRET",
    "STUDIO_EMAIL",
    "STUDIO_PASSWORD",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "CUSTOMER_EMAIL",
    "CUSTOMER_PASSWORD",
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = "production";
    assert.throws(authSecret, /AUTH_SECRET/);
    process.env.AUTH_SECRET = "short";
    assert.throws(() => issueOrderAccessToken(order.reference), /AUTH_SECRET/);
    process.env.AUTH_SECRET = "a".repeat(32);
    const token = issueOrderAccessToken(order.reference);
    assert.equal(verifyOrderAccessToken(order.reference, token), true);
    process.env.AUTH_SECRET = "b".repeat(32);
    assert.equal(verifyOrderAccessToken(order.reference, token), false);
    assert.equal(verifyCredentials("admin@resolutdesign.co.za", "resolut-admin"), null);
    assert.equal(verifyCredentials("customer@example.com", "resolut-customer"), null);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
