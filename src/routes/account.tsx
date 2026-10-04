import { RecoveryPage } from "@/components/auth/recovery-page";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import "@/lib/resolut/resolut.css";
import { StorefrontChrome } from "@/components/resolut/chrome";
import { OrderTimeline } from "@/components/resolut/order-timeline";
import { myOrdersQuery, myProfileQuery, queryKeys, sessionQuery } from "@/lib/api/queries";
import { saveMyProfile, type ProfileInput } from "@/lib/api/account.functions";
import { signOut } from "@/lib/api/auth.functions";
import type { Order } from "@/lib/data/types";
import { ZAR } from "@/lib/money";

const TITLE = "Your account — Resolut";
const DESCRIPTION =
  "View your Resolut orders, their production status and estimated delivery dates in one place.";

const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const EMPTY: ProfileInput = {
  contactEmail: "",
  phone: "",
  addressLine: "",
  addressLine2: "",
  suburb: "",
  city: "",
  province: "",
  postalCode: "",
  country: "South Africa",
  deliveryNotes: "",
};

const STATUS_LABEL: Record<string, string> = {
  await: "Awaiting payment",
  paid: "Payment received",
  making: "In the workshop",
  shipped: "Dispatched",
  cancelled: "Cancelled",
};

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // UX gate; the server function re-checks the session as the real boundary.
  beforeLoad: async ({ context, location }) => {
    const data = await context.queryClient.fetchQuery(sessionQuery);
    if (!data.session) {
      throw redirect({ to: "/signin", search: { redirect: location.href } });
    }
  },
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const endSession = useServerFn(signOut);
  const { data, isPending, isError } = useQuery(myOrdersQuery);

  const { data: auth } = useQuery(sessionQuery);

  const orders: Order[] = data?.orders ?? [];
  const viewer = data?.viewer ?? null;
  const active = orders.filter((o) => o.status !== "cancelled");
  const spend = active.reduce((sum, o) => sum + o.total, 0);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await endSession();
    navigate({ to: "/", replace: true });
  }

  return (
    <StorefrontChrome>
      <div className="pdp-page">
        <main className="pdp checkout-page ship-page">
          <div className="wrap">
            <nav className="pdp-crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Your account</span>
            </nav>

            <p className="eyebrow">Customer portal</p>
            <h1 className="co-title">Your orders</h1>
            <p className="ship-lead">
              {viewer ? `Signed in as ${viewer.email}. ` : ""}
              Every piece you&rsquo;ve ordered, its current stage in the workshop and when to expect
              delivery. Orders are matched to the email address on your account.
            </p>

            <section className="ship-block" aria-labelledby="acc-summary">
              <h2 id="acc-summary">Summary</h2>
              <table className="ship-table">
                <thead>
                  <tr>
                    <th scope="col">Orders</th>
                    <th scope="col">In progress</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{orders.length}</td>
                    <td>
                      {active.filter((o) => o.status === "paid" || o.status === "making").length}
                    </td>
                    <td>{ZAR(spend)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="sig-actions">
                <Link className="btn btn-ghost" to="/shipping">
                  Shipping &amp; tracking
                </Link>
                <button className="btn btn-ghost" type="button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            </section>

            <ProfileSection />
            {auth?.session?.user.hasPassword && <RecoveryPage mode="change" />}

            <section className="ship-block" aria-labelledby="acc-orders">
              <h2 id="acc-orders">Order history</h2>

              {isPending ? (
                <p className="ship-status">Loading your orders&hellip;</p>
              ) : isError ? (
                <p className="ship-status ship-status-miss">
                  We couldn&rsquo;t load your orders just now. Refresh the page, or{" "}
                  <a href="/#contact">contact the studio</a>.
                </p>
              ) : orders.length === 0 ? (
                <>
                  <p className="ship-status">
                    No orders linked to your account yet. If you checked out as a guest, open the
                    private link in your order email to view that purchase.
                  </p>
                  <div className="sig-actions">
                    <Link
                      className="btn btn-primary"
                      to="/collection"
                      search={{ availability: "all", sort: "curated" }}
                    >
                      Browse the collection
                    </Link>
                  </div>
                </>
              ) : (
                orders.map((order) => (
                  <div key={order.reference} style={{ marginBottom: "1.5rem" }}>
                    <p className="co-note">Status: {STATUS_LABEL[order.status] ?? order.status}</p>
                    <OrderTimeline order={order} />
                  </div>
                ))
              )}
            </section>
          </div>
        </main>
      </div>
    </StorefrontChrome>
  );
}

/** Editable contact + delivery details for the signed-in customer. */
function ProfileSection() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(myProfileQuery);
  const persist = useServerFn(saveMyProfile);
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    setForm({
      contactEmail: p.contactEmail ?? data.accountEmail,
      phone: p.phone ?? "",
      addressLine: p.addressLine ?? "",
      addressLine2: p.addressLine2 ?? "",
      suburb: p.suburb ?? "",
      city: p.city ?? "",
      province: p.province ?? "",
      postalCode: p.postalCode ?? "",
      country: p.country ?? "South Africa",
      deliveryNotes: p.deliveryNotes ?? "",
    });
  }, [data]);

  const save = useMutation({
    mutationFn: (values: ProfileInput) => persist({ data: values }),
    onSuccess: async () => {
      setSaved(true);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    },
    onError: (err: unknown) => {
      setSaved(false);
      setError(err instanceof Error ? err.message : "We couldn't save your details.");
    },
  });

  function set<K extends keyof ProfileInput>(key: K, value: string) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = (form.contactEmail ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    save.mutate({ ...form, contactEmail: email });
  }

  return (
    <section className="ship-block" aria-labelledby="acc-profile">
      <h2 id="acc-profile">Your profile</h2>
      <p className="ship-lead">
        Keep your contact email, phone number and delivery address current — we use these details
        for order updates and dispatch.
      </p>

      {isPending ? (
        <p className="ship-status">Loading your details&hellip;</p>
      ) : isError ? (
        <p className="ship-status ship-status-miss">
          We couldn&rsquo;t load your profile just now.
        </p>
      ) : (
        <form className="co-form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="pr-email">Contact email</label>
            <input
              id="pr-email"
              type="email"
              autoComplete="email"
              value={form.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="pr-phone">Phone</label>
            <input
              id="pr-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="071 234 5678"
            />
          </div>

          <div className="field">
            <label htmlFor="pr-address">Street address</label>
            <input
              id="pr-address"
              autoComplete="address-line1"
              value={form.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="pr-address2">Apartment, unit or complex (optional)</label>
            <input
              id="pr-address2"
              autoComplete="address-line2"
              value={form.addressLine2}
              onChange={(e) => set("addressLine2", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="pr-suburb">Suburb</label>
            <input
              id="pr-suburb"
              value={form.suburb}
              onChange={(e) => set("suburb", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="pr-city">City</label>
            <input
              id="pr-city"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="pr-province">Province</label>
            <select
              id="pr-province"
              value={form.province}
              onChange={(e) => set("province", e.target.value)}
            >
              <option value="">Select a province</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="pr-postal">Postal code</label>
            <input
              id="pr-postal"
              autoComplete="postal-code"
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="pr-country">Country</label>
            <input
              id="pr-country"
              autoComplete="country-name"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="pr-notes">Delivery notes (optional)</label>
            <textarea
              id="pr-notes"
              rows={3}
              maxLength={500}
              value={form.deliveryNotes}
              onChange={(e) => set("deliveryNotes", e.target.value)}
              placeholder="Gate code, building access, best delivery times"
            />
          </div>

          {error ? <p className="ship-status ship-status-miss">{error}</p> : null}
          {saved && !error ? <p className="ship-status">Details saved.</p> : null}

          <div className="sig-actions">
            <button className="btn btn-primary" type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving\u2026" : "Save details"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
