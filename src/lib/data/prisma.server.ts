/**
 * Prisma client (optional, but really wired).
 *
 * The generated client lives in `src/generated/prisma` (Prisma 7, driver
 * adapters — no native engine binary, so it runs in the edge runtime too).
 * It is loaded through a lazy dynamic import so the bundler includes it in the
 * server graph while the browser bundle never touches it.
 *
 *   DATABASE_URL set -> Prisma adapter
 *   otherwise        -> in-memory adapter
 */
type AnyPrisma = Record<string, any>;

let cached: AnyPrisma | null | undefined;

export function isDatabaseConfigured() {
  return Boolean(process.env["DATABASE_URL"]);
}

export async function getPrisma(): Promise<AnyPrisma | null> {
  if (cached !== undefined) return cached;
  const url = process.env["DATABASE_URL"];
  if (!url) {
    cached = null;
    return cached;
  }
  try {
    const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
      import("@/generated/prisma/client"),
      import("@prisma/adapter-pg"),
    ]);
    cached = new (PrismaClient as any)({ adapter: new PrismaPg({ connectionString: url }) });
  } catch (error) {
    console.error(
      "[resolut] DATABASE_URL is set but the Prisma client could not be created — falling back to in-memory data. Run `bunx prisma generate` (and `bunx prisma migrate deploy`).",
      error,
    );
    cached = null;
  }
  return cached ?? null;
}
