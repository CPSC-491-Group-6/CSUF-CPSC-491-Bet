// backend/src/services/createBetService.js
import { randomBytes, randomUUID } from "node:crypto";

import { AppError } from "../errors/AppError.js";
import { formatValidationIssues } from "../validation/authSchemas.js";
import { createBetSchema, joinCodeSchema } from "../validation/betSchemas.js";

/** Create Bet business logic without exposing ownership or codes to callers. */
export function createBetService({
  betRepository,
  makeJoinCode = () => randomBytes(6).toString("hex").toUpperCase(),
}) {
  /** Validate owner-controlled input and allocate a unique code. */
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

    // Retry only when the generated join code collides with another bet.
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

  /** Preserve the Create/List contract: My Bets means creator-owned bets. */
  function listMine(authenticatedUserID) {
    return betRepository.findByCreatorId(authenticatedUserID);
  }

  /** Public browsing cannot expose private bets or their join codes. */
  function listPublic() {
    return betRepository.findPublic();
  }

  /** Possession of a valid code permits viewing details, not joining a bet. */
  function findByCode(code) {
    const result = joinCodeSchema.safeParse(code);
    if (!result.success) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid join code.",
        details: [{ field: "join_code", message: "Join code is invalid." }],
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

  return { createBet, listMine, listPublic, findByCode };
}
