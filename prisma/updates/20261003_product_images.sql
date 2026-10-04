ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Product" SET "images" = CASE WHEN "detailImage" <> "image" THEN ARRAY["image", "detailImage"] ELSE ARRAY["image"] END WHERE cardinality("images") = 0;
