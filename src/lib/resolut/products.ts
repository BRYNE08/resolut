export type ResolutProduct = {
  slug: string;
  name: string;
  tagline: string;
  price: number | null;
  priceLabel: string;
  badge?: string;
  image: string;
  imageAlt: string;
  detailImage: string;
  intro: string;
  body: string[];
  specs: { v: string; k: string }[];
  details: { h: string; p: string }[];
  addId?: string;
};

export const RESOLUT_PRODUCTS: ResolutProduct[] = [
  {
    slug: "cornice",
    name: "Cornice",
    tagline: "Table lamp · stacked tiers",
    price: 4450,
    priceLabel: "R\u00a04,450",
    badge: "Signature piece",
    image: "/resolut/cornice-lit.jpg",
    imageAlt: "Cornice table lamp, lit and glowing",
    detailImage: "/resolut/cornice-off.jpg",
    intro: "Light, read as architecture.",
    body: [
      "Stacked, tapering tiers wrap a luminous orb — banded, soft, and resolved. Raised on three slender legs, Cornice holds a room without filling it.",
      "Printed as a single continuous geometry, then hand-finished, wired, and quality-checked. The piece that defines the range.",
    ],
    specs: [
      { v: "380 mm", k: "Height" },
      { v: "2700K", k: "Warm LED" },
      { v: "Made to order", k: "Each piece" },
    ],
    details: [
      {
        h: "Materials",
        p: "Precision 3D-printed polymer with a matte, lightly banded surface. Sculpted three-leg base.",
      },
      {
        h: "Light",
        p: "Supplied with a warm-white 2700K LED bulb. Use only the supplied bulb or an equivalent LED no greater than 9W.",
      },
      {
        h: "Lead time",
        p: "Each piece is made to order and ships in 2–3 weeks, packed for safe delivery.",
      },
    ],
    addId: "cornice",
  },
  {
    slug: "volute",
    name: "Volute",
    tagline: "Table lamp · spiral flute",
    price: 3450,
    priceLabel: "R\u00a03,450",
    badge: "New",
    image: "/resolut/volute.svg",
    imageAlt: "Volute spiral table lamp, glowing warm",
    detailImage: "/resolut/detail.svg",
    intro: "One line, wound into light.",
    body: [
      "A single continuous flute coils around a wide, luminous orb — printed as one unbroken path, without seam or join, resting on a sculpted plinth.",
      "Where Cornice stacks, Volute turns. The softer voice of the range.",
    ],
    specs: [
      { v: "212 mm", k: "Diameter" },
      { v: "2700K", k: "Warm LED" },
      { v: "Made to order", k: "Each piece" },
    ],
    details: [
      {
        h: "Materials",
        p: "Seamless single-path 3D print with a fluted surface, finished by hand on a sculpted plinth.",
      },
      {
        h: "Light",
        p: "Warm-white 2700K LED bulb included. Maximum 9W LED equivalent.",
      },
      {
        h: "Lead time",
        p: "Made to order · ships in 2–3 weeks.",
      },
    ],
    addId: "volute",
  },
  {
    slug: "strata",
    name: "Strata",
    tagline: "Pendant · stacked tiers",
    price: null,
    priceLabel: "Coming soon",
    image: "/resolut/placeholder.svg",
    imageAlt: "Strata pendant — photography coming soon",
    detailImage: "/resolut/detail.svg",
    intro: "Layers, suspended.",
    body: [
      "A pendant reading of the Cornice language — tiers stepping outward as they fall, throwing banded light across a table.",
      "Currently in final prototyping. Join the list and we'll write to you the week it opens for order.",
    ],
    specs: [
      { v: "In development", k: "Status" },
      { v: "2700K", k: "Warm LED" },
      { v: "Pendant", k: "Format" },
    ],
    details: [
      { h: "Format", p: "Ceiling pendant with adjustable drop, designed for dining and counter spans." },
      { h: "Light", p: "Warm-white 2700K LED, diffused through stacked tiers." },
      { h: "Availability", p: "Not yet available to order — photography and pricing to follow." },
    ],
  },
  {
    slug: "vellum",
    name: "Vellum",
    tagline: "Table lamp · soft minimal",
    price: null,
    priceLabel: "Coming soon",
    image: "/resolut/placeholder.svg",
    imageAlt: "Vellum table lamp — photography coming soon",
    detailImage: "/resolut/detail.svg",
    intro: "Quiet, by design.",
    body: [
      "The most restrained piece in the range — a soft, near-seamless shade that reads as a single volume of light.",
      "Currently in final prototyping. Join the list and we'll write to you the week it opens for order.",
    ],
    specs: [
      { v: "In development", k: "Status" },
      { v: "2700K", k: "Warm LED" },
      { v: "Table lamp", k: "Format" },
    ],
    details: [
      { h: "Format", p: "Compact table lamp for bedsides, consoles, and reading corners." },
      { h: "Light", p: "Warm-white 2700K LED, evenly diffused." },
      { h: "Availability", p: "Not yet available to order — photography and pricing to follow." },
    ],
  },
];

export function getResolutProduct(slug: string) {
  return RESOLUT_PRODUCTS.find((p) => p.slug === slug);
}
