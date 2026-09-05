/**
 * One-off: apply prisma/init.sql to DATABASE_URL and seed the real catalogue.
 * Run with: DATABASE_URL=... bun run scripts/db-setup.ts
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

import { RESOLUT_PRODUCTS } from "../src/lib/resolut/products";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required");

const client = new Client({ connectionString: url });
await client.connect();

await client.query(readFileSync(new URL("../prisma/init.sql", import.meta.url), "utf8"));
console.log("schema applied");

const stock: Record<string, number> = { cornice: 3, volute: 8 };

for (const p of RESOLUT_PRODUCTS) {
  await client.query(
    `INSERT INTO "Product" ("id","slug","name","tagline","intro","badge","body","priceCents","image","imageAlt","detailImage","specs","details","published","capacity","readyStock","updatedAt")
     VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,true,12,$13,CURRENT_TIMESTAMP)
     ON CONFLICT ("slug") DO UPDATE SET
       "name"=EXCLUDED."name","tagline"=EXCLUDED."tagline","intro"=EXCLUDED."intro","badge"=EXCLUDED."badge",
       "body"=EXCLUDED."body","priceCents"=EXCLUDED."priceCents","image"=EXCLUDED."image","imageAlt"=EXCLUDED."imageAlt",
       "detailImage"=EXCLUDED."detailImage","specs"=EXCLUDED."specs","details"=EXCLUDED."details","updatedAt"=CURRENT_TIMESTAMP`,
    [
      p.slug,
      p.name,
      p.tagline,
      p.intro,
      p.badge ?? null,
      p.body,
      p.price == null ? null : Math.round(p.price * 100),
      p.image,
      p.imageAlt,
      p.detailImage,
      JSON.stringify(p.specs),
      JSON.stringify(p.details),
      stock[p.slug] ?? 0,
    ],
  );
}

const { rows } = await client.query(`SELECT slug, "priceCents" FROM "Product" ORDER BY slug`);
console.log("products", rows);
await client.end();
