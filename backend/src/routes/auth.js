// backend/src/routes/auth.js

import { Router } from "express";

import { createAuthController } from "../controllers/createAuthController.js";
import { requireAuth } from "../middleware/requireAuth.js";

/**
 * Prevent browsers and intermediary caches from storing
 * session-sensitive authentication responses.
 */
function preventAuthCaching(req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  next();
}

/**
 * Create all account/authentication routes.
 *
 * Public endpoints handle registration and login.
 * Protected endpoints require a valid server-side session.
 */
export function createAuthRouter({ authService }) {
  const router = Router();

  const authController = createAuthController({
    authService,
  });

  // Authentication responses must not be cached.
  router.use(preventAuthCaching);

  /**
   * Register a new account.
   */
  router.post("/register", authController.register);

  /**
   * Verify credentials and create a server-side session.
   */
  router.post("/login", authController.login);

  /**
   * Validate the current server-side session.
   *
   * Unauthenticated requests are rejected by requireAuth
   * before the controller is executed.
   */
  router.get("/me", requireAuth, authController.me);

  /**
   * Invalidate the current authenticated session.
   */
  router.post("/logout", requireAuth, authController.logout);

  return router;
}
