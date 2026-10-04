/**
 * Query layer — one place for every server read.
 *
 * Routes prime these in their loader with `ensureQueryData`, components read
 * them with `useSuspenseQuery`, and mutations invalidate by key. Swapping the
 * datastore or auth provider changes nothing here.
 */
import { queryOptions } from "@tanstack/react-query";

import { fetchMyOrders, fetchMyProfile } from "./account.functions";
import { fetchDashboard, fetchStudioData } from "./admin.functions";
import { fetchSession, fetchStudioSession } from "./auth.functions";
import { fetchCart } from "./cart.functions";
import { fetchProduct, fetchProducts } from "./catalog.functions";
import { fetchOrder } from "./payments.functions";

export const queryKeys = {
  session: ["session"] as const,
  studioSession: ["studio-session"] as const,
  cart: ["cart"] as const,
  products: ["products"] as const,
  product: (slug: string) => ["product", slug] as const,
  dashboard: ["dashboard"] as const,
  studio: ["studio"] as const,
  order: (reference: string, accessToken?: string) => ["order", reference, accessToken ?? null] as const,
  myOrders: ["my-orders"] as const,
  myProfile: ["my-profile"] as const,
};

/** Customer portal: the signed-in customer's own orders. */
export const myOrdersQuery = queryOptions({
  queryKey: queryKeys.myOrders,
  queryFn: () => fetchMyOrders(),
  staleTime: 15_000,
});


/** Customer portal: the signed-in customer's saved contact + delivery details. */
export const myProfileQuery = queryOptions({
  queryKey: queryKeys.myProfile,
  queryFn: () => fetchMyProfile(),
  staleTime: 15_000,
});

export const sessionQuery = queryOptions({
  queryKey: queryKeys.session,
  queryFn: () => fetchSession(),
  staleTime: 0,
});

export const studioSessionQuery = queryOptions({
  queryKey: queryKeys.studioSession,
  queryFn: () => fetchStudioSession(),
  staleTime: 0,
});

export const productsQuery = queryOptions({
  queryKey: queryKeys.products,
  queryFn: () => fetchProducts(),
  staleTime: 5 * 60_000,
});

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.product(slug),
    queryFn: () => fetchProduct({ data: { slug } }),
    staleTime: 5 * 60_000,
  });

/** Server-owned cart; short stale time since mutations update it directly. */
export const cartQuery = queryOptions({
  queryKey: queryKeys.cart,
  queryFn: () => fetchCart(),
  staleTime: 10_000,
});

/** Single order by reference — the post-PayFast confirmation page polls this. */
export const orderQuery = (reference: string, accessToken?: string) =>
  queryOptions({
    queryKey: queryKeys.order(reference, accessToken),
    queryFn: () => fetchOrder({ data: { reference, accessToken } }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

export const dashboardQuery = queryOptions({
  queryKey: queryKeys.dashboard,
  queryFn: () => fetchDashboard(),
  staleTime: 30_000,
});

/** Studio-only aggregate read: pieces, orders, waitlist, messages, jobs. */
export const studioQuery = queryOptions({
  queryKey: queryKeys.studio,
  queryFn: () => fetchStudioData(),
  staleTime: 30_000,
});
