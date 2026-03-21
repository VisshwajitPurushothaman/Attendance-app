import { Request, Response, Router } from "express";
import { db } from "../db";
import { users } from "../schema";
import { loginSchema, signupSchema } from "@shared/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
// In a real app, use bcrypt or argon2
// import bcrypt from "bcrypt";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
    try {
        const parseResult = signupSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
            return; // Ensure function exits
        }

        if (!db) {
            res.status(500).json({ message: "Database connection not available" });
            return;
        }

        const { email, password, name, role } = parseResult.data;

        const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingUser.length > 0) {
            res.status(409).json({ message: "User already exists" });
            return;
        }

        // Hash password (simplified for demo)
        // const passwordHash = await bcrypt.hash(password, 10);
        const passwordHash = password; // WARNING: Don't do this in production!

        const [result] = await db.insert(users).values({
            name,
            email,
            passwordHash,
            role, // Add validation for role enum if strict
        });

        // Fetch the newly created user to return (optional)
        // const newUser = await db.select().from(users).where(eq(users.id, result.insertId)).limit(1);

        res.status(201).json({ message: "User created successfully", userId: result.insertId });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/login", async (req: Request, res: Response) => {
    try {
        const parseResult = loginSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
            return;
        }

        if (!db) {
            res.status(500).json({ message: "Database connection not available" });
            return;
        }

        const { email, password } = parseResult.data;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!user) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }

        // Verify password (simplified)
        // const isValid = await bcrypt.compare(password, user.passwordHash);
        const isValid = password === user.passwordHash;

        if (!isValid) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }

        // Return user info (excluding password)
        // Handle selectedRole gracefully in case column doesn't exist in DB yet
        const { passwordHash, ...userInfo } = user;
        const responseUser = {
            ...userInfo,
            selectedRole: userInfo.selectedRole || null, // Ensure selectedRole is always present
            canGenerateQr: userInfo.canGenerateQr === 'true', // Map to boolean for frontend
        };

        res.json({ message: "Login successful", user: responseUser });
    } catch (error: any) {
        console.error("Login error:", error);

        // Check if error is related to missing column
        if (error.message && error.message.includes("selected_role")) {
            res.status(500).json({
                message: "Database schema mismatch. Please run the migration to add selected_role column.",
                error: "Missing column: selected_role",
                migrationHint: "Run: ALTER TABLE users ADD COLUMN selected_role VARCHAR(50) NULL AFTER role;"
            });
            return;
        }

        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

const setRoleSchema = z.object({
    userId: z.number(),
    role: z.enum(["admin", "teacher", "student"]),
});

// Get all users (Admin only in practice, but simplified here)
router.get("/users", async (_req: Request, res: Response) => {
    try {
        const allUsers = await db.select().from(users);
        // Remove passwords from response
        const usersInfo = allUsers.map(({ passwordHash, ...userInfo }) => userInfo);
        res.json({ users: usersInfo });
    } catch (error) {
        console.error("Fetch users error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Toggle QR generation access for a teacher
router.post("/toggle-qr-access", async (req: Request, res: Response) => {
    try {
        const { userId, access } = req.body;
        if (typeof userId !== 'number' || typeof access !== 'boolean') {
            res.status(400).json({ message: "Invalid input" });
            return;
        }

        const accessStr = access ? 'true' : 'false';

        const result = await db.update(users)
            .set({ canGenerateQr: accessStr })
            .where(eq(users.id, userId));

        res.json({ message: `Access ${access ? 'granted' : 'revoked'} successfully` });
    } catch (error) {
        console.error("Toggle QR access error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/set-role", async (req: Request, res: Response) => {
    try {
        const parseResult = setRoleSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
            return;
        }

        const { userId, role } = parseResult.data;

        const existingUsers = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const [existingUser] = existingUsers;

        if (!existingUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Prevent changing role if it's already set (unless the requester is an admin in a real system)
        if (existingUser.selectedRole && existingUser.selectedRole !== role && existingUser.role !== 'admin') {
            res.status(403).json({ message: "Role is already set. Only administrators can change roles." });
            return;
        }

        await db
            .update(users)
            .set({ role, selectedRole: role })
            .where(eq(users.id, userId));

        const { passwordHash, ...userInfo } = { ...existingUser, role, selectedRole: role };

        res.json({ message: "Role updated successfully", user: userInfo });
    } catch (error) {
        console.error("Set role error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Delete a user
router.delete("/users/:id", async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id as string);
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }

        // Check if user exists
        const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!existingUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Prevent self-deletion if needed (could be checked via session/token in real app)

        await db.delete(users).where(eq(users.id, userId));
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Update a user
router.patch("/users/:id", async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id as string);
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }

        const { name, email, role } = req.body;

        // Basic validation
        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (role) {
            updateData.role = role;
            updateData.selectedRole = role; // Sync selectedRole as well
        }

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ message: "No data provided to update" });
            return;
        }

        await db.update(users).set(updateData).where(eq(users.id, userId));
        res.json({ message: "User updated successfully" });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Update profile photo
router.patch("/update-profile-photo", async (req: Request, res: Response) => {
    try {
        const { userId, profilePhoto } = req.body;

        if (!userId || !profilePhoto) {
            res.status(400).json({ message: "User ID and profile photo are required" });
            return;
        }

        await db.update(users)
            .set({ profilePhoto })
            .where(eq(users.id, userId));

        res.json({ message: "Profile photo updated successfully" });
    } catch (error) {
        console.error("Update profile photo error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Change password
router.patch("/change-password", async (req: Request, res: Response) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;

        if (!userId || !currentPassword || !newPassword) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Verify current password (simplified for demo similar to login route)
        const isValid = currentPassword === user.passwordHash;

        if (!isValid) {
            res.status(401).json({ message: "Incorrect current password" });
            return;
        }

        await db.update(users)
            .set({ passwordHash: newPassword })
            .where(eq(users.id, userId));

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export const authRoutes = router;
