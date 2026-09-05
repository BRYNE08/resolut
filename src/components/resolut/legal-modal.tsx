import { useEffect } from "react";
import { LEGAL_DOCS } from "@/lib/resolut/legal";
import { uiStore, useUi } from "@/lib/store/ui-store";

/** Legal document modal — content comes from src/lib/resolut/legal.ts. */
export function LegalModal() {
  const doc = useUi().legalDoc;
  const legal = doc ? LEGAL_DOCS[doc] : null;

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") uiStore.closeLegal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [doc]);

  return (
    <div
      className={doc ? "legal-overlay open" : "legal-overlay"}
      onClick={(e) => {
        if (e.target === e.currentTarget) uiStore.closeLegal();
      }}
    >
      <div className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legalTitle">
        <div className="legal-head">
          <h3 id="legalTitle">{legal?.title ?? ""}</h3>
          <button className="legal-close" aria-label="Close" onClick={() => uiStore.closeLegal()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {/* Trusted, author-owned markup from src/lib/resolut/legal.ts */}
        <div
          className="legal-body"
          dangerouslySetInnerHTML={{ __html: legal?.html ?? "" }}
        />
      </div>
    </div>
  );
}
