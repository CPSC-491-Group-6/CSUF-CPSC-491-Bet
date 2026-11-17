import { AppError } from "../errors/AppError.js";
import {
  joinCodeSchema,
  predictionTextSchema,
} from "../validation/betSchemas.js";

/**
 * Map repository failures to HTTP status and messages.
 */
const failures = {
  BET_NOT_FOUND: [404, "Bet not found."],
  BET_NOT_OPEN: [409, "This bet is not open."],
  ALREADY_JOINED: [409, "You already joined this bet."],
  BET_FULL: [409, "This bet has reached capacity."],
  ANSWER_REQUIRED: [400, "Select an available answer."],
  INVALID_OPTION: [400, "Invalid answer for this bet."],
  PREDICTION_REQUIRED: [400, "A prediction is required for this bet."],
  INVALID_PREDICTION: [400, "Invalid prediction text."],
  INVALID_ANSWER_TYPE: [400, "Invalid answer type for this bet."],
  INVALID_RESOLUTION_TEXT: [400, "A valid resolution text is required."],
  INVALID_WINNERS: [400, "Winning users must be participants in this bet."],
  NOT_BET_CREATOR: [403, "Only the bet creator may lock this bet."],
  NOT_UNLOCK_CREATOR: [403, "Only the bet creator may unlock this bet."],
  NOT_RESOLVE_CREATOR: [403, "Only the bet creator may resolve this bet."],
  BET_NOT_LOCKED: [409, "Only locked bets may be resolved."],
  BET_NOT_UNLOCKABLE: [409, "Only locked bets may be unlocked."],
  BET_ALREADY_RESOLVED: [409, "This bet has already been resolved."],
};

/**
 * Convert expected repository results into application errors.
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
 * Ensure the route contains a nonempty bet identifier.
 */
function validateBetID(betID) {
  if (typeof betID !== "string" || !betID.trim()) {
    throw new AppError({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "A bet ID is required.",
    });
  }

  return betID;
}

/**
 * Validate optional multiple-choice joining input.
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
 * Validate optional free-response joining input.
 */
function validatePredictionText(input) {
  const predictionText = input?.prediction_text;

  if (predictionText === undefined || predictionText === null) {
    return null;
  }

  const result = predictionTextSchema.safeParse(predictionText);

  if (!result.success) {
    throw new AppError({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid prediction text.",
      details: result.error.issues.map((issue) => ({
        field: "prediction_text",
        message: issue.message,
      })),
    });
  }

  return result.data;
}

/**
 * Validate the answer fields shared by both joining routes.
 */
function validateJoinAnswer(input) {
  return {
    selectedOptionID: validateSelectedOption(input),
    predictionText: validatePredictionText(input),
  };
}

/**
 * Validate a multiple-choice winner option identifier.
 */
function isValidOptionID(optionID) {
  return (
    typeof optionID === "string" &&
    optionID.trim().length > 0 &&
    optionID.length <= 100
  );
}

/**
 * Validate the request format before Resolve reaches persistence.
 *
 * The repository checks the actual stored answer type, creator
 * permission, bet state, and participant membership atomically.
 */
function validateResolutionInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid resolution information.",
    });
  }

  const hasOption = input.winning_option_id !== undefined;
  const hasText = input.resolution_text !== undefined;
  const hasWinners = input.winning_user_ids !== undefined;

  // Reject combined or ambiguous resolution formats.
  if (hasOption && (hasText || hasWinners)) {
    throw new AppError({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Cannot combine multiple-choice and free-response outcomes.",
    });
  }

  // Preserve the existing multiple-choice request contract.
  if (!hasText && !hasWinners) {
    if (!isValidOptionID(input.winning_option_id)) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "A valid winning option ID is required.",
      });
    }

    return {
      winningOptionID: input.winning_option_id,
      resolutionText: null,
      winningUserIDs: null,
    };
  }

  // Both free-response fields are required, including an empty
  // array when the creator selects no winning participants.
  const textResult = predictionTextSchema.safeParse(input.resolution_text);

  const winningUserIDs = input.winning_user_ids;

  if (
    !textResult.success ||
    !Array.isArray(winningUserIDs) ||
    winningUserIDs.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(winningUserIDs).size !== winningUserIDs.length
  ) {
    throw new AppError({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid free-response resolution information.",
    });
  }

  return {
    winningOptionID: null,
    resolutionText: textResult.data,
    winningUserIDs,
  };
}

export function createBetParticipationService({ participationRepository }) {
  /**
   * Join by invitation code using the authenticated user identity.
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
        ...validateJoinAnswer(input),
      }),
    );
  }

  /**
   * Join a public bet without requiring an invitation code.
   */
  function joinPublicById(betID, input, authenticatedUserID) {
    return unwrap(
      participationRepository.joinPublicById({
        betID: validateBetID(betID),
        userID: authenticatedUserID,
        ...validateJoinAnswer(input),
      }),
    );
  }

  /**
   * Lock an open bet on behalf of its creator.
   */
  function lockById(betID, authenticatedUserID) {
    return unwrap(
      participationRepository.lockById({
        betID: validateBetID(betID),
        userID: authenticatedUserID,
      }),
    );
  }

  /**
   * Unlock a locked bet on behalf of its creator.
   */
  function unlockById(betID, authenticatedUserID) {
    return unwrap(
      participationRepository.unlockById({
        betID: validateBetID(betID),
        userID: authenticatedUserID,
      }),
    );
  }

  /**
   * Resolve a locked multiple-choice or free-response bet.
   *
   * The repository enforces creator ownership and performs
   * the complete persistent transition atomically.
   */
  function resolveById(betID, input, authenticatedUserID) {
    return unwrap(
      participationRepository.resolveById({
        betID: validateBetID(betID),
        userID: authenticatedUserID,
        ...validateResolutionInput(input),
      }),
    );
  }

  return {
    joinByCode,
    joinPublicById,
    lockById,
    unlockById,
    resolveById,
  };
}
