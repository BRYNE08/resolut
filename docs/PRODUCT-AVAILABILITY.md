# Product availability

## Policy

Published products with a positive price can be purchased as made-to-order items, including when ready stock or monthly capacity is zero. Ready stock and capacity are studio planning information, not purchase limits. Unpublished products are absent from public product lookup; published unpriced products remain visible for previews/waitlist signup.

## Enforcement

- Both repositories validate orders independently of the browser and API schema. Reject missing/hidden/unpriced products, invalid prices, empty orders, more than 100 submitted lines, and quantities outside whole numbers 1–99.
- Duplicate product lines combine into one order line. The total quantity per product cannot exceed 99, even across duplicate input lines.
- Checkout supplies the price shown to the customer in integer cents. The server compares this with the current catalogue price and always charges its own price. A mismatch returns an actionable response; checkout refreshes the catalogue and requires another customer submission.
- PostgreSQL locks requested product rows in sorted order using `FOR SHARE` inside the order transaction. Publication and price edits cannot slip between validation and order persistence. Rejected orders do not clear the cart or create partial orders.
- Cart writes reject unavailable products and invalid quantities. Whole-cart replacement validates before deleting existing rows and runs in a transaction. Removing an existing unavailable item remains possible. Existing unavailable cart entries are retained for explicit removal, rather than silently omitted from checkout.
- The cart page, drawer and checkout show unavailable-item messages and removal controls. Checkout remains blocked until those items are removed. Failed synchronization is visible to the customer.
- Prices retain cents through repository reads, cart calculations and display.

No schema upgrade or environment changes are required. Existing saved orders retain their original prices; this policy applies when creating a new order. Inventory reservation/decrement, production scheduling, payment retries/idempotency and delivery pricing are separate work. This change does not promise ready-stock reservation or a capacity-based delivery date.

## Checks

```sh
bun run test:availability
npx tsc --noEmit
npm run build
```

The unit suite exercises validation, duplicate lines, exact cents, stale cart entries, made-to-order behavior, and both repository adapters. The PostgreSQL integration test verifies all-or-nothing order creation, safe cart replacement and a concurrent unpublish before checkout. Use only an explicit disposable database; the suite creates/drops its own isolated schema and does not use `DATABASE_URL`:

```sh
AVAILABILITY_TEST_DATABASE_URL=postgresql://... bun test tests/product-availability.integration.test.mjs
```
