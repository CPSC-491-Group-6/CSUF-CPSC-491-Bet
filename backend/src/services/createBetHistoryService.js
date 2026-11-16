import { AppError } from "../errors/AppError.js";

const validStatuses = new Set(["open", "locked", "resolved"]);

/**
 * Provide authenticated history retrieval with validated filters.
 *
 * The repository performs user-scoped SQL retrieval.
 * This service validates all client-supplied query parameters.
 */
export function createBetHistoryService({ historyRepository }) {
  /**
   * List all bets associated with the authenticated participant.
   *
   * Supported query parameters:
   *   status=open
   *   status=locked
   *   status=resolved
   *
   * An omitted status returns all lifecycle states.
   */
  function listHistory(authenticatedUserID, query = {}) {
    if (query === null || typeof query !== "object" || Array.isArray(query)) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid history filters.",
      });
    }

    // Reject unsupported query parameters instead of silently
    // ignoring client requests that cannot be fulfilled.
    const unsupported = Object.keys(query).some((key) => key !== "status");

    const status = query.status;

    if (unsupported || (status !== undefined && !validStatuses.has(status))) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid history filters.",
      });
    }

    // Never accept an arbitrary user ID from the request.
    // The session identity determines which records are visible.
    return historyRepository.findHistoryByUserId(
      authenticatedUserID,
      status ?? null,
    );
  }

  return {
    listHistory,
  };
}
