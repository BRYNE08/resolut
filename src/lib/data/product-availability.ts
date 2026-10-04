/** Current catalogue policy: published, positively priced pieces are made to order. */
export class ProductAvailabilityError extends Error {}
export const MAX_PRODUCT_QUANTITY = 99;
export const MAX_ORDER_LINES = 100;
export type RequestedLine = { slug: string; quantity: number; expectedUnitPriceCents?: number };
export type AvailableProduct = { slug: string; published?: boolean; priceCents: number | null };

export function normalizeLines(lines: RequestedLine[], allowEmpty = false): RequestedLine[] {
  if (!Array.isArray(lines) || (!allowEmpty && !lines.length) || lines.length > MAX_ORDER_LINES) {
    throw new ProductAvailabilityError("Choose between 1 and 100 products before checking out.");
  }
  const merged = new Map<string, RequestedLine>();
  for (const line of lines) {
    if (
      !line ||
      typeof line.slug !== "string" ||
      !line.slug.trim() ||
      line.slug.length > 160 ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_PRODUCT_QUANTITY
    ) {
      throw new ProductAvailabilityError(
        "Choose a whole quantity between 1 and 99 for each product.",
      );
    }
    const previous = merged.get(line.slug);
    if (previous && previous.expectedUnitPriceCents !== line.expectedUnitPriceCents)
      throw new ProductAvailabilityError(
        "Product prices changed. Refresh your cart and review the total.",
      );
    const quantity = (previous?.quantity ?? 0) + line.quantity;
    if (quantity > MAX_PRODUCT_QUANTITY)
      throw new ProductAvailabilityError(
        "You can order at most 99 of each product. Reduce the quantity in your cart.",
      );
    merged.set(line.slug, { ...line, quantity });
  }
  return [...merged.values()];
}

export function validateProducts<T extends AvailableProduct>(
  lines: RequestedLine[],
  products: T[],
  checkPrice = false,
) {
  return lines.map((line) => {
    const product = products.find((product) => product.slug === line.slug);
    if (!product || product.published === false)
      throw new ProductAvailabilityError(
        "A product in your cart is no longer available. Remove it before continuing.",
      );
    if (!Number.isSafeInteger(product.priceCents) || product.priceCents! <= 0)
      throw new ProductAvailabilityError(
        "A product in your cart is not available to order yet. Remove it before continuing.",
      );
    if (
      checkPrice &&
      (!Number.isSafeInteger(line.expectedUnitPriceCents) ||
        line.expectedUnitPriceCents !== product.priceCents)
    )
      throw new ProductAvailabilityError(
        "A product price has changed. Refresh your cart and review the total before checking out.",
      );
    return { ...line, product };
  });
}
