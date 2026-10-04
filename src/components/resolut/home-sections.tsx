/**
 * Home page sections, ported from the original static HTML to React.
 * Product data comes from TanStack Query (primed by the index route loader);
 * the Cornice lit/unlit toggle is local React state.
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { productsQuery } from "@/lib/api/queries";
import { addToCart } from "@/lib/store/cart-actions";
import { Reveal } from "./reveal";

const ARROW = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

const CLOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const STAR_PATH = "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z";

function Stars() {
  return (
    <span className="stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <span className="eyebrow">Sculptural lighting · 3D printed in South Africa</span>
        <h1>
          Precision,
          <br />
          <span className="ital">resolved</span>
          <br />
          in light.
        </h1>
        <p className="lede">
          Lighting engineered as a defining design statement — bold, elegant, and made to be felt
          the moment it's switched on.
        </p>
        <div className="hero-actions">
          <a href="https://www.resolutdesign.co.za/product/cornice-2" className="btn btn-primary">
            Meet Cornice {ARROW}
          </a>
          <a href="#collection" className="btn btn-ghost">
            The collection
          </a>
        </div>
      </div>
      <div className="hero-visual">
        <span className="hero-tag">Cornice — crafted to be seen, designed to be felt</span>
        <div className="hero-arch arch">
          <img src="/resolut/cornice-lit.jpg" alt="A sculptural Resolut lamp casting controlled, ribbed light" />
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const words = ["Precision", "Innovation", "Intentional Design", "Architectural Elegance", "Craftsmanship"];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[...words, ...words].map((word, i) => (
          <span key={i}>{word}</span>
        ))}
      </div>
    </div>
  );
}

function Philosophy() {
  return (
    <section className="philosophy" id="philosophy">
      <div className="wrap phil-grid">
        <Reveal>
          <span className="eyebrow">About the brand</span>
          <p className="phil-lead">
            For those who see lighting not as function, but as a <em>defining design statement.</em>
          </p>
        </Reveal>
        <Reveal className="phil-body">
          <p>
            Resolut begins where most lighting stops. Through intentional form, refined structure,
            and controlled illumination, each piece is engineered to shape light and define the
            space around it.
          </p>
          <p>
            Nothing is excessive. Inspired by modern architecture, the work balances strong
            geometric structure with soft, deliberate illumination — every proportion considered,
            every detail resolved.
          </p>
          <p className="phil-sign">— Crafted to be seen. Designed to be felt.</p>
        </Reveal>
      </div>
    </section>
  );
}

const VALUES = [
  {
    num: "01",
    title: "Precision",
    body: "Every design is engineered with intention. Structure, proportion, and detail are carefully considered to ensure clarity and refinement.",
  },
  {
    num: "02",
    title: "Innovation",
    body: "We embrace advanced 3D printing technology to push creative boundaries while maintaining quality and consistency.",
  },
  {
    num: "03",
    title: "Intentional Design",
    body: "Nothing is excessive. Each form is purposeful, minimal, and thoughtfully resolved.",
  },
  {
    num: "04",
    title: "Architectural Elegance",
    body: "Inspired by modern architecture, the brand balances strong geometric structure with soft illumination.",
  },
  {
    num: "05",
    title: "Quality & Craftsmanship",
    body: "From concept to final product, Resolut prioritises premium execution and lasting durability.",
  },
];

function Values() {
  return (
    <section className="values">
      <div className="wrap">
        <Reveal className="values-head">
          <div>
            <span className="eyebrow">What we stand on</span>
            <h2>Core Values</h2>
          </div>
          <p>
            Five principles that hold every Resolut piece to the same standard, from first sketch to
            final form.
          </p>
        </Reveal>
        <div className="value-list">
          {VALUES.map((value) => (
            <Reveal className="value-row" key={value.num}>
              <span className="num">{value.num}</span>
              <h3>{value.title}</h3>
              <p>{value.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Server-owned catalogue via TanStack Query; Cornice stars in its own spotlight below. */
function CollectionSection() {
  const { data } = useSuspenseQuery(productsQuery);
  const pieces = data.products.filter((p) => p.slug !== "cornice");

  return (
    <section className="collection" id="collection">
      <div className="wrap">
        <Reveal className="coll-head">
          <span className="eyebrow">The collection</span>
          <h2>Light, given form</h2>
          <p>
            Each fixture is printed, finished, and tuned by hand — sculptural objects that earn
            their place whether lit or dark.
          </p>
        </Reveal>
        <div className="coll-grid">
          {pieces.map((piece) => (
            <Reveal className="product" key={piece.slug}>
              <div className="frame">
                {piece.badge ? <span className="badge">{piece.badge}</span> : null}
                <div className="arch-img arch">
                  <img src={piece.image} alt={piece.imageAlt} loading="lazy" />
                </div>
              </div>
              <Link className="card-link" to="/product/$slug" params={{ slug: piece.slug }}>
                <span>View details</span>
              </Link>
              <div className="meta">
                <h3>{piece.name}</h3>
                <span className={piece.price ? "price" : "price soon"}>{piece.priceLabel}</span>
              </div>
              <p className="tagline">{piece.tagline}</p>
              {piece.addId ? (
                <button className="card-add" onClick={() => addToCart(piece.addId!, piece.name)}>
                  Add to cart
                </button>
              ) : null}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CorniceSignature() {
  const [lit, setLit] = useState(true);

  return (
    <section className="signature" id="cornice">
      <div className="sig-inner">
        <Reveal className="sig-img">
          <span className="tag">Signature piece</span>
          <button
            className="light-switch"
            aria-pressed={lit}
            aria-label="Toggle lamp light"
            onClick={() => setLit((v) => !v)}
          >
            <span className="ls-track">
              <span className="ls-thumb"></span>
            </span>
            <span className="ls-label">{lit ? "Lit" : "Off"}</span>
          </button>
          <div className="arch-img arch lamp-stack" data-lit={lit}>
            <img className="lamp-off" src="/resolut/cornice-off.jpg" alt="Cornice table lamp, switched off" />
            <img className="lamp-lit" src="/resolut/cornice-lit.jpg" alt="Cornice table lamp, lit and glowing" />
          </div>
        </Reveal>
        <Reveal className="sig-copy">
          <span className="eyebrow">Meet Cornice</span>
          <h2>
            Light, read as
            <br />
            <span className="ital">architecture.</span>
          </h2>
          <p>
            Stacked, tapering tiers wrap a luminous orb — banded, soft, and resolved. Raised on
            three slender legs, Cornice holds a room without filling it. The piece that defines the
            range.
          </p>
          <div className="sig-meta">
            <div className="m">
              <div className="v">380 mm</div>
              <div className="k">Height</div>
            </div>
            <div className="m">
              <div className="v">2700K</div>
              <div className="k">Warm LED</div>
            </div>
            <div className="m">
              <div className="v">Made to order</div>
              <div className="k">Each piece</div>
            </div>
          </div>
          <div className="sig-actions">
            <Link className="btn btn-ghost" to="/product/$slug" params={{ slug: "cornice" }}>
              View details
            </Link>
            <span className="sig-price">{"R 4,450"}</span>
            <button className="btn btn-primary" onClick={() => addToCart("cornice", "Cornice")}>
              Add to cart {ARROW}
            </button>
          </div>
          <div className="lead-note">
            {CLOCK_ICON}
            Made to order · ships in 2–3 weeks
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function VoluteSignature() {
  return (
    <section className="signature alt" id="volute">
      <div className="sig-inner">
        <Reveal className="sig-copy">
          <span className="eyebrow">Meet Volute</span>
          <h2>
            One line, wound
            <br />
            <span className="ital">into light.</span>
          </h2>
          <p>
            A single continuous flute coils around a wide, luminous orb — printed as one unbroken
            path, without seam or join, resting on a sculpted plinth. Where Cornice stacks, Volute
            turns. The softer voice of the range.
          </p>
          <div className="sig-meta">
            <div className="m">
              <div className="v">212 mm</div>
              <div className="k">Diameter</div>
            </div>
            <div className="m">
              <div className="v">2700K</div>
              <div className="k">Warm LED</div>
            </div>
            <div className="m">
              <div className="v">Made to order</div>
              <div className="k">Each piece</div>
            </div>
          </div>
          <div className="sig-actions">
            <Link className="btn btn-ghost" to="/product/$slug" params={{ slug: "volute" }}>
              View details
            </Link>
            <span className="sig-price">{"R 3,450"}</span>
            <button className="btn btn-primary" onClick={() => addToCart("volute", "Volute")}>
              Add to cart {ARROW}
            </button>
          </div>
          <div className="lead-note">
            {CLOCK_ICON}
            Made to order · ships in 2–3 weeks
          </div>
        </Reveal>
        <Reveal className="sig-img">
          <span className="tag">New arrival</span>
          <div className="arch-img arch">
            <img src="/resolut/volute.svg" alt="Volute spiral table lamp, glowing warm" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Feature() {
  return (
    <section className="feature">
      <div className="feature-inner">
        <Reveal className="feature-copy">
          <span className="eyebrow">The making</span>
          <h2>
            Engineered, not <span className="accent">mass produced.</span>
          </h2>
          <p>
            Advanced 3D printing lets us hold tolerances a mould never could — translating
            intricate geometry into a finished object with zero loss of fidelity. The result is
            structure you can read in the light itself.
          </p>
          <div className="feature-stats">
            <div className="stat">
              <div className="n">0.1mm</div>
              <div className="l">Layer precision</div>
            </div>
            <div className="stat">
              <div className="n">100%</div>
              <div className="l">Made to order</div>
            </div>
            <div className="stat">
              <div className="n">∞</div>
              <div className="l">Form possibilities</div>
            </div>
          </div>
        </Reveal>
        <div className="feature-img">
          <img src="/resolut/detail.svg" alt="Close detail of a 3D-printed ribbed lamp surface" loading="lazy" />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    num: "STEP 01",
    title: "Design",
    body: "Every form starts as a structural idea — drawn against principles of proportion, balance, and how light should move through it.",
  },
  {
    num: "STEP 02",
    title: "Print",
    body: "Geometry is resolved layer by layer in precision 3D print, holding detail that conventional manufacturing simply can't.",
  },
  {
    num: "STEP 03",
    title: "Finish",
    body: "Each piece is hand-finished, wired, and quality-checked before it carries the Resolut mark into your space.",
  },
];

function Process() {
  return (
    <section className="process" id="process">
      <div className="wrap">
        <Reveal className="process-head">
          <span className="eyebrow">How a piece comes to be</span>
          <h2>
            From concept
            <br />
            to resolved form
          </h2>
        </Reveal>
        <div className="steps">
          {STEPS.map((step) => (
            <Reveal className="step" key={step.num}>
              <span className="snum">{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const TRUST_ITEMS = [
  {
    icon: <path d="M12 2l2.4 6.9H22l-6 4.6 2.3 7L12 16.9 5.7 20.5 8 13.5l-6-4.6h7.6z" />,
    title: "Made to order",
    body: "Each piece is printed and finished by hand once you order — never mass produced.",
  },
  {
    icon: (
      <>
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v6l9 4 9-4V7" />
      </>
    ),
    title: "Recycled material",
    body: "Printed in a recycled PLA composite — premium feel, lighter footprint.",
  },
  {
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    title: "2-year warranty",
    body: "Backed against defects in workmanship, with local support and repairs.",
  },
  {
    icon: (
      <>
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    title: "Nationwide delivery",
    body: "Shipped across South Africa, carefully packed. Free over R 7,500.",
  },
];

function Trust() {
  return (
    <section className="trust">
      <div className="trust-inner">
        {TRUST_ITEMS.map((item) => (
          <Reveal className="trust-item" key={item.title}>
            <svg className="ti-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              {item.icon}
            </svg>
            <h4>{item.title}</h4>
            <p>{item.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/**
 * SAMPLE reviews for layout only — replace every one with a genuine customer
 * testimonial (with the customer's consent) before going live.
 */
const SAMPLE_REVIEWS = [
  {
    quote:
      "The Cornice is the first thing everyone notices when they walk in. Switched off it's a sculpture; switched on it changes the whole room. Worth every rand.",
    product: "Cornice",
  },
  {
    quote:
      "I loved that it's made to order — knowing mine was printed just for me made it feel special. The warm light is exactly as pictured. Beautifully packaged too.",
    product: "Volute",
  },
  {
    quote:
      "Delivery took a couple of weeks but they were upfront about it, and the piece that arrived was flawless. It's become the centrepiece of our lounge.",
    product: "Cornice",
  },
  {
    quote:
      "The Volute's spiral catches the light in this soft, sweeping way — photos don't do it justice. Genuinely a piece of art that happens to be a lamp.",
    product: "Volute",
  },
  {
    quote:
      "Ordered as a gift and the recipient was blown away. The quality feels premium, the finish is immaculate, and it arrived carefully packed with the bulb included.",
    product: "Cornice",
  },
];

const VERIFIED_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

function Reviews() {
  return (
    <section className="reviews" id="reviews">
      <Reveal className="reviews-head">
        <span className="eyebrow">Owner stories</span>
        <h2>
          Lived with, <span className="ital">loved.</span>
        </h2>
        <div className="stars-row">
          <Stars />
          <span className="rate-txt">
            Every piece, made to order and delivered across South Africa
          </span>
        </div>
      </Reveal>

      <Reveal className="sample-banner">
        <strong>Sample layout —</strong> these are placeholder reviews showing how the section will
        look. They'll be replaced with real founding-customer testimonials before launch.
      </Reveal>

      <div className="review-grid">
        {SAMPLE_REVIEWS.map((review, i) => (
          <Reveal className="review" key={i}>
            <span className="sample-tag">Sample</span>
            <Stars />
            <p className="quote">{review.quote}</p>
            <span className="verified">
              {VERIFIED_ICON}
              Verified purchase · {review.product}
            </span>
            <div className="reviewer">
              <div className="avatar">[ ]</div>
              <div className="r-info">
                <div className="r-name">[ Customer name ]</div>
                <div className="r-meta">[ City ]</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="cta" id="contact">
      <div className="cta-arch-bg" aria-hidden="true"></div>
      <Reveal className="wrap inner">
        <span className="eyebrow">Begin a project</span>
        <h2>
          Not just light.
          <br />
          <span className="ital">Presence.</span>
        </h2>
        <p>
          Sculptural lighting designed to elevate modern interiors. Tell us about your space, and
          we'll resolve the rest.
        </p>
        <div className="cta-actions">
          <a
            href="https://wa.me/27693837314?text=Hi%20Resolut%2C%20I%27d%20like%20to%20ask%20about%20your%20lighting."
            target="_blank"
            rel="noopener"
            className="btn btn-primary"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 01-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29z" />
            </svg>
            Chat on WhatsApp
          </a>
          <a href="mailto:hello@resolutdesign.co.za" className="btn btn-ghost">
            Email us {ARROW}
          </a>
        </div>
      </Reveal>
    </section>
  );
}

export function HomeSections() {
  return (
    <>
      <Hero />
      <Marquee />
      {/* <Philosophy /> */}
      {/* <Values /> */}
      <CollectionSection />
      {/* <CorniceSignature />
      <VoluteSignature /> */}
      {/* <Feature /> */}
      <Process />
      <Trust />
      {/* <Reviews /> */}
      {/* <Cta /> */}
    </>
  );
}
