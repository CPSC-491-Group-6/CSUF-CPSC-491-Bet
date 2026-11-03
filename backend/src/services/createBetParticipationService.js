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
};

// Convert repository failures into standard API errors.
function unwrap(result) {
  if (!result.error) return result;

  const [statusCode, message] = failures[result.error];

  throw new AppError({
    statusCode,
    code: result.error,
    message,
  });
}

export function createBetParticipationService({ participationRepository }) {
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

  return { joinByCode, lockById };
}
