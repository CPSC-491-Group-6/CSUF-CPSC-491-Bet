// backend/src/validation/betSchemas.js
import { z } from "zod";

/** Only creator-controlled fields are accepted; ID, owner and join code are server-generated. */
export const createBetSchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    description: z.string().trim().max(2000).default(""),
    max_participants: z.number().int().min(2).max(100).default(2),
    visibility: z.enum(["public", "private"]).default("private"),
  })
  .strict();

/** Accept stored legacy codes as well as newly generated 12-character hex codes. */
export const joinCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Join code contains invalid characters.");
