export function createBetParticipationRepository(database) {
  /**
   * Shared bet lookups for Join, Lock, and Resolve.
   */
  const betByCode = database.prepare(`
    SELECT
      id,
      creator_id,
      status,
      max_participants
    FROM bets
    WHERE join_code = ? COLLATE NOCASE
  `);

  const betById = database.prepare(`
    SELECT
      id,
      creator_id,
      status,
      locked_at,
      resolved_at,
      winning_option_id
    FROM bets
    WHERE id = ?
  `);

  const countParticipants = database.prepare(`
    SELECT COUNT(*) AS count
    FROM bet_participants
    WHERE bet_id = ?
  `);

  const participantExists = database.prepare(`
    SELECT 1
    FROM bet_participants
    WHERE bet_id = ?
      AND user_id = ?
  `);

  const countOptions = database.prepare(`
    SELECT COUNT(*) AS count
    FROM bet_options
    WHERE bet_id = ?
  `);

  const optionExists = database.prepare(`
    SELECT 1
    FROM bet_options
    WHERE id = ?
      AND bet_id = ?
  `);

  /**
   * Read winning participants after a successful resolution.
   *
   * A participant wins when their selected option matches the stored
   * winning option of the resolved bet. No duplicate winner table is
   * required.
   */
  const findWinners = database.prepare(`
    SELECT
      bp.user_id,
      bp.selected_option_id
    FROM bet_participants AS bp
    JOIN bets AS b
      ON b.id = bp.bet_id
    WHERE b.id = ?
      AND b.status = 'resolved'
      AND bp.selected_option_id = b.winning_option_id
    ORDER BY bp.user_id
  `);

  const insertParticipant = database.prepare(`
    INSERT INTO bet_participants
      (bet_id, user_id, selected_option_id)
    VALUES (?, ?, ?)
  `);

  const lockOpenBet = database.prepare(`
    UPDATE bets
    SET
      status = 'locked',
      locked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
      AND status = 'open'
  `);

  /**
   * Atomically resolve a locked bet.
   *
   * The winning option is assigned in the same UPDATE as the status and
   * timestamp. The status condition prevents rewriting an existing
   * resolution if another writer resolves the bet first.
   *
   * The database's CHECK and foreign-key constraints provide additional
   * protection against malformed persistent state.
   */
  const resolveLockedBet = database.prepare(`
    UPDATE bets
    SET
      status = 'resolved',
      winning_option_id = ?,
      resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
      AND status = 'locked'
  `);

  /**
   * Join transaction.
   *
   * Preserve the existing capacity, uniqueness, and answer validation.
   */
  const joinTransaction = database.transaction(
    ({ joinCode, userID, selectedOptionID }) => {
      const bet = betByCode.get(joinCode);

      if (!bet) {
        return { error: "BET_NOT_FOUND" };
      }

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

  /**
   * Lock transaction.
   *
   * Only the creator may transition an open bet to locked.
   */
  const lockTransaction = database.transaction(({ betID, userID }) => {
    const bet = betById.get(betID);

    if (!bet) {
      return { error: "BET_NOT_FOUND" };
    }

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

  /**
   * Resolve transaction.
   *
   * Every relevant check and the final update occur inside a single
   * SQLite transaction. Immediate mode serializes competing writers.
   *
   * Failed requests return an error before any changes are committed.
   * The winning participants are read from the stored outcome.
   */
  const resolveTransaction = database.transaction(
    ({ betID, userID, winningOptionID }) => {
      const bet = betById.get(betID);

      if (!bet) {
        return { error: "BET_NOT_FOUND" };
      }

      // Authorization must also be enforced on the backend.
      if (String(bet.creator_id) !== String(userID)) {
        return { error: "NOT_RESOLVE_CREATOR" };
      }

      // Existing resolved results must never be overwritten.
      if (bet.status === "resolved") {
        return { error: "BET_ALREADY_RESOLVED" };
      }

      // Enforce the intended open -> locked -> resolved lifecycle.
      if (bet.status !== "locked") {
        return { error: "BET_NOT_LOCKED" };
      }

      // The winning option must belong to this exact bet.
      if (!optionExists.get(winningOptionID, betID)) {
        return { error: "INVALID_OPTION" };
      }

      const updated = resolveLockedBet.run(winningOptionID, betID);

      // Protect against unexpected concurrent state changes.
      if (updated.changes !== 1) {
        return { error: "BET_NOT_LOCKED" };
      }

      const resolvedBet = betById.get(betID);
      const winners = findWinners.all(betID);

      return {
        bet: resolvedBet,
        winners,
      };
    },
  );

  return {
    // Immediate transactions serialize SQLite writers.
    joinByCode: (params) => joinTransaction.immediate(params),

    lockById: (params) => lockTransaction.immediate(params),

    resolveById: (params) => resolveTransaction.immediate(params),
  };
}
