import { Router } from "express";

import { createBetController } from "../controllers/createBetController.js";
import { createBetParticipationController } from "../controllers/createBetParticipationController.js";
import { requireAuth } from "../middleware/requireAuth.js";

/**
 * Register authenticated Bet API routes.
 *
 * Session middleware must run before this router.
 * The application-wide error handler must run afterward.
 */
export function createBetRouter({ betService }) {
  const router = Router();

  const betController = createBetController({ betService });

  const participationController = createBetParticipationController({
    betService,
  });

  // All bet operations require an authenticated session.
  router.use(requireAuth);

  // Create Bet and My Bets.
  router.post("/", betController.create);
  router.get("/", betController.listMine);

  // Public discovery and invite-code lookup.
  router.get("/public", betController.listPublic);
  router.get("/code/:joinCode", betController.findByCode);

  // Existing invite-code Join Bet endpoint.
  router.post("/join", participationController.join);

  // New direct public Join Bet endpoint.
  router.post("/:betId/join", participationController.joinPublic);

  // Preserve the creator-only lock and resolve endpoints.
  router.post("/:betId/lock", participationController.lock);
  router.post("/:betId/resolve", participationController.resolve);

  // Individual bet detail lookup.
  router.get("/:betId", betController.getById);

  return router;
}
