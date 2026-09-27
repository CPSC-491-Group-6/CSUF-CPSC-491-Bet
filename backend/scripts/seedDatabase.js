// backend/scripts/seedDatabase.js

import { execFileSync } from "node:child_process";
import path from "node:path";

import Database from "better-sqlite3";
import dotenv from "dotenv";

import { createUserRepository } from "../src/repositories/createUserRepository.js";
import { hashPassword } from "../src/services/passwordService.js";

// Load development database configuration.
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const configuredDbPath = process.env.DB_PATH || "./data/bet.db";

const databasePath = path.resolve(process.cwd(), configuredDbPath);

/**
 * Password shared by the development-only demo accounts.
 *
 * The value is intentionally predictable because these accounts exist only
 * for local development/demo use. Developers may override it without editing
 * source by setting SEED_DEMO_PASSWORD.
 *
 * Only the resulting Argon2id hash is stored in SQLite.
 */
const demoPassword = process.env.SEED_DEMO_PASSWORD || "DemoPassword123!";

/**
 * Initial Sprint 2 seed accounts.
 *
 * Later sprints can extend this dataset with bets and participants while
 * retaining these stable accounts for authentication demonstrations.
 */
const demoUsers = [
  {
    username: "demo_creator",
    email: "creator@example.com",
  },
  {
    username: "demo_participant",
    email: "participant@example.com",
  },
];

/**
 * Prevent development/demo fixtures from being inserted into production.
 */
function assertNotProduction() {
  if (nodeEnv === "production") {
    throw new Error("Database seeding is disabled when NODE_ENV=production.");
  }
}

/**
 * Ensure the current schema exists before attempting to seed records.
 *
 * The existing db:init script remains the schema source of truth. Running it
 * first also makes `npm run db:seed` usable on a fresh checkout where bet.db
 * has not yet been created.
 */
function initializeDatabase() {
  execFileSync(process.execPath, ["src/db/init.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

/**
 * Seed one demo user unless its username or email already exists.
 *
 * Seed operations should be repeatable. Existing accounts are therefore
 * skipped instead of causing UNIQUE constraint failures on every subsequent
 * `npm run db:seed`.
 *
 * @param {object} userRepository repository used to query/create users.
 * @param {object} demoUser deterministic development account definition.
 */
async function seedUser(userRepository, demoUser) {
  const existingEmailUser = userRepository.findByEmail(demoUser.email);

  const existingUsernameUser = userRepository.findByUsername(demoUser.username);

  if (existingEmailUser || existingUsernameUser) {
    console.log(`Skipped ${demoUser.email} (already exists).`);

    return;
  }

  // The plaintext development password is converted to Argon2id before
  // anything is sent to the repository.
  const passwordHash = await hashPassword(demoPassword);

  const user = userRepository.createUser({
    username: demoUser.username,
    email: demoUser.email,
    passwordHash,
  });

  console.log(`Created ${user.username} (${user.email}).`);
}

/**
 * Populate the local database with deterministic Sprint 2 demo accounts.
 *
 * Sessions are deliberately never seeded. Authentication sessions should
 * always be created through a real successful login.
 */
async function seedDatabase() {
  assertNotProduction();

  initializeDatabase();

  const database = new Database(databasePath);

  // Match the normal application's SQLite foreign-key behavior.
  database.pragma("foreign_keys = ON");

  const userRepository = createUserRepository(database);

  try {
    for (const demoUser of demoUsers) {
      await seedUser(userRepository, demoUser);
    }
  } finally {
    database.close();
  }

  console.log();
  console.log("Database seed complete.");
  console.log();
  console.log("Demo credentials:");
  console.log(`  creator@example.com / ${demoPassword}`);
  console.log(`  participant@example.com / ${demoPassword}`);
}

try {
  await seedDatabase();
} catch (error) {
  console.error(`Database seed failed: ${error.message}`);

  process.exitCode = 1;
}
