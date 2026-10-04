export type CustomerProvider = "google" | "apple";

export function isCustomerProvider(value: unknown): value is CustomerProvider {
  return value === "google" || value === "apple";
}

/** Never redirect a customer into staff/API routes or off this origin. */
export function customerReturnPath(value?: string) {
  if (
    !value ||
    value.length > 2048 ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return "/account";
  }
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";
  const url = new URL(value, "https://resolut.invalid");
  if (
    !/^\/(account|checkout|cart|collection|shipping|order\/[^/]+|product\/[^/]+)\/?$/.test(
      url.pathname,
    )
  ) {
    return "/account";
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export const CUSTOMER_AUTH_ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. You can try again whenever you’re ready.",
  expired: "Your sign-in attempt expired. Please start again.",
  unavailable: "This sign-in option is temporarily unavailable. Please try again later.",
  account_exists:
    "An account already uses this email. Use your original sign-in method (email, Google or Apple).",
  failed: "We couldn’t sign you in. Please try again.",
};
