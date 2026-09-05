/**
 * Storefront UI state — cart drawer, legal modal, and toast notifications.
 *
 * Same external-store pattern as cart-store: a single immutable snapshot read
 * through `useSyncExternalStore`, so every component stays in sync without
 * prop drilling. Server state lives in TanStack Query; this store is purely
 * client-owned interface state.
 */
import { useSyncExternalStore } from "react";
import type { LegalKey } from "@/lib/resolut/legal";

export type UiState = {
  cartOpen: boolean;
  legalDoc: LegalKey | null;
  toast: { id: number; message: string } | null;
};

/** Frozen so getServerSnapshot returns a stable reference across renders. */
const INITIAL: UiState = Object.freeze({ cartOpen: false, legalDoc: null, toast: null });

let state: UiState = INITIAL;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Overlays lock body scroll while open. */
function syncBodyScroll(next: UiState) {
  if (typeof document === "undefined") return;
  document.body.style.overflow = next.cartOpen || next.legalDoc ? "hidden" : "";
}

function set(partial: Partial<UiState>) {
  state = { ...state, ...partial };
  syncBodyScroll(state);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const uiStore = {
  subscribe,
  getSnapshot: (): UiState => state,
  getServerSnapshot: (): UiState => INITIAL,
  openCart() {
    set({ cartOpen: true });
  },
  closeCart() {
    set({ cartOpen: false });
  },
  openLegal(doc: LegalKey) {
    set({ legalDoc: doc });
  },
  closeLegal() {
    set({ legalDoc: null });
  },
  showToast(message: string) {
    set({ toast: { id: Date.now(), message } });
  },
  clearToast() {
    if (state.toast) set({ toast: null });
  },
};

export function useUi(): UiState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.getSnapshot, uiStore.getServerSnapshot);
}
