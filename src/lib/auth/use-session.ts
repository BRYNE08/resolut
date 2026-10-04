/** Customer session access. Staff routes use studioSessionQuery separately. */
import { useQuery } from "@tanstack/react-query";

import { sessionQuery } from "@/lib/api/queries";
import { canAccessStudio } from "./config";

export function useSession() {
  const { data, isLoading } = useQuery(sessionQuery);
  return {
    session: data?.session ?? null,
    user: data?.session?.user ?? null,
    providers: data?.providers ?? [],
    /** Whether a persistent authentication secret is configured. */
    live: data?.live ?? false,
    configured: data?.configured ?? false,
    status: isLoading ? "loading" : data?.session ? "authenticated" : "unauthenticated",
    canAccessStudio: canAccessStudio(data?.session ?? null),
  } as const;
}
