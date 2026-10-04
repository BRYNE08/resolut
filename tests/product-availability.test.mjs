import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeLines, validateProducts } from "../src/lib/data/product-availability.ts";
import { createMockRepository } from "../src/lib/data/mock-repository.ts";
import { createPrismaRepository } from "../src/lib/data/prisma-repository.server.ts";
import { priceCart } from "../src/lib/store/cart-store.ts";
import { ZAR } from "../src/lib/money.ts";

const line = { slug: "lamp", quantity: 1, expectedUnitPriceCents: 12345 };
const product = {
  id: "p1",
  slug: "lamp",
  published: true,
  priceCents: 12345,
  readyStock: 0,
  capacity: 0,
};
const customer = {
  customerName: "Buyer",
  email: "buyer@example.test",
  addressLine: "123 Road",
  city: "Cape Town",
  province: "Western Cape",
  postalCode: "8000",
  lines: [line],
};
test("rejects empty, oversized and invalid orders and aggregates duplicate quantities", () => {
  for (const lines of [
    [],
    Array(101).fill(line),
    [{ ...line, quantity: 0 }],
    [{ ...line, quantity: -1 }],
    [{ ...line, quantity: 1.5 }],
    [{ ...line, quantity: NaN }],
    [{ ...line, quantity: 100 }],
    [{ ...line, slug: "" }],
    [
      { ...line, quantity: 60 },
      { ...line, quantity: 40 },
    ],
  ])
    assert.throws(() => normalizeLines(lines));
  assert.deepEqual(normalizeLines([line, { ...line, quantity: 2 }]), [{ ...line, quantity: 3 }]);
  assert.throws(() => normalizeLines([line, { ...line, expectedUnitPriceCents: 100 }]));
});
test("blocks missing, hidden, unpriced and invalid prices; zero stock remains made to order", () => {
  for (const products of [
    [],
    [{ ...product, published: false }],
    ...[null, 0, -1, NaN, Infinity, 1.5].map((priceCents) => [{ ...product, priceCents }]),
  ])
    assert.throws(() => validateProducts([line], products, true));
  assert.equal(validateProducts([line], [product], true)[0].product.readyStock, 0);
  assert.throws(
    () => validateProducts([{ ...line, expectedUnitPriceCents: 12000 }], [product], true),
    /price has changed/,
  );
  assert.throws(
    () => validateProducts([{ slug: "lamp", quantity: 1 }], [product], true),
    /price has changed/,
  );
});
test("cart pricing reports unavailable lines and displays exact cents", () => {
  const cart = priceCart({ lamp: 2, hidden: 1, soon: 1 }, [
    { slug: "lamp", name: "Lamp", price: 123.45, image: "" },
    { slug: "soon", name: "Soon", price: null, image: "" },
  ]);
  assert.deepEqual(cart.unavailableSlugs, ["hidden", "soon"]);
  assert.equal(cart.subtotal, 246.9);
  assert.equal(ZAR(123.45), "R 123.45");
});
test("mock repository rejects entire invalid orders and leaves cart intact", async () => {
  const repo = createMockRepository();
  const p = await repo.createProduct({
    slug: "availability-test",
    name: "Test lamp",
    tagline: "Test",
    intro: "Test",
    price: 123.45,
    readyStock: 0,
    capacity: 0,
  });
  const requested = { ...line, slug: p.slug };
  await repo.setCartItem("test-cart", p.slug, 2);
  const before = (await repo.listOrders()).length;
  await assert.rejects(
    repo.createOrder({ ...customer, lines: [requested, { ...line, slug: "unknown" }] }),
  );
  assert.equal((await repo.listOrders()).length, before);
  assert.deepEqual(await repo.getCart("test-cart"), { [p.slug]: 2 });
  const order = await repo.createOrder({ ...customer, lines: [requested, requested] });
  assert.equal(order.lines.length, 1);
  assert.equal(order.total, 246.9);
  await repo.updateProduct(p.slug, { published: false });
  assert.equal(await repo.getProduct(p.slug), null);
  await assert.rejects(repo.setCartItem("test-cart", p.slug, 3));
  await assert.rejects(repo.createOrder({ ...customer, lines: [requested] }));
  assert.deepEqual(await repo.setCartItem("test-cart", p.slug, 0), {});
});
test("Prisma adapter validates before any order write and locks product rows inside its transaction", async () => {
  let products = [product],
    writes = 0,
    locks = 0,
    inTransaction = false;
  const tx = {
    product: { findMany: async () => products },
    $queryRaw: async () => {
      assert.equal(inTransaction, true);
      locks++;
      return [{ id: "p1" }];
    },
    order: {
      create: async ({ data }) => {
        writes++;
        return {
          ...data,
          createdAt: new Date(),
          items: data.items.create.map((item) => ({
            ...item,
            product: { slug: "lamp", name: "Lamp" },
          })),
        };
      },
    },
  };
  const repo = createPrismaRepository({
    ...tx,
    $transaction: async (callback, options) => {
      assert.deepEqual(options, { maxWait: 10_000, timeout: 15_000 });
      inTransaction = true;
      try {
        return await callback(tx);
      } finally {
        inTransaction = false;
      }
    },
  });
  for (const invalid of [
    [],
    [{ ...product, published: false }],
    [{ ...product, priceCents: null }],
    [{ ...product, priceCents: 999 }],
  ]) {
    products = invalid;
    await assert.rejects(repo.createOrder(customer));
    assert.equal(writes, 0);
  }
  products = [product];
  const order = await repo.createOrder({ ...customer, lines: [line, line] });
  assert.equal(writes, 1);
  assert.equal(order.total, 246.9);
  assert.equal(order.lines[0].quantity, 2);
  assert.ok(locks >= 5);
});
