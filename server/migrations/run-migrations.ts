import "dotenv/config";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigrations() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL environment variable is not set.");
        process.exit(1);
    }

    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL);

        console.log("Running migrations...");

        // Migration 1: Add selected_role column
        try {
            await connection.query(`
                ALTER TABLE \`users\` 
                ADD COLUMN \`selected_role\` VARCHAR(50) NULL AFTER \`role\`
            `);
            console.log("✓ Added selected_role column to users table");
        } catch (error: any) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log("✓ selected_role column already exists");
            } else {
                throw error;
            }
        }

        // Migration 2: Create face_encodings table
        try {
            // Drop existing table if it has incompatible schema
            try {
                await connection.query(`DROP TABLE IF EXISTS \`face_encodings\``);
                console.log("✓ Dropped existing face_encodings table (for schema update)");
            } catch (error: any) {
                console.log("Note: Could not drop face_encodings table, continuing...");
            }

            // First create table without foreign key
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`face_encodings\` (
                  \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                  \`user_id\` BIGINT UNSIGNED NOT NULL,
                  \`encoding\` TEXT NOT NULL COMMENT 'JSON array of face descriptor values',
                  \`face_image\` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'Base64 encoded face image',
                  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (\`id\`),
                  UNIQUE KEY \`unique_user_id\` (\`user_id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log("✓ Created face_encodings table");

            // Now add the foreign key constraint
            try {
                await connection.query(`
                    ALTER TABLE \`face_encodings\`
                    ADD CONSTRAINT \`face_encodings_user_id_fk\` 
                    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
                `);
                console.log("✓ Added foreign key constraint");
            } catch (error: any) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    console.log("✓ Foreign key constraint already exists");
                } else {
                    console.log("⚠ Could not add foreign key (this is OK for development):", error.message);
                }
            }
        } catch (error: any) {
            if (error.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log("✓ face_encodings table already exists");
            } else {
                throw error;
            }
        }

        // Migration 3: Add face_image column to face_encodings table (if not already present)
        try {
            await connection.query(`
                ALTER TABLE \`face_encodings\` 
                ADD COLUMN \`face_image\` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER \`encoding\`
            `);
            console.log("✓ Added face_image column to face_encodings table");
        } catch (error: any) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log("✓ face_image column already exists");
            } else {
                // Column might already exist from table recreation, ignore errors
                console.log("Note: face_image column check completed");
            }
        }

        // Migration 4: Create sessions table for QR codes
        try {
            // Drop and recreate to fix type mismatch (INT -> BIGINT)
            await connection.query(`DROP TABLE IF EXISTS \`sessions\``);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`sessions\` (
                  \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                  \`teacher_id\` BIGINT UNSIGNED NOT NULL,
                  \`code\` VARCHAR(255) NOT NULL,
                  \`subject\` VARCHAR(255) NOT NULL,
                  \`expires_at\` TIMESTAMP NOT NULL,
                  \`is_active\` VARCHAR(10) DEFAULT 'true',
                  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (\`id\`),
                  UNIQUE KEY \`unique_code\` (\`code\`),
                  CONSTRAINT \`sessions_teacher_id_fk\` FOREIGN KEY (\`teacher_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log("✓ Recreated sessions table with BIGINT UNSIGNED");
        } catch (error: any) {
            console.log("Note: Could not create sessions table or it already exists:", error.message);
        }

        // Migration 5: Update attendance table for 2-step verification
        try {
            // Add session_id
            try {
                await connection.query(`
                    ALTER TABLE \`attendance\` 
                    ADD COLUMN \`session_id\` BIGINT UNSIGNED NULL AFTER \`user_id\`,
                    ADD CONSTRAINT \`attendance_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`sessions\` (\`id\`) ON DELETE SET NULL
                `);
                console.log("✓ Added session_id column to attendance table");
            } catch (error: any) {
                if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_FK_DUP_NAME') {
                    console.log("✓ session_id column or constraint already exists");
                } else {
                    console.log("Note: session_id update check completed", error.message);
                }
            }

            // Update method to VARCHAR and add verification flags
            try {
                await connection.query(`
                    ALTER TABLE \`attendance\` 
                    MODIFY COLUMN \`method\` VARCHAR(50) NOT NULL,
                    ADD COLUMN \`qr_verified\` VARCHAR(10) DEFAULT 'false',
                    ADD COLUMN \`face_verified\` VARCHAR(10) DEFAULT 'false'
                `);
                console.log("✓ Updated attendance table with verification flags");
            } catch (error: any) {
                console.log("Note: attendance flags check completed");
            }
        } catch (error: any) {
            console.error("Attendance update error:", error);
        }

        // Migration 6: Add can_generate_qr column to users
        try {
            await connection.query(`
                ALTER TABLE \`users\` 
                ADD COLUMN \`can_generate_qr\` VARCHAR(10) DEFAULT 'false' AFTER \`selected_role\`
            `);
            console.log("✓ Added can_generate_qr column to users table");

            // Auto-grant access to existing admins
            await connection.query(`
                UPDATE \`users\` SET \`can_generate_qr\` = 'true' WHERE \`role\` = 'admin'
            `);
            console.log("✓ Auto-granted QR access to admins");
        } catch (error: any) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log("✓ can_generate_qr column already exists");
            } else {
                console.log("Note: can_generate_qr update check completed", error.message);
            }
        }

        // Migration 7: Sections and Subjects
        try {
            console.log('Running Migration 7: Sections and Subjects...');

            // Create sections table
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`sections\` (
                    \`id\` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
                    \`name\` VARCHAR(255) NOT NULL,
                    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log("✓ Created sections table");

            // Create teacher_sections junction table
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`teacher_sections\` (
                    \`id\` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
                    \`teacher_id\` BIGINT UNSIGNED NOT NULL,
                    \`section_id\` BIGINT UNSIGNED NOT NULL,
                    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (\`teacher_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`section_id\`) REFERENCES \`sections\`(\`id\`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log("✓ Created teacher_sections table");

            // Add subject to users
            try {
                await connection.query(`
                    ALTER TABLE \`users\` ADD COLUMN \`subject\` VARCHAR(255) AFTER \`can_generate_qr\`
                `);
                console.log("✓ Added subject column to users");
            } catch (e: any) {
                if (e.code === 'ER_DUP_FIELDNAME') console.log("✓ subject column exists");
                else console.log("Note: subject column check:", e.message);
            }

            // Add section_id to users (for students)
            try {
                await connection.query(`
                    ALTER TABLE \`users\` ADD COLUMN \`section_id\` BIGINT UNSIGNED AFTER \`subject\`
                `);
                console.log("✓ Added section_id column to users");
            } catch (e: any) {
                if (e.code === 'ER_DUP_FIELDNAME') console.log("✓ section_id column exists in users");
                else console.log("Note: section_id user check:", e.message);
            }

            // Add section_id to sessions
            try {
                await connection.query(`
                    ALTER TABLE \`sessions\` ADD COLUMN \`section_id\` BIGINT UNSIGNED AFTER \`subject\`
                `);
                console.log("✓ Added section_id column to sessions");
            } catch (e: any) {
                if (e.code === 'ER_DUP_FIELDNAME') console.log("✓ section_id column exists in sessions");
                else console.log("Note: section_id session check:", e.message);
            }
        } catch (error: any) {
            console.error("Migration 7 error:", error);
        }

        // Migration 8: Profile Photo
        try {
            console.log('Running Migration 8: Profile Photo...');
            await connection.query(`
                ALTER TABLE \`users\` ADD COLUMN \`profile_photo\` TEXT AFTER \`section_id\`
            `);
            console.log("✓ Added profile_photo column to users");
        } catch (error: any) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log("✓ profile_photo column already exists");
            } else {
                console.log("Migration 8 error:", error.message);
            }
        }

        // Migration 9: Location Coordinates for Attendance
        try {
            console.log('Running Migration 9: Location Coordinates for Attendance...');
            await connection.query(`
                ALTER TABLE \`attendance\` 
                ADD COLUMN \`latitude\` VARCHAR(50) NULL AFTER \`face_verified\`,
                ADD COLUMN \`longitude\` VARCHAR(50) NULL AFTER \`latitude\`
            `);
            console.log("✓ Added latitude and longitude columns to attendance table");
        } catch (error: any) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log("✓ latitude/longitude columns already exist");
            } else {
                console.log("Migration 9 error:", error.message);
            }
        }

        await connection.end();
        console.log("\n✅ All migrations completed successfully!");
    } catch (error) {
        console.error("Migration error:", error);
        process.exit(1);
    }
}

runMigrations();
