import { Router } from "express";

import { createBetController } from "../controllers/createBetController.js";
import { createBetHistoryController } from "../controllers/createBetHistoryController.js";
import { createBetParticipationController } from "../controllers/createBetParticipationController.js";
import { requireAuth } from "../middleware/requireAuth.js";

/**
 * Register authenticated Bet API routes.
 *
 * Session middleware runs before this router, and
 * the application error handler runs afterward.
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

  // All bet operations require authentication.
  router.use(requireAuth);

  // Create Bet and creator-owned My Bets.
  router.post("/", betController.create);
  router.get("/", betController.listMine);

  // Register fixed paths before parameterized bet routes.
  router.get("/history", historyController.list);
  router.get("/public", betController.listPublic);
  router.get("/code/:joinCode", betController.findByCode);

  // Private/invite-code joining.
  router.post("/join", participationController.join);

  // Public joining without a code.
  router.post("/:betId/join", participationController.joinPublic);

  // Creator-controlled lifecycle operations.
  router.post("/:betId/lock", participationController.lock);
  router.post("/:betId/unlock", participationController.unlock);
  router.post("/:betId/resolve", participationController.resolve);

  // Individual bet details.
  router.get("/:betId", betController.getById);

  return router;
}
