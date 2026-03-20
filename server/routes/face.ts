import { Router, Request, Response } from "express";
import { db } from "../db";
import { faceEncodings, users } from "../schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const storeFaceSchema = z.object({
    userId: z.number(),
    encoding: z.array(z.number()), // Array of face descriptor values
    imageData: z.string(), // Base64 encoded image (data:image/jpeg;base64,...)
});

const verifyFaceSchema = z.object({
    userId: z.number(),
    encoding: z.array(z.number()),
    threshold: z.number().optional().default(0.6), // Similarity threshold (0-1)
});

// Calculate Euclidean distance between two face encodings (optimized)
function calculateDistance(encoding1: number[], encoding2: number[]): number {
    if (encoding1.length !== encoding2.length) {
        return Infinity; // Different dimensions = no match
    }

    let sum = 0;
    const len = encoding1.length;

    // Use unrolled loop for faster computation
    for (let i = 0; i < len; i++) {
        const diff = encoding1[i] - encoding2[i];
        sum += diff * diff;
    }

    return Math.sqrt(sum);
}

// Calculate cosine similarity (better for high-dimensional face embeddings)
// Returns value between 0 and 1, where 1 is identical, 0 is orthogonal/opposite
function calculateCosineSimilarity(encoding1: number[], encoding2: number[]): number {
    if (encoding1.length !== encoding2.length) {
        return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < encoding1.length; i++) {
        dotProduct += encoding1[i] * encoding2[i];
        norm1 += encoding1[i] * encoding1[i];
        norm2 += encoding2[i] * encoding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
        return 0;
    }

    // Cosine similarity ranges from -1 to 1
    const cosineSim = dotProduct / (norm1 * norm2);

    // For face recognition: use (1 + cosineSim) / 2 to map [-1, 1] to [0, 1]
    // This makes matching more practical:
    // - Identical faces: cosineSim = 1.0, result = 1.0
    // - Very similar (same person, diff angle): cosineSim = 0.7-0.9, result = 0.85-0.95
    // - Different people: cosineSim = -0.3 to 0.2, result = 0.35-0.6
    // - Very different: cosineSim = -1.0, result = 0.0
    return Math.max(0, Math.min(1, (cosineSim + 1) / 2));
}

// Convert distance to similarity score (0-1, where 1 is identical)
// For 128-dimensional face encodings, use cosine similarity
function distanceToSimilarity(encoding1: number[], encoding2: number[]): number {
    // Use cosine similarity which is better for face embeddings
    // This naturally handles 128-dimensional vectors
    // Returns value between 0 and 1
    return calculateCosineSimilarity(encoding1, encoding2);
}

router.post("/store-face", async (req: Request, res: Response) => {
    try {
        const parseResult = storeFaceSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
            return;
        }

        const { userId, encoding, imageData } = parseResult.data;

        // Verify user exists
        const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (userExists.length === 0) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Check if face encoding already exists
        const existing = await db
            .select()
            .from(faceEncodings)
            .where(eq(faceEncodings.userId, userId))
            .limit(1);

        const encodingJson = JSON.stringify(encoding);

        if (existing.length > 0) {
            // Update existing encoding and image
            await db
                .update(faceEncodings)
                .set({
                    encoding: encodingJson,
                    faceImage: imageData, // Store base64 image data
                    updatedAt: new Date()
                })
                .where(eq(faceEncodings.userId, userId));

            res.json({
                message: "Face encoding and image updated successfully",
                isNew: false
            });
        } else {
            // Create new encoding with image
            await db.insert(faceEncodings).values({
                userId,
                encoding: encodingJson,
                faceImage: imageData, // Store base64 image data
            });

            res.json({
                message: "Face encoding and image stored successfully",
                isNew: true
            });
        }
    } catch (error) {
        console.error("Store face error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error details:", errorMessage);
        res.status(500).json({ message: "Internal server error", error: errorMessage });
    }
});

router.post("/verify-face", async (req: Request, res: Response) => {
    try {
        const startTime = Date.now();

        const parseResult = verifyFaceSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
            return;
        }

        const { userId, encoding, threshold } = parseResult.data;

        // Get stored face encoding for user
        const storedFaces = await db
            .select()
            .from(faceEncodings)
            .where(eq(faceEncodings.userId, userId))
            .limit(1);

        if (storedFaces.length === 0) {
            res.status(404).json({
                message: "No face encoding found for this user. Please register your face first.",
                match: false,
                needsRegistration: true
            });
            return;
        }

        const storedEncoding = JSON.parse(storedFaces[0].encoding) as number[];

        // Calculate similarity using cosine similarity
        const similarity = distanceToSimilarity(encoding, storedEncoding);
        const distance = calculateDistance(encoding, storedEncoding);

        // Use a stricter dual-check for reliability:
        // 1. Cosine similarity must be above threshold (default 0.8)
        // 2. Euclidean distance must be below 0.6 (standard for face-api.js)
        const matches = similarity >= threshold && distance <= 0.6;

        const responseTime = Date.now() - startTime;

        // Log detailed matching information for debugging
        console.log(`\n📊 Face Verification for User ${userId}:`);
        console.log(`   Cosine Similarity: ${similarity.toFixed(4)} (${(similarity * 100).toFixed(1)}%)`);
        console.log(`   Euclidean Distance: ${distance.toFixed(4)}`);
        console.log(`   Threshold: ${threshold} (${(threshold * 100).toFixed(0)}%)`);
        console.log(`   Requirement: Sim >= ${threshold} AND Dist <= 0.6`);
        console.log(`   Result: ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);
        console.log(`   Time: ${responseTime}ms\n`);

        res.json({
            match: matches,
            similarity: Math.round(similarity * 100) / 100,
            distance: Math.round(distance * 100) / 100,
            threshold,
            responseTime,
            message: matches
                ? "Face matches successfully"
                : `Face does not match clearly enough. Similarity: ${(similarity * 100).toFixed(1)}% (required: ${(threshold * 100).toFixed(0)}%) and Distance: ${distance.toFixed(2)} (required: < 0.60)`
        });
    } catch (error) {
        console.error("Verify face error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get("/has-face/:userId", async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId as string);
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }

        const storedFaces = await db
            .select()
            .from(faceEncodings)
            .where(eq(faceEncodings.userId, userId))
            .limit(1);

        res.json({
            hasFace: storedFaces.length > 0,
            registeredAt: storedFaces[0]?.createdAt || null
        });
    } catch (error) {
        console.error("Check face error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
