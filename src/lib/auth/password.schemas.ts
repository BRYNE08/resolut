import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254)
  .transform((email) => email.toLowerCase());
export const newPasswordSchema = z
  .string()
  .min(15, "Use at least 15 characters. A phrase with several words works well.")
  .max(128, "Use no more than 128 characters.")
  .refine(
    (value) =>
      ![
        "passwordpassword",
        "passwordpassword1",
        "123456789012345",
        "1234567890123456",
        "qwertyuiopasdfgh",
        "letmeinletmeinletmein",
      ].includes(value.toLowerCase()) && !/^(.)\1+$/.test(value),
    "Choose a less common password.",
  );

const passwords = {
  password: newPasswordSchema,
  confirmPassword: z.string().max(128),
};
const matches = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const mismatch = { message: "Passwords do not match.", path: ["confirmPassword"] };

export const customerSignupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(100),
    email: emailSchema,
    ...passwords,
  })
  .refine(matches, mismatch);
export const customerPasswordSigninSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export const emailRequestSchema = z.object({ email: emailSchema });
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "This link is invalid or expired.");
export const verifyEmailSchema = z.object({
  token: tokenSchema,
  password: z.string().min(1).max(128),
});
export const resetPasswordSchema = z
  .object({ token: tokenSchema, ...passwords })
  .refine(matches, mismatch);
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), ...passwords })
  .refine(matches, mismatch);

export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
export type CustomerPasswordSigninInput = z.infer<typeof customerPasswordSigninSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
