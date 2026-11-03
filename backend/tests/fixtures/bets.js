import { randomBytes, randomUUID } from "node:crypto";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";

// Create a valid open bet owned by the supplied test creator.
export function createOpenBet(database, creator, options = {}) {
  const repository = createBetRepository(database);

  return repository.createBet({
    id: randomUUID(),
    creator_id: creator.userID,
    title: options.title ?? "Sprint 4 Test Bet",
    description: options.description ?? "Synthetic test bet",
    join_code: randomBytes(6).toString("hex").toUpperCase(),
    visibility: options.visibility ?? "private",
    max_participants: options.max_participants ?? 5,
  });
}

// Create a locked bet with a valid lifecycle timestamp.
export function createLockedBet(database, creator, options = {}) {
  const repository = createBetRepository(database);

  return database.transaction(() => {
    const bet = createOpenBet(database, creator, options);

    database
      .prepare(
        `
        UPDATE bets
        SET status = 'locked',
            locked_at = ?
        WHERE id = ?
      `,
      )
      .run(new Date().toISOString(), bet.id);

    return repository.findById(bet.id);
  })();
}
