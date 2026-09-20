import {
  emailAlreadyExistsError,
  usernameAlreadyExistsError,
  validationError,
} from "../errors/authErrors.js";

import {
  formatValidationIssues,
  registrationSchema,
} from "../validation/authSchemas.js";

/**
 * Remove sensitive authentication fields before user data leaves the
 * service layer.
 *
 * In particular, passwordHash must never be returned through an API
 * response even though the repository needs to retrieve it for login.
 */
function toSafeUser(user) {
  return {
    userID: user.userID,
    username: user.username,
    email: user.email,
    verificationStatus: user.verificationStatus,
    timeStamp: user.timeStamp,
  };
}

/**
 * Create the authentication business service.
 *
 * Dependencies are injected instead of imported directly so automated tests
 * can use controlled fake implementations without opening the production
 * database or performing expensive password hashes.
 *
 * @param {object} dependencies
 * @param {object} dependencies.userRepository User persistence interface.
 * @param {object} dependencies.passwordService Password hashing interface.
 */
export function createAuthService({ userRepository, passwordService }) {
  /**
   * Register a new user account.
   *
   * Registration performs the following steps:
   * 1. Validate request input.
   * 2. Normalize identity fields.
   * 3. Check whether email or username is already in use.
   * 4. Hash the plaintext password with Argon2id.
   * 5. Persist the account.
   * 6. Return a safe representation without passwordHash.
   */
  async function register(input) {
    const validationResult = registrationSchema.safeParse(input);

    if (!validationResult.success) {
      throw validationError(formatValidationIssues(validationResult.error));
    }

    const { username, email, password } = validationResult.data;

    // Preserve the user's chosen username capitalization for display.
    // The repository/database use case-insensitive comparisons for identity.
    const normalizedUsername = username.trim();

    // Email addresses are normalized before storage and lookup so the same
    // address is not represented with several capitalization variants.
    const normalizedEmail = email.trim().toLowerCase();

    const existingEmailUser = userRepository.findByEmail(normalizedEmail);

    if (existingEmailUser) {
      throw emailAlreadyExistsError();
    }

    const existingUsernameUser =
      userRepository.findByUsername(normalizedUsername);

    if (existingUsernameUser) {
      throw usernameAlreadyExistsError();
    }

    // Only the Argon2id hash is persisted. The plaintext password is never
    // sent to the repository or written to the database.
    const passwordHash = await passwordService.hashPassword(password);

    try {
      const user = userRepository.createUser({
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
      });

      return toSafeUser(user);
    } catch (error) {
      /*
       * The checks above produce friendly errors under normal circumstances,
       * but database UNIQUE constraints remain the ultimate guarantee.
       *
       * A concurrent registration could pass the earlier lookup and insert
       * just before this request. If that happens, re-check the conflicting
       * fields and convert the SQLite constraint into our standardized error.
       */
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        if (userRepository.findByEmail(normalizedEmail)) {
          throw emailAlreadyExistsError();
        }

        if (userRepository.findByUsername(normalizedUsername)) {
          throw usernameAlreadyExistsError();
        }
      }

      // Unexpected database/programming errors should not be disguised as
      // authentication failures. Let the global error handler process them.
      throw error;
    }
  }

  return {
    register,
  };
}
