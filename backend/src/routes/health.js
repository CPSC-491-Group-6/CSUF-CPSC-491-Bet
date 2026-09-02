// backend/src/routes/health.js

import { Router } from "express";

// Create an isolated router for health-check related routes.
const router = Router();

// GET /health
// Used to confirm that the backend server is running and responding.
router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

export default router;
