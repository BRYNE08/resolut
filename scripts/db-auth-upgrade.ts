import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required.");
const client = new Client({ connectionString: url });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query(
    readFileSync(
      new URL("../prisma/updates/20260927_customer_password_auth.sql", import.meta.url),
      "utf8",
    ),
  );
  await client.query("COMMIT");
  console.log("Customer password authentication schema is ready. Existing data was preserved.");
} catch {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Authentication schema upgrade failed. Check database access and server logs.");
  process.exitCode = 1;
} finally {
  await client.end();
}
