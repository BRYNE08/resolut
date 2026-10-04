/**
 * Slide-in cart drawer. Quantities live in the client cart store; pricing is
 * joined from TanStack Query's products cache. The full checkout lives on the
 * /checkout page — the drawer hands off to it.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { productsQuery } from "@/lib/api/queries";
import { ZAR } from "@/lib/money";
import { cartStore, priceCart, useCartItems } from "@/lib/store/cart-store";
import { uiStore, useUi } from "@/lib/store/ui-store";

export function CartDrawer() {
  const open = useUi().cartOpen;
  const items = useCartItems();
  const { data } = useQuery(productsQuery);
  const navigate = useNavigate();

  const priced = priceCart(items, data?.products ?? []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") uiStore.closeCart();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const goCheckout = () => {
    uiStore.closeCart();
    void navigate({ to: "/checkout" });
  };

  return (
    <>
      <div
        className={open ? "cart-overlay open" : "cart-overlay"}
        onClick={() => uiStore.closeCart()}
      />
      <aside className={open ? "cart-drawer open" : "cart-drawer"} aria-label="Shopping cart">
        <div
          className="cart-step"
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <div className="cart-head">
            <h3>Your cart</h3>
            <button
              className="cart-close"
              aria-label="Close cart"
              onClick={() => uiStore.closeCart()}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {data && priced.unavailableSlugs.length > 0 && (
            <div role="alert">
              <p>Some items are no longer available.</p>
              <button
                onClick={() => priced.unavailableSlugs.forEach((slug) => cartStore.remove(slug))}
              >
                Remove unavailable items
              </button>
            </div>
          )}
          {priced.lines.length === 0 ? (
            <div className="cart-body">
              <div className="cart-empty">
                Your cart is empty.
                <br />
                Add a piece to begin.
              </div>
            </div>
          ) : (
            <>
              <div className="cart-body">
                {priced.lines.map((line) => (
                  <div className="cart-item" key={line.slug}>
                    <div className="cart-item-img">
                      <img src={line.image} alt={line.name} />
                    </div>
                    <div className="cart-item-info">
                      <h4>{line.name}</h4>
                      <div className="ci-lead">Made to order · 2–3 weeks</div>
                      <div className="ci-price">{ZAR(line.unitPrice)}</div>
                      <div className="ci-controls">
                        <div className="qty-step">
                          <button
                            aria-label={`Decrease ${line.name} quantity`}
                            onClick={() => cartStore.setQuantity(line.slug, line.quantity - 1)}
                          >
                            −
                          </button>
                          <span>{line.quantity}</span>
                          <button
                            aria-label={`Increase ${line.name} quantity`}
                            onClick={() => cartStore.setQuantity(line.slug, line.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <button className="ci-remove" onClick={() => cartStore.remove(line.slug)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-foot" style={{ display: "block" }}>
                <p className="cart-ship">
                  {priced.freeShipping
                    ? "You’ve qualified for free delivery."
                    : `Add ${ZAR(priced.shortfall)} more for free delivery.`}
                </p>
                <div className="cart-total">
                  <span className="lbl">Subtotal</span>
                  <span className="amt">{ZAR(priced.subtotal)}</span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={goCheckout}
                  disabled={!data || priced.unavailableSlugs.length > 0}
                >
                  Checkout
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
