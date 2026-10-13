// backend/src/services/betService.js
import betRepository from "../repositories/betRepository.js";
import { createBetService } from "./createBetService.js";

const betService = createBetService({ betRepository });
export default betService;
