import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { passwordService } from "../src/lib/auth/password-service.server.ts";
import { enforcePasswordRateLimit } from "../src/lib/auth/password-rate-limit.server.ts";
import { emailTokenHash, hashPassword } from "../src/lib/auth/password-crypto.server.ts";

// Explicit opt-in; never loads .env or falls back to the application's DATABASE_URL.
const connectionString = process.env.AUTH_TEST_DATABASE_URL;
test(
  "password authentication against isolated PostgreSQL",
  { skip: !connectionString },
  async (t) => {
    const schema = `auth_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new Client({ connectionString });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const scopedUrl = new URL(connectionString);
    scopedUrl.searchParams.set("options", `-c search_path=${schema}`);
    const setup = new Client({ connectionString: scopedUrl.href });
    await setup.connect();
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: scopedUrl.href }, { schema }),
    });
    try {
      await setup.query(await readFile(new URL("../prisma/init.sql", import.meta.url), "utf8"));
      // Exercise upgrading pre-password tables and preserving an existing customer.
      await setup.query(
        'ALTER TABLE "User" DROP COLUMN "passwordHash", DROP COLUMN "sessionVersion"',
      );
      await setup.query('DROP TABLE "AuthRateLimit"');
      await setup.query(
        `INSERT INTO "User" (id, email, role) VALUES ('existing', 'legacy@example.test', 'CUSTOMER')`,
      );
      const upgrade = await readFile(
        new URL("../prisma/updates/20260927_customer_password_auth.sql", import.meta.url),
        "utf8",
      );
      await setup.query(upgrade);
      await setup.query(upgrade);
      assert.equal((await db.user.findUnique({ where: { id: "existing" } })).sessionVersion, 0);
      const mail = [];
      const service = passwordService(db, async (email, purpose, token) => {
        mail.push({ email, purpose, token });
      });
      const password = "cedar river moonlight home";
      const nextPassword = "another garden peaceful evening";
      const input = { name: "Buyer", email: "buyer@example.test", password };
      await t.test(
        "registration requires verification and never overwrites duplicates",
        async () => {
          await service.signup(input);
          const original = await db.user.findUnique({ where: { email: input.email } });
          assert.equal(original.role, "CUSTOMER");
          assert.equal(original.emailVerified, null);
          const record = await db.verificationToken.findUnique({
            where: { token: emailTokenHash(mail[0].token) },
          });
          assert.ok(record);
          assert.notEqual(record.token, mail[0].token);
          await assert.rejects(service.signin(input.email, password), /Verify your email/);
          await service.signup({ ...input, password: nextPassword });
          assert.equal(
            (await db.user.findUnique({ where: { email: input.email } })).passwordHash,
            original.passwordHash,
          );
          assert.equal(mail.length, 1);
          await assert.rejects(service.verify(mail[0].token, nextPassword), /invalid or expired/);
          await service.verify(mail[0].token, password);
          await assert.rejects(service.verify(mail[0].token, password), /invalid or expired/);
          assert.equal((await service.signin(input.email, password)).emailVerified, true);
        },
      );
      await t.test("invalid credentials do not reveal whether an account exists", async () => {
        let known, unknown;
        try {
          await service.signin(input.email, "wrong");
        } catch (e) {
          known = e.message;
        }
        try {
          await service.signin("missing@example.test", "wrong");
        } catch (e) {
          unknown = e.message;
        }
        assert.equal(known, unknown);
      });
      await t.test(
        "reset tokens enforce purpose, expiry and exactly one concurrent use",
        async () => {
          const before = await service.signin(input.email, password);
          await service.request(input.email, "reset");
          const expired = mail.at(-1).token;
          await db.verificationToken.update({
            where: { token: emailTokenHash(expired) },
            data: { expires: new Date(0) },
          });
          await assert.rejects(service.reset(expired, nextPassword), /invalid or expired/);
          await service.request(input.email, "reset");
          const token = mail.at(-1).token;
          await assert.rejects(service.verify(token, password), /invalid or expired/);
          const results = await Promise.allSettled([
            service.reset(token, nextPassword),
            service.reset(token, nextPassword),
          ]);
          assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
          await assert.rejects(service.signin(input.email, password), /incorrect/);
          const current = await service.signin(input.email, nextPassword);
          assert.equal(current.sessionVersion, before.sessionVersion + 1);
          await assert.rejects(service.reset(token, password), /invalid or expired/);
        },
      );
      await t.test(
        "changing a password requires the old password and invalidates old links and sessions",
        async () => {
          const before = await service.signin(input.email, nextPassword);
          await service.request(input.email, "reset");
          const token = mail.at(-1).token;
          await assert.rejects(service.change(before.id, "wrong", password), /incorrect/);
          const current = await service.change(before.id, nextPassword, password);
          assert.equal(current.sessionVersion, before.sessionVersion + 1);
          await assert.rejects(service.reset(token, nextPassword), /invalid or expired/);
          await assert.rejects(service.signin(input.email, nextPassword), /incorrect/);
          assert.ok(await service.signin(input.email, password));
        },
      );
      await t.test(
        "email recovery can repair an unverified signup without trusting its original password",
        async () => {
          await service.signup({ ...input, email: "unverified@example.test" });
          const verification = mail.at(-1).token;
          await service.request("unverified@example.test", "reset");
          await service.reset(mail.at(-1).token, nextPassword);
          assert.ok(await service.signin("unverified@example.test", nextPassword));
          await assert.rejects(service.verify(verification, password), /invalid or expired/);
        },
      );
      await t.test(
        "social and staff identities cannot obtain passwords or customer sessions",
        async () => {
          await db.user.create({
            data: { email: "social@example.test", role: "CUSTOMER", emailVerified: new Date() },
          });
          await db.user.create({
            data: {
              email: "staff@example.test",
              role: "ADMIN",
              passwordHash: await hashPassword(password),
              emailVerified: new Date(),
            },
          });
          const count = mail.length;
          for (const email of [
            "social@example.test",
            "staff@example.test",
            "missing@example.test",
          ]) {
            await service.request(email, "reset");
            await service.request(email, "verify");
            await service.signup({ ...input, email });
            if (email !== "missing@example.test")
              await assert.rejects(service.signin(email, password), /incorrect/);
          }
          assert.equal(mail.length, count + 1); // Only the deliberately new signup sends mail.
          assert.equal(
            (await db.user.findUnique({ where: { email: "social@example.test" } })).passwordHash,
            null,
          );
        },
      );
      await t.test("email changes invalidate outstanding tokens", async () => {
        await service.signup({ ...input, email: "before@example.test" });
        const token = mail.at(-1).token;
        await db.user.update({
          where: { email: "before@example.test" },
          data: { email: "after@example.test" },
        });
        await assert.rejects(service.verify(token, password), /invalid or expired/);
      });
      await t.test("rate limits are atomic, expire, and never persist raw identities", async () => {
        const attempts = await Promise.allSettled(
          Array.from({ length: 10 }, () =>
            enforcePasswordRateLimit(
              db,
              "test-secret",
              "signin",
              "limited@example.test",
              "192.0.2.1",
            ),
          ),
        );
        assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 8);
        assert.equal(attempts.filter((result) => result.status === "rejected").length, 2);
        const rows = await db.authRateLimit.findMany();
        assert.equal(rows.length, 2);
        for (const row of rows) assert.match(row.key, /^[a-f0-9]{64}$/);
        await db.authRateLimit.updateMany({ data: { expiresAt: new Date(0) } });
        await enforcePasswordRateLimit(
          db,
          "test-secret",
          "signin",
          "limited@example.test",
          "192.0.2.1",
        );
        assert.ok((await db.authRateLimit.findMany()).every((row) => row.count === 1));
      });
    } finally {
      await db.$disconnect();
      await setup.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
