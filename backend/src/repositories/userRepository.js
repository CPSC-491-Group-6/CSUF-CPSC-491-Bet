// backend/src/repositories/userRepository.js

/**
 * A user repository for interacting with the users table in the database.
 */

import db from "../db/database.js";
import { createUserRepository } from "./createUserRepository.js";

const userRepository = createUserRepository(db);

export default userRepository;
