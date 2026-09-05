import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server-side cart — the datastore owns the cart, the browser only holds the
 * sealed cart-id cookie. Works with the in-memory adapter out of the box and
 * switches to the database automatically once DATABASE_URL is set.
 */

export const fetchCart = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureCartId } = await import("@/lib/data/cart-session.server");
  const { getRepository } = await import("@/lib/data/repository.server");
  const cartId = await ensureCartId();
  const repo = await getRepository();
  return { source: repo.name, items: await repo.getCart(cartId) };
});

export const setCartItem = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1), quantity: z.number().int().min(0).max(99) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureCartId } = await import("@/lib/data/cart-session.server");
    const { getRepository } = await import("@/lib/data/repository.server");
    const cartId = await ensureCartId();
    const repo = await getRepository();
    return { source: repo.name, items: await repo.setCartItem(cartId, data.slug, data.quantity) };
  });

/** Merges a legacy localStorage cart into the server cart (additive). */
export const syncCart = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ items: z.record(z.string(), z.number().int().min(1).max(99)) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureCartId } = await import("@/lib/data/cart-session.server");
    const { getRepository } = await import("@/lib/data/repository.server");
    const cartId = await ensureCartId();
    const repo = await getRepository();
    const merged = await repo.getCart(cartId);
    Object.entries(data.items).forEach(([slug, qty]) => {
      merged[slug] = Math.min(99, (merged[slug] ?? 0) + qty);
    });
    return { source: repo.name, items: await repo.setCart(cartId, merged) };
  });

export const clearCart = createServerFn({ method: "POST" }).handler(async () => {
  const { ensureCartId } = await import("@/lib/data/cart-session.server");
  const { getRepository } = await import("@/lib/data/repository.server");
  const cartId = await ensureCartId();
  const repo = await getRepository();
  return repo.clearCart(cartId);
});
