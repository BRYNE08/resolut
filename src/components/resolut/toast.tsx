import { useEffect } from "react";
import { uiStore, useUi } from "@/lib/store/ui-store";

/** Storefront toast notification, driven by the UI store. */
export function Toast() {
  const toast = useUi().toast;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => uiStore.clearToast(), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">
      {toast?.message ?? ""}
    </div>
  );
}
