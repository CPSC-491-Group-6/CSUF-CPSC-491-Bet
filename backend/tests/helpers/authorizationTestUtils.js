import {
  createCreatorUser,
  createParticipantUser,
  createNonParticipantUser,
} from "../fixtures/users.js";

import { createOpenBet, createLockedBet } from "../fixtures/bets.js";

// Create a user who owns an open or locked test bet.
export function createCreatorState(database, options = {}) {
  const { status = "open", ...betOptions } = options;

  if (!["open", "locked"].includes(status)) {
    throw new Error(`Unsupported test bet status: ${status}`);
  }

  return database.transaction(() => {
    const user = createCreatorUser(database);

    const bet =
      status === "locked"
        ? createLockedBet(database, user, betOptions)
        : createOpenBet(database, user, betOptions);

    return { user, bet };
  })();
}

// Create a user who is already participating in a bet.
export function createParticipantState(database, bet) {
  if (!bet?.id) {
    throw new Error("A test bet is required.");
  }

  return database.transaction(() => {
    const user = createParticipantUser(database);

    database
      .prepare(
        `
        INSERT INTO bet_participants (bet_id, user_id)
        VALUES (?, ?)
      `,
      )
      .run(bet.id, user.userID);

    return { user, bet };
  })();
}

// Create an authenticated identity with no bet membership.
export function createNonParticipantState(database, bet) {
  if (!bet?.id) {
    throw new Error("A test bet is required.");
  }

  return database.transaction(() => {
    const user = createNonParticipantUser(database);

    const membership = database
      .prepare(
        `
        SELECT 1
        FROM bet_participants
        WHERE bet_id = ? AND user_id = ?
      `,
      )
      .get(bet.id, user.userID);

    if (membership) {
      throw new Error("Non-participant is already in the bet.");
    }

    return { user, bet };
  })();
}

// Test-only session middleware for authenticated API requests.
// Authorization checks still use the actual database relationships.
export function createAuthorizationTestSessionMiddleware(database) {
  const findUser = database.prepare(`
    SELECT userID FROM users WHERE userID = ?
  `);

  return (req, res, next) => {
    const rawID = req.get("x-test-user");
    const userID = Number(rawID);

    if (
      rawID &&
      Number.isSafeInteger(userID) &&
      userID > 0 &&
      findUser.get(userID)
    ) {
      req.session = { userID };
    }

    next();
  };
}

// Headers for Supertest requests using a synthetic test identity.
export function getTestAuthHeaders(state) {
  return {
    "x-test-user": String(state.user.userID),
  };
}
