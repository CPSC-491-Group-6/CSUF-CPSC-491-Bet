// backend/scripts/seedDatabase.js

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import dotenv from "dotenv";

import { createUserRepository } from "../src/repositories/createUserRepository.js";
import { hashPassword } from "../src/services/passwordService.js";

/**
 * Load the development environment from backend/.env.
 */
dotenv.config();

/**
 * Read only the configuration required by this maintenance script.
 *
 * The seeder intentionally avoids importing the full web-server
 * configuration because it does not require session or HTTP configuration.
 */
const nodeEnv = process.env.NODE_ENV?.trim() || "development";

const configuredDbPath = process.env.DB_PATH?.trim() || "./data/bet.db";

const databasePath = path.resolve(process.cwd(), configuredDbPath);

/**
 * Allow developers to override the demo password without modifying source.
 *
 * This plaintext value exists only while the seed command runs. SQLite
 * receives only the Argon2id hash produced by passwordService.js.
 */
const demoPassword = process.env.SEED_DEMO_PASSWORD || "DemoPassword123!";

/**
 * Stable development identities.
 *
 * Their numeric userID values are deliberately not defined here because
 * SQLite owns primary-key generation. Related seed SQL finds these accounts
 * through their unique email addresses.
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
 * Resolve the SQL fixtures that depend on the seeded user accounts.
 */
const seedSqlPath = path.resolve(process.cwd(), "src/data/seed.sql");

/**
 * Prevent demonstration fixtures from ever being deliberately inserted into
 * a production database through this utility.
 */
function assertNotProduction() {
  if (nodeEnv === "production") {
    throw new Error("Database seeding is disabled when NODE_ENV=production.");
  }
}

/**
 * Ensure all database migrations have been applied before inserting fixtures.
 *
 * src/data/init.js is the consolidated schema entry point after retiring the
 * previous src/db/ and root Database/ implementations.
 */
function initializeDatabase() {
  execFileSync(process.execPath, ["src/data/init.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

/**
 * Create one development account when it does not already exist.
 *
 * Both username and email are checked because each value has a
 * case-insensitive UNIQUE constraint in SQLite.
 *
 * Existing accounts are skipped so npm run db:seed can be run repeatedly.
 *
 * @param {ReturnType<createUserRepository>} userRepository User repository.
 * @param {{username: string, email: string}} demoUser Fixture definition.
 */
async function seedUser(userRepository, demoUser) {
  const existingEmailUser = userRepository.findByEmail(demoUser.email);

  const existingUsernameUser = userRepository.findByUsername(demoUser.username);

  /**
   * A fixture should not silently continue if the expected username and
   * email belong to two different existing accounts. That situation usually
   * means the local database contains conflicting development data and
   * should be reset explicitly.
   */
  if (
    existingEmailUser &&
    existingUsernameUser &&
    existingEmailUser.userID !== existingUsernameUser.userID
  ) {
    throw new Error(
      `Seed identity conflict for ${demoUser.username}/${demoUser.email}. Run npm run db:reset before seeding.`,
    );
  }

  /**
   * If either unique identity already exists, treat this fixture as already
   * seeded rather than causing a UNIQUE constraint failure.
   */
  if (existingEmailUser || existingUsernameUser) {
    console.log(`Skipped ${demoUser.email} (already exists).`);

    return;
  }

  /**
   * Use the production authentication hashing implementation even for demo
   * users so seeded accounts exercise the same login path as registered
   * accounts.
   */
  const passwordHash = await hashPassword(demoPassword);

  const user = userRepository.createUser({
    username: demoUser.username,
    email: demoUser.email,
    passwordHash,
    verificationStatus: 0,
  });

  console.log(`Created ${user.username} (${user.email}).`);
}

/**
 * Seed bets and participant relationships after the required demo users
 * exist.
 *
 * seed.sql resolves users through their unique email addresses rather than
 * assuming particular automatically generated userID values.
 *
 * @param {Database.Database} database Open SQLite database.
 */
function seedApplicationData(database) {
  if (!fs.existsSync(seedSqlPath)) {
    throw new Error(`Database seed SQL was not found: ${seedSqlPath}`);
  }

  const seedSql = fs.readFileSync(seedSqlPath, "utf8");

  /**
   * Keep related fixture changes atomic. If one statement fails, SQLite
   * rolls back all bet/participant changes from this seed execution.
   */
  const seedFixtures = database.transaction(() => {
    database.exec(seedSql);
  });

  seedFixtures();
}

/**
 * Populate the local development database.
 *
 * Order:
 *   1. reject production,
 *   2. apply pending migrations,
 *   3. create valid login accounts,
 *   4. insert demo bets and participation records.
 */
async function seedDatabase() {
  assertNotProduction();

  initializeDatabase();

  const database = new Database(databasePath);

  /**
   * Match the normal backend's SQLite connection behavior.
   */
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");

  const userRepository = createUserRepository(database);

  try {
    for (const demoUser of demoUsers) {
      await seedUser(userRepository, demoUser);
    }

    seedApplicationData(database);
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

/**
 * Return a non-zero process result when seeding fails so both developers and
 * CI can detect unsuccessful database preparation.
 */
try {
  await seedDatabase();
} catch (error) {
  console.error(`Database seed failed: ${error.message}`);

  process.exitCode = 1;
}
