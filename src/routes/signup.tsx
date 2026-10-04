import { createFileRoute, redirect } from "@tanstack/react-router";
import { customerReturnPath } from "@/lib/auth/customer-auth";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? customerReturnPath(search.redirect) : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/signin", search: { mode: "signup", redirect: search.redirect } });
  },
});
