import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { createPrismaRepository } from "../src/lib/data/prisma-repository.server.ts";
const url = process.env.AVAILABILITY_TEST_DATABASE_URL;
test(
  "PostgreSQL availability enforcement and concurrent catalogue edits",
  { skip: !url },
  async () => {
    const schema = `availability_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const setup = new Client({ connectionString: scoped.href });
    await setup.connect();
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: scoped.href }, { schema }),
    });
    try {
      await setup.query(await readFile(new URL("../prisma/init.sql", import.meta.url), "utf8"));
      const repo = createPrismaRepository(db);
      await repo.createProduct({
        slug: "lamp",
        name: "Lamp",
        tagline: "Test",
        intro: "Test",
        price: 123.45,
        readyStock: 0,
        capacity: 0,
      });
      const input = {
        customerName: "Buyer",
        email: "buyer@example.test",
        addressLine: "123 Road",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8000",
        lines: [{ slug: "lamp", quantity: 1, expectedUnitPriceCents: 12345 }],
      };
      await repo.setCartItem("cart", "lamp", 1);
      await assert.rejects(
        repo.createOrder({
          ...input,
          lines: [...input.lines, { slug: "missing", quantity: 1, expectedUnitPriceCents: 100 }],
        }),
      );
      assert.equal(await db.order.count(), 0);
      assert.deepEqual(await repo.getCart("cart"), { lamp: 1 });
      const order = await repo.createOrder({ ...input, lines: [...input.lines, ...input.lines] });
      assert.equal(order.total, 246.9);
      assert.equal(order.lines.length, 1);
      // Hold an uncommitted publication edit; checkout must wait and see the committed state.
      await setup.query("BEGIN");
      await setup.query('UPDATE "Product" SET "published" = false WHERE slug = $1', ["lamp"]);
      let releaseStarted;
      const started = new Promise((resolve) => {
        releaseStarted = resolve;
      });
      const instrumented = {
        ...db,
        $transaction: (callback) =>
          db.$transaction((tx) =>
            callback(
              new Proxy(tx, {
                get(target, key) {
                  if (key === "$queryRaw")
                    return (...args) => {
                      releaseStarted();
                      return target.$queryRaw(...args);
                    };
                  const value = target[key];
                  return typeof value === "function" ? value.bind(target) : value;
                },
              }),
            ),
          ),
      };
      const attempted = createPrismaRepository(instrumented).createOrder(input);
      const rejected = assert.rejects(attempted, /no longer available/);
      await started;
      await setup.query("COMMIT");
      await rejected;
      assert.equal(await db.order.count(), 1);
      assert.equal(await repo.getProduct("lamp"), null);
      await assert.rejects(repo.setCart("cart", { missing: 1 }));
      assert.deepEqual(await repo.getCart("cart"), { lamp: 1 });
      assert.deepEqual(await repo.setCartItem("cart", "lamp", 0), {});
    } finally {
      await setup.query("ROLLBACK");
      await db.$disconnect();
      await setup.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
