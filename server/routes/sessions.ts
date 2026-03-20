import { Router, Request, Response } from "express";
import { db } from "../db";
import { sessions, users, attendance } from "../schema";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const createSessionSchema = z.object({
    teacherId: z.coerce.number(),
    subject: z.string(),
    durationMinutes: z.coerce.number().optional().default(60),
});

// Create a new attendance session with a unique QR code
router.post("/create", async (req: Request, res: Response) => {
    try {
        const parseResult = createSessionSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
            return;
        }

        const { teacherId, subject, durationMinutes } = parseResult.data;

        // Verify teacher exists and has correct permission or role
        const teacher = await db.select().from(users).where(eq(users.id, teacherId)).limit(1);
        if (teacher.length === 0) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const canCreate = teacher[0].role?.toLowerCase() === 'admin' || teacher[0].canGenerateQr === 'true';

        if (!canCreate) {
            res.status(403).json({ message: "You do not have permission to generate QR codes. Please contact an admin." });
            return;
        }

        // Generate a unique code (UUID or similar random string)
        const code = `SES-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

        const result = await db.insert(sessions).values({
            teacherId,
            subject,
            code,
            expiresAt,
            isActive: "true",
        });

        // In MySQL, result[0] is a ResultSetHeader containing insertId
        const sessionId = (result[0] as any).insertId;

        res.json({
            message: "Session created successfully",
            session: {
                id: sessionId,
                code,
                subject,
                expiresAt,
            }
        });
    } catch (error: any) {
        console.error("Create session error details:", {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).json({
            message: "Internal server error",
            details: error.message
        });
    }
});

// Verify a QR code and return session details
router.get("/verify/:code", async (req: Request, res: Response) => {
    try {
        const code = req.params.code as string;

        const session = await db
            .select()
            .from(sessions)
            .where(and(eq(sessions.code, code), eq(sessions.isActive, "true")))
            .limit(1);

        if (session.length === 0) {
            res.status(404).json({ message: "Invalid or inactive session code" });
            return;
        }

        const now = new Date();
        if (session[0].expiresAt < now) {
            // Mark as inactive if expired
            await db.update(sessions).set({ isActive: "false" }).where(eq(sessions.id, session[0].id));
            res.status(410).json({ message: "Session has expired" });
            return;
        }

        // Get teacher name
        const teacher = await db.select().from(users).where(eq(users.id, session[0].teacherId)).limit(1);

        res.json({
            valid: true,
            session: {
                id: session[0].id,
                subject: session[0].subject,
                teacherName: teacher[0]?.name || "Unknown Teacher",
                expiresAt: session[0].expiresAt,
            }
        });
    } catch (error) {
        console.error("Verify session error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get active sessions for a teacher
router.get("/active/:teacherId", async (req: Request, res: Response) => {
    try {
        const teacherId = parseInt(req.params.teacherId as string);
        if (isNaN(teacherId)) {
            res.status(400).json({ message: "Invalid teacher ID" });
            return;
        }

        const activeSessions = await db
            .select()
            .from(sessions)
            .where(and(
                eq(sessions.teacherId, teacherId),
                eq(sessions.isActive, "true"),
                gt(sessions.expiresAt, new Date())
            ));

        res.json({ sessions: activeSessions });
    } catch (error) {
        console.error("Get active sessions error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get attendance for a specific session
router.get("/:sessionId/attendance", async (req: Request, res: Response) => {
    try {
        const sessionId = parseInt(req.params.sessionId as string);
        if (isNaN(sessionId)) {
            res.status(400).json({ message: "Invalid session ID" });
            return;
        }

        // Fetch session info
        const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
        if (!session) {
            res.status(404).json({ message: "Session not found" });
            return;
        }

        // Fetch attendance records with user info
        const records = await db
            .select({
                id: attendance.id,
                userId: attendance.userId,
                name: users.name,
                email: users.email,
                date: attendance.date,
                status: attendance.status,
                method: attendance.method,
                latitude: attendance.latitude,
                longitude: attendance.longitude,
                qrVerified: attendance.qrVerified,
                faceVerified: attendance.faceVerified,
            })
            .from(attendance)
            .innerJoin(users, eq(attendance.userId, users.id))
            .where(eq(attendance.sessionId, sessionId));

        res.json({
            session,
            attendance: records
        });
    } catch (error) {
        console.error("Get session attendance error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
