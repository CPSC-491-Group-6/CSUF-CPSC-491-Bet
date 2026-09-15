// backend/eslint.config.mjs
//
// Shared ESLint configuration for the Node.js backend.
// This file defines the JavaScript environment and enables
// ESLint's recommended rules for detecting common problems.

import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    // Lint all JavaScript source files in the backend.
    files: ["**/*.js"],

    languageOptions: {
      // The backend runs in Node.js, so make Node globals such as
      // `process`, `console`, and `Buffer` available to ESLint.
      globals: {
        ...globals.node,
      },
    },

    // Enable ESLint's recommended JavaScript rules.
    plugins: {
      js,
    },
    extends: ["js/recommended"],

    rules: {
      // Unused variables are usually accidental, but treating them
      // as warnings keeps development from being unnecessarily blocked.
      "no-unused-vars": "warn",

      // Require strict equality comparisons.
      eqeqeq: ["error", "always"],
    },
  },

  {
    // Do not inspect installed dependencies or the local database area.
    ignores: ["node_modules/**", "data/**"],
  },
]);
