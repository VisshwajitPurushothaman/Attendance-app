import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const dbType = process.env.DB_TYPE?.toLowerCase();
const dialect = dbType === "mysql" ? "mysql" : "postgresql";

export default defineConfig({
    out: "./migrations",
    schema: "./server/schema.ts",
    dialect,
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
