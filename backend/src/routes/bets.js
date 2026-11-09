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

  // Every bet operation requires an authenticated session.
  router.use(requireAuth);

  router.post("/", controller.create);

  // Register specific routes before future parameterized routes.
  router.post("/join", participationController.join);

  // Only authorized creators may change the bet lifecycle.
  router.post("/:betId/lock", participationController.lock);
  router.post("/:betId/resolve", participationController.resolve);

  router.get("/", controller.listMine);
  router.get("/public", controller.listPublic);

  router.get("/code/:joinCode", controller.findByCode);
  router.get("/:betId", controller.getById);

  return router;
}
