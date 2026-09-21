// backend/src/validation/authSchemas.js

import { z } from "zod";

/**
 * Registration input accepted by the authentication service.
 *
 * Password rules intentionally focus on length instead of arbitrary
 * composition requirements such as "must contain one symbol." Argon2id
 * handles the password securely after validation.
 */
export const registrationSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must contain at least 3 characters.")
      .max(30, "Username cannot exceed 30 characters.")
      .regex(
        /^[A-Za-z0-9_]+$/,
        "Username may contain only letters, numbers, and underscores.",
      ),

    email: z
      .string()
      .trim()
      .email("Email must be a valid email address.")
      .max(254, "Email cannot exceed 254 characters."),

    password: z
      .string()
      .min(12, "Password must contain at least 12 characters.")
      .max(128, "Password cannot exceed 128 characters."),
  })
  .strict();

/**
 * Login input accepted by the authentication service.
 *
 * Login validation intentionally does not apply the registration minimum
 * password length. Authentication should verify the supplied credential
 * against the stored hash rather than reject it because password policy may
 * change over time.
 */
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Email must be a valid email address.")
      .max(254, "Email cannot exceed 254 characters."),

    password: z
      .string()
      .min(1, "Password is required.")
      .max(128, "Password cannot exceed 128 characters."),
  })
  .strict();

/**
 * Convert Zod's detailed issue objects into a stable and smaller format
 * suitable for returning from our API.
 *
 * Example:
 * [
 *   {
 *     field: "email",
 *     message: "Email must be a valid email address."
 *   }
 * ]
 */
export function formatValidationIssues(zodError) {
  return zodError.issues.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}
