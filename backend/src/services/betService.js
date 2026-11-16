// backend/src/services/betService.js

import database from "../data/database.js";
import betRepository from "../repositories/betRepository.js";

import { createBetHistoryRepository } from "../repositories/createBetHistoryRepository.js";
import { createBetParticipationRepository } from "../repositories/createBetParticipationRepository.js";

import { createBetService } from "./createBetService.js";
import { createBetHistoryService } from "./createBetHistoryService.js";
import { createBetParticipationService } from "./createBetParticipationService.js";

// Reuse the configured SQLite connection.
const participationRepository = createBetParticipationRepository(database);

const historyRepository = createBetHistoryRepository(database);

// Compose the existing services and the new read-only history service.
const betService = {
  ...createBetService({ betRepository }),

  ...createBetParticipationService({
    participationRepository,
  }),

  ...createBetHistoryService({
    historyRepository,
  }),
};

export default betService;
