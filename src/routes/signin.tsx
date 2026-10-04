import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CustomerPasswordForm } from "@/components/auth/password-form";
import { z } from "zod";
import { startCustomerSignIn } from "@/lib/api/auth.functions";
import { sessionQuery } from "@/lib/api/queries";
import {
  CUSTOMER_AUTH_ERRORS,
  customerReturnPath,
  type CustomerProvider,
} from "@/lib/auth/customer-auth";
import "@/lib/resolut/resolut.css";
import "@/lib/resolut/resolut-admin.css";
import "@/lib/resolut/customer-auth.css";

const searchSchema = z.object({
  redirect: z.string().max(2048).optional(),
  mode: z.enum(["signin", "signup"]).optional(),
  error: z.string().max(40).optional(),
});

export const Route = createFileRoute("/signin")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Your Resolut account — Sign in or sign up" },
      {
        name: "description",
        content: "Sign in or create your Resolut customer account with email, Google or Apple.",
      },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  beforeLoad: async ({ context, search }) => {
    const auth = await context.queryClient.fetchQuery(sessionQuery);
    if (auth.session) throw redirect({ href: customerReturnPath(search.redirect) });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionQuery),
  component: CustomerSignIn,
});

function CustomerSignIn() {
  const { providers } = Route.useLoaderData();
  const search = Route.useSearch();
  const signup = search.mode === "signup";
  const submit = useServerFn(startCustomerSignIn);
  const mutation = useMutation({
    mutationFn: (input: { data: { provider: CustomerProvider; redirect: string } }) =>
      submit(input),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const error =
    mutation.error?.message ||
    (search.error ? CUSTOMER_AUTH_ERRORS[search.error] || CUSTOMER_AUTH_ERRORS.failed : undefined);

  function begin(provider: CustomerProvider) {
    mutation.mutate({ data: { provider, redirect: customerReturnPath(search.redirect) } });
  }

  return (
    <main className="signin customer-signin">
      <section className="signin-panel">
        <div className="signin-brand">
          <div className="arch-mark" aria-hidden="true" />
          <div>
            <b>Resolut</b>
            <span>Your collection, your space</span>
          </div>
        </div>
        <blockquote>Follow your pieces from our studio to your home.</blockquote>
        <Link to="/" className="signin-back">
          Back to the storefront
        </Link>
      </section>
      <section className="signin-form-wrap">
        <div className="signin-form">
          <p className="eyebrow">Your Resolut account</p>
          <h1>{signup ? "Make yourself at home." : "Welcome back."}</h1>
          <p className="signin-lead">
            {signup
              ? "Create an account to keep your orders and delivery details in one place."
              : "Sign in to view your orders and manage your delivery details."}
          </p>
          <CustomerPasswordForm
            key={signup ? "signup" : "signin"}
            signup={signup}
            returnTo={customerReturnPath(search.redirect)}
          />
          <p className="customer-auth-divider">Or continue with</p>
          <div className="customer-providers" aria-busy={mutation.isPending}>
            {providers.map((provider) => (
              <button
                className={`customer-provider ${provider.id}`}
                key={provider.id}
                type="button"
                onClick={() => begin(provider.id as CustomerProvider)}
                disabled={!provider.configured || mutation.isPending}
              >
                {provider.id === "google" ? <GoogleMark /> : <AppleMark />}
                <span>
                  {mutation.isPending && mutation.variables?.data.provider === provider.id
                    ? "Connecting…"
                    : `Continue with ${provider.name}`}
                </span>
                {!provider.configured ? <small>Temporarily unavailable</small> : null}
              </button>
            ))}
          </div>
          {error ? (
            <p className="signin-msg err customer-auth-message" role="alert">
              {error}
            </p>
          ) : null}
          <p className="customer-auth-note">
            New here? Your account is created automatically the first time you continue with Google
            or Apple.
          </p>
          <p className="customer-auth-switch">
            {signup ? "Already have an account? " : "New to Resolut? "}
            <Link
              to="/signin"
              search={{ mode: signup ? "signin" : "signup", redirect: search.redirect }}
            >
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="customer-auth-note">
            You can also{" "}
            <Link to="/collection" search={{ availability: "all", sort: "curated" }}>
              continue shopping
            </Link>{" "}
            and check out as a guest.
          </p>
          <div className="customer-staff-link">
            <Link to="/admin/signin">Studio &amp; admin sign-in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M17.05 12.54c.03 3.23 2.84 4.3 2.87 4.31-.02.08-.45 1.53-1.48 3.03-.89 1.3-1.81 2.6-3.27 2.63-1.44.03-1.9-.85-3.54-.85-1.63 0-2.14.83-3.49.88-1.4.05-2.46-1.4-3.36-2.7-1.83-2.66-3.23-7.5-1.35-10.77a5.23 5.23 0 0 1 4.44-2.69c1.39-.03 2.7.94 3.54.94.85 0 2.44-1.16 4.11-.99.7.03 2.66.28 3.92 2.12-.1.06-2.34 1.37-2.39 4.09ZM14.36 4.57c.75-.9 1.26-2.15 1.12-3.4-1.08.04-2.4.72-3.17 1.62-.69.8-1.3 2.08-1.14 3.31 1.2.1 2.43-.61 3.19-1.53Z" />
    </svg>
  );
}
