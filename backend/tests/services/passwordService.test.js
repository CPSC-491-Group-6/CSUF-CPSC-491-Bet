// backend/tests/services/passwordService.test.js

import assert from "node:assert/strict";
import test from "node:test";

import {
  hashPassword,
  verifyPassword,
} from "../../src/services/passwordService.js";

test("hashPassword creates an Argon2id password hash", async () => {
  const password = "ExamplePassword123!";

  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.match(passwordHash, /^\$argon2id\$/);
});

test("verifyPassword returns true for the correct password", async () => {
  const password = "ExamplePassword123!";
  const passwordHash = await hashPassword(password);

  const matches = await verifyPassword(passwordHash, password);

  assert.equal(matches, true);
});

test("verifyPassword returns false for an incorrect password", async () => {
  const passwordHash = await hashPassword("ExamplePassword123!");

  const matches = await verifyPassword(
    passwordHash,
    "DefinitelyTheWrongPassword!",
  );

  assert.equal(matches, false);
});
