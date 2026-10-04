import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { signupCustomer, signinCustomerPassword } from "@/lib/api/password.functions";
import { customerSignupSchema, customerPasswordSigninSchema } from "@/lib/auth/password.schemas";

export function PasswordField({
  name = "password",
  label = "Password",
  fresh = false,
}: {
  name?: string;
  label?: string;
  fresh?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="customer-field">
      <span>{label}</span>
      <div className="customer-password-input">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={fresh ? "new-password" : "current-password"}
          required
          minLength={fresh ? 15 : 1}
          maxLength={128}
          aria-describedby={fresh ? `${name}-hint` : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {fresh && (
        <small id={`${name}-hint`}>
          Use 15–128 characters. A phrase with several words works well.
        </small>
      )}
    </label>
  );
}

export function CustomerPasswordForm({ signup, returnTo }: { signup: boolean; returnTo: string }) {
  const register = useServerFn(signupCustomer);
  const signin = useServerFn(signinCustomerPassword);
  const mutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const values = Object.fromEntries(new FormData(form));
      if (signup) {
        const parsed = customerSignupSchema.safeParse(values);
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        const result = await register({ data: parsed.data });
        form.reset();
        return result.message;
      }
      const parsed = customerPasswordSigninSchema.safeParse(values);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      await signin({ data: parsed.data });
      window.location.assign(returnTo);
      return "";
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(event.currentTarget);
  }
  return (
    <form className="customer-password-form" onSubmit={submit} aria-busy={mutation.isPending}>
      <fieldset disabled={mutation.isPending}>
        {signup && (
          <label className="customer-field">
            <span>Your name</span>
            <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
          </label>
        )}
        <label className="customer-field">
          <span>Email address</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            maxLength={254}
          />
        </label>
        <PasswordField fresh={signup} />
        {signup && <PasswordField name="confirmPassword" label="Confirm password" fresh />}
        {signup && (
          <p className="customer-auth-note">
            We’ll email you a verification link before you can sign in.
          </p>
        )}
        <button className="customer-provider" type="submit">
          {mutation.isPending
            ? "Please wait…"
            : signup
              ? "Create account with email"
              : "Sign in with email"}
        </button>
      </fieldset>
      {mutation.error && (
        <p role="alert" className="signin-msg err">
          {mutation.error?.message}
        </p>
      )}
      {mutation.data && (
        <p role="status" className="customer-auth-message">
          {mutation.data}
        </p>
      )}
      <p className="customer-auth-note">
        <Link to="/forgot-password">Forgot password?</Link> ·{" "}
        <Link to="/verify-email">Resend verification email</Link>
      </p>
    </form>
  );
}
