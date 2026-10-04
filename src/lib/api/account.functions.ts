import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { CustomerProfile } from "@/lib/data/types";

/**
 * Customer portal reads. The session cookie is the security boundary: a signed
 * in customer sees linked purchases and guest orders for a verified email.
 */
export const fetchMyOrders = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "private, no-store");
  const [{ getRepository }, { readSession }] = await Promise.all([
    import("@/lib/data/repository.server"),
    import("@/lib/auth/session.server"),
  ]);

  const { session } = await readSession();
  if (!session) throw new Error("Sign in to view your orders.");

  const repo = await getRepository();
  const orders = await repo.listOrdersForCustomer(
    session.user.id, session.user.emailVerified ? session.user.email : undefined,
  );
  return { viewer: session.user, orders };
});

const profileSchema = z.object({
  contactEmail: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  addressLine: z.string().trim().max(160).optional().or(z.literal("")),
  addressLine2: z.string().trim().max(160).optional().or(z.literal("")),
  suburb: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  province: z.string().trim().max(60).optional().or(z.literal("")),
  postalCode: z.string().trim().max(12).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** The signed-in customer's saved contact + delivery details. */
export const fetchMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "private, no-store");
  const [{ getRepository }, { readSession }] = await Promise.all([
    import("@/lib/data/repository.server"),
    import("@/lib/auth/session.server"),
  ]);

  const { session } = await readSession();
  if (!session) throw new Error("Sign in to view your profile.");

  const repo = await getRepository();
  // The legacy column is named accountEmail; new keys use the stable customer ID.
  // Only a currently verified email may read a pre-OAuth profile for migration.
  const saved = await repo.getProfile(`customer:${session.user.id}`) ??
    (session.user.emailVerified ? await repo.getProfile(session.user.email) : null);
  return {
    accountEmail: session.user.email,
    name: session.user.name,
    profile:
      (saved ? { ...saved, accountEmail: session.user.email } : null) ??
      ({
        accountEmail: session.user.email,
        contactEmail: session.user.email,
        country: "South Africa",
      } as CustomerProfile),
  };
});

/**
 * Saves the profile. The session user ID is the key, so a customer can never
 * write to another account's profile by changing the contact email field.
 */
export const saveMyProfile = createServerFn({ method: "POST" })
  .inputValidator((data: ProfileInput) => profileSchema.parse(data))
  .handler(async ({ data }) => {
    const [{ getRepository }, { readSession }] = await Promise.all([
      import("@/lib/data/repository.server"),
      import("@/lib/auth/session.server"),
    ]);

    const { session } = await readSession();
    if (!session) throw new Error("Sign in to update your profile.");

    const clean = (v?: string) => {
      const t = (v ?? "").trim();
      return t === "" ? undefined : t;
    };

    const repo = await getRepository();
    const profile = await repo.saveProfile(`customer:${session.user.id}`, {
      contactEmail: data.contactEmail.trim(),
      phone: clean(data.phone),
      addressLine: clean(data.addressLine),
      addressLine2: clean(data.addressLine2),
      suburb: clean(data.suburb),
      city: clean(data.city),
      province: clean(data.province),
      postalCode: clean(data.postalCode),
      country: clean(data.country) ?? "South Africa",
      deliveryNotes: clean(data.deliveryNotes),
    });
    return { profile: { ...profile, accountEmail: session.user.email } };
  });
