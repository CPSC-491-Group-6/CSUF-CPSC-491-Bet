// backend/src/routes/bets.js
import { Router } from "express";

import { createBetController } from "../controllers/createBetController.js";
import { requireAuth } from "../middleware/requireAuth.js";

/** Register bet routes after session middleware but before errorHandler. */
export function createBetRouter({ betService }) {
  const router = Router();
  const controller = createBetController({ betService });

  router.use(requireAuth);
  router.post("/", controller.create);
  router.get("/", controller.listMine);
  router.get("/public", controller.listPublic);
  // Register specific lookup routes before any future /:id route.
  router.get("/code/:joinCode", controller.findByCode);
  return router;
}
