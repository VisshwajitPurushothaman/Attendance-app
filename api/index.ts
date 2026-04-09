import serverless from "serverless-http";
import express from "express";
import path from "path";
import { createServer } from "../server/index";

const app = createServer();

// Serve static files (React SPA)
const distPath = path.join(process.cwd(), "dist/spa");
app.use(express.static(distPath));

// SPA fallback: serve index.html for all non-API routes
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});

export default serverless(app);
