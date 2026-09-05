/**
 * Storefront cart action shared by every "Add to cart" button:
 * update the cart store, notify, and open the drawer.
 */
import { cartStore } from "./cart-store";
import { uiStore } from "./ui-store";

export function addToCart(slug: string, name: string) {
  cartStore.add(slug);
  uiStore.showToast(`${name} added to cart`);
  uiStore.openCart();
}
