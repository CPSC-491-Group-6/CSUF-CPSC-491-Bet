// backend/src/config/env.js

import dotenv from "dotenv";

// Load environment variables from backend/.env into process.env.
dotenv.config();

// Centralized application configuration.
// Other backend files should use this object instead of repeatedly
// accessing process.env directly.
export const env = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || "./data/bet.db",
  nodeEnv: process.env.NODE_ENV || "development",
};
