import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

async function initializeDatabase() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL environment variable is not set.");
        process.exit(1);
    }

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });

        const db = drizzle(pool, { schema });

        console.log("Initializing PostgreSQL database...");

        // Create ENUM types first
        try {
            await db.execute(sql`
                DO $$ BEGIN
                    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            console.log("✓ Created attendance_status enum");
        } catch (error: any) {
            console.log("Note: attendance_status enum already exists or creation skipped");
        }

        console.log("✓ Database initialization completed successfully");
        await pool.end();
    } catch (error) {
        console.error("Error initializing database:", error);
        process.exit(1);
    }
}

initializeDatabase();
