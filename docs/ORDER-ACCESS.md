# Private order access

Order references identify orders; they no longer grant permission to read them.

- A signed-in customer can read orders linked to their user ID, plus unclaimed guest orders matching a currently verified account email (case insensitive).
- Studio/admin sessions can read orders for customer support.
- Guests use an order-specific HMAC-SHA256 signed link, valid for 30 days. Checkout return/cancel URLs and future confirmation/status emails contain this link.
- Unavailable orders and unauthorized requests both return `order: null`. Anonymous requests without a valid signed token are rejected before querying orders.
- Internal verified PayFast notifications still use the repository directly; no guest token is required by the payment callback.

Tokens travel in the URL fragment (`#access=...`), which browsers exclude from page requests and referrers. The order page sends the token in a POST body to the protected lookup. Responses are marked `private, no-store`, the page uses `no-referrer` and `noindex`, and inactive order queries are immediately removed from the client cache. These are bearer links: anyone given the full link can access that order until it expires. Do not log request bodies or include URL fragments in analytics.

New references use 12 cryptographically random bytes. Existing references still work for an authorized customer or staff member. Previously sent reference-only links no longer grant guest access; support can use the studio dashboard, and subsequent status emails provide private links. There is no self-service link renewal endpoint yet.

Production requires `AUTH_SECRET` with at least 32 characters and `PUBLIC_SITE_URL` (or `AUTH_URL`) for links. Use a randomly generated secret, shared by all server instances. Missing/short secrets cannot fall back to the development key, and demo accounts are disabled in production. Development without a suitable secret uses an ephemeral random key; restarting invalidates local sessions/links. Rotating `AUTH_SECRET` revokes all sessions and guest links. Individual-link revocation is not implemented.

Customer Google/Apple authentication now links new signed-in orders to stable database user IDs. Historical email matching requires verified ownership, and never overrides another customer’s linked order. See [AUTHENTICATION.md](AUTHENTICATION.md) for provider verification and independent staff sessions.

No database migration is needed. Check deployment configuration before releasing. Test actual PayFast sandbox return/cancel redirects and delivered email links against the deployed site; local tests verify generated URLs, not provider delivery behavior.

Run the security regression tests with Node 24:

```sh
node --test tests/order-access.test.mjs
```

They cover anonymous/cross-customer rejection, staff/owner access, existing references, valid guest links, tampering, cross-order reuse, expiration, secret rotation, missing production secrets, demo-account rejection and checkout return/cancel link construction.
