import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/customer/$provider/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { finishCustomerOAuth } = await import("@/lib/auth/customer-oauth.server");
        return finishCustomerOAuth(request, params.provider);
      },
      POST: async ({ request, params }) => {
        const { finishCustomerOAuth } = await import("@/lib/auth/customer-oauth.server");
        return finishCustomerOAuth(request, params.provider);
      },
    },
  },
});
