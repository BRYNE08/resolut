# Resolut

A lighting studio storefront and studio dashboard, built with TanStack Start
(React 19 + Vite), TanStack Query, Prisma-shaped data adapters and separate customer/staff
session layers.

The app **runs with an empty environment**: no database, no auth credentials.
It serves in-memory sample data and supports development-only studio demo accounts.
Customer email/password and Google/Apple authentication require configuration.
Every step below flips one piece to the real thing — no component changes.

```
storefront          /  /collection  /product/$slug  /checkout
studio dashboard    /admin  (role-gated)  /admin/signin
customer account    /signin  /signup  /account
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

Sign in at `/admin/signin` with the development demo accounts listed on that page:

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

## 3. Authentication

Customers sign in or create an account at `/signin` (or `/signup`) with email/password, Google
or Apple. Staff use `/admin/signin` with the configured studio/admin credentials.
These flows have independent sessions and logout actions; customer OAuth never
grants studio access.

Google and Apple require provider-console credentials, a persistent PostgreSQL
database, and a random `AUTH_SECRET` of at least 32 characters. Provider buttons
stay disabled until configured. Apple requires an HTTPS callback URL.

See [authentication setup](docs/AUTHENTICATION.md) for the exact environment
variables, Google/Apple callback URLs, account ownership rules and activation checks.
Email/password accounts include verification, recovery and password changes. Configure
`RESEND_API_KEY` and `EMAIL_FROM`, verify the sender domain in Resend, and apply the additive schema upgrade with `bun run db:auth-upgrade`
before deploying to an existing database (see the setup guide).

Development-only staff demo accounts remain available at `/admin/signin` when
no staff credentials are configured. Customer environment/demo accounts are no
longer supported; customers register their own accounts. Production never enables demo credentials.

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

With no credentials set it runs against **PayFast's public sandbox merchant**.
Local sandbox return links use `127.0.0.1` instead of `localhost` and omit the
unreachable notification URL. To test automatic payment confirmation, set
`PUBLIC_SITE_URL` to your public development tunnel URL. Go live by setting:

```env
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=      # set the same passphrase in your PayFast dashboard
PAYFAST_SANDBOX=false    # true for your own sandbox merchant credentials
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
