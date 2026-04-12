import serverless from "serverless-http";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "../server/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createServer();

// On Vercel, static files and SPA fallbacks are handled by Vercel CDN and vercel.json.
// We only expose the Express application to handle /api/* requests.
export default serverless(app);
