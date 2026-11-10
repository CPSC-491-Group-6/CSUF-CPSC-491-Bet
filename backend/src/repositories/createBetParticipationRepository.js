/**
 * Prepared SQLite operations shared by invite-code Join, public Join,
 * creator-only Lock, and Resolve Bet.
 */
export function createBetParticipationRepository(database) {
  const betByCode = database.prepare(`
    SELECT id, creator_id, status, visibility, max_participants
    FROM bets
    WHERE join_code = ? COLLATE NOCASE
  `);

  // Only public bets may be joined by ID without a code.
  const publicBetById = database.prepare(`
    SELECT id, creator_id, status, visibility, max_participants
    FROM bets
    WHERE id = ? AND visibility = 'public'
  `);

  // Retain the fields used by the original Lock/Resolve responses.
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

  const insertParticipant = database.prepare(`
    INSERT INTO bet_participants (
      bet_id,
      user_id,
      selected_option_id
    )
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
   * Resolve a locked bet atomically.
   *
   * Status, outcome, and timestamp are updated together.
   * The status predicate prevents overwriting a resolved bet.
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
   * Identify winners using the persisted winning option.
   *
   * No separate winners table is required.
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

  /**
   * Shared Join transaction.
   *
   * Both invite-code and public-ID joins use the same validation,
   * capacity check, and membership insertion.
   */
  const joinTransaction = database.transaction(
    ({
      joinCode = null,
      betID = null,
      userID,
      selectedOptionID = null,
      publicOnly = false,
    }) => {
      const bet = publicOnly
        ? publicBetById.get(betID)
        : betByCode.get(joinCode);

      if (!bet) {
        return { error: "BET_NOT_FOUND" };
      }

      // Never allow direct joining of a private bet by its ID.
      if (publicOnly && bet.visibility !== "public") {
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

      // All checks passed; insert the participation record.
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
   * Preserve creator-only Lock behavior.
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
   * Preserve the original Resolve transaction.
   *
   * Only the creator can resolve a locked bet.
   * Existing results are immutable.
   * The winning option must belong to the target bet.
   */
  const resolveTransaction = database.transaction(
    ({ betID, userID, winningOptionID }) => {
      const bet = betById.get(betID);

      if (!bet) {
        return { error: "BET_NOT_FOUND" };
      }

      if (String(bet.creator_id) !== String(userID)) {
        return { error: "NOT_RESOLVE_CREATOR" };
      }

      if (bet.status === "resolved") {
        return { error: "BET_ALREADY_RESOLVED" };
      }

      if (bet.status !== "locked") {
        return { error: "BET_NOT_LOCKED" };
      }

      if (!optionExists.get(winningOptionID, betID)) {
        return { error: "INVALID_OPTION" };
      }

      const updated = resolveLockedBet.run(winningOptionID, betID);

      if (updated.changes !== 1) {
        return { error: "BET_NOT_LOCKED" };
      }

      // Read back the stored result and matching winners.
      return {
        bet: betById.get(betID),
        winners: findWinners.all(betID),
      };
    },
  );

  return {
    /**
     * Immediate transactions serialize competing SQLite writers.
     */
    joinByCode: (params) =>
      joinTransaction.immediate({
        ...params,
        publicOnly: false,
      }),

    joinPublicById: (params) =>
      joinTransaction.immediate({
        ...params,
        publicOnly: true,
      }),

    lockById: (params) => lockTransaction.immediate(params),

    resolveById: (params) => resolveTransaction.immediate(params),
  };
}
