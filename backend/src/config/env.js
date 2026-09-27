// backend/src/config/env.js

import dotenv from "dotenv";

// Load environment variables from backend/.env into process.env.
dotenv.config();

/**
 * Convert the configured PORT into a valid TCP port number.
 *
 * Express/Node can interpret some invalid string values as named pipes,
 * so validate the value here and fail during startup instead.
 */
function parsePort(value) {
  // Use the project's normal development port when PORT is not configured.
  if (value === undefined || value.trim() === "") {
    return 3000;
  }

  // Accept only whole-number strings.
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(
      `Invalid PORT "${value}". PORT must be an integer from 1 to 65535.`,
    );
  }

  const port = Number(value);

  // TCP ports must fit within the valid non-zero port range.
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT "${value}". PORT must be an integer from 1 to 65535.`,
    );
  }

  return port;
}

/**
 * Validate the configured Node environment.
 */
function parseNodeEnv(value) {
  const nodeEnv = value || "development";
  const allowedEnvironments = ["development", "test", "production"];

  if (!allowedEnvironments.includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV "${nodeEnv}". Expected development, test, or production.`,
    );
  }

  return nodeEnv;
}

/**
 * Read and validate the session signing secret.
 */
function parseSessionSecret(value) {
  if (value === undefined || value.trim() === "") {
    throw new Error("SESSION_SECRET must be configured.");
  }

  if (value.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }

  return value;
}

// Centralized application configuration.
// Backend files should use this object instead of reading process.env directly.
export const env = {
  port: parsePort(process.env.PORT),
  dbPath: process.env.DB_PATH || "./data/bet.db",
  nodeEnv: parseNodeEnv(process.env.NODE_ENV),
  sessionSecret: parseSessionSecret(process.env.SESSION_SECRET),
};
