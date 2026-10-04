import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import {
  customerSignupSchema,
  customerPasswordSigninSchema,
  emailRequestSchema,
  verifyEmailSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../auth/password.schemas";

async function run<T>(
  action: (runtime: typeof import("../auth/password-runtime.server")) => Promise<T>,
  concealTiming = false,
) {
  setResponseHeader("Cache-Control", "private, no-store");
  const runtime = await import("../auth/password-runtime.server");
  return runtime.publicAuthAction(() => action(runtime), concealTiming);
}
const EMAIL_MESSAGE =
  "If this address is eligible, an email will arrive shortly. Check your spam folder. Existing accounts should use their original sign-in method; you can request another email if needed.";

export const signupCustomer = createServerFn({ method: "POST" })
  .inputValidator((input) => customerSignupSchema.parse(input))
  .handler(({ data }) =>
    run(async ({ passwordRuntime }) => {
      await (await passwordRuntime("signup", data.email, true)).signup(data);
      return { message: EMAIL_MESSAGE };
    }, true),
  );

export const signinCustomerPassword = createServerFn({ method: "POST" })
  .inputValidator((input) => customerPasswordSigninSchema.parse(input))
  .handler(({ data }) =>
    run(async ({ passwordRuntime }) => {
      const user = await (
        await passwordRuntime("signin", data.email)
      ).signin(data.email, data.password);
      const { startSession } = await import("../auth/session.server");
      await startSession(user);
      return { ok: true };
    }),
  );

export const requestVerificationEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => emailRequestSchema.parse(input))
  .handler(({ data }) =>
    run(async ({ passwordRuntime }) => {
      await (await passwordRuntime("email", data.email, true)).request(data.email, "verify");
      return { message: EMAIL_MESSAGE };
    }, true),
  );

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input) => emailRequestSchema.parse(input))
  .handler(({ data }) =>
    run(async ({ passwordRuntime }) => {
      await (await passwordRuntime("email", data.email, true)).request(data.email, "reset");
      return { message: EMAIL_MESSAGE };
    }, true),
  );

export const verifyCustomerEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => verifyEmailSchema.parse(input))
  .handler(({ data }) =>
    run(async ({ passwordRuntime }) => {
      await (await passwordRuntime("token", data.token)).verify(data.token, data.password);
      return { message: "Email verified. You can now sign in." };
    }),
  );

export const resetCustomerPassword = createServerFn({ method: "POST" })
  .inputValidator((input) => resetPasswordSchema.parse(input))
  .handler(({ data }) =>
    run(async ({ passwordRuntime }) => {
      await (await passwordRuntime("token", data.token)).reset(data.token, data.password);
      const { endSession } = await import("../auth/session.server");
      await endSession();
      return {
        message:
          "Password reset. Sign in with your new password. Your previous sessions have been signed out.",
      };
    }),
  );

export const changeCustomerPassword = createServerFn({ method: "POST" })
  .inputValidator((input) => changePasswordSchema.parse(input))
  .handler(({ data }) =>
    run(async ({ passwordRuntime }) => {
      const { readSession, startSession } = await import("../auth/session.server");
      const { session } = await readSession();
      if (!session) throw new Error("Sign in to change your password.");
      const user = await (
        await passwordRuntime("change", session.user.id)
      ).change(session.user.id, data.currentPassword, data.password);
      await startSession(user);
      return { message: "Password changed. Your other sessions have been signed out." };
    }),
  );
