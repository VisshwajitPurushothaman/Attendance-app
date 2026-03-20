import "dotenv/config";
import mysql from "mysql2/promise";

async function createDb() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error("DATABASE_URL environment variable is not set.");
        process.exit(1);
    }

    try {
        const dbUrl = new URL(url);
        const dbName = dbUrl.pathname.slice(1); // Remove leading slash

        console.log(`Attempting to create database: ${dbName}`);

        // Create connection config without the database name to connect to server directly
        const connection = await mysql.createConnection({
            host: dbUrl.hostname,
            port: Number(dbUrl.port) || 3306,
            user: decodeURIComponent(dbUrl.username),
            password: decodeURIComponent(dbUrl.password),
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`Database '${dbName}' created successfully (or already existed).`);

        await connection.end();
    } catch (error) {
        console.error("Error creating database:", error);
        process.exit(1);
    }
}

createDb();
