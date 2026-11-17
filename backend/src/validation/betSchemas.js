import { z } from "zod";

/**
 * Validate answer choices supplied when creating a bet.
 *
 * Labels must be unique within the bet, ignoring case.
 * The option count is bounded to prevent excessive inserts.
 */
export const betOptionsSchema = z
  .array(z.string().trim().min(1).max(150))
  .min(2, "Provide at least two answer options.")
  .max(20, "Provide no more than 20 answer options.")
  .superRefine((options, context) => {
    const seen = new Set();

    for (const [index, label] of options.entries()) {
      const normalizedLabel = label.toLowerCase();

      if (seen.has(normalizedLabel)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Answer options must be unique.",
        });
      }

      seen.add(normalizedLabel);
    }
  });

/**
 * Shared text validation for free-response predictions.
 *
 * Whitespace is trimmed before length validation and persistence.
 */
export const predictionTextSchema = z
  .string()
  .trim()
  .min(1, "A prediction is required.")
  .max(2000, "A prediction cannot exceed 2000 characters.");

/**
 * Validate creator-controlled Create Bet fields.
 *
 * IDs, ownership, join codes, and option IDs are generated
 * or determined by the backend.
 *
 * Multiple-choice bets use options and may include
 * creator_selected_option_index.
 *
 * Free-response bets omit options and may include
 * creator_prediction_text.
 *
 * The creator prediction remains optional at creation for
 * compatibility with existing clients that do not submit
 * an initial creator answer.
 */
export const createBetSchema = z
  .object({
    title: z.string().trim().min(1).max(150),

    description: z.string().trim().max(2000).default(""),

    max_participants: z.number().int().min(2).max(100).default(2),

    visibility: z.enum(["public", "private"]).default("private"),

    options: betOptionsSchema.optional(),

    // Zero-based index into the submitted multiple-choice options.
    creator_selected_option_index: z.number().int().nonnegative().optional(),

    // Optional initial creator prediction for free-response bets.
    creator_prediction_text: predictionTextSchema.optional(),
  })
  .strict()
  .superRefine((data, context) => {
    const hasOptions = data.options !== undefined;
    const selectedIndex = data.creator_selected_option_index;
    const predictionText = data.creator_prediction_text;

    // A bet cannot combine multiple-choice and free-response answers.
    if (hasOptions && predictionText !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["creator_prediction_text"],
        message:
          "Free-response predictions cannot be used with answer options.",
      });
    }

    // Multiple-choice selection requires actual answer options.
    if (selectedIndex !== undefined && !hasOptions) {
      context.addIssue({
        code: "custom",
        path: ["creator_selected_option_index"],
        message: "Creator selection requires answer options.",
      });

      return;
    }

    // The selected index must reference an existing option.
    if (
      selectedIndex !== undefined &&
      hasOptions &&
      selectedIndex >= data.options.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["creator_selected_option_index"],
        message: "Creator selection must reference an existing answer option.",
      });
    }
  });

/**
 * Accept stored legacy codes and newly generated
 * 12-character hexadecimal join codes.
 */
export const joinCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Join code contains invalid characters.");
