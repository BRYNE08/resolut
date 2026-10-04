import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  requestVerificationEmail,
  requestPasswordReset,
  verifyCustomerEmail,
  resetCustomerPassword,
  changeCustomerPassword,
} from "@/lib/api/password.functions";
import {
  emailRequestSchema,
  verifyEmailSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/auth/password.schemas";
import { PasswordField } from "./password-form";
import "@/lib/resolut/resolut.css";
import "@/lib/resolut/resolut-admin.css";
import "@/lib/resolut/customer-auth.css";

export function RecoveryPage({ mode }: { mode: "verify" | "forgot" | "reset" | "change" }) {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const sendVerify = useServerFn(requestVerificationEmail);
  const sendReset = useServerFn(requestPasswordReset);
  const verify = useServerFn(verifyCustomerEmail);
  const reset = useServerFn(resetCustomerPassword);
  const change = useServerFn(changeCustomerPassword);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    setToken((previous) => previous || value);
    if (value)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    setReady(true);
  }, []);
  const completes = mode === "change" || (Boolean(token) && mode !== "forgot");
  const mutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const values = { ...Object.fromEntries(new FormData(form)), token };
      if (mode === "change") {
        const data = changePasswordSchema.safeParse(values);
        if (!data.success) throw new Error(data.error.issues[0].message);
        return change({ data: data.data });
      }
      if (completes) {
        if (mode === "verify") {
          const data = verifyEmailSchema.safeParse(values);
          if (!data.success) throw new Error(data.error.issues[0].message);
          return verify({ data: data.data });
        }
        const data = resetPasswordSchema.safeParse(values);
        if (!data.success) throw new Error(data.error.issues[0].message);
        return reset({ data: data.data });
      }
      const data = emailRequestSchema.safeParse(values);
      if (!data.success) throw new Error(data.error.issues[0].message);
      return mode === "verify" ? sendVerify({ data: data.data }) : sendReset({ data: data.data });
    },
    onSuccess: (_, form) => form.reset(),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(event.currentTarget);
  }
  const title =
    mode === "change"
      ? "Change your password"
      : mode === "verify"
        ? "Verify your email"
        : "Reset your password";
  const content = (
    <div className="signin-form">
      <h1>{title}</h1>
      <p className="signin-lead">
        {mode === "change"
          ? "For accounts created with email and password. Google and Apple accounts use their provider’s security settings."
          : completes && mode === "verify"
            ? "Enter the password you chose when signing up to confirm this email address. If you did not create this account, do not continue."
            : completes
              ? "Choose a new password for your account."
              : "Enter your email address and we’ll send a link if your account is eligible."}
      </p>
      {ready && !mutation.isSuccess && (
        <form onSubmit={submit} className="customer-password-form" aria-busy={mutation.isPending}>
          <fieldset disabled={mutation.isPending}>
            {!completes && (
              <label className="customer-field">
                <span>Email address</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode === "change" && <PasswordField name="currentPassword" label="Current password" />}
            {completes && (
              <PasswordField
                fresh={mode !== "verify"}
                label={mode === "verify" ? "Your signup password" : "New password"}
              />
            )}
            {completes && mode !== "verify" && (
              <PasswordField name="confirmPassword" label="Confirm new password" fresh />
            )}
            <button className="customer-provider" type="submit">
              {mutation.isPending ? "Please wait…" : completes ? title : "Send email"}
            </button>
          </fieldset>
        </form>
      )}
      {mutation.error && (
        <p className="signin-msg err" role="alert">
          {mutation.error.message}
        </p>
      )}
      {mutation.data && <p role="status">{mutation.data.message}</p>}
      {mutation.isSuccess && !completes && (
        <button className="customer-provider" onClick={() => mutation.reset()}>
          Request another email
        </button>
      )}
      <p className="customer-auth-note">
        <Link to="/signin">Back to sign in</Link>
        {mode === "verify" && token && (
          <>
            {" "}
            · <Link to="/forgot-password">Forgot your signup password?</Link>
          </>
        )}
        {completes && mode !== "change" && (
          <>
            {" "}
            ·{" "}
            <a href={mode === "verify" ? "/verify-email" : "/forgot-password"}>
              Request a new link
            </a>
          </>
        )}
      </p>
    </div>
  );
  return mode === "change" ? (
    <section className="ship-block">{content}</section>
  ) : (
    <main className="customer-recovery">{content}</main>
  );
}
