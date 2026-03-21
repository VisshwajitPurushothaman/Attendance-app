import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "[db] ERROR: No database URL provided. Expected DATABASE_URL or NETLIFY_DATABASE_URL_UNPOOLED."
  );
}

export let pool: Pool | null = null;
export let db: ReturnType<(typeof drizzle)> | null = null;

if (databaseUrl) {
  pool = new Pool({ connectionString: databaseUrl });
  db = drizzle(pool, { schema, mode: "default" });
  console.info("[db] Connected to database");
} else {
  console.warn("[db] Running without a database connection.");
}

