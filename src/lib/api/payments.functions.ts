import { ProductAvailabilityError } from "../data/product-availability";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
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
    .array(
      z.object({
        slug: z.string().min(1).max(100),
        quantity: z.number().int().min(1).max(99),
        expectedUnitPriceCents: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(100),
});

function siteOrigin() {
  const configured = process.env["PUBLIC_SITE_URL"] || process.env["AUTH_URL"];
  if (configured) return configured.replace(/\/$/, "");
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("PUBLIC_SITE_URL is required for checkout return links.");
  }
  return new URL(getRequest().url).origin;
}

export const startPayfastCheckout = createServerFn({ method: "POST" })
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data }) => {
    const { getRepository } = await import("@/lib/data/repository.server");
    const { ensureCartId } = await import("@/lib/data/cart-session.server");
    const { buildCheckout, checkoutOrigin, PayfastConfigurationError } = await import("@/lib/payments/payfast.server");
    const { issueOrderAccessToken } = await import("@/lib/auth/order-access.server");
    const { authSecret } = await import("@/lib/auth/secret.server");
    const { readSession } = await import("@/lib/auth/session.server");

    setResponseHeader("Cache-Control", "private, no-store");
    authSecret();
    let origin: string;
    try {
      origin = checkoutOrigin(siteOrigin());
    } catch (error) {
      if (error instanceof PayfastConfigurationError) {
        return { ok: false as const, message: error.message };
      }
      throw error;
    }

    const repo = await getRepository();
    const { session } = await readSession();
    let order;
    try {
      order = await repo.createOrder({ ...data, userId: session?.user.id });
    } catch (error) {
      if (error instanceof ProductAvailabilityError)
        return { ok: false as const, message: error.message };
      throw error;
    }

    const itemName =
      order.lines.length === 1
        ? `Resolut ${order.lines[0]!.name}`
        : `Resolut order ${order.reference}`;

    const payment = buildCheckout({
      origin,
      reference: order.reference,
      accessToken: issueOrderAccessToken(order.reference),
      amount: order.total,
      itemName,
      itemDescription: order.lines.map((l) => `${l.quantity} x ${l.name}`).join(", "),
      customerName: order.customerName,
      email: order.email,
      phone: data.phone,
    });

    // Clear the cart only after the payment request has been built successfully.
    await repo.clearCart(await ensureCartId()).catch(() => undefined);

    return { ok: true as const, source: repo.name, order, payment };
  });

/** POST keeps guest credentials out of request URLs and intermediary caches. */
export const fetchOrder = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reference: z.string().min(3).max(80),
        accessToken: z.string().max(128).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { getRepository } = await import("@/lib/data/repository.server");
    const { readSession, readStudioSession } = await import("@/lib/auth/session.server");
    const { readAccessibleOrder } = await import("@/lib/auth/order-access.server");
    const repo = await getRepository();
    const [customer, studio] = await Promise.all([readSession(), readStudioSession()]);
    const session = studio.session ?? customer.session;
    const order = await readAccessibleOrder(repo, data.reference, session, data.accessToken);
    return { source: repo.name, order };
  });
