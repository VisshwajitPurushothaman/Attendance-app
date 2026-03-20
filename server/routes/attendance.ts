import { Router, Request, Response } from "express";
import { db } from "../db";
import { attendance, users, faceEncodings, sessions } from "../schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const markAttendanceSchema = z.object({
    userId: z.number(),
    sessionId: z.number().optional(),
    method: z.string(), // "qr", "facial", or "hybrid"
    status: z.enum(["present", "absent", "late"]).default("present"),
    subject: z.string().optional(),
    qrVerified: z.boolean().optional().default(false),
    faceMatchVerified: z.boolean().optional().default(false),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
});

router.post("/mark", async (req: Request, res: Response) => {
    try {
        const parseResult = markAttendanceSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
            return;
        }

        const { userId, sessionId, method, status, subject, qrVerified, faceMatchVerified, latitude, longitude } = parseResult.data;

        // Verify user exists first
        const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (userExists.length === 0) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Handle hybrid/2-step requirement
        if (method === "hybrid" || method === "facial") {
            if (!faceMatchVerified) {
                res.status(400).json({ message: "Face verification required" });
                return;
            }
        }

        if (method === "hybrid" || method === "qr") {
            if (!qrVerified || !sessionId) {
                res.status(400).json({ message: "QR verification session required" });
                return;
            }
        }

        // If sessionId is provided, use subject from session if not provided
        let finalSubject = subject || "General";
        if (sessionId) {
            const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
            if (session.length > 0) {
                finalSubject = session[0].subject;
            }
        }

        await db.insert(attendance).values({
            userId,
            sessionId: sessionId || null,
            method,
            status,
            subject: finalSubject,
            qrVerified: qrVerified ? "true" : "false",
            faceVerified: faceMatchVerified ? "true" : "false",
            latitude: latitude || null,
            longitude: longitude || null,
        });

        res.status(201).json({ message: "Attendance marked successfully" });
    } catch (error) {
        console.error("Attendance error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get("/history/:userId", async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId as string);
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }

        const history = await db.select()
            .from(attendance)
            .where(eq(attendance.userId, userId))
            .orderBy(desc(attendance.date))
            .limit(10);

        res.json(history);
    } catch (error) {
        console.error("History error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get("/stats/:userId", async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId as string);
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }

        const records = await db.select().from(attendance).where(eq(attendance.userId, userId));

        const total = records.length;
        const present = records.filter(r => r.status === 'present').length;
        const absent = records.filter(r => r.status === 'absent').length;

        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        res.json({
            total,
            present,
            absent,
            percentage
        });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
