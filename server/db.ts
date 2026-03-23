import "dotenv/config";
import { Pool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NEON_DATABASE_URL;

// You can override DB type explicitly with DB_TYPE (mysql | postgres)
const dbTypeFromEnv = process.env.DB_TYPE?.toLowerCase();
const inferredDbType = databaseUrl?.startsWith("mysql://")
  ? "mysql"
  : databaseUrl?.startsWith("postgres://") || databaseUrl?.startsWith("postgresql://")
  ? "postgres"
  : "postgres";

export const dbType = dbTypeFromEnv || inferredDbType;

export let pool: any = null;
export let db: any = null;

if (!databaseUrl) {
  console.error(
    "[db] ERROR: No database URL provided. Expected DATABASE_URL, NETLIFY_DATABASE_URL_UNPOOLED, or NEON_DATABASE_URL."
  );
} else if (dbType === "postgres") {
  pool = new Pool({ connectionString: databaseUrl });
  db = drizzlePg(pool, { schema });
  console.info("[db] Connected to Postgres database");
} else {
  console.error(`[db] ERROR: Unsupported DB_TYPE '${dbType}'. Use 'postgres'.`);
}



