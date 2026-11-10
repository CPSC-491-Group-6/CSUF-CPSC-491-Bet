import { AppError } from "../errors/AppError.js";
import { joinCodeSchema } from "../validation/betSchemas.js";

/**
 * Preserve the existing Join, Lock, and Resolve error contract.
 */
const failures = {
  BET_NOT_FOUND: [404, "Bet not found."],
  BET_NOT_OPEN: [409, "This bet is not open."],
  ALREADY_JOINED: [409, "You already joined this bet."],
  BET_FULL: [409, "This bet has reached capacity."],
  ANSWER_REQUIRED: [400, "Select an available answer."],
  INVALID_OPTION: [400, "Invalid answer for this bet."],
  NOT_BET_CREATOR: [403, "Only the bet creator may lock this bet."],
  NOT_RESOLVE_CREATOR: [403, "Only the bet creator may resolve this bet."],
  BET_NOT_LOCKED: [409, "Only locked bets may be resolved."],
  BET_ALREADY_RESOLVED: [409, "This bet has already been resolved."],
};

/**
 * Convert expected repository failures into application errors.
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
 * Validate optional answer selection for both joining methods.
 */
function validateSelectedOption(input) {
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

  return selectedOptionID ?? null;
}

/**
 * Validate a winning option before attempting resolution.
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
   * Join a public or private bet using its invite code.
   *
   * Retains the established invite-code API behavior.
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

    return unwrap(
      participationRepository.joinByCode({
        joinCode: code.data,
        userID: authenticatedUserID,
        selectedOptionID: validateSelectedOption(input),
      }),
    );
  }

  /**
   * Join a public bet by ID without requiring an invite code.
   *
   * The repository enforces public visibility and all
   * participation constraints inside its SQLite transaction.
   */
  function joinPublicById(betID, input, authenticatedUserID) {
    if (typeof betID !== "string" || !betID.trim()) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "A bet ID is required.",
      });
    }

    return unwrap(
      participationRepository.joinPublicById({
        betID,
        userID: authenticatedUserID,
        selectedOptionID: validateSelectedOption(input),
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
   * Restore Resolve Bet service functionality.
   *
   * The repository validates authorization, lifecycle state,
   * and outcome ownership within an atomic transaction.
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
    joinPublicById,
    lockById,
    resolveById,
  };
}
