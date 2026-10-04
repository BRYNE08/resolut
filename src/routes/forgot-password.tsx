import { createFileRoute } from "@tanstack/react-router";
import { RecoveryPage } from "@/components/auth/recovery-page";
export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Customer account — Resolut" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: () => <RecoveryPage mode="forgot" />,
});
