
import { randomBytes, randomUUID } from "node:crypto";

import { AppError } from "../errors/AppError.js";
import { formatValidationIssues } from "../validation/authSchemas.js";
import { createBetSchema, joinCodeSchema } from "../validation/betSchemas.js";

export function createBetService({
  betRepository,
  makeJoinCode = () => randomBytes(6).toString("hex").toUpperCase(),
}) {
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

        if (!isCodeCollision) throw error;
      }
    }

    throw new AppError({
      statusCode: 503,
      code: "JOIN_CODE_UNAVAILABLE",
      message: "Could not allocate a join code. Please try again.",
    });
  }

  function listMine(authenticatedUserID) {
    return betRepository.findByCreatorId(authenticatedUserID);
  }

  function listPublic() {
    return betRepository.findPublic();
  }

  function findByCode(code) {
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

    return bet;
  }

  // Sprint 4 - Retrieve individual bet details.
  function getBetById(betId, authenticatedUserID) {
    if (
      typeof betId !== "string" ||
      !betId.trim()
    ) {
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

    const isCreator =
      String(bet.creator_id) ===
      String(authenticatedUserID);

    // Private bets cannot be retrieved by
    // unauthorized users through their IDs.
    if (!isCreator && bet.visibility !== "public") {
      throw new AppError({
        statusCode: 404,
        code: "BET_NOT_FOUND",
        message: "Bet not found.",
      });
    }

    // Never expose invite codes through
    // this endpoint to non-creators.
    if (!isCreator) {
      const publicBet = { ...bet };
      delete publicBet.join_code;
      return publicBet;
    }

    return bet;
  }

  return {
    createBet,
    listMine,
    listPublic,
    findByCode,
    getBetById,
  };
}
