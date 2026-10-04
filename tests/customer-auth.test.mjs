import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { customerReturnPath, isCustomerProvider } from "../src/lib/auth/customer-auth.ts";
import { validOAuthState } from "../src/lib/auth/oauth-state.server.ts";
import {
  verifyCustomerIdentity,
  resolveCustomer,
} from "../src/lib/auth/customer-identity.server.ts";
import { canReadOrder } from "../src/lib/auth/order-access.server.ts";
import { verifyCredentials } from "../src/lib/auth/credentials.server.ts";
import { listProviders } from "../src/lib/auth/config.ts";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "test-key" }] });
const now = Math.floor(Date.now() / 1000);

async function token(provider = "google", claims = {}, signingKey = privateKey) {
  return new SignJWT({
    iss: provider === "google" ? "https://accounts.google.com" : "https://appleid.apple.com",
    aud: "our-client",
    sub: "provider-subject",
    iat: now,
    exp: now + 300,
    nonce: "browser-nonce",
    email: "buyer@gmail.com",
    email_verified: true,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(signingKey);
}

test("accepts correctly signed Google and Apple identities and handles relay emails", async () => {
  for (const provider of ["google", "apple"]) {
    const email = provider === "google" ? "buyer@gmail.com" : "hidden@privaterelay.appleid.com";
    const identity = await verifyCustomerIdentity(
      provider,
      await token(provider, { email, email_verified: provider === "apple" ? "true" : true }),
      "our-client",
      "browser-nonce",
      jwks,
    );
    assert.equal(identity.subject, "provider-subject");
    assert.equal(identity.email, email);
    assert.equal(identity.emailOwnershipVerified, true);
  }
});

test("rejects invalid signature, issuer, audience, nonce, expiry and unverified email", async () => {
  const invalidClaims = [
    { iss: "https://attacker.invalid" },
    { aud: "another-client" },
    { nonce: "other-browser" },
    { exp: now - 30 },
    { email_verified: false },
    { email_verified: "false" },
    { email: "not-an-email" },
    { sub: "" },
    { sub: 123 },
    { aud: ["our-client", "other-client"] },
    { azp: "another-client" },
    { iat: now - 1000 },
  ];
  for (const claims of invalidClaims) {
    const signed = await token("google", claims);
    await assert.rejects(() =>
      verifyCustomerIdentity("google", signed, "our-client", "browser-nonce", jwks),
    );
  }
  const attacker = await generateKeyPair("RS256");
  const forged = await token("google", {}, attacker.privateKey);
  await assert.rejects(() =>
    verifyCustomerIdentity("google", forged, "our-client", "browser-nonce", jwks),
  );
});

test("Google third-party emails cannot claim historical purchases by email", async () => {
  const identity = await verifyCustomerIdentity(
    "google",
    await token("google", { email: "buyer@external.example" }),
    "our-client",
    "browser-nonce",
    jwks,
  );
  assert.equal(identity.emailOwnershipVerified, false);
  const workspace = await verifyCustomerIdentity(
    "google",
    await token("google", { email: "buyer@company.example", hd: "company.example" }),
    "our-client",
    "browser-nonce",
    jwks,
  );
  assert.equal(workspace.emailOwnershipVerified, true);
});

test("OAuth state is browser-bound and expires, including future timestamps", () => {
  const flow = { state: "random-state", nonce: "nonce", verifier: "pkce", createdAt: 1_000_000 };
  assert.equal(validOAuthState(flow, "random-state", 1_000_001), true);
  assert.equal(validOAuthState(flow, "other-state", 1_000_001), false);
  assert.equal(validOAuthState(flow, null, 1_000_001), false);
  assert.equal(validOAuthState(flow, "random-state", 1_600_000), false);
  assert.equal(validOAuthState(flow, "random-state", 999_999), false);
  assert.equal(validOAuthState({}, "random-state", 1_000_001), false);
});

test("return destinations cannot escape to external, API or admin routes", () => {
  for (const path of [
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "/admin",
    "/admin/signin",
    "/api/auth/customer/google/callback",
    "/%2f%2fattacker.example",
    "/checkout\n",
    "/signin",
  ]) {
    assert.equal(customerReturnPath(path), "/account", path);
  }
  assert.equal(customerReturnPath("/checkout"), "/checkout");
  assert.equal(customerReturnPath("/order/RSL-123#access=token"), "/order/RSL-123#access=token");
  assert.equal(isCustomerProvider("admin"), false);
  assert.equal(isCustomerProvider("apple"), true);
});

function fakeDatabase() {
  const users = [];
  const accounts = [];
  const tx = {
    account: {
      findUnique: async ({ where }) => {
        const { provider, providerAccountId } = where.provider_providerAccountId;
        const account = accounts.find(
          (a) => a.provider === provider && a.providerAccountId === providerAccountId,
        );
        return account ? { ...account, user: users.find((u) => u.id === account.userId) } : null;
      },
    },
    user: {
      findFirst: async ({ where }) =>
        users.find((u) => u.email.toLowerCase() === where.email.equals.toLowerCase()) ?? null,
      create: async ({ data }) => {
        const { accounts: nested, ...fields } = data;
        const user = { ...fields, id: `user-${users.length + 1}` };
        users.push(user);
        accounts.push({ ...nested.create, userId: user.id });
        return user;
      },
    },
  };
  return { db: { $transaction: (run) => run(tx) }, users, accounts };
}

const identity = {
  provider: "google",
  subject: "google-1",
  email: "buyer@gmail.com",
  emailOwnershipVerified: true,
  name: "Buyer",
};

test("first provider login creates a customer; subsequent logins reuse the provider subject", async () => {
  const { db, users, accounts } = fakeDatabase();
  const first = await resolveCustomer(db, identity);
  const second = await resolveCustomer(db, { ...identity, email: "new@gmail.com" });
  assert.equal(first.role, "customer");
  assert.equal(second.id, first.id);
  assert.equal(
    second.email,
    first.email,
    "a provider email change must not silently change account ownership",
  );
  assert.equal(second.emailVerified, false);
  assert.equal(users.length, 1);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].access_token, undefined, "provider tokens are not retained");
});

test("matching emails never automatically link a second provider or grant staff roles", async () => {
  const { db, users } = fakeDatabase();
  await resolveCustomer(db, identity);
  await assert.rejects(
    () => resolveCustomer(db, { ...identity, provider: "apple", subject: "apple-1" }),
    (e) => e.code === "account_exists",
  );
  users[0].role = "ADMIN";
  await assert.rejects(
    () => resolveCustomer(db, identity),
    (e) => e.code === "failed",
  );
});

test("stable order ownership supports another checkout email and blocks competing accounts", () => {
  const session = {
    user: {
      id: "owner",
      email: "relay@privaterelay.appleid.com",
      role: "customer",
      emailVerified: true,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
  const linked = { reference: "RSL-private", userId: "owner", email: "delivery@example.com" };
  assert.equal(canReadOrder(linked, session), true);
  assert.equal(
    canReadOrder(linked, {
      ...session,
      user: { ...session.user, id: "other", email: linked.email },
    }),
    false,
  );
  const unverified = {
    ...session,
    user: { ...session.user, email: linked.email, emailVerified: false },
  };
  assert.equal(canReadOrder({ ...linked, userId: undefined }, unverified), false);
});

test("customer environment credentials cannot authenticate through staff login", () => {
  const saved = { email: process.env.CUSTOMER_EMAIL, password: process.env.CUSTOMER_PASSWORD };
  try {
    process.env.CUSTOMER_EMAIL = "customer-only@example.com";
    process.env.CUSTOMER_PASSWORD = "customer-secret";
    assert.equal(
      verifyCredentials(process.env.CUSTOMER_EMAIL, process.env.CUSTOMER_PASSWORD),
      null,
    );
  } finally {
    if (saved.email === undefined) delete process.env.CUSTOMER_EMAIL;
    else process.env.CUSTOMER_EMAIL = saved.email;
    if (saved.password === undefined) delete process.env.CUSTOMER_PASSWORD;
    else process.env.CUSTOMER_PASSWORD = saved.password;
  }
});

test("social providers stay unavailable without persistent storage and secrets", () => {
  assert.ok(listProviders({}).every((p) => !p.configured));
  const env = {
    DATABASE_URL: "configured",
    AUTH_SECRET: "s".repeat(32),
    AUTH_GOOGLE_ID: "google-client",
    AUTH_GOOGLE_SECRET: "google-secret",
    AUTH_APPLE_ID: "apple-service",
    AUTH_APPLE_TEAM_ID: "team",
    AUTH_APPLE_KEY_ID: "key",
    AUTH_APPLE_PRIVATE_KEY: "private-key",
    PUBLIC_SITE_URL: "https://shop.example",
  };
  assert.ok(listProviders(env).every((p) => p.configured));
  assert.equal(
    listProviders({ ...env, PUBLIC_SITE_URL: "http://localhost:8080" }).find(
      (p) => p.id === "apple",
    ).configured,
    false,
  );
});
