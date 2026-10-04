import assert from "node:assert/strict";
import { test } from "node:test";
import { createPrismaRepository } from "../src/lib/data/prisma-repository.server.ts";

const input = { name: "Test Lamp", tagline: "Lighting", intro: "A lamp" };

function fixture(existing = [], onCreate = () => {}) {
  const rows = new Map(existing.map((slug) => [slug, { id: slug, slug, published: false }]));
  const attempts = [];
  const repo = createPrismaRepository({
    product: {
      findUnique: async ({ where }) => rows.get(where.slug) ?? null,
      create: async ({ data }) => {
        attempts.push(data.slug);
        await onCreate(data, rows);
        if (rows.has(data.slug)) throw Object.assign(new Error("Duplicate slug"), { code: "P2002" });
        const row = { ...data, id: data.slug, published: true };
        rows.set(data.slug, row);
        return row;
      },
    },
  });
  return { repo, rows, attempts };
}

test("normalizes slugs and suffixes duplicates, including unpublished products", async () => {
  const { repo, rows } = fixture(["test-lamp", "test-lamp-2"]);
  assert.equal((await repo.createProduct(input)).slug, "test-lamp-3");
  assert.equal((await repo.createProduct(input)).slug, "test-lamp-4");
  assert.equal(rows.get("test-lamp").published, false);
  assert.equal((await repo.createProduct({ ...input, slug: " Custom Slug! " })).slug, "custom-slug");
  assert.equal((await repo.createProduct({ ...input, slug: "Custom Slug" })).slug, "custom-slug-2");
});

test("retries a slug claimed between lookup and insertion", async () => {
  const { repo, attempts } = fixture([], (data, rows) => {
    if (data.slug === "test-lamp") rows.set(data.slug, { id: "concurrent", slug: data.slug });
  });
  assert.equal((await repo.createProduct(input)).slug, "test-lamp-2");
  assert.deepEqual(attempts, ["test-lamp", "test-lamp-2"]);
});

test("propagates unrelated unique constraints and database failures", async () => {
  for (const code of ["P2002", "P1001"]) {
    const error = Object.assign(new Error("Other database failure"), { code });
    const { repo, attempts } = fixture([], () => { throw error; });
    await assert.rejects(repo.createProduct(input), (actual) => actual === error);
    assert.deepEqual(attempts, ["test-lamp"]);
  }
});
