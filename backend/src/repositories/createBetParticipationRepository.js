export function createBetParticipationRepository(database) {
  const betByCode = database.prepare(`
    SELECT id, creator_id, status, max_participants
    FROM bets WHERE join_code = ? COLLATE NOCASE
  `);

  const betById = database.prepare(`
    SELECT id, creator_id, status, locked_at
    FROM bets WHERE id = ?
  `);

  const countParticipants = database.prepare(`
    SELECT COUNT(*) AS count
    FROM bet_participants WHERE bet_id = ?
  `);

  const participantExists = database.prepare(`
    SELECT 1 FROM bet_participants
    WHERE bet_id = ? AND user_id = ?
  `);

  const countOptions = database.prepare(`
    SELECT COUNT(*) AS count
    FROM bet_options WHERE bet_id = ?
  `);

  const optionExists = database.prepare(`
    SELECT 1 FROM bet_options
    WHERE id = ? AND bet_id = ?
  `);

  const insertParticipant = database.prepare(`
    INSERT INTO bet_participants
      (bet_id, user_id, selected_option_id)
    VALUES (?, ?, ?)
  `);

  const lockOpenBet = database.prepare(`
    UPDATE bets
    SET status = 'locked',
        locked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND status = 'open'
  `);

  // Atomic join protects capacity and uniqueness.
  const joinTransaction = database.transaction(
    ({ joinCode, userID, selectedOptionID }) => {
      const bet = betByCode.get(joinCode);

      if (!bet) return { error: "BET_NOT_FOUND" };
      if (bet.status !== "open") {
        return { error: "BET_NOT_OPEN" };
      }

      if (participantExists.get(bet.id, userID)) {
        return { error: "ALREADY_JOINED" };
      }

      const hasOptions = countOptions.get(bet.id).count > 0;

      if (hasOptions && !selectedOptionID) {
        return { error: "ANSWER_REQUIRED" };
      }

      if (selectedOptionID && !optionExists.get(selectedOptionID, bet.id)) {
        return { error: "INVALID_OPTION" };
      }

      if (countParticipants.get(bet.id).count >= bet.max_participants) {
        return { error: "BET_FULL" };
      }

      insertParticipant.run(bet.id, userID, selectedOptionID ?? null);

      return {
        bet_id: bet.id,
        user_id: userID,
        selected_option_id: selectedOptionID ?? null,
        current_participants: countParticipants.get(bet.id).count,
      };
    },
  );

  // Only the creator can perform open -> locked.
  const lockTransaction = database.transaction(({ betID, userID }) => {
    const bet = betById.get(betID);

    if (!bet) return { error: "BET_NOT_FOUND" };

    if (String(bet.creator_id) !== String(userID)) {
      return { error: "NOT_BET_CREATOR" };
    }

    if (bet.status !== "open") {
      return { error: "BET_NOT_OPEN" };
    }

    const updated = lockOpenBet.run(betID);

    if (updated.changes !== 1) {
      return { error: "BET_NOT_OPEN" };
    }

    return betById.get(betID);
  });

  return {
    // Immediate transactions serialize SQLite writers.
    joinByCode: (params) => joinTransaction.immediate(params),

    lockById: (params) => lockTransaction.immediate(params),
  };
}
