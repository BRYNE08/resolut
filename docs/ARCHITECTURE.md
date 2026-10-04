# Resolut — data, auth, and state architecture

Everything below is plug-and-play: the app runs with **no** database and **no**
auth credentials, and switches to the real thing when environment variables
appear. No component changes are needed either way.

## Layers

```text
components / routes
      |  useSuspenseQuery / useMutation      (TanStack Query — server state)
      |  useCartItems()                      (cart store — client state)
      v
src/lib/api/*.functions.ts                   (createServerFn — the only RPC surface)
      v
src/lib/data/repository.server.ts            (adapter selection)
      |                        \
src/lib/data/mock-repository.ts   src/lib/data/prisma-repository.server.ts
  (in-memory, default)              (activates when DATABASE_URL is set)
      v
prisma/schema.prisma
```

## Prisma

- Schema lives in `prisma/schema.prisma` (catalogue, orders, production jobs,
  waitlist, contact messages, Auth.js tables).
- `src/lib/data/prisma.server.ts` imports `@prisma/client` through a
  Vite-ignored dynamic import, so the package is genuinely optional.
- Go live: `bun add @prisma/client && bun add -d prisma`, set `DATABASE_URL`,
  then `bunx prisma migrate dev && bunx prisma generate`.
- The active adapter name is returned with every read (`source: "in-memory" |
  "prisma"`) and shown in the studio dashboard.

## Authentication

- Customers use `/signin` or `/signup` with verified email/password or Google/Apple OAuth; staff use `/admin/signin` with provisioned credentials.
- `customer-oauth.server.ts` handles authorization, ten-minute state/nonce cookies, Google PKCE and Apple's form POST callback.
- `customer-identity.server.ts` verifies signed provider tokens and creates/loads customer-only User/Account records by provider subject.
- `session.server.ts` maintains separate encrypted customer/studio cookies. Staff functions explicitly read the studio session; customer sessions are rechecked against the database.
- Signed-in orders are linked to stable customer IDs. Matching guest-order emails requires verified ownership.
- See [AUTHENTICATION.md](AUTHENTICATION.md) for provider configuration, data compatibility and validation.

## Data fetching

- All reads are `createServerFn` handlers behind `queryOptions` in
  `src/lib/api/queries.ts`.
- Routes prime the cache in their loader with `ensureQueryData`; components read
  with `useSuspenseQuery`, so there are no loading flashes and SSR is populated.
- Mutations (`placeOrder`, `joinWaitlist`) run through `useMutation` and
  invalidate by `queryKeys`.

## State management

- Server state: TanStack Query only. Never mirrored into `useState`.
- Client state: `src/lib/store/cart-store.ts`, an external store read through
  `useSyncExternalStore`. It persists to `localStorage`, syncs across tabs, and
  emits `resolut:cart` so the legacy cart drawer stays in step.
- Pricing is never trusted from the client: `priceCart()` joins cart quantities
  with server-supplied prices, and `placeOrder` re-prices on the server.

## Payments

Bank fields in the checkout UI are illustrative only — nothing is transmitted or
stored. PayFast's hosted page should own card/EFT capture; `PAYFAST_*` variables
are reserved in `.env.example`.

Customer password authentication uses `password.functions.ts`, `password-service.server.ts`, salted scrypt hashes, hashed single-use email tokens, atomic database rate limits and session versions for revocation. See [AUTHENTICATION.md](AUTHENTICATION.md) for the required additive database upgrade and email setup.

Email delivery uses Resend’s REST API through `resend.server.ts`; `send-email.ts` renders the shared React templates for customer auth and order emails. Server-only configuration is `RESEND_API_KEY` plus `EMAIL_FROM`. Environment files are ignored by Git.
