import serverless from "serverless-http";
import { createServer } from "../server/index";

const app = createServer();

// Vercel handles static SPA routing and CDN delivery.
// This serverless function handles all /api/* requests.
export default serverless(app);
