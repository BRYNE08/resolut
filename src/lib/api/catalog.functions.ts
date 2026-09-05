import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const fetchProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { getRepository } = await import("@/lib/data/repository.server");
  const repo = await getRepository();
  return { source: repo.name, products: await repo.listProducts() };
});

export const fetchProduct = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { getRepository } = await import("@/lib/data/repository.server");
    const repo = await getRepository();
    return { source: repo.name, product: await repo.getProduct(data.slug) };
  });

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email(), label: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getRepository } = await import("@/lib/data/repository.server");
    const repo = await getRepository();
    return repo.joinWaitlist(data);
  });
