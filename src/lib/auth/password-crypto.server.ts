import { scrypt, randomBytes, createHash, timingSafeEqual } from "node:crypto";

// OWASP's 32 MiB scrypt profile. Fixed parameters prevent unbounded costs from stored input.
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const PREFIX = "scrypt$32768$8$3";
const DUMMY_HASH = `${PREFIX}$${"0".repeat(32)}$${"0".repeat(128)}`;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, OPTIONS, (error, result) =>
      error ? reject(error) : resolve(result),
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derive(password, salt);
  return `${PREFIX}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded?: string | null) {
  const valid =
    typeof encoded === "string" &&
    /^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  const parts = (valid ? encoded : DUMMY_HASH).split("$");
  const derived = await derive(password, Buffer.from(parts[4]!, "hex"));
  const equal = timingSafeEqual(derived, Buffer.from(parts[5]!, "hex"));
  return Boolean(valid && equal);
}

export function newEmailToken() {
  return randomBytes(32).toString("hex");
}

export function emailTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
