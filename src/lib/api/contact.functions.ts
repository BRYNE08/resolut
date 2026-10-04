import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(254),
        message: z.string().trim().min(1).max(5000),
        website: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Silently discard submissions to the field hidden from real visitors.
    if (data.website) return { ok: true as const };
    const { getRepository } = await import("@/lib/data/repository.server");
    const repo = await getRepository();
    return repo.createMessage({ name: data.name, email: data.email, message: data.message });
  });
