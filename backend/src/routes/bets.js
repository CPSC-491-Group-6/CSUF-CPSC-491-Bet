// backend/src/routes/bets.js

import { Router } from "express";
import { createBetController } from "../controllers/createBetController.js";
import { createBetParticipationController } from "../controllers/createBetParticipationController.js";
import { requireAuth } from "../middleware/requireAuth.js";

/** Register bet routes after session middleware but before errorHandler. */
export function createBetRouter({ betService }) {
  const router = Router();
  const controller = createBetController({ betService });
  const participationController = createBetParticipationController({
    betService,
  });

  router.use(requireAuth);

  router.post("/", controller.create);

  // The join route must precede any future parameterized bet-ID route.
  router.post("/join", participationController.join);
  router.post("/:betId/lock", participationController.lock);

  router.get("/", controller.listMine);
  router.get("/public", controller.listPublic);

  // Register specific lookup routes before any future /:id route.
  router.get("/code/:joinCode", controller.findByCode);

  return router;
}
