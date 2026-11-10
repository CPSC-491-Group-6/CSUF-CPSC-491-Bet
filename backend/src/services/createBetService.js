import { randomBytes, randomUUID } from "node:crypto";

import { AppError } from "../errors/AppError.js";
import { formatValidationIssues } from "../validation/authSchemas.js";
import { createBetSchema, joinCodeSchema } from "../validation/betSchemas.js";

export function createBetService({
  betRepository,
  makeJoinCode = () => randomBytes(6).toString("hex").toUpperCase(),
}) {
  /**
   * Create a bet owned by the authenticated user.
   *
   * The repository inserts the bet, creator membership,
   * and optional answer choices in one transaction.
   */
  function createBet(input, authenticatedUserID) {
    const result = createBetSchema.safeParse(input);

    if (!result.success) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid bet information.",
        details: formatValidationIssues(result.error),
      });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return betRepository.createBet({
          ...result.data,
          id: randomUUID(),
          creator_id: authenticatedUserID,
          join_code: makeJoinCode(),
        });
      } catch (error) {
        const isCodeCollision =
          error.code === "SQLITE_CONSTRAINT_UNIQUE" &&
          /bets\.join_code/i.test(error.message);

        if (!isCodeCollision) {
          throw error;
        }
      }
    }

    throw new AppError({
      statusCode: 503,
      code: "JOIN_CODE_UNAVAILABLE",
      message: "Could not allocate a join code. Please try again.",
    });
  }

  /**
   * Retrieve bets created by the authenticated user.
   */
  function listMine(authenticatedUserID) {
    return betRepository.findByCreatorId(authenticatedUserID);
  }

  /**
   * Retrieve publicly discoverable bets.
   */
  function listPublic() {
    return betRepository.findPublic();
  }

  /**
   * Look up a bet using a valid invitation code.
   *
   * Possession of a valid code permits a limited preview,
   * but it does not automatically authorize full private
   * bet details or the complete participant list.
   */
  function findByCode(code, authenticatedUserID) {
    const result = joinCodeSchema.safeParse(code);

    if (!result.success) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid join code.",
        details: [
          {
            field: "join_code",
            message: "Join code is invalid.",
          },
        ],
      });
    }

    const bet = betRepository.findByJoinCode(result.data);

    if (!bet) {
      throw new AppError({
        statusCode: 404,
        code: "BET_NOT_FOUND",
        message: "Bet not found.",
      });
    }

    const isCreator = String(bet.creator_id) === String(authenticatedUserID);

    const isParticipant = betRepository.isParticipant(
      bet.id,
      authenticatedUserID,
    );

    // Include options so users can choose an answer before joining.
    const options = betRepository.findOptionsByBetId(bet.id);

    const preview = {
      ...bet,
      options,
      is_participant: isParticipant,
    };

    // Only the creator receives the actual stored invite code.
    if (!isCreator) {
      delete preview.join_code;
    }

    // Do not expose the participant list through code lookup.
    return preview;
  }

  /**
   * Retrieve individual bet details.
   *
   * Private bets are accessible to their creator and
   * authenticated participants.
   *
   * Public bets can be viewed by authenticated users,
   * but the full participant list is only returned
   * to the creator or an existing participant.
   */
  function getBetById(betId, authenticatedUserID) {
    if (typeof betId !== "string" || !betId.trim()) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "A bet ID is required.",
      });
    }

    const bet = betRepository.findById(betId);

    if (!bet) {
      throw new AppError({
        statusCode: 404,
        code: "BET_NOT_FOUND",
        message: "Bet not found.",
      });
    }

    const isCreator = String(bet.creator_id) === String(authenticatedUserID);

    const isParticipant = betRepository.isParticipant(
      bet.id,
      authenticatedUserID,
    );

    const isPublic = bet.visibility === "public";

    // Hide private bets from users without membership.
    if (!isPublic && !isCreator && !isParticipant) {
      throw new AppError({
        statusCode: 404,
        code: "BET_NOT_FOUND",
        message: "Bet not found.",
      });
    }

    // Options are safe for authorized detail viewers.
    const options = betRepository.findOptionsByBetId(bet.id);

    // Restrict participant identity data to members.
    const participants =
      isCreator || isParticipant
        ? betRepository.findParticipantsByBetId(bet.id)
        : [];

    const result = {
      ...bet,
      options,
      participants,
      is_participant: isParticipant,
    };

    // Preserve creator-only access to the stored join code.
    if (!isCreator) {
      delete result.join_code;
    }

    return result;
  }

  return {
    createBet,
    listMine,
    listPublic,
    findByCode,
    getBetById,
  };
}
