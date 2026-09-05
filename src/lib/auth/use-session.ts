/**
 * Client-side session access. Same surface as Auth.js's `useSession()`, so the
 * switch to the real provider is a one-file change.
 */
import { useQuery } from "@tanstack/react-query";

import { sessionQuery } from "@/lib/api/queries";
import { canAccessStudio } from "./config";

export function useSession() {
  const { data, isLoading } = useQuery(sessionQuery);
  return {
    session: data?.session ?? null,
    user: data?.session?.user ?? null,
    providers: data?.providers ?? [],
    /** false while Auth.js is running in plug-and-play demo mode. */
    live: data?.live ?? false,
    configured: data?.configured ?? false,
    status: isLoading ? "loading" : data?.session ? "authenticated" : "unauthenticated",
    canAccessStudio: canAccessStudio(data?.session ?? null),
  } as const;
}
