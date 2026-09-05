import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import "@/lib/resolut/resolut.css";
import { productsQuery, queryKeys } from "@/lib/api/queries";
import { clearCart } from "@/lib/api/cart.functions";
import { startPayfastCheckout } from "@/lib/api/payments.functions";
import { StorefrontChrome } from "@/components/resolut/chrome";
import { cartStore, priceCart, useCartItems, FREE_SHIPPING_THRESHOLD } from "@/lib/store/cart-store";

const FREE_SHIP = FREE_SHIPPING_THRESHOLD;
const ZAR = (n: number) =>
  // Deterministic grouping: Intl locale data differs between server and browser.
  "R\u00a0" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const TITLE = "Checkout — Resolut";
const DESCRIPTION =
  "Complete your Resolut order. Enter delivery details and pay securely through the PayFast gateway.";

export const Route = createFileRoute("/checkout")({
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
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: CheckoutPage,
});

const initialForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  address2: "",
  suburb: "",
  city: "",
  province: "",
  postal: "",
  notes: "",
};

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

type PaymentRequest = { processUrl: string; fields: { name: string; value: string }[] };

/**
 * PayFast expects a form POST, not a GET redirect, and the field order is part
 * of the signature — so we replay the server-built fields verbatim.
 */
function postToPayfast(payment: PaymentRequest) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = payment.processUrl;
  form.style.display = "none";
  payment.fields.forEach(({ name, value }) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function CheckoutPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [redirecting, setRedirecting] = useState(false);

  // Client state: the cart store. Server state: product pricing via Query.
  const items = useCartItems();
  const { data: catalogue } = useSuspenseQuery(productsQuery);
  const priced = priceCart(items, catalogue.products);
  const lines = priced.lines.map((l) => ({
    slug: l.slug,
    name: l.name,
    qty: l.quantity,
    price: l.unitPrice,
    image: l.image,
  }));
  const subtotal = priced.subtotal;
  const freeShip = priced.freeShipping;

  const queryClient = useQueryClient();
  const submitOrder = useServerFn(startPayfastCheckout);
  const emptyServerCart = useServerFn(clearCart);
  const orderMutation = useMutation({
    mutationFn: submitOrder,
    onSuccess: (result) => {
      // The order is saved server-side and the server cart is already cleared;
      // mirror that on the client, then hand the buyer over to PayFast.
      cartStore.clear();
      queryClient.setQueryData(queryKeys.cart, { source: result.source, items: {} });
      void emptyServerCart().catch(() => {});
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      setRedirecting(true);
      postToPayfast(result.payment);
    },
  });

  const set =
    (k: keyof typeof initialForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Please enter a valid email address.";
    if (form.phone.trim().length < 7) e.phone = "Please enter a contact number.";
    if (form.address.trim().length < 5) e.address = "Please enter your delivery address.";
    if (form.city.trim().length < 2) e.city = "Please enter your city or town.";
    if (form.province.trim().length < 2) e.province = "Please select your province.";
    if (!/^\d{4}$/.test(form.postal.trim())) e.postal = "Please enter a 4-digit postal code.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate() || lines.length === 0) return;
    orderMutation.mutate({
      data: {
        customerName: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        addressLine: form.address.trim(),
        addressLine2: form.address2.trim() || undefined,
        suburb: form.suburb.trim() || undefined,
        city: form.city.trim(),
        province: form.province.trim(),
        postalCode: form.postal.trim(),
        country: "South Africa",
        deliveryNotes: form.notes.trim() || undefined,
        lines: lines.map((l) => ({ slug: l.slug, quantity: l.qty })),
      },
    });
  }

  const field = (
    key: keyof typeof initialForm,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="field">
      <label htmlFor={`co-${key}`}>{label}</label>
      <input
        id={`co-${key}`}
        value={form[key]}
        onChange={set(key)}
        className={errors[key] ? "error" : ""}
        {...props}
      />
      <div className={`err-msg${errors[key] ? " show" : ""}`}>{errors[key] ?? ""}</div>
    </div>
  );

  return (
    <StorefrontChrome>
      <div className="pdp-page">
        <main className="pdp checkout-page">
        <div className="wrap">
          <nav className="pdp-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <a href="/#collection">Collection</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Checkout</span>
          </nav>

          {redirecting ? (
            <div className="co-done">
              <p className="eyebrow">Order saved</p>
              <h1>Taking you to PayFast{"\u2026"}</h1>
              {orderMutation.data ? (
                <p className="co-note">
                  Order reference <strong>{orderMutation.data.order.reference}</strong>
                </p>
              ) : null}
              <p>
                Your order is saved. PayFast&rsquo;s secure page is opening now to complete payment. If nothing happens,
                use the button below.
              </p>
              {orderMutation.data ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => postToPayfast(orderMutation.data!.payment)}
                >
                  Continue to PayFast
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="eyebrow">Checkout</p>
              <h1 className="co-title">Complete your order</h1>

              <div className="co-grid">
                <form className="co-form" onSubmit={onSubmit} noValidate>
                  <section className="co-block">
                    <h2>Delivery details</h2>
                    {field("name", "Full name", { autoComplete: "name" })}
                    {field("email", "Email address", { type: "email", autoComplete: "email" })}
                    {field("phone", "Contact number", { type: "tel", autoComplete: "tel" })}
                  </section>

                  <section className="co-block">
                    <h2>Shipping address</h2>
                    <p className="co-note">
                      Your piece is delivered to this address once it leaves the workshop. Add a complex, unit or
                      access note so the courier can find you.
                    </p>
                    {field("address", "Street address", { autoComplete: "address-line1" })}
                    {field("address2", "Apartment, suite, complex (optional)", {
                      autoComplete: "address-line2",
                    })}
                    <div className="co-row">
                      {field("suburb", "Suburb (optional)", { autoComplete: "address-level3" })}
                      {field("city", "City / town", { autoComplete: "address-level2" })}
                    </div>
                    <div className="co-row">
                      <div className="field">
                        <label htmlFor="co-province">Province</label>
                        <select
                          id="co-province"
                          value={form.province}
                          onChange={set("province")}
                          className={errors["province"] ? "error" : ""}
                        >
                          <option value="">Select a province</option>
                          {PROVINCES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <div className={`err-msg${errors["province"] ? " show" : ""}`}>
                          {errors["province"] ?? ""}
                        </div>
                      </div>
                      {field("postal", "Postal code", { inputMode: "numeric", autoComplete: "postal-code" })}
                    </div>
                    <div className="field">
                      <label htmlFor="co-country">Country</label>
                      <input id="co-country" value="South Africa" readOnly disabled />
                      <div className="err-msg" />
                    </div>
                    <div className="field">
                      <label htmlFor="co-notes">Delivery notes (optional)</label>
                      <textarea
                        id="co-notes"
                        rows={3}
                        maxLength={500}
                        value={form.notes}
                        onChange={set("notes")}
                        placeholder="Gate code, best delivery times, safe place to leave the crate."
                      />
                      <div className="err-msg" />
                    </div>
                  </section>

                  <section className="co-block">
                    <h2>Payment</h2>
                    <p className="co-note">
                      Placing this order saves it under a reference, then hands you to PayFast&rsquo;s secure page to
                      pay by instant EFT, card or SnapScan. Your account and card details are entered on PayFast only
                      &mdash; never here.
                    </p>
                  </section>

                  <section className="co-block co-payfast">
                    <div className="pf-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 3l7 3v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6l7-3z" />
                        <path d="M9 12.5l2 2 4-4.5" />
                      </svg>
                    </div>
                    <div>
                      <h2>All payments processed by PayFast</h2>
                      <p>
                        Every transaction is handled by PayFast, a South African payment gateway, over an encrypted
                        connection. Resolut never sees or stores your full card number or online banking login. PayFast
                        supports instant EFT, Visa, Mastercard, and SnapScan.
                      </p>
                      <ul className="pf-list">
                        <li>PCI-DSS compliant gateway</li>
                        <li>3D Secure card verification</li>
                        <li>Encrypted, South African hosted</li>
                      </ul>
                    </div>
                  </section>

                  {orderMutation.isError ? (
                    <p className="co-note" role="alert">
                      We couldn&rsquo;t place your order just now. Please try again in a moment.
                    </p>
                  ) : null}

                  <div className="sig-actions">
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={lines.length === 0 || orderMutation.isPending || redirecting}
                    >
                      {orderMutation.isPending || redirecting
                        ? "Redirecting to PayFast\u2026"
                        : "Pay with PayFast"}
                    </button>
                    <Link className="btn btn-ghost" to="/">
                      Continue looking
                    </Link>
                  </div>
                </form>

                <aside className="co-order">
                  <h2>Your order</h2>
                  {lines.length === 0 ? (
                    <p className="co-note">
                      Your cart is empty. <Link to="/">Choose a piece</Link> to begin.
                    </p>
                  ) : (
                    <>
                      <ul className="co-lines">
                        {lines.map((l) => (
                          <li key={l.slug}>
                            <div className="co-thumb">
                              <img src={l.image} alt={l.name} />
                            </div>
                            <div>
                              <strong>{l.name}</strong>
                              <span>Qty {l.qty} · Made to order · 2&ndash;3 weeks</span>
                            </div>
                            <em>{ZAR(l.price * l.qty)}</em>
                          </li>
                        ))}
                      </ul>
                      <div className="co-row-total">
                        <span>Subtotal</span>
                        <span>{ZAR(subtotal)}</span>
                      </div>
                      <div className="co-row-total">
                        <span>Delivery</span>
                        <span>{freeShip ? "Free" : "Calculated after"}</span>
                      </div>
                      <div className="co-row-total tot">
                        <span>Total</span>
                        <span>{ZAR(subtotal)}</span>
                      </div>
                      <p className="co-note">
                        {freeShip
                          ? "You\u2019ve qualified for free delivery."
                          : `Add ${ZAR(FREE_SHIP - subtotal)} more for free delivery.`}
                      </p>
                    </>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
        </main>
      </div>
    </StorefrontChrome>
  );
}
