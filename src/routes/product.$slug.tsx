import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productQuery, productsQuery } from "@/lib/api/queries";
import "@/lib/resolut/resolut.css";
import { StorefrontChrome } from "@/components/resolut/chrome";
import { addToCart } from "@/lib/store/cart-actions";

export const Route = createFileRoute("/product/$slug")({
  // Loader primes Query on the server; the component subscribes with
  // useSuspenseQuery, so there is no loading flash and head() has real data.
  loader: async ({ context, params }) => {
    const [{ product }] = await Promise.all([
      context.queryClient.ensureQueryData(productQuery(params.slug)),
      context.queryClient.ensureQueryData(productsQuery),
    ]);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Piece unavailable — Resolut" }, { name: "robots", content: "noindex" }],
      };
    }
    const { product } = loaderData;
    const title = `${product.name} — ${product.tagline} | Resolut`;
    const description = `${product.name}: ${product.body[0]}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(slug));
  const { data: catalogue } = useSuspenseQuery(productsQuery);
  const product = data.product!;

  const others = catalogue.products.filter((p) => p.slug !== product.slug);

  return (
    <StorefrontChrome>
      <div className="pdp-page">

      <main className="pdp">
        <div className="wrap">
          <nav className="pdp-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link to="/collection" search={{ availability: "all", sort: "curated" }}>
              Collection
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{product.name}</span>
          </nav>

          <div className="pdp-grid">
            <div className="pdp-media">
              <div className="frame">
                {product.badge ? <span className="badge">{product.badge}</span> : null}
                <div className="arch-img arch">
                  <img src={product.image} alt={product.imageAlt} />
                </div>
              </div>
              <div className="pdp-thumbs">
                <div className="arch-img arch">
                  <img src={product.image} alt={`${product.name}, full view`} />
                </div>
                <div className="arch-img arch">
                  <img src={product.detailImage} alt={`${product.name}, surface detail`} />
                </div>
              </div>
            </div>

            <div className="pdp-copy">
              <span className="eyebrow">{product.tagline}</span>
              <h1>{product.name}</h1>
              <p className="pdp-intro ital">{product.intro}</p>
              {product.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}

              <div className="sig-meta">
                {product.specs.map((spec) => (
                  <div className="m" key={spec.k}>
                    <div className="v">{spec.v}</div>
                    <div className="k">{spec.k}</div>
                  </div>
                ))}
              </div>

              <div className="sig-actions">
                <span className="sig-price">{product.priceLabel}</span>
                {product.addId ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => addToCart(product.addId!, product.name)}
                  >
                    Add to cart
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </button>
                ) : (
                  <a className="btn btn-ghost" href="/#contact">
                    Join the list
                  </a>
                )}
              </div>

              <div className="lead-note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {product.price ? "Made to order · ships in 2–3 weeks" : "In development · availability to be announced"}
              </div>

              <dl className="pdp-details">
                {product.details.map((detail) => (
                  <div className="pdp-detail" key={detail.h}>
                    <dt>{detail.h}</dt>
                    <dd>{detail.p}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <section className="pdp-more">
            <div className="coll-head">
              <span className="eyebrow">Also in the collection</span>
              <h2>Continue looking</h2>
            </div>
            <div className="coll-grid">
              {others.map((other) => (
                <article className="product" key={other.slug}>
                  <div className="frame">
                    <div className="arch-img arch">
                      <img src={other.image} alt={other.imageAlt} />
                    </div>
                  </div>
                  <Link className="card-link" to="/product/$slug" params={{ slug: other.slug }}>
                    <span>View details</span>
                  </Link>
                  <div className="meta">
                    <h3>{other.name}</h3>
                    <span className={other.price ? "price" : "price soon"}>{other.priceLabel}</span>
                  </div>
                  <p className="tagline">{other.tagline}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>

      </div>
    </StorefrontChrome>
  );
}
