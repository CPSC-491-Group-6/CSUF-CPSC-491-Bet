import userRepository from "../repositories/userRepository.js";

import { createAuthService } from "./createAuthService.js";
import { hashPassword, verifyPassword } from "./passwordService.js";

/**
 * Production authentication service.
 *
 * The factory itself remains dependency-agnostic for testing, while this
 * module connects it to the real SQLite repository and Argon2id service.
 */
const authService = createAuthService({
  userRepository,
  passwordService: {
    hashPassword,
    verifyPassword,
  },
});

export default authService;
