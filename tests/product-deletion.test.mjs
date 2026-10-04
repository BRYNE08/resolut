import assert from "node:assert/strict";
import { test } from "node:test";
import { createPrismaRepository } from "../src/lib/data/prisma-repository.server.ts";
import { createMockRepository } from "../src/lib/data/mock-repository.ts";

function fixture(orderCount = 0, product = { id: "p1" }) {
  const events = [];
  const tx = {
    $queryRaw: async () => { events.push("lock"); return []; },
    product: {
      findUnique: async () => product,
      delete: async ({ where }) => { assert.equal(where.id, "p1"); events.push("delete"); },
    },
    orderItem: { count: async () => orderCount },
    cartItem: {
      deleteMany: async ({ where }) => { assert.equal(where.productId, "p1"); events.push("clear carts"); },
    },
  };
  return {
    events,
    repo: createPrismaRepository({ $transaction: async (callback) => callback(tx) }),
  };
}

test("permanently deletes a product and clears carts inside its transaction", async () => {
  const { repo, events } = fixture();
  assert.deepEqual(await repo.deleteProduct("lamp"), { ok: true });
  assert.deepEqual(events, ["lock", "clear carts", "delete"]);
});

test("preserves products linked to orders and their cart entries", async () => {
  const { repo, events } = fixture(1);
  await assert.rejects(repo.deleteProduct("lamp"), /linked to existing orders/);
  assert.deepEqual(events, ["lock"]);
});

test("repeated deletion succeeds when the product is already gone", async () => {
  const { repo, events } = fixture(0, null);
  assert.deepEqual(await repo.deleteProduct("missing"), { ok: true });
  assert.deepEqual(events, ["lock"]);
});

test("mock deletion removes cart entries and frees the slug for reuse", async () => {
  const repo = createMockRepository();
  const input = { slug: "permanent-delete-test", name: "Test lamp", tagline: "Lighting", intro: "A lamp", price: 100 };
  const product = await repo.createProduct(input);
  await repo.setCartItem("deletion-cart", product.slug, 1);
  await repo.deleteProduct(product.slug);
  assert.equal(await repo.getProduct(product.slug), null);
  assert.deepEqual(await repo.getCart("deletion-cart"), {});
  const replacement = await repo.createProduct(input);
  assert.equal(replacement.slug, product.slug);
  await repo.deleteProduct(replacement.slug);
  await assert.rejects(repo.deleteProduct("cornice"), /linked to existing orders/);
});
