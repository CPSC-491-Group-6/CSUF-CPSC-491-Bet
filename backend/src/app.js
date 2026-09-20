// backend/src/app.js

import express from "express";

import healthRouter from "./routes/health.js";

// Create the main Express application.
const app = express();

// Allow Express to read JSON request bodies.
// This is required for registration, login, creating bets, etc.
app.use(express.json());

// Mount the health router.
// The "/" route inside health.js becomes GET /health here.
app.use("/health", healthRouter);

export default app;
