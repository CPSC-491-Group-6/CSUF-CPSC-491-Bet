// backend/src/app.js

import { createApp } from "./createApp.js";
import sessionMiddleware from "./config/session.js";
import authService from "./services/authService.js";

/**
 * Production Express application configured with the real authentication
 * service and SQLite-backed session middleware.
 */
const app = createApp({
  authService,
  sessionMiddleware,
});

export default app;
