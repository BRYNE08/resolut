import { createServerFn } from "@tanstack/react-start";

import { signInSchema } from "./auth.schemas";

export const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  const [{ readSession }, { listProviders, isAuthConfigured }, { hasRealAccounts, DEMO_ACCOUNTS }] =
    await Promise.all([
      import("@/lib/auth/session.server"),
      import("@/lib/auth/config"),
      import("@/lib/auth/credentials.server"),
    ]);
  const env = process.env as Record<string, string | undefined>;
  const { session, live } = await readSession();
  return {
    session,
    live,
    configured: isAuthConfigured(env),
    providers: listProviders(env),
    /** Shown on the sign-in page only while no real credentials are set. */
    demoAccounts: hasRealAccounts(env) ? [] : DEMO_ACCOUNTS,
  };
});

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input) => signInSchema.parse(input))
  .handler(async ({ data }) => {
    const [{ verifyCredentials }, { startSession }] = await Promise.all([
      import("@/lib/auth/credentials.server"),
      import("@/lib/auth/session.server"),
    ]);

    const user = verifyCredentials(data.email, data.password);
    if (!user) {
      // Deliberately vague: never reveal whether the address exists.
      throw new Error("Those details don’t match a studio account.");
    }

    const session = await startSession(user);
    return { session };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("@/lib/auth/session.server");
  await endSession();
  return { ok: true as const };
});
