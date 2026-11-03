import { AppError } from "../errors/AppError.js";
import { joinCodeSchema } from "../validation/betSchemas.js";

const failures = {
  BET_NOT_FOUND: [404, "Bet not found."],
  BET_NOT_OPEN: [409, "This bet is not open."],
  ALREADY_JOINED: [409, "You already joined this bet."],
  BET_FULL: [409, "This bet has reached capacity."],
  ANSWER_REQUIRED: [400, "Select an available answer."],
  INVALID_OPTION: [400, "Invalid answer for this bet."],
  NOT_BET_CREATOR: [403, "Only the bet creator may lock this bet."],

  // Resolve-specific errors.
  NOT_RESOLVE_CREATOR: [403, "Only the bet creator may resolve this bet."],
  BET_NOT_LOCKED: [409, "Only locked bets may be resolved."],
  BET_ALREADY_RESOLVED: [409, "This bet has already been resolved."],
};

/**
 * Convert repository failures into the existing application error format.
 *
 * This preserves the same error-handling behavior used by Join and Lock.
 */
function unwrap(result) {
  if (!result.error) {
    return result;
  }

  const failure = failures[result.error];

  if (!failure) {
    throw new Error("Unexpected bet participation repository failure.");
  }

  const [statusCode, message] = failure;

  throw new AppError({
    statusCode,
    code: result.error,
    message,
  });
}

/**
 * Validate an option identifier supplied by a client.
 *
 * Existing bet option identifiers are strings. Preserve compatibility
 * with the existing Join Bet validation rather than requiring UUIDs.
 */
function isValidOptionID(optionID) {
  return (
    typeof optionID === "string" &&
    optionID.trim().length > 0 &&
    optionID.length <= 100
  );
}

export function createBetParticipationService({ participationRepository }) {
  /**
   * Join an open bet using its join code.
   */
  function joinByCode(input, authenticatedUserID) {
    const code = joinCodeSchema.safeParse(input?.join_code);

    if (!code.success) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid join code.",
      });
    }

    const selectedOptionID = input?.selected_option_id;

    if (
      selectedOptionID !== undefined &&
      selectedOptionID !== null &&
      (typeof selectedOptionID !== "string" ||
        selectedOptionID.length < 1 ||
        selectedOptionID.length > 100)
    ) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid selected option ID.",
      });
    }

    return unwrap(
      participationRepository.joinByCode({
        joinCode: code.data,
        userID: authenticatedUserID,
        selectedOptionID: selectedOptionID ?? null,
      }),
    );
  }

  /**
   * Lock an open bet on behalf of its creator.
   */
  function lockById(betID, authenticatedUserID) {
    if (typeof betID !== "string" || !betID.trim()) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "A bet ID is required.",
      });
    }

    return unwrap(
      participationRepository.lockById({
        betID,
        userID: authenticatedUserID,
      }),
    );
  }

  /**
   * Resolve a locked bet with one of its stored answer options.
   *
   * Input validation happens before starting the SQLite transaction.
   * The repository performs authorization and state checks atomically
   * so invalid requests cannot partially modify the result.
   */
  function resolveById(betID, input, authenticatedUserID) {
    if (typeof betID !== "string" || !betID.trim()) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "A bet ID is required.",
      });
    }

    const winningOptionID = input?.winning_option_id;

    if (!isValidOptionID(winningOptionID)) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "A valid winning option ID is required.",
      });
    }

    return unwrap(
      participationRepository.resolveById({
        betID,
        userID: authenticatedUserID,
        winningOptionID,
      }),
    );
  }

  return {
    joinByCode,
    lockById,
    resolveById,
  };
}
