import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCartCount } from "@/lib/store/cart-store";
import { uiStore } from "@/lib/store/ui-store";
import { ResolutLogo } from "./logo";

/**
 * Storefront navigation. On the home page, section links are plain hash
 * anchors; on subpages they point back to `/#section`.
 */
export function StorefrontNav({ home = false }: { home?: boolean }) {
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const count = useCartCount();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hash = (id: string) => (home ? `#${id}` : `/#${id}`);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={solid ? "nav solid" : "nav"} id="nav">
      <a href={hash("top")} className="brand" aria-label="Resolut home">
        <ResolutLogo height={40} />
      </a>
      <nav className={menuOpen ? "navlinks open" : "navlinks"} id="navlinks">
        <Link to="/collection" search={{ availability: "all", sort: "curated" }} onClick={closeMenu}>
          Collection
        </Link>
        <a href="https://www.resolutdesign.co.za/product/cornice-2" onClick={closeMenu}>Cornice</a>
        <a href="https://www.resolutdesign.co.za/product/volute-2" onClick={closeMenu}>Volute</a>
        {/* <a href={hash("philosophy")} onClick={closeMenu}>Philosophy</a> */}
        <a href={hash("process")} onClick={closeMenu}>Process</a>
        <Link to="/shipping" onClick={closeMenu}>Shipping</Link>
        {/* <Link to="/account" onClick={closeMenu}>Account</Link> */}
        <Link to="/contact" onClick={closeMenu}>Contact</Link>
        <button className="nav-cart" aria-label="Open cart" onClick={() => uiStore.openCart()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M6 6h15l-1.5 9h-12z" />
            <path d="M6 6L5 3H2" />
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="18" cy="20" r="1.4" />
          </svg>
          <span className={count > 0 ? "count show" : "count"}>{count}</span>
        </button>
      </nav>
      <button className="burger" aria-label="Menu" onClick={() => setMenuOpen((open) => !open)}>
        <span></span>
        <span></span>
        <span></span>
      </button>
    </header>
  );
}
