import { mysqlTable, serial, varchar, timestamp, text, bigint, mysqlEnum, int } from "drizzle-orm/mysql-core"; // Schema for Attendance Tracker

export const users = mysqlTable("users", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 50 }).default("student"),
    selectedRole: varchar("selected_role", { length: 50 }),
    canGenerateQr: varchar("can_generate_qr", { length: 10 }).default("false"),
    subject: varchar("subject", { length: 255 }), // Specifically for teachers
    sectionId: bigint("section_id", { mode: 'number' }), // For students
    profilePhoto: text("profile_photo"), // New: Path or Base64
    createdAt: timestamp("created_at").defaultNow(),
});

export const sections = mysqlTable("sections", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});

export const teacherSections = mysqlTable("teacher_sections", {
    id: serial("id").primaryKey(),
    teacherId: bigint("teacher_id", { mode: 'number' }).references(() => users.id).notNull(),
    sectionId: bigint("section_id", { mode: 'number' }).references(() => sections.id).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = mysqlTable("sessions", {
    id: serial("id").primaryKey(),
    teacherId: bigint("teacher_id", { mode: 'number' }).references(() => users.id).notNull(),
    sectionId: bigint("section_id", { mode: 'number' }).references(() => sections.id), // New: associate session with a section
    code: varchar("code", { length: 255 }).notNull().unique(), // The QR code value
    subject: varchar("subject", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    isActive: varchar("is_active", { length: 10 }).default("true"),
    createdAt: timestamp("created_at").defaultNow(),
});

export const attendance = mysqlTable("attendance", {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: 'number' }).references(() => users.id).notNull(),
    sessionId: bigint("session_id", { mode: 'number' }).references(() => sessions.id), // Link to session
    date: timestamp("date").defaultNow(),
    status: mysqlEnum("status", ["present", "absent", "late"]).default("present"),
    method: varchar("method", { length: 50 }).notNull(), // Changed to varchar for more flexibility (qr, facial, hybrid)
    subject: varchar("subject", { length: 255 }),
    qrVerified: varchar("qr_verified", { length: 10 }).default("false"),
    faceVerified: varchar("face_verified", { length: 10 }).default("false"),
    latitude: varchar("latitude", { length: 50 }),
    longitude: varchar("longitude", { length: 50 }),
});

export const faceEncodings = mysqlTable("face_encodings", {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: 'number' }).references(() => users.id).notNull().unique(),
    encoding: text("encoding").notNull(), // JSON array of face descriptor values
    faceImage: text("face_image"), // Base64 encoded image (data:image/jpeg;base64,...) - using text for compatibility
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
export type TeacherSection = typeof teacherSections.$inferSelect;
export type NewTeacherSection = typeof teacherSections.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type FaceEncoding = typeof faceEncodings.$inferSelect;
export type NewFaceEncoding = typeof faceEncodings.$inferInsert;
