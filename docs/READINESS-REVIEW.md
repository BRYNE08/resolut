# Resolut application readiness review

Reviewed 26 September 2026. Scope: application routes, storefront and studio components, server functions, authentication, repositories, database schema/setup, payments, email, uploads, configuration, and project documentation. Generated Prisma files and generic UI primitives were treated as supporting infrastructure.

Implementation update: private order access now requires a matching customer session, staff authorization, or an expiring signed guest link. New references are random; checkout and future order emails provide private links. See [ORDER-ACCESS.md](ORDER-ACCESS.md) for configuration, compatibility and remaining deployment checks. The findings below describe the original review baseline; distributed rate limiting remains follow-up work.

This is a source review, not certification of the deployed application. TypeScript and lint were run; live database, payment, email, browser accessibility, and hosting behavior were not exercised. Environment secrets were not read. Recommendations below follow the checked-in implementation; hosting-level controls may exist separately.

Authentication update: customer email/password registration, verification, recovery, password changes, Google/Apple sign-in and signup, a separate staff login/session, and stable user-ID ownership for new signed-in purchases are implemented. The additive database upgrade, email/provider credentials and live delivery/provider testing are still required; see [AUTHENTICATION.md](AUTHENTICATION.md).

Product availability update: public product lookup hides unpublished products. Both repositories reject invalid or unpriced order lines, empty orders, stale price snapshots and aggregate quantities above 99 per product. Checkout creates the full validated order or rejects it without clearing the cart. Product rows are locked during database order creation to coordinate concurrent publication/price edits. See [PRODUCT-AVAILABILITY.md](PRODUCT-AVAILABILITY.md). Ready stock and monthly capacity remain informational: the agreed policy permits made-to-order purchases at zero ready stock.

## Assessment

Resolut has a substantial storefront and studio foundation, but needs commerce correctness and operational work before accepting public orders. Build on the existing implementation rather than replacing it.

Already implemented:

- Collection filtering/sorting, product pages, cart drawer, cart page, and guest checkout.
- PayFast hosted checkout, signed requests, notification verification, and order polling.
- Encrypted cookie sessions, server-side studio role checks, and CSRF middleware for server functions.
- Customer order history and a saved contact/delivery profile.
- Studio product editing/uploads, order status changes, production jobs, waitlist/messages views, and CSV exports.
- PostgreSQL repository, order confirmation/status email templates, and basic error handling/reporting.

## P0: resolve before accepting public payments

| Work | Evidence and current gap | Completion criteria |
| --- | --- | --- |
| Protect customer order details | `src/lib/api/payments.functions.ts` exposes `fetchOrder` without authorization. `prisma-repository.server.ts` returns names, emails, phone numbers and delivery addresses, and generates references from the last six timestamp digits. | Require account ownership or a high-entropy guest access token. Public tracking must not disclose personal data. Use collision-resistant references; rate-limit lookups. Verify one buyer cannot retrieve another buyer's order. |
| Enforce production configuration | `credentials.server.ts` falls back to published demo credentials; `session.server.ts` uses a fixed development key if no secret is configured. Repository initialization can fall back to memory, and payment setup can default to sandbox. None of these fallbacks are explicitly development-only. | Production refuses to start or accept orders with missing required configuration. Demo authentication and memory storage are explicitly limited to development. Validate the intended payment environment and canonical site URL. |
| Calculate the complete checkout total | `shipping.tsx` displays regional rates, but `createOrder` saves `totalCents: subtotalCents` and leaves shipping at its zero default. The cart advertises a free-shipping threshold. | Compute shipping on the server from a defined delivery policy; display and charge the same subtotal, delivery and total. Validate serviceable destinations. Keep money in integer cents through calculation and payment generation. |
| Make checkout recoverable and repeat-safe | `startPayfastCheckout` clears the cart before payment; the cancelled-order button returns to `/checkout`. Each checkout call creates another order. | Retry payment on the existing eligible order, preserve or restore cart contents, and use checkout idempotency keys. Refreshes and duplicate submissions must not create duplicate orders. |
| Validate purchasability | Prisma `getProduct` and `createOrder` do not require `published: true`. Invalid/unpriced lines are silently discarded; an order can be created without valid items. Stock and capacity do not constrain checkout. | Reject hidden, invalid, unavailable, or changed items with actionable messages. Reject empty orders, normalize duplicate lines and enforce aggregate quantity limits. Define ready-stock versus made-to-order rules. |
| Record payment events and enforce order transitions | ITN reads `pfPaymentId` but does not persist it, despite `Order.paymentRef`. Status updates are unrestricted; the read-then-update notification handling is not atomic. Non-`COMPLETE` statuses are all mapped to cancelled. | Persist unique payment events, validate expected merchant/status and finite exact amounts, apply atomic allowed transitions, and handle duplicate/out-of-order notifications. Add reconciliation and payment-attempt history. |
| Distinguish cancellation from refunds | No refund model/workflow exists. Admin can cancel a paid order, while the cancellation email says nothing was charged. | Preserve payment history; track refund requested/processing/completed/failed separately. Support a recorded manual refund process initially, with truthful customer messages and an audit trail. |
| Repair navigation and publish finished content | `HomeSections` comments out Cornice, Volute, Philosophy and Contact sections while nav/footer/product links still target them. Legal modal content includes draft owner notes and blanks. | Every visible link has a working destination; contact is reachable; policies contain finished business-approved content. Resolve conflicting studio locations and delivery promises. |

Suggested verification scenarios: unauthorized order lookup; missing production secret; hidden-product checkout; fractional-cent preservation; delivery below/above the free threshold; repeated checkout submit; cancelled-payment retry; duplicate concurrent ITNs; paid-order cancellation; restart after order creation.

## P1: complete the customer and studio workflows

### Customer onboarding and account ownership

The original review found only fixed environment accounts and demo users. Customer registration, verified email/password sign-in, password recovery/change and Google/Apple OAuth are now implemented, with independent staff sessions. Activation requirements are tracked in [AUTHENTICATION.md](AUTHENTICATION.md).

Add verified customer onboarding (email-link login or registration with recovery), account management, and staff invitations. Keep guest checkout. Associate signed-in orders with stable user IDs; allow verified claiming of guest orders. Current history matches the session email, so ordering with an alternate contact email can hide an order from the account. Prefill checkout from the existing saved profile, which checkout currently does not consume.

Done when a new customer can create/access an account, recover access, find their own orders, and reuse delivery details without staff editing environment variables.

### Fulfilment and delivery tracking

`OrderStatus` ends at shipped; there is no delivered state, carrier, tracking number, dispatch/delivery timestamps or status history. The shipping timeline uses fixed day offsets rather than recorded events. `ProductionJob` has optional order/product relations, but create-job functions do not populate them.

Add manual courier/tracking entry first, delivered status, actual event history, payment-based production start dates, and per-product lead times. Create linked production jobs after payment; record stages, responsibility, completion and delays. Reserve/decrement ready stock atomically and release reservations after expiry/cancellation. Add courier automation later if volume warrants it.

Done when staff can take a paid order through production and delivery, and the customer sees the corresponding real events and tracking link.

### Customer support, returns and receipts

The studio can list and mark `ContactMessage` records handled, but no customer-facing submission endpoint creates them. Existing contact links use email/WhatsApp, and the home contact section is disabled.

Add a working contact/project enquiry form with validation, spam controls and acknowledgement. Allow enquiries to reference an order; expose a damage/return request with attachments and a recorded resolution. Provide downloadable receipts/invoices with immutable purchased-item and price snapshots. Product names currently come from the related mutable product record.

### Reliable customer notifications

Order confirmation and status templates already exist. `order-emails.server.ts` catches and logs send failures; there is no durable application outbox or staff retry screen. Since payment status is saved before email delivery, a later payment callback retry does not recover that failed send.

Add a transactional outbox, delivery outcomes, retry scheduling, staff resend controls and alerts for failed messages. Retain the existing email idempotency keys. Notify staff of paid orders and customers of dispatch/tracking, delays and refunds.

### Working waitlists

`joinWaitlist` and database storage exist, but no storefront component calls the mutation. Product “Join the list” links point to the disabled contact section. Product IDs are not linked by the current signup repository method.

Add product-specific signup forms, confirmation, duplicate handling, notification preferences/unsubscribe, and staff release notifications. Link subscriptions to products instead of relying only on free-text labels.

### Cart consistency

The drawer and shared add-to-cart action mutate local storage; `/cart` merges it additively into the server cart. Checkout uses the local mirror. These paths need a single consistent synchronization policy.

Use server-backed mutations throughout with optimistic UI, error recovery and deliberate merge semantics. Verify drawer → cart → checkout, returning visits, multiple tabs and login do not duplicate or lose quantities.

### Staff controls and accurate reporting

Studio/admin roles currently share the same access rule. Add individual staff accounts, narrower privileges for sensitive actions, audit events and stronger staff authentication. Add pagination and server-side filtering before the records grow substantially; studio reads currently fetch all operational lists.

Fix dashboard definitions before relying on them: 30-day revenue includes awaiting-payment orders; the yearly series includes cancelled orders; average order mixes 30-day revenue with all-time order count; stock sold is always zero. Compute paid revenue, refunds, average order value, production backlog and stock from consistent periods and states.

## P2: improve discovery and conversion after the core works

- Product image gallery with zoom, separate detail-image editing, dimensions, installation/care downloads, and clear lead times. Add variants only if the actual product range needs them.
- Search and richer filters when the catalogue outgrows the existing availability and price sorting.
- Genuine purchase-linked reviews. The existing placeholder review component is currently commented out; keep it hidden until real content is available.
- Wishlists, discount codes, bundles and abandoned-checkout reminders once payment recovery and notification preferences are complete.
- Trade/project quote requests for interior designers if that is a target audience.
- Brand metadata and social images, canonical URLs, product structured data and a sitemap. Root metadata still uses “Lovable App”; avoid indexing private account/order views.
- Keyboard and screen-reader improvements: focus trapping/restoration in the cart drawer and legal modal, mobile-menu expanded state, field-error associations and announcement of mutation outcomes. Confirm behavior in a real browser.
- Durable optimized image hosting. The upload adapter currently silently returns base64 data URLs when credentials are absent or uploads fail; production should report upload failures and avoid storing large inline assets.

## Release engineering and acceptance

- Add critical-path integration/browser tests for catalogue → checkout → verified payment → fulfilment, guest access, account ownership and staff permissions. No project test suite or test script was found.
- Establish versioned migrations and a reproducible deployment procedure. `prisma/init.sql` exists, but no committed migrations directory was found despite README deployment instructions using `prisma migrate deploy`. Keep catalogue seeding separate from production schema upgrades; the setup script overwrites existing product content on conflict.
- Add CI for types, lint, build and critical tests. No checked-in CI workflow was found.
- Verify deployed runtime support for Prisma/PostgreSQL, cryptography and uploads; documentation makes edge-runtime claims that have not been validated in this review.
- Add readiness checks, payment/email failure alerts, backup/restore verification and a rollback procedure. Existing generic error reporting is useful but does not verify these operational paths.
- Add endpoint abuse controls for login, checkout, order lookup, signup and contact forms; no application-level rate limiting was found. Confirm separately whether the host provides it.
- Update README and architecture notes to match implementation: several descriptions still say working integrations are stubs, and the documented environment template was not present in the file inventory.

Validation performed:

- `tsc --noEmit`: passed.
- ESLint: 846 errors (836 formatting, 10 explicit `any`) and 9 React-refresh warnings. These are not evidence of 846 runtime defects, but the lint gate currently fails.
- Production build and external integration tests: not run.

## Suggested implementation sequence

1. Protect order access and enforce production configuration.
2. Correct checkout totals, references, product validation, payment retries and event persistence.
3. Repair contact/navigation/policies and deliver a tested guest purchase/support journey.
4. Complete customer onboarding, saved-profile checkout and verified order ownership.
5. Connect stock, production, tracking, returns/refunds and durable email.
6. Add accurate reporting, release automation, then optional discovery/conversion features.

A guest-only initial release can defer customer registration if account links are removed and secure guest order access/support work. Paid-order integrity, private customer data, truthful totals, fulfilment and recovery cannot be deferred.
