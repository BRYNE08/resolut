import assert from "node:assert/strict";
import { test } from "node:test";
import { createMockRepository } from "../src/lib/data/mock-repository.ts";
import { createPieceSchema, updatePieceSchema } from "../src/lib/api/admin.schemas.ts";

test("gallery survives creation and edits, with cover and detail images synchronized", async () => {
  const repo = createMockRepository();
  const piece = await repo.createProduct({ name: "Gallery test", tagline: "Test lighting", intro: "Test piece", images: ["/first.jpg", "/second.jpg", "/third.jpg"] });
  try {
    assert.equal(piece.image, "/first.jpg");
    assert.equal(piece.detailImage, "/second.jpg");
    const renamed = await repo.updateProduct(piece.slug, { name: "Renamed gallery" });
    assert.deepEqual(renamed.images, piece.images);
    const reordered = await repo.updateProduct(piece.slug, { images: ["/third.jpg", "/first.jpg"] });
    assert.equal(reordered.image, "/third.jpg");
    assert.equal(reordered.detailImage, "/first.jpg");
    const cleared = await repo.updateProduct(piece.slug, { images: [] });
    assert.deepEqual(cleared.images, []);
    assert.equal(cleared.image, "/resolut/placeholder.svg");
    assert.equal(cleared.detailImage, cleared.image);
  } finally { await repo.deleteProduct(piece.slug); }
});

test("validates gallery limits and preserves legacy single-image input", () => {
  const input = { name: "Lamp", tagline: "Test lighting", intro: "Test piece" };
  assert.equal(createPieceSchema.parse({ ...input, image: "/legacy.jpg" }).image, "/legacy.jpg");
  assert.throws(() => createPieceSchema.parse({ ...input, images: Array(11).fill("/image.jpg") }));
  assert.throws(() => updatePieceSchema.parse({ slug: "lamp", images: [""] }));
  assert.deepEqual(updatePieceSchema.parse({ slug: "lamp", images: [] }).images, []);
});
