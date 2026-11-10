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
 * Validate creator-controlled Create Bet fields.
 *
 * IDs, ownership, join codes, and option IDs are generated
 * or determined by the backend.
 *
 * creator_selected_option_index is a zero-based position
 * in the submitted options array.
 *
 * It remains optional for compatibility with older clients.
 */
export const createBetSchema = z
  .object({
    title: z.string().trim().min(1).max(150),

    description: z.string().trim().max(2000).default(""),

    max_participants: z.number().int().min(2).max(100).default(2),

    visibility: z.enum(["public", "private"]).default("private"),

    options: betOptionsSchema.optional(),

    /**
     * Example:
     * options: ["Yes", "No"]
     * creator_selected_option_index: 1
     *
     * The creator is selecting "No".
     */
    creator_selected_option_index: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((data, context) => {
    const selectedIndex = data.creator_selected_option_index;

    // Older clients may omit the creator's selection.
    if (selectedIndex === undefined) {
      return;
    }

    // A selection cannot exist without answer options.
    if (!data.options || data.options.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["creator_selected_option_index"],
        message: "Creator selection requires answer options.",
      });

      return;
    }

    // The index must identify one submitted answer option.
    if (selectedIndex >= data.options.length) {
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
