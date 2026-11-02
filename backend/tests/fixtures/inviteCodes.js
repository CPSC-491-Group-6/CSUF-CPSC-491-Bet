import { createBetRepository } from "../../src/repositories/createBetRepository.js";

// Return the actual invite code belonging to a test bet.
export function createValidInviteCode(database, bet) {
  const repository = createBetRepository(database);

  if (!bet?.id) {
    throw new Error("A test bet is required.");
  }

  const storedBet = repository.findById(bet.id);

  if (!storedBet?.join_code) {
    throw new Error("Test bet does not have a valid invite code.");
  }

  return storedBet.join_code;
}

// Generate a correctly formatted code that does not exist.
export function createInvalidInviteCode(database) {
  const repository = createBetRepository(database);

  let counter = 0;
  let code;

  do {
    code = counter.toString(16).toUpperCase().padStart(12, "0");
    counter += 1;
  } while (repository.findByJoinCode(code));

  return code;
}
