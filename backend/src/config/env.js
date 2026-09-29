// backend/src/config/env.js

import dotenv from "dotenv";

/**
 * Load backend/.env values into process.env.
 *
 * The backend is normally started with backend/ as its working directory,
 * which allows dotenv to locate backend/.env automatically.
 */
dotenv.config();

/**
 * Convert PORT into a validated TCP port number.
 *
 * Node can interpret some malformed string values as named pipes instead of
 * TCP ports, so configuration is validated before the HTTP server starts.
 *
 * @param {string | undefined} value Raw PORT environment value.
 * @returns {number} Valid TCP port.
 */
function parsePort(value) {
  /**
   * Use the standard local development port when PORT is absent or empty.
   */
  if (value === undefined || value.trim() === "") {
    return 3000;
  }

  const normalizedValue = value.trim();

  /**
   * Accept only decimal whole-number strings.
   *
   * Values such as "300O", "3.5", "-1", and "3000abc" are rejected rather
   * than being partially interpreted by JavaScript or Node.
   */
  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(
      `Invalid PORT "${value}". PORT must be an integer from 1 to 65535.`,
    );
  }

  const port = Number(normalizedValue);

  /**
   * Valid non-zero TCP ports are in the range 1 through 65535.
   */
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT "${value}". PORT must be an integer from 1 to 65535.`,
    );
  }

  return port;
}

/**
 * Validate NODE_ENV and normalize the default development environment.
 *
 * @param {string | undefined} value Raw NODE_ENV value.
 * @returns {"development" | "test" | "production"} Valid environment name.
 */
function parseNodeEnv(value) {
  const nodeEnv = value?.trim() || "development";

  const allowedEnvironments = ["development", "test", "production"];

  if (!allowedEnvironments.includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV "${nodeEnv}". Expected development, test, or production.`,
    );
  }

  return nodeEnv;
}

/**
 * Validate the configured SQLite database path.
 *
 * DB_PATH remains the single supported environment variable for the
 * application's SQLite location.
 *
 * The special SQLite value ":memory:" is allowed so automated tests can use
 * an in-memory database without creating filesystem artifacts.
 *
 * @param {string | undefined} value Raw DB_PATH environment value.
 * @returns {string} Database path used by database.js.
 */
function parseDbPath(value) {
  /**
   * Use backend/data/bet.db when DB_PATH is absent or contains only
   * whitespace.
   */
  if (value === undefined || value.trim() === "") {
    return "./data/bet.db";
  }

  const dbPath = value.trim();

  /**
   * Null bytes are invalid in filesystem paths and should cause a clear
   * configuration error before any filesystem operation is attempted.
   */
  if (dbPath.includes("\0")) {
    throw new Error("DB_PATH cannot contain a null byte.");
  }

  return dbPath;
}

/**
 * Validate the secret used to sign/authenticate application sessions.
 *
 * @param {string | undefined} value Raw SESSION_SECRET environment value.
 * @returns {string} Valid session secret.
 */
function parseSessionSecret(value) {
  if (value === undefined || value.trim() === "") {
    throw new Error("SESSION_SECRET must be configured.");
  }

  /**
   * Require a reasonably long secret so trivial development values do not
   * accidentally make their way into a deployed environment.
   */
  if (value.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }

  return value;
}

/**
 * Centralized, validated application configuration.
 *
 * Application source files should consume values from this object instead
 * of reading process.env directly. Maintenance scripts may intentionally
 * read only the environment variables they require so destructive tooling
 * does not need to initialize the full web application.
 */
export const env = {
  port: parsePort(process.env.PORT),
  dbPath: parseDbPath(process.env.DB_PATH),
  nodeEnv: parseNodeEnv(process.env.NODE_ENV),
  sessionSecret: parseSessionSecret(process.env.SESSION_SECRET),
};
