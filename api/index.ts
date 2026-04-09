import serverless from "serverless-http";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "../server/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createServer();

// Serve static files (React SPA)
// In Vercel, this resolves to /var/task/dist/spa
const distPath = path.join(__dirname, "..", "dist", "spa");
console.log("Serving static files from:", distPath);

app.use(express.static(distPath, { 
  // Don't serve HTML files directly, let the fallback handle them
  setHeaders: (res, filepath) => {
    if (filepath.endsWith(".html")) {
      res.set("Content-Type", "text/html; charset=utf-8");
    }
  }
}));

// SPA fallback: serve index.html for all non-API routes
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  const indexPath = path.join(distPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error serving index.html:", err);
      res.status(500).json({ error: "Could not serve index.html" });
    }
  });
});

export default serverless(app);
