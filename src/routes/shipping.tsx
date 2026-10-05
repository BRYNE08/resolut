import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import "@/lib/resolut/resolut.css";
import { StorefrontChrome } from "@/components/resolut/chrome";
import { orderQuery } from "@/lib/api/queries";
import type { Order, OrderStatus } from "@/lib/data/types";
import { ZAR } from "@/lib/money";
import { LEGAL_DOCS } from "@/lib/resolut/legal";

const TITLE = "Shipping & Order Tracking — Resolut";
const DESCRIPTION =
  "Track your Resolut order, see estimated delivery dates for your made-to-order piece, and view nationwide shipping costs.";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShippingPage,
});

/** Made-to-order timeline, in business-day offsets from the order date. */
const STAGES: { key: OrderStatus | "delivered"; label: string; note: string; days: number }[] = [
  { key: "paid", label: "Order confirmed", note: "Payment cleared through PayFast.", days: 0 },
  {
    key: "making",
    label: "In the workshop",
    note: "Printed, finished and hand-assembled.",
    days: 3,
  },
  {
    key: "shipped",
    label: "Dispatched",
    note: "Courier collects and tracking is emailed.",
    days: 15,
  },
  { key: "delivered", label: "Delivered", note: "Signed for at your address.", days: 20 },
];

const ORDER_OF: Record<string, number> = {
  await: -1,
  paid: 0,
  making: 1,
  shipped: 2,
  cancelled: -1,
};

function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
  }
  return d;
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic date formatting — Intl locale data differs across runtimes. */
function fmt(d: Date) {
  return `${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

function ShippingPage() {
  const [input, setInput] = useState("");
  const [reference, setReference] = useState("");

  const { data, isFetching, isError } = useQuery({
    ...orderQuery(reference),
    enabled: reference.length >= 3,
  });
  const order: Order | null = reference ? (data?.order ?? null) : null;

  return (
    <StorefrontChrome>
      <div className="pdp-page">
        <main className="pdp checkout-page ship-page">
          <div className="wrap">
            <nav className="pdp-crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Shipping &amp; tracking</span>
            </nav>

            <p className="eyebrow">Made to order</p>
            <h1 className="co-title">Shipping &amp; tracking</h1>
            <p className="ship-lead">
              Every Resolut piece is printed and assembled after you order it. Below you can follow
              your order, see when to expect it, and check what delivery costs to your area.
            </p>

            <section className="ship-block" aria-labelledby="ship-track">
              <h2 id="ship-track">Track your order</h2>
              <form
                className="ship-track-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setReference(input.trim().toUpperCase());
                }}
              >
                <label htmlFor="ship-ref">Order reference</label>
                <div className="ship-track-row">
                  <input
                    id="ship-ref"
                    name="reference"
                    placeholder="RSL-123456"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoComplete="off"
                  />
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={input.trim().length < 3}
                  >
                    Track
                  </button>
                </div>
                <p className="co-note">
                  Sign in with the account matching your order email to look up a reference. Guest
                  customers: open the private order link in your latest email.
                </p>
              </form>

              {reference && isFetching && !order ? (
                <p className="ship-status">Looking up {reference}…</p>
              ) : reference && (isError || !order) ? (
                <p className="ship-status ship-status-miss">
                  This order is unavailable. Check the reference and{" "}
                  <Link to="/signin">sign in</Link>, or use your private email link. For help,{" "}
                  <a href="mailto:orders@resolutdesign.co.za">contact the studio</a>.
                </p>
              ) : order ? (
                <OrderTimeline order={order} />
              ) : null}
            </section>

            <section className="ship-block" aria-labelledby="ship-policy">
              <h2 id="ship-policy">Shipping &amp; Delivery</h2>
              <div
                className="legal-body"
                dangerouslySetInnerHTML={{ __html: LEGAL_DOCS.shipping.html }}
              />
              <div className="sig-actions">
                <Link
                  className="btn btn-ghost"
                  to="/collection"
                  search={{ availability: "all", sort: "curated" }}
                >
                  Browse the collection
                </Link>
              </div>
            </section>
          </div>
        </main>
      </div>
    </StorefrontChrome>
  );
}

function OrderTimeline({ order }: { order: Order }) {
  const placed = new Date(order.createdAt);
  const current = ORDER_OF[order.status] ?? -1;
  const cancelled = order.status === "cancelled";
  const eta = addBusinessDays(placed, STAGES[3]!.days);

  return (
    <div className="ship-order">
      <div className="ship-order-head">
        <div>
          <p className="eyebrow">Order {order.reference}</p>
          <strong>{order.lines.map((l) => `${l.quantity} × ${l.name}`).join(", ")}</strong>
          <span>
            Placed {fmt(placed)} · {ZAR(order.total)} · to {order.city}
          </span>
        </div>
        <div className="ship-eta">
          <span>{cancelled ? "Not scheduled" : "Estimated delivery"}</span>
          <strong>{cancelled ? "—" : fmt(eta)}</strong>
        </div>
      </div>

      {order.status === "await" ? (
        <p className="ship-status">
          Payment hasn’t cleared yet, so the making queue hasn’t started. Dates appear as soon as
          PayFast confirms.
        </p>
      ) : null}
      {cancelled ? (
        <p className="ship-status ship-status-miss">
          This order was cancelled and nothing was charged.
        </p>
      ) : null}

      <ol className="ship-timeline">
        {STAGES.map((s, i) => {
          const done = !cancelled && current >= i;
          const active = !cancelled && current === i;
          return (
            <li key={s.key} className={done ? (active ? "done active" : "done") : ""}>
              <span className="dot" aria-hidden="true" />
              <div>
                <strong>{s.label}</strong>
                <span>{s.note}</span>
              </div>
              <em>{cancelled ? "—" : fmt(addBusinessDays(placed, s.days))}</em>
            </li>
          );
        })}
      </ol>

      <div className="sig-actions">
        <Link
          className="btn btn-primary"
          to="/order/$reference"
          params={{ reference: order.reference }}
        >
          Open order page
        </Link>
      </div>
    </div>
  );
}
