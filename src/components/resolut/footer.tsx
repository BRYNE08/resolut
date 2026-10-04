import { Link } from "@tanstack/react-router";
import { uiStore } from "@/lib/store/ui-store";
import { ResolutLogo } from "./logo";

export function StorefrontFooter({ home = false }: { home?: boolean }) {
  const hash = (id: string) => (home ? `#${id}` : `/#${id}`);

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <div className="brand">
              <ResolutLogo height={44} label="Resolut" />
            </div>
            <p>
              Precision, resolved in light. Sculptural, 3D-printed lighting for those who treat
              illumination as design.
            </p>
          </div>
          <div className="foot-col">
            <h4>Explore</h4>
            <a href={hash("collection")}>Collection</a>
            <a href={hash("philosophy")}>Philosophy</a>
            <a href={hash("process")}>Process</a>
          </div>
          <div className="foot-col">
            <h4>Company</h4>
            <a href={hash("philosophy")}>About</a>
            <Link to="/contact">Contact</Link>
            <Link to="/shipping">Shipping &amp; tracking</Link>
          </div>
          <div className="foot-col">
            <h4>Connect</h4>
            <a href="https://instagram.com/resolut.design" target="_blank" rel="noopener">
              Instagram
            </a>
            <a href="https://wa.me/27693837314" target="_blank" rel="noopener">
              WhatsApp
            </a>
            <a href="mailto:hello@resolutdesign.co.za">Email</a>
          </div>
        </div>
        <div className="foot-legal">
          <button type="button" onClick={() => uiStore.openLegal("terms")}>
            Terms &amp; Conditions
          </button>
          <button type="button" onClick={() => uiStore.openLegal("refund")}>
            Refund &amp; Returns
          </button>
          <button type="button" onClick={() => uiStore.openLegal("privacy")}>
            Privacy Policy
          </button>
          <button type="button" onClick={() => uiStore.openLegal("shipping")}>
            Shipping &amp; Delivery
          </button>
        </div>
        <div className="foot-bottom">
          <p>© 2026 Resolut Design. All rights reserved.</p>
          <p className="foot-addr">
            King William’s Town
            <br />
            Eastern Cape, South Africa
          </p>
        </div>
        <p className="foot-reg">
          Resolut is a trading name of Slash Resolut (Pty) Ltd · Reg. no. 2024/854669/07 · King
          William’s Town, Eastern Cape · resolutdesign.co.za. Prices in South African Rand (ZAR),
          incl. VAT where applicable.
        </p>
      </div>
    </footer>
  );
}
