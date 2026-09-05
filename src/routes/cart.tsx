import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import "@/lib/resolut/resolut.css";
import { cartQuery, productsQuery, queryKeys } from "@/lib/api/queries";
import { setCartItem, syncCart } from "@/lib/api/cart.functions";
import { StorefrontChrome } from "@/components/resolut/chrome";
import { ZAR } from "@/lib/money";
import { cartStore, priceCart, readStoredCart, FREE_SHIPPING_THRESHOLD } from "@/lib/store/cart-store";
import type { CartItems } from "@/lib/data/types";

const TITLE = "Your Cart — Resolut";
const DESCRIPTION = "Review the pieces in your Resolut cart before checkout.";

export const Route = createFileRoute("/cart")({
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
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(cartQuery),
    ]),
  component: CartPage,
});

function CartPage() {
  // Server state: the datastore-owned cart. Client state: badge/drawer mirror.
  const { data: cart } = useSuspenseQuery(cartQuery);
  const { data: catalogue } = useSuspenseQuery(productsQuery);
  const queryClient = useQueryClient();
  const setItem = useServerFn(setCartItem);
  const mergeCart = useServerFn(syncCart);
  const synced = useRef(false);

  /** Applies a server cart result to both the query cache and the nav badge. */
  const applyServerCart = (result: { items: CartItems }) => {
    queryClient.setQueryData(queryKeys.cart, { ...cart, ...result });
    cartStore.replace(result.items);
  };

  // One-way upgrade: fold any legacy localStorage cart into the server cart once.
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    const localItems = readStoredCart();
    const local = Object.entries(localItems).filter(([slug, qty]) => qty > 0);
    if (local.length === 0) {
      // Server owns the cart: restore the local badge/drawer mirror from it.
      if (Object.keys(cart.items).length > 0) cartStore.replace(cart.items);
      return;
    }
    const missing = local.some(([slug, qty]) => (cart.items[slug] ?? 0) < qty);
    if (!missing) return;
    mergeCart({ data: { items: localItems } })
      .then(applyServerCart)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quantityMutation = useMutation({
    mutationFn: setItem,
    onSuccess: applyServerCart,
  });

  const priced = priceCart(cart.items, catalogue.products);
  const lines = priced.lines;

  const setQuantity = (slug: string, quantity: number) =>
    quantityMutation.mutate({ data: { slug, quantity } });

  return (
    <StorefrontChrome>
      <div className="pdp-page">
        <main className="pdp checkout-page cart-page">
        <div className="wrap">
          <nav className="pdp-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link to="/collection" search={{ availability: "all", sort: "curated" }}>Collection</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Cart</span>
          </nav>

          <p className="eyebrow">Your cart</p>
          <h1 className="co-title">Pieces set aside</h1>

          {lines.length === 0 ? (
            <div className="co-done">
              <p>
                Your cart is empty. Browse the <Link to="/collection" search={{ availability: "all", sort: "curated" }}>collection</Link> to find a
                piece made for your space.
              </p>
              <Link className="btn btn-primary" to="/collection" search={{ availability: "all", sort: "curated" }}>
                Browse the collection
              </Link>
            </div>
          ) : (
            <div className="co-grid">
              <section className="co-block">
                <h2>
                  {lines.length} {lines.length === 1 ? "piece" : "pieces"}
                </h2>
                <ul className="cart-lines">
                  {lines.map((l) => (
                    <li key={l.slug} className="cart-line">
                      <Link
                        to="/product/$slug"
                        params={{ slug: l.slug }}
                        className="co-thumb cart-line-thumb"
                      >
                        <img src={l.image} alt={l.name} />
                      </Link>
                      <div className="cart-line-info">
                        <Link to="/product/$slug" params={{ slug: l.slug }}>
                          <strong>{l.name}</strong>
                        </Link>
                        <span>Made to order · 2&ndash;3 weeks</span>
                        <em>{ZAR(l.unitPrice)}</em>
                      </div>
                      <div className="cart-line-actions">
                        <div className="qty-stepper">
                          <button
                            type="button"
                            aria-label={`Decrease ${l.name} quantity`}
                            disabled={quantityMutation.isPending}
                            onClick={() => setQuantity(l.slug, l.quantity - 1)}
                          >
                            &minus;
                          </button>
                          <span aria-live="polite">{l.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Increase ${l.name} quantity`}
                            disabled={quantityMutation.isPending || l.quantity >= 99}
                            onClick={() => setQuantity(l.slug, l.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <em className="cart-line-total">{ZAR(l.unitPrice * l.quantity)}</em>
                        <button
                          type="button"
                          className="cart-line-remove"
                          disabled={quantityMutation.isPending}
                          onClick={() => setQuantity(l.slug, 0)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <aside className="co-order">
                <h2>Summary</h2>
                <div className="co-row-total">
                  <span>Subtotal</span>
                  <span>{ZAR(priced.subtotal)}</span>
                </div>
                <div className="co-row-total">
                  <span>Delivery</span>
                  <span>{priced.freeShipping ? "Free" : "Calculated after"}</span>
                </div>
                <div className="co-row-total tot">
                  <span>Total</span>
                  <span>{ZAR(priced.subtotal)}</span>
                </div>
                <p className="co-note">
                  {priced.freeShipping
                    ? "You’ve qualified for free delivery."
                    : `Add ${ZAR(Math.max(0, FREE_SHIPPING_THRESHOLD - priced.subtotal))} more for free delivery.`}
                </p>
                <div className="sig-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <Link className="btn btn-primary" to="/checkout">
                    Proceed to checkout
                  </Link>
                  <Link className="btn btn-ghost" to="/collection" search={{ availability: "all", sort: "curated" }}>
                    Continue looking
                  </Link>
                </div>
              </aside>
            </div>
          )}
        </div>
        </main>
      </div>
    </StorefrontChrome>
  );
}
