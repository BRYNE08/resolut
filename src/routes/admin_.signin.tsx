import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { signInStudio } from "@/lib/api/auth.functions";
import { studioSessionQuery } from "@/lib/api/queries";
import { canAccessStudio } from "@/lib/auth/config";
import "@/lib/resolut/resolut.css";
import "@/lib/resolut/resolut-admin.css";

const TITLE = "Studio sign-in — Resolut";
const DESCRIPTION =
  "Sign in to the Resolut studio to manage orders, the lighting collection, production and waitlist demand.";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/admin_/signin")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Already signed in with studio rights? Skip the form.
  beforeLoad: async ({ context }) => {
    const data = await context.queryClient.fetchQuery(studioSessionQuery);
    if (canAccessStudio(data.session)) {
      throw redirect({ to: "/admin" });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(studioSessionQuery),
  component: SignInPage,
});

function SignInPage() {
  const { demoAccounts } = Route.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submit = useServerFn(signInStudio);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submit,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      navigate({ to: "/admin", replace: true });
    },
    onError: (err: Error) => setError(err.message || "Could not sign you in."),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    if (!email || password.length < 3) {
      setError("Enter your studio email and password.");
      return;
    }
    setError(null);
    mutation.mutate({ data: { email, password } });
  }

  return (
    <main className="signin">
      <section className="signin-panel">
        <div className="signin-brand">
          <div className="arch-mark" aria-hidden="true" />
          <div>
            <b>Resolut</b>
            <span>Studio</span>
          </div>
        </div>
        <blockquote>
          “Every piece is printed, wired and finished by hand in Cape Town — the studio floor is
          where the collection lives.”
        </blockquote>
        <Link to="/" className="signin-back">
          Back to the storefront
        </Link>
      </section>

      <section className="signin-form-wrap">
        <div className="signin-form">
          <p className="eyebrow">Restricted area</p>
          <h1>Sign in to the studio.</h1>
          <p className="signin-lead">Access for the Resolut studio team and administrators.</p>
          <p className="signin-lead">
            Shopping with us? <Link to="/signin">Customer sign-in</Link>
          </p>

          <form onSubmit={onSubmit} noValidate>
            <label>
              <span>Email address</span>
              <input name="email" type="email" autoComplete="username" required autoFocus />
            </label>
            <label>
              <span>Password</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>

            {error ? (
              <p className="signin-msg err" role="alert">
                {error}
              </p>
            ) : null}

            <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Signing in\u2026" : "Sign in"}
            </button>
          </form>

          {demoAccounts.length > 0 ? (
            <div className="signin-demo">
              <h2>Demo accounts</h2>
              <p>Development preview accounts. These are unavailable in production.</p>
              <ul>
                {demoAccounts.map((account) => (
                  <li key={account.email}>
                    <strong>{account.email}</strong>
                    <code>{account.password}</code>
                    <em>{account.role}</em>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
