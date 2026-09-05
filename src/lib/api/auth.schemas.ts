import { z } from "zod";

/** Studio sign-in payload. */
export const signInSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(6).max(200),
});

export type SignInInput = z.infer<typeof signInSchema>;
