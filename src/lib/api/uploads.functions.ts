import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"] as const;

const uploadImageSchema = z.object({
  name: z.string().min(1).max(200),
  contentType: z.enum(ALLOWED),
  /** Base64 body of the file (no data: prefix). */
  data: z.string().min(16).max(8_000_000),
});

/**
 * Studio-only image upload. Goes to UploadThing when UPLOADTHING_TOKEN is set,
 * otherwise the file is inlined so the flow works with zero credentials.
 */
export const uploadPieceImage = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadImageSchema.parse(input))
  .handler(async ({ data }) => {
    const [{ readSession }, { canAccessStudio }, uploads] = await Promise.all([
      import("@/lib/auth/session.server"),
      import("@/lib/auth/config"),
      import("@/lib/uploads/uploadthing.server"),
    ]);
    const { session } = await readSession();
    if (!canAccessStudio(session)) throw new Error("Not authorised for the studio.");

    const binary = atob(data.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (bytes.byteLength > uploads.MAX_IMAGE_BYTES) {
      throw new Error("Image is larger than 4 MB — please compress it first.");
    }

    return uploads.uploadPieceImageFile({
      name: data.name,
      contentType: data.contentType,
      bytes,
    });
  });
