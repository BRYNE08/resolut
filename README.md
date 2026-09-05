# Resolut

A lighting studio storefront and studio dashboard, built with TanStack Start
(React 19 + Vite), TanStack Query, Prisma-shaped data adapters and an
Auth.js-shaped session layer.

The app **runs with an empty environment**: no database, no auth credentials.
It serves in-memory sample data and signs you in with demo studio accounts.
Every step below flips one piece to the real thing — no component changes.

```
storefront          /  /collection  /product/$slug  /checkout
studio dashboard    /admin  (role-gated)  /signin
```

## 1. Run it locally

```sh
bun install     # or npm i
bun run dev     # http://localhost:8080
```

Copy the env template — leave everything blank for now:

```sh
cp .env.example .env
```

Sign in at `/signin` with the demo accounts listed on that page:

| Email | Password | Role |
| --- | --- | --- |
| studio@resolutdesign.co.za | resolut-studio | studio |
| admin@resolutdesign.co.za | resolut-admin | admin |

## 2. Wire up the database (Prisma + PostgreSQL)

The repository layer picks its adapter at runtime: Prisma when `DATABASE_URL`
is set, in-memory otherwise (`src/lib/data/repository.server.ts`). The active
adapter name is returned with every read and shown in the studio dashboard.

Prisma 7 is already installed (`@prisma/client`, `@prisma/adapter-pg`), and the
client is generated into `src/generated/prisma` with the driver-adapter runtime,
so it works in the edge runtime as well.

1. Point `DATABASE_URL` at a PostgreSQL instance in `.env`:

   ```
   DATABASE_URL=postgresql://user:password@host:5432/resolut?schema=public
   ```

   Any Postgres works: local Docker, Neon, Supabase, RDS. The connection URL is
   read from `prisma.config.ts` for CLI commands and passed to the adapter at
   runtime — the schema no longer carries a `url`.

2. Create the schema, seed the catalogue and (re)generate the client:

   ```sh
   bun run scripts/db-setup.ts   # applies prisma/init.sql + seeds the 4 pieces
   bunx prisma generate
   ```

   `prisma/init.sql` mirrors `prisma/schema.prisma` and is idempotent, so it can
   also be applied with `psql`. `bunx prisma migrate dev` works too where the
   Prisma schema engine is available.


3. Restart `bun run dev`. The dashboard now reads `source: prisma`. If the
   client cannot be created, the server logs
   `[resolut] DATABASE_URL is set but the Prisma client could not be created`
   and falls back to in-memory data — check that log first.


5. Seed the catalogue. The sample pieces live in
   `src/lib/data/mock-repository.ts`; either add them through the studio
   **Pieces → New piece** form, or write a `prisma/seed.ts` that inserts the
   same records and run it with `bunx prisma db seed`.

Models live in `prisma/schema.prisma`: `Product`, `Order`/`OrderItem`,
`ProductionJob`, `WaitlistSignup`, `ContactMessage`, plus the Auth.js tables
(`User`, `Account`, `Session`, `VerificationToken`). Prices and totals are
stored in **cents (ZAR)**.

## 3. Wire up authentication

Sign-in already works for real: the session is an encrypted, http-only cookie
(`src/lib/auth/session.server.ts`). Two levels of "real":

### a. Your own credential accounts (no extra packages)

Set these in `.env` and the demo accounts disappear from `/signin`:

```
AUTH_SECRET=RQ3biIOKeoc5B/dbgWcEAJ5ICk5uVjnwXSUZd9VcmdEFRQ7b3gc9BpztbWI=
STUDIO_EMAIL=you@studio.co.za
STUDIO_PASSWORD=a-long-random-password
STUDIO_NAME=Studio
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=
```

`AUTH_SECRET` seals the cookie in production; without it a development key is
used and sessions reset on redeploy.

### b. Full Auth.js (Google / GitHub / email link)

1. `bun add @auth/core @auth/prisma-adapter`
2. Fill in the provider credentials in `.env`:

   ```
   AUTH_URL=https://your-domain.com
   AUTH_GOOGLE_ID=
   AUTH_GOOGLE_SECRET=
   AUTH_GITHUB_ID=
   AUTH_GITHUB_SECRET=
   AUTH_RESEND_KEY=
   ```

   Redirect/callback URL: `https://your-domain.com/api/auth/callback/<provider>`.
3. In `src/lib/auth/session.server.ts`, replace the cookie read in
   `readSession()` with the Auth.js session read and use the Prisma adapter for
   `User`/`Account`/`Session`. Everything downstream — `useSession()`, the
   `/admin` route gate, and the server-side `canAccessStudio` check in
   `src/lib/api/admin.functions.ts` — consumes the same `Session` shape and
   keeps working.
4. Roles come from `User.role` (`CUSTOMER | STUDIO | ADMIN`). Promote your first
   studio user with SQL or Prisma Studio (`bunx prisma studio`).

Provider descriptors and the role rule live in `src/lib/auth/config.ts`.

## 3b. Wire up image uploads (UploadThing)

The studio piece forms ("New piece" / "Edit piece") upload the piece image
straight from the browser. With no credentials the file is inlined as a data URL
so the flow works immediately. To store files properly:

```bash
bun add uploadthing
```

```env
UPLOADTHING_TOKEN=   # UploadThing dashboard → API Keys → V7 token
```

`src/lib/uploads/uploadthing.server.ts` then uploads via `UTApi` and returns the
hosted file URL; the upload endpoint is `uploadPieceImage` in
`src/lib/api/uploads.functions.ts` and is studio-role gated (4 MB max, images
only).

## 4. Payments (PayFast) — already live

Checkout is a real PayFast integration, not a mock:

1. `/checkout` collects delivery details only. Pressing **Pay with PayFast**
   calls `startPayfastCheckout` (`src/lib/api/payments.functions.ts`), which
   saves the order with status `AWAITING_PAYMENT`, clears the server cart, and
   returns a signed payment request.
2. The browser POSTs those fields to PayFast's hosted page. Card, EFT and
   SnapScan details are entered on PayFast — this app never sees them.
3. PayFast returns the buyer to `/order/<reference>`, which polls the order
   until the payment result lands.
4. PayFast posts the result to `/api/public/payfast-itn`
   (`src/routes/api/public/payfast-itn.ts`). It checks the referring host,
   recomputes the MD5 signature, confirms the notification server-to-server
   against PayFast, compares the amount to the stored total, and only then
   flips the order to `PAID` (or `CANCELLED`).

With no credentials set it runs against **PayFast's public sandbox merchant**,
so the whole flow works immediately. Go live by setting:

```env
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=      # set the same passphrase in your PayFast dashboard
PAYFAST_SANDBOX=false    # optional override; auto-detected from the keys above
PUBLIC_SITE_URL=https://your-domain.com   # used for return/cancel/notify URLs
```

The ITN callback must be publicly reachable, so payments only confirm
automatically on a deployed URL — on localhost the order stays
`AWAITING_PAYMENT` until you mark it paid in the studio.

Signing lives in `src/lib/payments/payfast.server.ts` (PHP-compatible
`urlencode`, field order preserved — PayFast's signature depends on both).

## 5. Deploy

```sh
bun run build
```

Set the same environment variables in your host, then run the migration against
the production database (`bunx prisma migrate deploy`). Required in production:
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, your credential or provider values,
and the `PAYFAST_*` keys once checkout is live.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the layer diagram. In short:

- **Server boundary** — `src/lib/api/*.functions.ts`, the only RPC surface
  (`createServerFn`). Server-only modules use the `.server.ts` suffix.
- **Data** — `src/lib/data/` adapters behind the `ResolutRepository` interface.
- **Server state** — TanStack Query only, via `queryOptions` in
  `src/lib/api/queries.ts`; routes prime the cache with `ensureQueryData`,
  components read with `useSuspenseQuery`.
- **Client state** — `src/lib/store/cart-store.ts`, an external store persisted
  to `localStorage` (nav badge + drawer mirror).
- **Cart** — server-owned (`/cart`): `src/lib/api/cart.functions.ts` keys an
  anonymous cart by a sealed `resolut_cart` cookie and persists it through the
  repository — in-memory by default, `Cart`/`CartItem` tables once Prisma is
  live. Legacy `localStorage` carts are merged upward on first visit.
- **Security** — the `/admin` route gate is UX; each studio server function
  re-checks the role server-side.

## Built with Lovable

Continue developing this project in the
[Lovable editor](https://lovable.dev/projects/1a234c7e-4de2-43dc-b3a5-f0ad8829fbfe).
Every change made in Lovable is committed straight to this repository, and
pushes to `main` sync back into Lovable.
