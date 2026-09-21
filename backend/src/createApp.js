// backend/src/createApp.js

import express from "express";

import { errorHandler } from "./middleware/errorHandler.js";
import { createAuthRouter } from "./routes/auth.js";
import healthRouter from "./routes/health.js";

/**
 * Build and configure the Express application.
 *
 * Authentication/session dependencies are injected so tests can use
 * isolated databases and session stores instead of production state.
 */
export function createApp({ authService, sessionMiddleware }) {
  const app = express();

  /**
   * Parse incoming JSON before authentication routes inspect req.body.
   */
  app.use(express.json());

  /**
   * Install session handling before routes that need req.session.
   *
   * sessionMiddleware remains optional so simple tests such as /health can
   * construct the app without needing authentication state.
   */
  if (sessionMiddleware) {
    app.use(sessionMiddleware);
  }

  app.use("/health", healthRouter);

  app.use(
    "/api/auth",
    createAuthRouter({
      authService,
    }),
  );

  /**
   * Error handling must remain last so errors from all earlier middleware and
   * routes reach the standardized response handler.
   */
  app.use(errorHandler);

  return app;
}
