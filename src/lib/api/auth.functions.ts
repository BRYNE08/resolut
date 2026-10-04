import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { signInSchema } from "./auth.schemas";

export const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "private, no-store");
  const [{ readSession }, { listProviders, isAuthConfigured }] = await Promise.all([
    import("@/lib/auth/session.server"),
    import("@/lib/auth/config"),
  ]);
  const { session, live } = await readSession();
  return {
    session,
    live,
    configured: isAuthConfigured(process.env),
    providers: listProviders(process.env),
  };
});

export const fetchStudioSession = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "private, no-store");
  const [{ readStudioSession }, { hasRealAccounts, DEMO_ACCOUNTS }] = await Promise.all([
    import("@/lib/auth/session.server"),
    import("@/lib/auth/credentials.server"),
  ]);
  const { session, live } = await readStudioSession();
  return {
    session,
    live,
    demoAccounts:
      process.env["NODE_ENV"] === "production" || hasRealAccounts(process.env) ? [] : DEMO_ACCOUNTS,
  };
});

export const signInStudio = createServerFn({ method: "POST" })
  .inputValidator((input) => signInSchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const [{ verifyCredentials }, { startStudioSession }] = await Promise.all([
      import("@/lib/auth/credentials.server"),
      import("@/lib/auth/session.server"),
    ]);
    const user = verifyCredentials(data.email, data.password);
    if (!user || (user.role !== "studio" && user.role !== "admin")) {
      throw new Error("Those details don’t match a studio account.");
    }
    return { session: await startStudioSession(user) };
  });

export const startCustomerSignIn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ provider: z.enum(["google", "apple"]), redirect: z.string().max(2048).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { beginCustomerOAuth } = await import("@/lib/auth/customer-oauth.server");
    try {
      return { url: await beginCustomerOAuth(data.provider, getRequest(), data.redirect) };
    } catch {
      throw new Error("This sign-in option is temporarily unavailable. Please try again later.");
    }
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("@/lib/auth/session.server");
  await endSession();
  return { ok: true as const };
});

export const signOutStudio = createServerFn({ method: "POST" }).handler(async () => {
  const { endStudioSession } = await import("@/lib/auth/session.server");
  await endStudioSession();
  return { ok: true as const };
});
