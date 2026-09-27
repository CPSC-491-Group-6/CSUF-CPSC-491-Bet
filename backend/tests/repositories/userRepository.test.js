// backend/tests/repositories/userRepository.test.js

import assert from "node:assert/strict";
import test from "node:test";

import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import { createTestDatabase } from "../helpers/testDatabase.js";

const exampleUser = {
  username: "testuser",
  email: "test@example.com",
  passwordHash: "$argon2id$example-hash",
};

test("createUser creates and returns a user", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    const user = repository.createUser(exampleUser);

    assert.equal(user.userID, 1);
    assert.equal(user.username, "testuser");
    assert.equal(user.email, "test@example.com");
    assert.equal(user.passwordHash, "$argon2id$example-hash");
    assert.equal(user.verificationStatus, 0);
    assert.ok(user.timeStamp);
  } finally {
    database.close();
  }
});

test("findById returns an existing user", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    const createdUser = repository.createUser(exampleUser);

    const user = repository.findById(createdUser.userID);

    assert.equal(user.userID, createdUser.userID);
    assert.equal(user.username, "testuser");
    assert.equal(user.email, "test@example.com");
  } finally {
    database.close();
  }
});

test("findById returns undefined when the user does not exist", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    const user = repository.findById(999);

    assert.equal(user, undefined);
  } finally {
    database.close();
  }
});

test("findByEmail returns an existing user", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    repository.createUser(exampleUser);

    const user = repository.findByEmail("test@example.com");

    assert.equal(user.username, "testuser");
    assert.equal(user.email, "test@example.com");
  } finally {
    database.close();
  }
});

test("findByEmail returns undefined when the email does not exist", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    const user = repository.findByEmail("missing@example.com");

    assert.equal(user, undefined);
  } finally {
    database.close();
  }
});

test("findByUsername returns an existing user", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    repository.createUser(exampleUser);

    const user = repository.findByUsername("testuser");

    assert.equal(user.username, "testuser");
    assert.equal(user.email, "test@example.com");
  } finally {
    database.close();
  }
});

test("findByUsername returns undefined when the username does not exist", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    const user = repository.findByUsername("missinguser");

    assert.equal(user, undefined);
  } finally {
    database.close();
  }
});

test("database rejects duplicate email addresses", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    repository.createUser(exampleUser);

    assert.throws(
      () =>
        repository.createUser({
          username: "anotheruser",
          email: "test@example.com",
          passwordHash: "$argon2id$another-hash",
        }),
      (error) => {
        assert.equal(error.code, "SQLITE_CONSTRAINT_UNIQUE");
        return true;
      },
    );
  } finally {
    database.close();
  }
});

test("database rejects duplicate usernames", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    repository.createUser(exampleUser);

    assert.throws(
      () =>
        repository.createUser({
          username: "testuser",
          email: "another@example.com",
          passwordHash: "$argon2id$another-hash",
        }),
      (error) => {
        assert.equal(error.code, "SQLITE_CONSTRAINT_UNIQUE");
        return true;
      },
    );
  } finally {
    database.close();
  }
});

test("findByEmail performs a case-insensitive lookup", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    repository.createUser({
      username: "testuser",
      email: "Test@Example.com",
      passwordHash: "$argon2id$example-hash",
    });

    const user = repository.findByEmail("test@example.com");

    assert.equal(user.email, "Test@Example.com");
  } finally {
    database.close();
  }
});

test("findByUsername performs a case-insensitive lookup", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    repository.createUser({
      username: "TestUser",
      email: "test@example.com",
      passwordHash: "$argon2id$example-hash",
    });

    const user = repository.findByUsername("testuser");

    assert.equal(user.username, "TestUser");
  } finally {
    database.close();
  }
});

test("database rejects usernames that differ only by capitalization", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    repository.createUser({
      username: "TestUser",
      email: "first@example.com",
      passwordHash: "$argon2id$example-hash",
    });

    assert.throws(
      () =>
        repository.createUser({
          username: "testuser",
          email: "second@example.com",
          passwordHash: "$argon2id$another-hash",
        }),
      (error) => {
        assert.equal(error.code, "SQLITE_CONSTRAINT_UNIQUE");
        return true;
      },
    );
  } finally {
    database.close();
  }
});

test("database rejects emails that differ only by capitalization", () => {
  const database = createTestDatabase();
  const repository = createUserRepository(database);

  try {
    repository.createUser({
      username: "firstuser",
      email: "Test@Example.com",
      passwordHash: "$argon2id$example-hash",
    });

    assert.throws(
      () =>
        repository.createUser({
          username: "seconduser",
          email: "test@example.com",
          passwordHash: "$argon2id$another-hash",
        }),
      (error) => {
        assert.equal(error.code, "SQLITE_CONSTRAINT_UNIQUE");
        return true;
      },
    );
  } finally {
    database.close();
  }
});
