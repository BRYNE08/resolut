import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/api/queries";
import "@/lib/resolut/resolut.css";
import { StorefrontChrome } from "@/components/resolut/chrome";

const AVAILABILITY = ["all", "available", "soon"] as const;
const SORTS = ["curated", "price-asc", "price-desc", "name"] as const;

type Availability = (typeof AVAILABILITY)[number];
type Sort = (typeof SORTS)[number];

const FILTERS: { key: Availability; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "available", label: "For sale" },
  { key: "soon", label: "In development" },
];

const SORT_LABELS: { key: Sort; label: string }[] = [
  { key: "curated", label: "Curated" },
  { key: "price-asc", label: "Price · low to high" },
  { key: "price-desc", label: "Price · high to low" },
  { key: "name", label: "A–Z" },
];

const TITLE = "The Collection — Resolut lighting pieces";
const DESCRIPTION =
  "Browse every Resolut piece: sculptural, made-to-order 3D-printed lighting. Filter by availability and price, then open a piece for full specifications.";

export const Route = createFileRoute("/collection")({
  validateSearch: (search: Record<string, unknown>) => ({
    availability: AVAILABILITY.includes(search.availability as Availability)
      ? (search.availability as Availability)
      : ("all" as Availability),
    sort: SORTS.includes(search.sort as Sort) ? (search.sort as Sort) : ("curated" as Sort),
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(productsQuery);
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectionPage,
  errorComponent: ({ error }) => (
    <main className="pdp">
      <div className="wrap" role="alert">
        <h1>Collection unavailable</h1>
        <p>{error instanceof Error ? error.message : "Something went wrong. Please try again."}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="pdp">
      <div className="wrap">
        <h1>Nothing here yet</h1>
        <p>The collection is being photographed. Please check back shortly.</p>
      </div>
    </main>
  ),
});

function CollectionPage() {
  const { availability, sort } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(productsQuery);

  const all = data.products;
  const filtered = all.filter((p) =>
    availability === "available"
      ? p.price != null && p.price > 0
      : availability === "soon"
        ? p.price == null || p.price <= 0
        : true,
  );

  const pieces = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "price-asc" || sort === "price-desc") {
      const av = a.price ?? Number.POSITIVE_INFINITY;
      const bv = b.price ?? Number.POSITIVE_INFINITY;
      return sort === "price-asc" ? av - bv : bv - av;
    }
    return 0;
  });

  const forSale = all.filter((p) => p.price != null && p.price > 0).length;

  return (
    <StorefrontChrome>
      <div className="pdp-page">
        <main className="pdp coll-page">
          <div className="wrap">
            <nav className="pdp-crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Collection</span>
            </nav>

            <header className="coll-hero">
              <span className="eyebrow">The collection</span>
              <h1>Every piece, in one room</h1>
              <p className="pdp-intro ital">
                {all.length} pieces · {forSale} available to order · each printed, finished and
                wired in King Williams Town
              </p>
            </header>

            <div className="coll-filters">
              <div className="coll-chips" role="group" aria-label="Filter by availability">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`chip${availability === filter.key ? " is-active" : ""}`}
                    aria-pressed={availability === filter.key}
                    onClick={() =>
                      navigate({
                        to: ".",
                        search: (prev) => ({ ...prev, availability: filter.key }),
                      })
                    }
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <label className="coll-sort">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    navigate({
                      to: ".",
                      search: (prev) => ({ ...prev, sort: event.target.value as Sort }),
                    })
                  }
                >
                  {SORT_LABELS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {pieces.length === 0 ? (
              <p className="coll-empty">No pieces match that filter yet.</p>
            ) : (
              <div className="coll-grid">
                {pieces.map((piece) => (
                  <article className="product" key={piece.slug}>
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
                      <h2>{piece.name}</h2>
                      <span className={piece.price ? "price" : "price soon"}>
                        {piece.priceLabel}
                      </span>
                    </div>
                    <p className="tagline">{piece.tagline}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </StorefrontChrome>
  );
}
