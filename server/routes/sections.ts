import { Router, Request, Response } from "express";
import { db } from "../db";
import { sections, teacherSections, users } from "../schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Get all sections
router.get("/", async (_req: Request, res: Response) => {
    try {
        const allSections = await db.select().from(sections);
        res.json({ sections: allSections });
    } catch (error) {
        console.error("Fetch sections error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create a new section
router.post("/", async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ message: "Section name is required" });
            return;
        }

        const [result] = await db.insert(sections).values({ name });
        const sectionId = (result as any).insertId;

        res.status(201).json({ message: "Section created successfully", sectionId });
    } catch (error) {
        console.error("Create section error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Allocate a teacher to a section
router.post("/allocate", async (req: Request, res: Response) => {
    try {
        const { teacherId, sectionId } = req.body;
        if (!teacherId || !sectionId) {
            res.status(400).json({ message: "Teacher ID and Section ID are required" });
            return;
        }

        // Check if allocation already exists
        const existing = await db.select().from(teacherSections).where(
            and(
                eq(teacherSections.teacherId, teacherId),
                eq(teacherSections.sectionId, sectionId)
            )
        ).limit(1);

        if (existing.length > 0) {
            res.status(409).json({ message: "Teacher already allocated to this section" });
            return;
        }

        await db.insert(teacherSections).values({ teacherId, sectionId });
        res.json({ message: "Teacher allocated to section successfully" });
    } catch (error) {
        console.error("Allocate teacher error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Remove teacher allocation from a section
router.post("/deallocate", async (req: Request, res: Response) => {
    try {
        const { teacherId, sectionId } = req.body;
        await db.delete(teacherSections).where(
            and(
                eq(teacherSections.teacherId, teacherId),
                eq(teacherSections.sectionId, sectionId)
            )
        );
        res.json({ message: "Allocation removed successfully" });
    } catch (error) {
        console.error("Deallocate teacher error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Update teacher subject
router.post("/teacher-subject", async (req: Request, res: Response) => {
    try {
        const { teacherId, subject } = req.body;
        if (!teacherId) {
            res.status(400).json({ message: "Teacher ID is required" });
            return;
        }

        await db.update(users).set({ subject }).where(eq(users.id, teacherId));
        res.json({ message: "Teacher subject updated successfully" });
    } catch (error) {
        console.error("Update teacher subject error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get sections allocated to a teacher
router.get("/teacher/:teacherId", async (req: Request, res: Response) => {
    try {
        const teacherId = parseInt(req.params.teacherId as string);
        const allocated = await db
            .select({
                id: sections.id,
                name: sections.name,
            })
            .from(teacherSections)
            .innerJoin(sections, eq(teacherSections.sectionId, sections.id))
            .where(eq(teacherSections.teacherId, teacherId));

        res.json({ sections: allocated });
    } catch (error) {
        console.error("Fetch teacher sections error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Assign student to section
router.post("/assign-student", async (req: Request, res: Response) => {
    try {
        const { studentId, sectionId } = req.body;
        if (!studentId) {
            res.status(400).json({ message: "Student ID is required" });
            return;
        }

        await db.update(users).set({ sectionId }).where(eq(users.id, studentId));
        res.json({ message: "Student assigned to section successfully" });
    } catch (error) {
        console.error("Assign student error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
