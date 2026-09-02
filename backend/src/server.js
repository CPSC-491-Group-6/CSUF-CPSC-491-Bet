// backend/src/server.js

import express from "express";

import { env } from "./config/env.js";
import healthRouter from "./routes/health.js";

// Create the main Express application.
const app = express();

// Allow Express to read JSON request bodies.
// This will be needed later for registration, login, creating bets, etc.
app.use(express.json());

// Mount the health router.
// The "/" route inside health.js becomes GET /health here.
app.use("/health", healthRouter);

// Start the backend API server using the port loaded from backend/.env.
app.listen(env.port, () => {
  console.log(`Bet backend running on port ${env.port}`);
});
