/**
 * Cart state — a tiny external store instead of scattered localStorage reads.
 *
 * `useSyncExternalStore` gives React components a consistent snapshot, and the
 * store stays in sync with the legacy vanilla cart drawer through localStorage
 * plus a `resolut:cart` event. Server state (products, orders, dashboard) lives
 * in TanStack Query; only client-owned state lives here.
 */
import { useSyncExternalStore } from "react";

export type CartItems = Record<string, number>;

export const CART_KEY = "resolut.cart";
export const CART_EVENT = "resolut:cart";
export const FREE_SHIPPING_THRESHOLD = 7500;

/** Frozen so getServerSnapshot returns a stable reference across renders. */
const EMPTY: CartItems = Object.freeze({});

let snapshot: CartItems = EMPTY;
let serialized = "{}";
const listeners = new Set<() => void>();

function sanitize(raw: unknown): CartItems {
  if (!raw || typeof raw !== "object") return {};
  const out: CartItems = {};
  Object.entries(raw as Record<string, unknown>).forEach(([slug, qty]) => {
    const n = Number(qty);
    if (Number.isFinite(n) && n > 0) out[slug] = Math.min(99, Math.floor(n));
  });
  return out;
}

function readStorage(): CartItems {
  if (typeof window === "undefined") return {};
  try {
    return sanitize(JSON.parse(window.localStorage.getItem(CART_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

function emit() {
  listeners.forEach((l) => l());
}

/** Re-read storage; only swap the snapshot when the contents actually changed. */
function refresh() {
  const next = readStorage();
  const nextSerialized = JSON.stringify(next);
  if (nextSerialized === serialized) return;
  snapshot = next;
  serialized = nextSerialized;
  emit();
}

function write(next: CartItems) {
  snapshot = sanitize(next);
  serialized = JSON.stringify(snapshot);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CART_KEY, serialized);
    } catch {
      /* private mode — keep in-memory state */
    }
    (window as unknown as { __resolutCart?: CartItems }).__resolutCart = snapshot;
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  }
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener(CART_EVENT, refresh);
    window.addEventListener("storage", refresh);
  }
  listeners.add(listener);
  refresh();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener(CART_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    }
  };
}

export const cartStore = {
  subscribe,
  getSnapshot: () => snapshot,
  getServerSnapshot: (): CartItems => EMPTY,
  add(slug: string, qty = 1) {
    write({ ...snapshot, [slug]: (snapshot[slug] ?? 0) + qty });
  },
  setQuantity(slug: string, qty: number) {
    const next = { ...snapshot };
    if (qty <= 0) delete next[slug];
    else next[slug] = qty;
    write(next);
  },
  remove(slug: string) {
    const next = { ...snapshot };
    delete next[slug];
    write(next);
  },
  clear() {
    write({});
  },
  /** Mirrors the server-owned cart into the local badge/drawer store. */
  replace(items: CartItems) {
    write(items);
  },
};

/** Direct localStorage read — safe to call before the store's first refresh. */
export function readStoredCart(): CartItems {
  return readStorage();
}

export function useCartItems(): CartItems {
  return useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot,
  );
}

export function useCartCount(): number {
  const items = useCartItems();
  return Object.values(items).reduce((a, b) => a + b, 0);
}

export type PricedLine = {
  slug: string;
  name: string;
  quantity: number;
  unitPrice: number;
  image: string;
};

/** Join client cart quantities with server-owned pricing. */
export function priceCart(
  items: CartItems,
  products: {
    slug: string;
    name: string;
    price: number | null;
    image: string;
    published?: boolean;
  }[],
): {
  unavailableSlugs: string[];
  lines: PricedLine[];
  subtotal: number;
  freeShipping: boolean;
  shortfall: number;
} {
  const lines = Object.entries(items).flatMap(([slug, quantity]) => {
    const product = products.find((p) => p.slug === slug);
    if (
      !product ||
      product.published === false ||
      product.price == null ||
      !Number.isFinite(product.price) ||
      product.price <= 0 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    )
      return [];
    return [{ slug, name: product.name, quantity, unitPrice: product.price, image: product.image }];
  });
  const unavailableSlugs = Object.keys(items).filter(
    (slug) => !lines.some((line) => line.slug === slug),
  );
  const subtotal = lines.reduce((s, l) => s + Math.round(l.unitPrice * 100) * l.quantity, 0) / 100;
  return {
    lines,
    unavailableSlugs,
    subtotal,
    freeShipping: subtotal >= FREE_SHIPPING_THRESHOLD,
    shortfall: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
  };
}
