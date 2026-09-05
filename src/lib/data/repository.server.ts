/**
 * Single place that decides which adapter serves the app.
 *
 *   DATABASE_URL set + @prisma/client installed  ->  Prisma adapter
 *   otherwise                                    ->  in-memory adapter
 *
 * Server functions call `getRepository()` and never import an adapter directly.
 */
import { createMockRepository } from "./mock-repository";
import { getPrisma } from "./prisma.server";
import type { ResolutRepository } from "./types";

let mock: ResolutRepository | null = null;
let prismaRepo: ResolutRepository | null = null;

export async function getRepository(): Promise<ResolutRepository> {
  const prisma = await getPrisma();
  if (prisma) {
    if (!prismaRepo) {
      const { createPrismaRepository } = await import("./prisma-repository.server");
      prismaRepo = createPrismaRepository(prisma);
    }
    return prismaRepo;
  }
  if (!mock) mock = createMockRepository();
  return mock;
}
