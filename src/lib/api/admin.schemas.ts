import { z } from "zod";

export const pieceBodySchema = z.array(
  z.string().max(5_000, "Each description paragraph must contain at most 5,000 characters."),
).max(6, "Description must contain at most 6 paragraphs.");

/** Spec chips shown on the product page: value + label ("212 mm" / "Diameter"). */
export const specSchema = z.object({
  v: z.string().min(1).max(40),
  k: z.string().min(1).max(40),
});

/** Long-form detail blocks: heading + paragraph. */
export const detailSchema = z.object({
  h: z.string().min(2).max(60),
  p: z.string().min(2).max(600),
});

/** Payload for adding a new piece from the studio dashboard. */
export const createPieceSchema = z.object({
  name: z.string().min(2).max(60),
  tagline: z.string().min(3).max(80),
  intro: z.string().min(3).max(160),
  price: z.number().int().positive().max(1_000_000).nullable().optional(),
  badge: z.string().max(40).optional(),
  images: z.array(z.string().trim().min(1).max(6_000_000)).max(10).optional(),
  image: z.string().max(6_000_000).optional(),
  imageAlt: z.string().max(160).optional(),
  body: pieceBodySchema.optional(),
  specs: z.array(specSchema).max(6).optional(),
  details: z.array(detailSchema).max(6).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
  readyStock: z.number().int().min(0).max(500).optional(),
});

export type CreatePieceInput = z.infer<typeof createPieceSchema>;

/** Editing an existing piece — every field optional, slug identifies the row. */
export const updatePieceSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(2).max(60).optional(),
  tagline: z.string().min(3).max(80).optional(),
  intro: z.string().min(3).max(160).optional(),
  price: z.number().int().positive().max(1_000_000).nullable().optional(),
  badge: z.string().max(40).nullable().optional(),
  images: z.array(z.string().trim().min(1).max(6_000_000)).max(10).optional(),
  image: z.string().max(6_000_000).optional(),
  imageAlt: z.string().max(160).optional(),
  body: pieceBodySchema.optional(),
  specs: z.array(specSchema).max(6).optional(),
  details: z.array(detailSchema).max(6).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
  readyStock: z.number().int().min(0).max(500).optional(),
  published: z.boolean().optional(),
});

export const deletePieceSchema = z.object({ slug: z.string().min(1) });


export const orderStatusSchema = z.object({
  reference: z.string().min(3),
  status: z.enum(["await", "paid", "making", "shipped", "cancelled"]),
});

export const createJobSchema = z.object({
  title: z.string().min(2).max(80),
  detail: z.string().min(2).max(200),
  due: z.string().max(40).optional(),
  overdue: z.boolean().optional(),
});

export const updateJobSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(80).optional(),
  detail: z.string().min(2).max(200).optional(),
  due: z.string().max(40).optional(),
  overdue: z.boolean().optional(),
});

export const jobIdSchema = z.object({ id: z.string().min(1) });

export const messageHandledSchema = z.object({
  id: z.string().min(1),
  handled: z.boolean(),
});
