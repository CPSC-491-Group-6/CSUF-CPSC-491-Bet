import {
  emailAlreadyExistsError,
  invalidCredentialsError,
  usernameAlreadyExistsError,
  validationError,
} from "../errors/authErrors.js";

import {
  formatValidationIssues,
  loginSchema,
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

  /**
   * Authenticate a user using their email address and plaintext password.
   *
   * Login:
   * 1. validates the request,
   * 2. normalizes the email address,
   * 3. retrieves the matching account,
   * 4. verifies the password against the stored Argon2id hash,
   * 5. returns a safe user representation.
   *
   * Unknown accounts and incorrect passwords deliberately produce the same
   * INVALID_CREDENTIALS error so callers cannot determine whether a specific
   * email address is registered.
   */
  async function login(input) {
    const validationResult = loginSchema.safeParse(input);

    if (!validationResult.success) {
      throw validationError(formatValidationIssues(validationResult.error));
    }

    const { email, password } = validationResult.data;

    const normalizedEmail = email.trim().toLowerCase();

    const user = userRepository.findByEmail(normalizedEmail);

    /**
     * Fixed Argon2id hash used only to equalize login work when an email address
     * does not correspond to an account.
     *
     * Without this verification, an unknown email would return immediately while
     * an existing account would perform the relatively expensive Argon2id check.
     * That timing difference could reveal whether an account exists even though
     * both requests return the same INVALID_CREDENTIALS response.
     *
     * This hash was generated using the same Argon2id cost parameters used by the
     * application's password service:
     *
     *   memoryCost:  19456 KiB
     *   timeCost:    2
     *   parallelism: 1
     *
     * The corresponding plaintext value is irrelevant and is never accepted as
     * authentication for a real user because this hash is not associated with a
     * database account.
     */
    const DUMMY_PASSWORD_HASH =
      "$argon2id$v=19$m=19456,t=2,p=1$q3dgkl3vWgH3y7wmrxGUAQ$P+HU6Wf11OQ3auF3ZhLsQbjKEaBoZlxLdV4VgHAKiKI";

    /**
     * Perform a real password-verification operation even when no user exists.
     *
     * This keeps the computational work of:
     *
     *   unknown email
     *
     * much closer to:
     *
     *   existing email + incorrect password
     *
     * Both paths still return the exact same public authentication error.
     */
    if (!user) {
      await passwordService.verifyPassword(DUMMY_PASSWORD_HASH, password);
      throw invalidCredentialsError();
    }

    /*
     * verifyPassword compares the submitted plaintext password against the
     * encoded Argon2id hash stored in users.passwordHash.
     */
    const passwordMatches = await passwordService.verifyPassword(
      user.passwordHash,
      password,
    );

    if (!passwordMatches) {
      throw invalidCredentialsError();
    }

    /*
     * Authentication succeeded. Never return passwordHash to the controller
     * or API response.
     */
    return toSafeUser(user);
  }

  /**
   * Retrieve the currently authenticated user's safe account representation.
   *
   * The session stores only userID, so protected endpoints use that identifier
   * to retrieve fresh account information from the database.
   *
   * Returning undefined when the account no longer exists allows the HTTP layer
   * to treat a stale session as unauthenticated.
   */
  function getCurrentUser(userID) {
    const user = userRepository.findById(userID);

    if (!user) {
      return undefined;
    }

    return toSafeUser(user);
  }

  return {
    register,
    login,
    getCurrentUser,
  };
}
