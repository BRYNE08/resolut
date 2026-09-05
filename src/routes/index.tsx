import { createFileRoute } from "@tanstack/react-router";
import { productsQuery } from "@/lib/api/queries";
import "@/lib/resolut/resolut.css";
import { StorefrontChrome } from "@/components/resolut/chrome";
import { HomeSections } from "@/components/resolut/home-sections";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(productsQuery);
  },
  head: () => ({
    meta: [
      { title: "Resolut — Precision, Resolved in Light" },
      {
        name: "description",
        content:
          "Sculptural, 3D-printed lighting from Resolut Design. Made-to-order pieces that treat illumination as design.",
      },
      { property: "og:title", content: "Resolut — Precision, Resolved in Light" },
      {
        property: "og:description",
        content:
          "Sculptural, 3D-printed lighting from Resolut Design. Made-to-order pieces that treat illumination as design.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <StorefrontChrome home>
      <HomeSections />
    </StorefrontChrome>
  );
}
