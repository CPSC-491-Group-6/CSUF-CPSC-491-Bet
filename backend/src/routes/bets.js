
import { Router } from "express";

import { createBetController } from "../controllers/createBetController.js";
import { requireAuth } from "../middleware/requireAuth.js";

/** Register bet routes after session middleware. */
export function createBetRouter({ betService }) {
  const router = Router();
  const controller = createBetController({ betService });

  router.use(requireAuth);

  // Create a bet.
  router.post("/", controller.create);

  // Retrieve the authenticated user's bets.
  router.get("/", controller.listMine);

  // Retrieve publicly visible bets.
  router.get("/public", controller.listPublic);

  // Find a bet using an invite code.
  // Must be registered before the /:betId route.
  router.get("/code/:joinCode", controller.findByCode);

  // Sprint 4 - Retrieve an individual bet by ID.
  router.get("/:betId", controller.getById);

  return router;
}
