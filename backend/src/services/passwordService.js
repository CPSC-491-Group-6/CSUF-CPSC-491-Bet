// backend/src/services/passwordService.js

import argon2 from "argon2";

// OWASP-recommended minimum Argon2id configuration:
// memory: 19 MiB
// iterations: 2
// parallelism: 1
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash a plaintext password using Argon2id.
 *
 * The returned encoded hash contains the algorithm parameters and salt,
 * so a separate salt column is not required in the database.
 */
export async function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Compare a plaintext password against an existing Argon2id hash.
 *
 * Returns true when the password matches and false otherwise.
 */
export async function verifyPassword(passwordHash, password) {
  return argon2.verify(passwordHash, password);
}
