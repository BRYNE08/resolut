import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { ABOUT_PARAGRAPHS } from "@/lib/resolut/about-content";
import { StorefrontChrome } from "@/components/resolut/chrome";
import "@/lib/resolut/resolut.css";
import "@/lib/resolut/about.css";

const TITLE = "About the studio — Resolut";
const DESCRIPTION =
  "Sculptural lighting shaped by architecture, precision 3D printing and hand finishing. Discover Resolut, a design studio in the Eastern Cape, South Africa.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AboutPage,
});

const PRINCIPLES = [
  {
    title: "Form with intention",
    body: "Architecture informs our proportions. Strong geometry meets soft illumination, with every line serving the whole.",
  },
  {
    title: "Precision in every layer",
    body: "3D printing lets us explore texture, rhythm and intricate structure. The process is part of the character of each piece.",
  },
  {
    title: "A human finish",
    body: "Technology gives the form its precision. Hand finishing, assembly and quality checks bring it to completion.",
  },
];

function AboutPage() {
  return (
    <StorefrontChrome>
      <main className="about-page">
        <section className="about-hero" aria-labelledby="about-title">
          <div className="wrap">
            <nav className="pdp-crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">About</span>
            </nav>
            <div className="about-hero-grid">
              <div className="about-hero-copy">
                <p className="eyebrow">The Resolut studio</p>
                <h1 id="about-title">
                  Light, with
                  <br />
                  <em>intention.</em>
                </h1>
                <p className="about-lead">
                  Sculptural objects. Considered proportions. A presence that stays, even when the
                  light is off.
                </p>
                <p className="about-location">King William’s Town · Eastern Cape, South Africa</p>
              </div>
              <figure className="about-hero-image">
                <div className="arch">
                  <img
                    src="https://gxtc0pztso.ufs.sh/f/hQo7Tp5UBanzcILc2npxIOxTr3b5dhV2PUoJez7jNE1yAkim"
                    alt="The illuminated Cornice lamp, with its sculptural ribbed form"
                    fetchPriority="high"
                  />
                </div>
                <figcaption>
                  <span>Cornice / A study in form and light</span>
                  <span>Resolut Design</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="about-story wrap" id="philosophy" aria-labelledby="about-story-title">
          <div>
            <p className="eyebrow">Our point of view</p>
            <h2 id="about-story-title">
              Crafted to be seen.
              <br />
              <em>Designed to be felt.</em>
            </h2>
          </div>
          <div className="about-story-body">
            <p className="about-story-lead">
              For those who see lighting not as function, but as a defining design statement.
            </p>
            {ABOUT_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="about-principles" aria-labelledby="about-principles-title">
          <div className="wrap">
            <div className="about-section-heading">
              <p className="eyebrow">What guides the work</p>
              <h2 id="about-principles-title">Nothing without purpose.</h2>
            </div>
            <div className="about-principle-grid">
              {PRINCIPLES.map((principle, index) => (
                <article key={principle.title}>
                  <span className="eyebrow">0{index + 1}</span>
                  <h3>{principle.title}</h3>
                  <p>{principle.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-making wrap" aria-labelledby="about-making-title">
          <figure className="about-making-image">
            <img
              src="https://gxtc0pztso.ufs.sh/f/hQo7Tp5UBanz6cHgyiA3WiFsjLXTBUwhgRYV79nH8Qok5tP4"
              alt="Cornice switched off, showing its layered surface and architectural silhouette"
              loading="lazy"
            />
            <figcaption>The form holds its own, lit or unlit.</figcaption>
          </figure>
          <div className="about-making-copy">
            <p className="eyebrow">Made here. Made to order.</p>
            <h2 id="about-making-title">
              From a considered idea
              <br />
              to a <em>resolved object.</em>
            </h2>
            <p>
              Our pieces are designed, printed and assembled in King William’s Town. Each one enters
              the making process after you order.
            </p>
            <ol className="about-making-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Design</h3>
                  <p>Form, proportion and illumination are considered together.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Print</h3>
                  <p>The geometry takes shape, layer by precise layer.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Finish</h3>
                  <p>Hand-finished, wired and checked before it leaves the studio.</p>
                </div>
              </li>
            </ol>
            <Link className="about-text-link" to="/shipping">
              Explore making &amp; delivery times <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="about-invitation" aria-labelledby="about-invitation-title">
          <div className="wrap">
            <p className="eyebrow">A place for Resolut</p>
            <h2 id="about-invitation-title">
              Find the light
              <br />
              for <em>your space.</em>
            </h2>
            <p>Discover the collection, or tell us about the interior you have in mind.</p>
            <div className="about-actions">
              <Link
                className="btn btn-primary"
                to="/collection"
                search={{ availability: "all", sort: "curated" }}
              >
                Explore the collection <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <Link className="btn btn-ghost" to="/contact">
                Talk to the studio <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </StorefrontChrome>
  );
}
