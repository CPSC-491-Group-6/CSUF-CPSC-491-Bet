// backend/src/repositories/betRepository.js
import database from "../data/database.js";
import { createBetRepository } from "./createBetRepository.js";

// Use the same configured SQLite connection as authentication and sessions.
const betRepository = createBetRepository(database);
export default betRepository;
