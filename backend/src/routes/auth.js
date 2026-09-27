// backend/src/routes/auth.js

import { Router } from "express";

import { createAuthController } from "../controllers/createAuthController.js";
import { requireAuth } from "../middleware/requireAuth.js";

/**
 * Create all account/authentication routes.
 *
 * Public routes handle account creation and credential verification.
 * Protected routes require an authenticated server-side session before the
 * corresponding controller is allowed to execute.
 */
export function createAuthRouter({ authService }) {
  const router = Router();

  const authController = createAuthController({
    authService,
  });

  /**
   * Public endpoint: create a new account.
   */
  router.post("/register", authController.register);

  /**
   * Public endpoint: verify credentials and establish an authenticated
   * server-side session.
   */
  router.post("/login", authController.login);

  /**
   * Protected endpoint: retrieve the account associated with the current
   * server-side authentication session.
   */
  router.get("/me", requireAuth, authController.me);

  /**
   * Protected endpoint: invalidate the current server-side session.
   */
  router.post("/logout", requireAuth, authController.logout);

  return router;
}
