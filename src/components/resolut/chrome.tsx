import type { ReactNode } from "react";
import { CartDrawer } from "./cart-drawer";
import { StorefrontFooter } from "./footer";
import { LegalModal } from "./legal-modal";
import { StorefrontNav } from "./nav";
import { Toast } from "./toast";

/**
 * Shared storefront chrome: nav, footer, cart drawer, legal modal, toast.
 * Pass `home` on the index route so section links render as bare hash anchors.
 */
export function StorefrontChrome({ home = false, children }: { home?: boolean; children: ReactNode }) {
  return (
    <>
      <StorefrontNav home={home} />
      {children}
      <StorefrontFooter home={home} />
      <CartDrawer />
      <LegalModal />
      <Toast />
    </>
  );
}
