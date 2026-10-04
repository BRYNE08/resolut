# Customer and staff authentication

## Routes and behavior

- `/signin`: customer email/password, Google and Apple sign-in. First successful provider login creates a customer account.
- `/signup`: customer registration with name, email, password and password confirmation, or a social provider.
- `/verify-email`: confirm a verification link or request another email.
- `/forgot-password` and `/reset-password`: request and complete password recovery.
- `/account`: includes a password-change form for email/password accounts.
- `/admin/signin`: staff email/password sign-in. No public staff registration or social login.
- `/account`: requires a customer session.
- `/admin` and studio server functions: require the independent staff session.

Customer and staff sessions use separate encrypted, HTTP-only cookies. Both can be active in the same browser. Signing out of one does not sign out of the other. Existing shared `resolut_session` cookies are no longer read, so existing users must sign in again.

Customers are stored in the existing PostgreSQL `User` and `Account` tables; the identity key is provider + provider subject. OAuth will not fall back to in-memory accounts. Provider tokens are not stored. New accounts always have the `CUSTOMER` role, and social login refuses existing staff records.

There is no automatic account merging by email. If the same email is already registered, use the original sign-in method. Password reset does not add a password to a social-only account. An explicit account-linking flow can be added separately. Customer environment passwords/demo users have been removed; staff `STUDIO_*` and `ADMIN_*` credentials remain supported.

## Configuration

Configure these server environment variables on the host and in your local environment when testing. Do not prefix secrets with `VITE_` or put them in frontend code. Do not commit populated environment files.

```dotenv
DATABASE_URL=postgresql://...
AUTH_SECRET=<random secret of at least 32 characters>
PUBLIC_SITE_URL=https://your-domain.example
RESEND_API_KEY=<Resend sending API key>
EMAIL_FROM="Resolut <noreply@notify.resolutdesign.co.za>"
# Optional: only a header overwritten by your trusted proxy, e.g. Cloudflare Workers:
# AUTH_TRUSTED_IP_HEADER=cf-connecting-ip

AUTH_GOOGLE_ID=<web OAuth client ID>
AUTH_GOOGLE_SECRET=<web OAuth client secret>

AUTH_APPLE_ID=<Apple Services ID>
AUTH_APPLE_TEAM_ID=<Apple Developer team ID>
AUTH_APPLE_KEY_ID=<Sign in with Apple key ID>
AUTH_APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

STUDIO_EMAIL=<staff email>
STUDIO_PASSWORD=<staff password>
ADMIN_EMAIL=<optional administrator email>
ADMIN_PASSWORD=<optional administrator password>
```

Actual multiline Apple PEM keys and PEM strings containing literal `\n` are both accepted. The server generates Apple's short-lived client-secret JWT from the private key for each token exchange; there is no manually maintained Apple client-secret token to expire.

`AUTH_URL` can supply the canonical site origin if `PUBLIC_SITE_URL` is absent. Production requires HTTPS. Missing configuration disables the relevant provider button; the user sees “Temporarily unavailable.” Existing databases require the additive upgrade below before deploying this version. Google and Apple provider configuration is still managed separately.

### Email/password setup and database upgrade

The application uses Resend for authentication and order emails, with the existing React templates rendered as HTML and plain text. Configure `RESEND_API_KEY`, `EMAIL_FROM`, a canonical `PUBLIC_SITE_URL` (or `AUTH_URL`), `DATABASE_URL` and `AUTH_SECRET`. Verify the domain used by `EMAIL_FROM` in Resend first; the API key alone does not authorize a custom sender. See [Resend DNS setup](RESEND-DNS.md) for this project’s verification records. Disable open/click tracking for authentication and private order links. No Lovable paid plan is required. Registration, verification resends and recovery return an unavailable message when email configuration is missing; password sign-in does not depend on email delivery.

For an existing database, run the additive upgrade against the intended environment **before deploying this code**:

```sh
bun run db:auth-upgrade
bunx prisma generate
```

The script reads `DATABASE_URL`, adds nullable `User.passwordHash`, `User.sessionVersion` (default 0), and the `AuthRateLimit` table/index. It runs in a transaction, can be rerun, and does not reseed or overwrite existing customer/catalog data. Do not run `scripts/db-setup.ts` merely to upgrade authentication: that script also seeds catalog data. Fresh database initialization includes these additions in `prisma/init.sql`.

Password behavior:

- Signup normalizes the email and stores only a salted scrypt hash (N=32768, r=8, p=3). Passwords allow 15–128 characters with no composition rules or silent trimming; confirmation must match. A small local common-password check is included, not a comprehensive breached-password service.
- Email/password customers cannot sign in before verification. Verification links expire after 24 hours and require the original signup password, preventing an unsolicited registration from being activated by someone who did not choose that password.
- Recovery links expire after one hour. A successful recovery also verifies an unverified password account, so the mailbox owner can recover an unwanted signup safely.
- Only SHA-256 token digests are stored. Links carry tokens in URL fragments; pages remove the fragment after reading it, disable indexing/referrers and consume tokens only on an explicit CSRF-protected POST. Email scanners opening a link cannot consume it.
- Atomic token consumption and a compare-and-swap account version allow only one concurrent reset/verification to succeed. Reset/change invalidates all older customer sessions and outstanding links. A password change renews the current session; recovery requires signing in again. Password changes send a security notification email.
- Duplicate signup and recovery/resend requests return generic responses. Unknown and ineligible sign-ins still perform a password derivation. Email-request responses have a 1.2-second minimum duration; this reduces simple timing differences but is not a guarantee against email-provider latency analysis.
- PostgreSQL stores shared atomic rate counters under HMAC keys: eight sign-in attempts per email/15 minutes, three signup/email/token/change attempts per identity/hour, and 60 total password actions per IP/15 minutes. Expired counters and tokens are cleaned opportunistically. Configure a trusted client-IP source at deployment; without a usable IP, requests share a conservative `unknown` bucket. Never trust a header users can set directly.
- Email delivery failure is logged without tokens or addresses, with generic customer responses and a resend path. Delivery is synchronous and there is no durable retry queue; monitor the mail provider and test delivery before launch.

Staff authentication remains independent. Customer email/password registration cannot create a staff role, and staff database records cannot use customer password recovery.

### Google

Create a **Web application** OAuth client in Google Cloud, configure its consent/branding screen and allowed users, and register this exact authorized redirect URI:

```text
https://your-domain.example/api/auth/customer/google/callback
```

For local Google testing, register `http://localhost:8080/api/auth/customer/google/callback` as an additional URI and use the matching local site origin. Keep separate production/test credentials as appropriate. An app in Google's testing mode must permit the test account.

### Apple

Configure Sign in with Apple for your developer account, associate a Services ID with the enabled primary App ID, register your website domain, and register this exact return URL:

```text
https://your-domain.example/api/auth/customer/apple/callback
```

Use the Services ID as `AUTH_APPLE_ID`, and a Sign in with Apple `.p8` private key with its key/team IDs. Apple requires an HTTPS web return URL; use an HTTPS development domain/tunnel instead of plain localhost. Register your outbound email sources with Apple's private email relay so messages reach customers who choose Hide My Email.

The Apple callback accepts `form_post`; its short-lived OAuth cookie uses `SameSite=None; Secure`. The normal application session remains `SameSite=Lax`. The optional first-login display name is saved once; the email and subject always come from the verified identity token, never Apple's unsigned form `user` object.

## Security and ownership

- Google authorization uses PKCE. Both flows use independent random state and nonce, a ten-minute encrypted flow cookie, and server-side code exchange.
- Identity tokens are verified against the provider's signing keys, issuer, client ID, nonce, signature algorithm and expiration. Unverified email claims are rejected.
- Redirects are restricted to known customer pages on this site. Provider errors do not expose tokens, profile payloads or raw upstream error bodies.
- The flow cookie is cleared before code exchange. OAuth codes are single-use at the provider.
- Customer sessions are rechecked against the database; deleted, changed-email, non-customer or revoked session-version records are rejected.
- New signed-in purchases store the server-selected `Order.userId`. This lets an Apple relay user enter another delivery email and still see their order. Claimed orders cannot be accessed by another customer merely matching the delivery email.
- Unclaimed guest orders can be matched only through a currently verified email. For Google accounts using third-party email without a Workspace `hd` claim, email ownership is not assumed; these customers see purchases linked to their user ID and can use private guest-order links.
- New customer profiles use `customer:<userId>` in the existing legacy `accountEmail` key column. A pre-OAuth email-keyed profile can be read only with verified ownership; saving writes the stable-ID record. Public profile responses still show the customer's account email.

Google and Apple sign-in do not grant studio access. The staff API independently reads the studio cookie and checks its role. Demo staff accounts remain development-only.

## Validation and activation

```sh
npm run test:auth
npm run test:email
npx tsc --noEmit
npm run build
```

The unit tests use locally signed tokens and a simulated database to exercise identity validation, account creation/reuse, email collision handling, staff-role rejection, state expiry, redirect restrictions and order ownership. Local HTTP smoke checks cover both login pages, signup, protected-route redirects, and invalid callbacks.

The database integration suite exercises registration, verification, recovery, password changes, staff/social isolation, concurrent reset consumption, atomic rate limits and an idempotent upgrade preserving an existing user. It requires an explicitly supplied disposable PostgreSQL database; it never loads `.env` or uses `DATABASE_URL`. It creates and drops its own uniquely named schema:

```sh
AUTH_TEST_DATABASE_URL=postgresql://... node --test tests/password-auth.integration.test.mjs
```

Before activating email/password, apply the upgrade, configure the mail provider and trusted client-IP header, and test real verification/reset/change-notification delivery on the configured domain, including spam-folder placement, expired links, retries and sign-out of another browser after reset. No live emails or changes to the configured application database were made during implementation.

Before activating the providers, complete actual Google and Apple logins against the configured host and database: first registration, returning sign-in, cancellation, expired state, Apple Hide My Email, checkout with an alternate delivery email, and independent customer/staff logout. Provider-console setup and live consent flows cannot be verified by local unit tests.

Sources: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google email ownership guidance](https://developers.google.com/identity/sign-in/android/backend-auth), [Apple environment configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple), [Apple authorization endpoint](https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server.), [Arctic provider implementation](https://github.com/pilcrowonpaper/arctic), [JOSE token verification](https://github.com/panva/jose).

Password references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

The optional `/lovable/email/transactional/preview` editor endpoint retains its separate `LOVABLE_API_KEY` gate; it is not used to send emails and must never receive the Resend key. The mail transport calls the [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email) with a 15-second timeout and preserves order-email idempotency keys. API acceptance is not proof of inbox delivery. Monitor delivery/bounces in Resend.

## Troubleshooting email and database connections

- PostgreSQL SSL alias warning: use `sslmode=verify-full` in `DATABASE_URL` to retain certificate and hostname verification. Restart the server after changing environment settings, and apply the same setting in the deployment environment.
- Authentication mail failures now log a safe category and HTTP status, without recipients, tokens or upstream response bodies. `provider_rejected` with status 403 can indicate an unverified sending domain or insufficient permissions; check Resend’s dashboard. `network_or_timeout` indicates the request could not be confirmed.
- The sender domain must be verified in Resend. Add every record from [RESEND-DNS.md](RESEND-DNS.md) at the authoritative DNS provider, then request verification. An API key alone is insufficient.
- After fixing delivery, use `/verify-email` to request another verification email for an existing signup; signing up again does not overwrite the account or automatically resend its email.
