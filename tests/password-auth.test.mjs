import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hashPassword,
  verifyPassword,
  newEmailToken,
  emailTokenHash,
} from "../src/lib/auth/password-crypto.server.ts";
import {
  customerSignupSchema,
  customerPasswordSigninSchema,
  resetPasswordSchema,
} from "../src/lib/auth/password.schemas.ts";

const password = "cedar river moonlight home";
test("passwords use independent salts and reject incorrect, missing and malformed hashes", async () => {
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password + " ", first), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(await verifyPassword(password, "scrypt$999999999$8$3$garbage"), false);
});
test("signup normalizes emails, preserves password whitespace and checks confirmation", () => {
  const input = {
    name: " Buyer ",
    email: " BUYER@Example.COM ",
    password: ` ${password} `,
    confirmPassword: ` ${password} `,
  };
  const data = customerSignupSchema.parse(input);
  assert.equal(data.email, "buyer@example.com");
  assert.equal(data.name, "Buyer");
  assert.equal(data.password, input.password);
  for (const bad of ["short", "a".repeat(16), "passwordpassword", "x".repeat(129)])
    assert.equal(
      customerSignupSchema.safeParse({ ...input, password: bad, confirmPassword: bad }).success,
      false,
    );
  assert.equal(
    customerSignupSchema.safeParse({ ...input, confirmPassword: "different" }).success,
    false,
  );
  assert.equal(
    customerPasswordSigninSchema.parse({ email: input.email, password: "old" }).password,
    "old",
  );
});
test("email tokens have strong random values and reject malformed submissions", () => {
  const first = newEmailToken();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, newEmailToken());
  assert.notEqual(emailTokenHash(first), first);
  assert.equal(
    resetPasswordSchema.safeParse({ token: "bad", password, confirmPassword: password }).success,
    false,
  );
});
