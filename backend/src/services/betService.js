// backend/src/services/betService.js

import database from "../data/database.js";
import betRepository from "../repositories/betRepository.js";
import { createBetParticipationRepository } from "../repositories/createBetParticipationRepository.js";
import { createBetService } from "./createBetService.js";
import { createBetParticipationService } from "./createBetParticipationService.js";

const participationRepository = createBetParticipationRepository(database);

const betService = {
  ...createBetService({ betRepository }),
  ...createBetParticipationService({ participationRepository }),
};

export default betService;
