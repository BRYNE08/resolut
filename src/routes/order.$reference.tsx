import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import "@/lib/resolut/resolut.css";
import { orderQuery } from "@/lib/api/queries";
import type { Order, OrderLine } from "@/lib/data/types";
import { StorefrontChrome } from "@/components/resolut/chrome";
import { ZAR } from "@/lib/money";

const searchSchema = z.object({
  status: z.enum(["complete", "cancelled"]).optional(),
});

export const Route = createFileRoute("/order/$reference")({
  validateSearch: (search) => searchSchema.parse(search),
  head: ({ params }) => {
    const title = `Order ${params.reference} — Resolut`;
    const description = "Your Resolut order status and summary.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
        { name: "referrer", content: "no-referrer" },
      ],
    };
  },
  component: OrderPage,
});

const COPY: Record<string, { eyebrow: string; heading: string; note: string }> = {
  await: {
    eyebrow: "Awaiting payment",
    heading: "We\u2019re waiting on PayFast",
    note: "PayFast is still confirming this payment. This page updates itself as soon as the confirmation lands.",
  },
  paid: {
    eyebrow: "Payment received",
    heading: "Thank you \u2014 your piece is booked",
    note: "PayFast has confirmed the payment. Your lamp enters the making queue and we\u2019ll email you at each stage.",
  },
  making: {
    eyebrow: "In the workshop",
    heading: "Your piece is being made",
    note: "Hand assembly takes two to three weeks.",
  },
  shipped: {
    eyebrow: "Shipped",
    heading: "Your piece is on its way",
    note: "Courier tracking has been emailed to you.",
  },
  cancelled: {
    eyebrow: "Payment not completed",
    heading: "This order wasn\u2019t paid",
    note: "The payment was cancelled or declined. Nothing has been charged \u2014 you\u2019re welcome to try again.",
  },
};

function OrderPage() {
  const { reference } = Route.useParams();
  const { status: fromPayfast } = Route.useSearch();
  const hash = useLocation({ select: (location) => location.hash });
  const [credential, setCredential] = useState<{ hash: string; token?: string }>();
  useEffect(() => {
    setCredential({
      hash,
      token: new URLSearchParams(hash.replace(/^#/, "")).get("access") ?? undefined,
    });
  }, [hash]);

  const { data, isPending } = useQuery({
    ...orderQuery(reference, credential?.token),
    enabled: credential?.hash === hash,
    // While PayFast's callback is still in flight, poll until it lands.
    refetchInterval: (query) => {
      const current = query.state.data as { order: Order | null } | undefined;
      return current?.order?.status === "await" ? 4000 : false;
    },
  });

  const order = data?.order ?? null;
  const copy = COPY[order?.status ?? "await"]!;

  return (
    <StorefrontChrome>
      <div className="pdp-page">
        <main className="pdp checkout-page">
          <div className="wrap">
            <nav className="pdp-crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <Link to="/collection" search={{ availability: "all", sort: "curated" }}>Collection</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Order {reference}</span>
            </nav>

            {isPending && !order ? (
              <div className="co-done">
                <p className="eyebrow">One moment</p>
                <h1>Fetching your order{"\u2026"}</h1>
              </div>
            ) : !order ? (
              <div className="co-done">
                <p className="eyebrow">Order unavailable</p>
                <h1>We can&rsquo;t display this order</h1>
                <p>
                  Open the private link in your latest order email or sign in with the account
                  matching your order email. Links expire after 30 days. For help with an older
                  order, email the studio.
                </p>
                <Link className="btn btn-primary" to="/signin" search={{ redirect: `/order/${encodeURIComponent(reference)}` }}>
                  Sign in
                </Link>{" "}
                <a className="btn btn-ghost" href="mailto:orders@resolutdesign.co.za">
                  Contact the studio
                </a>
                <Link className="btn btn-primary" to="/collection" search={{ availability: "all", sort: "curated" }}>
                  Back to the collection
                </Link>
              </div>
            ) : (
              <div className="co-done">
                <p className="eyebrow">{copy.eyebrow}</p>
                <h1>{copy.heading}</h1>
                <p className="co-note">
                  Order reference <strong>{order.reference}</strong>
                  {fromPayfast === "cancelled" && order.status === "await"
                    ? " \u00b7 you returned from PayFast without completing payment"
                    : ""}
                </p>
                <p>{copy.note}</p>

                <ul className="co-lines" style={{ marginTop: "1.5rem" }}>
                  {order.lines.map((l: OrderLine) => (
                    <li key={l.slug}>
                      <div>
                        <strong>{l.name}</strong>
                        <span>Qty {l.quantity}</span>
                      </div>
                      <em>{ZAR(l.unitPrice * l.quantity)}</em>
                    </li>
                  ))}
                </ul>
                <div className="co-row-total tot">
                  <span>Total</span>
                  <span>{ZAR(order.total)}</span>
                </div>

                <div className="sig-actions" style={{ marginTop: "1.5rem" }}>
                  {order.status === "cancelled" || fromPayfast === "cancelled" ? (
                    <Link className="btn btn-primary" to="/checkout">
                      Try payment again
                    </Link>
                  ) : null}
                  <Link className="btn btn-ghost" to="/collection" search={{ availability: "all", sort: "curated" }}>
                    Back to the collection
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </StorefrontChrome>
  );
}
