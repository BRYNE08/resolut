import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Checkout = one server call. It saves the order (status `await`), clears the
 * server cart, and hands back a signed PayFast payment request for the browser
 * to POST. No bank or card data ever reaches this app.
 */
const checkoutSchema = z.object({
  customerName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7).optional(),
  addressLine: z.string().min(5).max(160),
  addressLine2: z.string().max(160).optional(),
  suburb: z.string().max(80).optional(),
  city: z.string().min(2).max(80),
  province: z.string().min(2).max(60),
  postalCode: z.string().regex(/^\d{4}$/),
  country: z.string().min(2).max(60).default("South Africa"),
  deliveryNotes: z.string().max(500).optional(),
  lines: z
    .array(z.object({ slug: z.string().min(1), quantity: z.number().int().min(1).max(99) }))
    .min(1),
});

function siteOrigin() {
  const configured = process.env["PUBLIC_SITE_URL"] ?? process.env["AUTH_URL"];
  if (configured) return configured.replace(/\/$/, "");
  return new URL(getRequest().url).origin;
}

export const startPayfastCheckout = createServerFn({ method: "POST" })
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data }) => {
    const { getRepository } = await import("@/lib/data/repository.server");
    const { ensureCartId } = await import("@/lib/data/cart-session.server");
    const { buildCheckout } = await import("@/lib/payments/payfast.server");

    const repo = await getRepository();
    const order = await repo.createOrder(data);

    // The order is persisted, so the cart's job is done.
    await repo.clearCart(await ensureCartId()).catch(() => undefined);

    const itemName =
      order.lines.length === 1
        ? `Resolut ${order.lines[0]!.name}`
        : `Resolut order ${order.reference}`;

    const payment = buildCheckout({
      origin: siteOrigin(),
      reference: order.reference,
      amount: order.total,
      itemName,
      itemDescription: order.lines.map((l) => `${l.quantity} x ${l.name}`).join(", "),
      customerName: order.customerName,
      email: order.email,
      phone: data.phone,
    });

    return { source: repo.name, order, payment };
  });

/** Order lookup by reference — used by the confirmation page to poll status. */
export const fetchOrder = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ reference: z.string().min(3) }).parse(input))
  .handler(async ({ data }) => {
    const { getRepository } = await import("@/lib/data/repository.server");
    const repo = await getRepository();
    const order = await repo.getOrder(data.reference);
    return { source: repo.name, order };
  });
