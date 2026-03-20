import "dotenv/config";
import mysql from "mysql2/promise";

async function testConnection() {
    console.log("Testing database connection...");
    const url = process.env.DATABASE_URL;

    if (!url) {
        console.error("❌ DATABASE_URL is missing in .env");
        return;
    }

    try {
        const connection = await mysql.createConnection(url);
        await connection.ping();
        console.log("✅ Successfully connected to MySQL database!");

        const [rows] = await connection.query("SELECT 1 as val");
        console.log("✅ Query test passed:", rows);

        await connection.end();
    } catch (error: any) {
        console.error("❌ Database connection failed:");
        console.error(error.message);
    }
}

testConnection();
