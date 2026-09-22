import assert from "node:assert/strict";
import test from "node:test";

import { createAuthService } from "../../src/services/createAuthService.js";

/**
 * Create a small fake repository for authentication-service unit tests.
 *
 * These tests are concerned with authentication business behavior, not
 * SQLite itself. Repository/SQLite behavior is tested separately.
 */
function createFakeUserRepository(initialUsers = []) {
  const users = [...initialUsers];

  return {
    findByEmail(email) {
      return users.find(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      );
    },

    findByUsername(username) {
      return users.find(
        (user) => user.username.toLowerCase() === username.toLowerCase(),
      );
    },

    createUser({ username, email, passwordHash, verificationStatus = 0 }) {
      const user = {
        userID: users.length + 1,
        username,
        email,
        passwordHash,
        verificationStatus,
        timeStamp: "2026-09-19 12:00:00",
      };

      users.push(user);

      return user;
    },
  };
}

/**
 * Fake password service used to confirm that the registration service sends
 * the password through the hashing boundary without performing real Argon2
 * work. Real Argon2 behavior already has its own passwordService tests.
 */
function createFakePasswordService() {
  return {
    async hashPassword(password) {
      return `hashed:${password}`;
    },

    async verifyPassword(passwordHash, password) {
      return passwordHash === `hashed:${password}`;
    },
  };
}

test("register creates and returns a safe user", async () => {
  const userRepository = createFakeUserRepository();

  const authService = createAuthService({
    userRepository,
    passwordService: createFakePasswordService(),
  });

  const user = await authService.register({
    username: "TestUser",
    email: "Test@Example.com",
    password: "ExamplePassword123!",
  });

  assert.equal(user.userID, 1);
  assert.equal(user.username, "TestUser");

  // Email is normalized before persistence and response.
  assert.equal(user.email, "test@example.com");

  // Sensitive authentication material must not leave the service.
  assert.equal("passwordHash" in user, false);
  assert.equal("password" in user, false);
});

test("register hashes the password before persistence", async () => {
  let persistedPasswordHash;

  const userRepository = createFakeUserRepository();

  const originalCreateUser = userRepository.createUser;

  userRepository.createUser = (userData) => {
    persistedPasswordHash = userData.passwordHash;
    return originalCreateUser(userData);
  };

  const authService = createAuthService({
    userRepository,
    passwordService: createFakePasswordService(),
  });

  await authService.register({
    username: "TestUser",
    email: "test@example.com",
    password: "ExamplePassword123!",
  });

  assert.equal(persistedPasswordHash, "hashed:ExamplePassword123!");

  assert.notEqual(persistedPasswordHash, "ExamplePassword123!");
});

test("register rejects an invalid email address", async () => {
  const authService = createAuthService({
    userRepository: createFakeUserRepository(),
    passwordService: createFakePasswordService(),
  });

  await assert.rejects(
    () =>
      authService.register({
        username: "TestUser",
        email: "not-an-email",
        password: "ExamplePassword123!",
      }),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("register rejects a password that is too short", async () => {
  const authService = createAuthService({
    userRepository: createFakeUserRepository(),
    passwordService: createFakePasswordService(),
  });

  await assert.rejects(
    () =>
      authService.register({
        username: "TestUser",
        email: "test@example.com",
        password: "short",
      }),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("register rejects an email that is already registered", async () => {
  const authService = createAuthService({
    userRepository: createFakeUserRepository([
      {
        userID: 1,
        username: "ExistingUser",
        email: "existing@example.com",
        passwordHash: "hashed:ExistingPassword123!",
        verificationStatus: 0,
        timeStamp: "2026-09-19 12:00:00",
      },
    ]),
    passwordService: createFakePasswordService(),
  });

  await assert.rejects(
    () =>
      authService.register({
        username: "NewUser",
        email: "EXISTING@example.com",
        password: "ExamplePassword123!",
      }),
    (error) => {
      assert.equal(error.code, "EMAIL_ALREADY_EXISTS");
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test("register rejects a username that is already registered", async () => {
  const authService = createAuthService({
    userRepository: createFakeUserRepository([
      {
        userID: 1,
        username: "ExistingUser",
        email: "existing@example.com",
        passwordHash: "hashed:ExistingPassword123!",
        verificationStatus: 0,
        timeStamp: "2026-09-19 12:00:00",
      },
    ]),
    passwordService: createFakePasswordService(),
  });

  await assert.rejects(
    () =>
      authService.register({
        username: "existinguser",
        email: "new@example.com",
        password: "ExamplePassword123!",
      }),
    (error) => {
      assert.equal(error.code, "USERNAME_ALREADY_EXISTS");
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test("login returns a safe user when credentials are valid", async () => {
  const authService = createAuthService({
    userRepository: createFakeUserRepository([
      {
        userID: 1,
        username: "TestUser",
        email: "test@example.com",
        passwordHash: "hashed:ExamplePassword123!",
        verificationStatus: 0,
        timeStamp: "2026-09-21 12:00:00",
      },
    ]),
    passwordService: createFakePasswordService(),
  });

  const user = await authService.login({
    email: "TEST@EXAMPLE.COM",
    password: "ExamplePassword123!",
  });

  assert.equal(user.userID, 1);
  assert.equal(user.username, "TestUser");
  assert.equal(user.email, "test@example.com");

  /*
   * Login responses must never expose password material.
   */
  assert.equal("password" in user, false);
  assert.equal("passwordHash" in user, false);
});

test("login rejects an incorrect password", async () => {
  const authService = createAuthService({
    userRepository: createFakeUserRepository([
      {
        userID: 1,
        username: "TestUser",
        email: "test@example.com",
        passwordHash: "hashed:CorrectPassword123!",
        verificationStatus: 0,
        timeStamp: "2026-09-21 12:00:00",
      },
    ]),
    passwordService: createFakePasswordService(),
  });

  await assert.rejects(
    () =>
      authService.login({
        email: "test@example.com",
        password: "WrongPassword123!",
      }),
    (error) => {
      assert.equal(error.code, "INVALID_CREDENTIALS");

      assert.equal(error.statusCode, 401);

      assert.equal(error.message, "Invalid email or password.");

      return true;
    },
  );
});

test("login rejects an unknown email using the same credential error", async () => {
  const authService = createAuthService({
    userRepository: createFakeUserRepository(),
    passwordService: createFakePasswordService(),
  });

  await assert.rejects(
    () =>
      authService.login({
        email: "missing@example.com",
        password: "ExamplePassword123!",
      }),
    (error) => {
      /*
       * Unknown email and wrong password intentionally have identical public
       * errors to avoid exposing which email addresses have accounts.
       */
      assert.equal(error.code, "INVALID_CREDENTIALS");

      assert.equal(error.statusCode, 401);

      assert.equal(error.message, "Invalid email or password.");

      return true;
    },
  );
});
test("login rejects malformed input before checking credentials", async () => {
  const authService = createAuthService({
    userRepository: createFakeUserRepository(),
    passwordService: createFakePasswordService(),
  });

  await assert.rejects(
    () =>
      authService.login({
        email: "not-an-email",
        password: "",
      }),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");

      assert.equal(error.statusCode, 400);

      assert.ok(Array.isArray(error.details));

      return true;
    },
  );
});

test("login still performs password verification when the account does not exist", async () => {
  let verificationCalls = 0;

  const userRepository = createFakeUserRepository();

  const passwordService = {
    /**
     * Registration is not exercised by this test, but createAuthService
     * expects the complete password-service interface.
     */
    async hashPassword(password) {
      return `hashed:${password}`;
    },

    /**
     * Count verification calls so the test can prove that an unknown account
     * still performs the password-verification workload.
     */
    async verifyPassword(passwordHash, password) {
      verificationCalls += 1;

      return passwordHash === `hashed:${password}`;
    },
  };

  const authService = createAuthService({
    userRepository,
    passwordService,
  });

  await assert.rejects(
    () =>
      authService.login({
        email: "missing@example.com",
        password: "ExamplePassword123!",
      }),
    (error) => {
      assert.equal(error.code, "INVALID_CREDENTIALS");

      return true;
    },
  );

  /**
   * An unknown account must still pass through password verification so the
   * missing-user path does not immediately return before performing the
   * expensive authentication operation.
   */
  assert.equal(verificationCalls, 1);
});
