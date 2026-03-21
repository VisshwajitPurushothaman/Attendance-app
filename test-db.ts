import "dotenv/config";
import { Pool } from "pg";

async function testConnection() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL not set");
        process.exit(1);
    }

    try {
        console.log("Testing database connection...");
        console.log("URL:", process.env.DATABASE_URL.replace(/:[^:]+@/, ':***@')); // Hide password

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });

        // Test basic connection
        const result = await pool.query("SELECT 1 as test");
        console.log("✅ Database connection successful");

        // Check if tables exist
        const tables = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('users', 'sections', 'teacher_sections', 'sessions', 'attendance', 'face_encodings')
        `);

        console.log("Existing tables:", tables.rows.map(r => r.table_name));

        await pool.end();
        console.log("✅ Connection test completed");
    } catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
}

testConnection();