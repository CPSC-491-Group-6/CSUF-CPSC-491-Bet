import { Router } from "express";

import { createBetController } from "../controllers/createBetController.js";
import { createBetHistoryController } from "../controllers/createBetHistoryController.js";
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

  const historyController = createBetHistoryController({
    betService,
  });

  const participationController = createBetParticipationController({
    betService,
  });

  // All bet operations require an authenticated session.
  router.use(requireAuth);

  // Create Bet and existing creator-owned My Bets.
  router.post("/", betController.create);
  router.get("/", betController.listMine);

  // Authenticated participant history.
  // Register before the parameterized individual bet route.
  router.get("/history", historyController.list);

  // Public discovery and invite-code lookup.
  router.get("/public", betController.listPublic);
  router.get("/code/:joinCode", betController.findByCode);

  // Existing invite-code Join Bet endpoint.
  router.post("/join", participationController.join);

  // Existing direct public Join Bet endpoint.
  router.post("/:betId/join", participationController.joinPublic);

  // Preserve creator-only Lock and Resolve endpoints.
  router.post("/:betId/lock", participationController.lock);
  router.post("/:betId/resolve", participationController.resolve);

  // Individual bet detail lookup.
  router.get("/:betId", betController.getById);

  return router;
}
