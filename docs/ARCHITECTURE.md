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

## Auth.js

- `src/lib/auth/config.ts` holds Auth.js-shaped types, provider descriptors
  (Google / GitHub / email link) and the `canAccessStudio` role rule.
- `src/lib/auth/session.server.ts` is the only place that reads a session. With
  no `AUTH_SECRET` it returns a demo studio session; the live Auth.js call is
  stubbed in place, commented, ready to enable.
- `src/lib/auth/use-session.ts` mirrors Auth.js's `useSession()` for components.
- `src/lib/api/admin.functions.ts` re-checks the role server-side — the route
  guard is UX, the server check is the boundary.

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
