/**
 * Optional UploadThing adapter.
 *
 * `uploadthing` is deliberately NOT a dependency yet, so the specifier is held
 * in a variable and passed to a Vite-ignored dynamic import — the bundler never
 * resolves it and the studio keeps working without it installed.
 *
 * Go live:
 *   1. bun add uploadthing
 *   2. set UPLOADTHING_TOKEN (App dashboard → API Keys → V7 token)
 *
 * With no token the upload is inlined as a data URL so the flow is fully
 * testable locally; the returned `source` says which path ran.
 */

export type UploadedImage = {
  url: string;
  key: string | null;
  source: "uploadthing" | "inline";
};

export function isUploadthingConfigured() {
  return Boolean(process.env["UPLOADTHING_TOKEN"]);
}

/** Max accepted image size (bytes) — keeps the inline fallback sane too. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function uploadPieceImageFile(input: {
  name: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<UploadedImage> {
  const token = process.env["UPLOADTHING_TOKEN"];
  const inline = (): UploadedImage => ({
    url: `data:${input.contentType};base64,${toBase64(input.bytes)}`,
    key: null,
    source: "inline",
  });

  if (!token) return inline();

  const specifier = "uploadthing/server";
  try {
    const mod: Record<string, any> = await import(/* @vite-ignore */ specifier);
    const UTApi = mod.UTApi ?? mod.default?.UTApi;
    const api = new UTApi({ token });
    const file = new File([input.bytes as unknown as BlobPart], input.name, {
      type: input.contentType,
    });
    const result = await api.uploadFiles(file);
    if (result?.error) throw new Error(result.error.message ?? "UploadThing rejected the file.");
    const url: string | undefined = result?.data?.ufsUrl ?? result?.data?.url;
    if (!url) throw new Error("UploadThing returned no file URL.");
    return { url, key: result?.data?.key ?? null, source: "uploadthing" };
  } catch (error) {
    console.warn(
      "[resolut] UPLOADTHING_TOKEN is set but the upload failed (is `uploadthing` installed?) — inlining the image instead.",
      error,
    );
    return inline();
  }
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
