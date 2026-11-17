/**
 * Prepared SQLite operations for Join, Lock, Unlock, and Resolve.
 *
 * All state-changing operations use immediate transactions.
 */
export function createBetParticipationRepository(database) {
  const betByCode = database.prepare(`
    SELECT id, creator_id, status, visibility,
           max_participants, answer_type
    FROM bets
    WHERE join_code = ? COLLATE NOCASE
  `);

  const publicBetById = database.prepare(`
    SELECT id, creator_id, status, visibility,
           max_participants, answer_type
    FROM bets
    WHERE id = ? AND visibility = 'public'
  `);

  const betById = database.prepare(`
    SELECT
      id,
      creator_id,
      status,
      answer_type,
      locked_at,
      resolved_at,
      winning_option_id,
      resolution_text
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
      selected_option_id,
      prediction_text
    )
    VALUES (?, ?, ?, ?)
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
   * Reopen a locked bet.
   *
   * The database lifecycle constraint requires locked_at
   * to become NULL when status returns to open.
   */
  const unlockLockedBet = database.prepare(`
    UPDATE bets
    SET
      status = 'open',
      locked_at = NULL
    WHERE id = ?
      AND status = 'locked'
  `);

  /**
   * Resolve an existing multiple-choice bet.
   */
  const resolveLockedMultipleChoiceBet = database.prepare(`
    UPDATE bets
    SET
      status = 'resolved',
      winning_option_id = ?,
      resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
      AND status = 'locked'
      AND answer_type = 'multiple_choice'
  `);

  /**
   * Resolve a free-response bet using the final actual outcome.
   *
   * A free-response result does not have a winning option.
   */
  const resolveLockedFreeResponseBet = database.prepare(`
    UPDATE bets
    SET
      status = 'resolved',
      resolution_text = ?,
      winning_option_id = NULL,
      resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
      AND status = 'locked'
      AND answer_type = 'free_response'
  `);

  /**
   * Multiple-choice winners are determined by matching options.
   */
  const findMultipleChoiceWinners = database.prepare(`
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
   * Persist an explicitly selected free-response winner.
   *
   * The database foreign key also verifies that the user
   * belongs to the specified bet.
   */
  const insertFreeResponseWinner = database.prepare(`
    INSERT INTO bet_winners (
      bet_id,
      user_id
    )
    VALUES (?, ?)
  `);

  const findFreeResponseWinners = database.prepare(`
    SELECT
      bp.user_id,
      bp.prediction_text
    FROM bet_winners AS bw
    JOIN bet_participants AS bp
      ON bp.bet_id = bw.bet_id
     AND bp.user_id = bw.user_id
    WHERE bw.bet_id = ?
    ORDER BY bp.user_id
  `);

  /**
   * Shared Join transaction for public and invite-code joining.
   */
  const joinTransaction = database.transaction(
    ({
      joinCode = null,
      betID = null,
      userID,
      selectedOptionID = null,
      predictionText = null,
      publicOnly = false,
    }) => {
      const bet = publicOnly
        ? publicBetById.get(betID)
        : betByCode.get(joinCode);

      if (!bet) {
        return { error: "BET_NOT_FOUND" };
      }

      if (publicOnly && bet.visibility !== "public") {
        return { error: "BET_NOT_FOUND" };
      }

      if (bet.status !== "open") {
        return { error: "BET_NOT_OPEN" };
      }

      if (participantExists.get(bet.id, userID)) {
        return { error: "ALREADY_JOINED" };
      }

      const hasSelectedOption = selectedOptionID !== null;
      const hasPredictionText = predictionText !== null;

      if (hasSelectedOption && hasPredictionText) {
        return { error: "INVALID_ANSWER_TYPE" };
      }

      if (bet.answer_type === "multiple_choice") {
        if (!hasSelectedOption) {
          return { error: "ANSWER_REQUIRED" };
        }

        if (!optionExists.get(selectedOptionID, bet.id)) {
          return { error: "INVALID_OPTION" };
        }
      } else if (bet.answer_type === "free_response") {
        if (hasSelectedOption) {
          return { error: "INVALID_ANSWER_TYPE" };
        }

        if (
          !hasPredictionText ||
          typeof predictionText !== "string" ||
          predictionText.trim().length === 0
        ) {
          return { error: "PREDICTION_REQUIRED" };
        }

        if (predictionText.trim().length > 2000) {
          return { error: "INVALID_PREDICTION" };
        }
      } else if (bet.answer_type === "legacy") {
        if (hasPredictionText) {
          return { error: "INVALID_ANSWER_TYPE" };
        }

        const hasOptions = countOptions.get(bet.id).count > 0;

        if (hasOptions && !hasSelectedOption) {
          return { error: "ANSWER_REQUIRED" };
        }

        if (hasSelectedOption && !optionExists.get(selectedOptionID, bet.id)) {
          return { error: "INVALID_OPTION" };
        }
      } else {
        return { error: "INVALID_ANSWER_TYPE" };
      }

      if (countParticipants.get(bet.id).count >= bet.max_participants) {
        return { error: "BET_FULL" };
      }

      const storedPrediction =
        bet.answer_type === "free_response" ? predictionText.trim() : null;

      insertParticipant.run(bet.id, userID, selectedOptionID, storedPrediction);

      return {
        bet_id: bet.id,
        user_id: userID,
        selected_option_id: selectedOptionID,
        prediction_text: storedPrediction,
        current_participants: countParticipants.get(bet.id).count,
      };
    },
  );

  /**
   * Lock an open bet only when requested by its creator.
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
   * Unlock a locked bet without deleting participants or predictions.
   *
   * Open and resolved bets cannot be unlocked.
   */
  const unlockTransaction = database.transaction(({ betID, userID }) => {
    const bet = betById.get(betID);

    if (!bet) {
      return { error: "BET_NOT_FOUND" };
    }

    if (String(bet.creator_id) !== String(userID)) {
      return { error: "NOT_UNLOCK_CREATOR" };
    }

    if (bet.status !== "locked") {
      return { error: "BET_NOT_UNLOCKABLE" };
    }

    const updated = unlockLockedBet.run(betID);

    if (updated.changes !== 1) {
      return { error: "BET_NOT_UNLOCKABLE" };
    }

    return betById.get(betID);
  });

  /**
   * Resolve a locked bet atomically.
   *
   * Multiple-choice bets use a winning option.
   * Free-response bets use resolution text and explicit winners.
   */
  const resolveTransaction = database.transaction(
    ({
      betID,
      userID,
      winningOptionID = null,
      resolutionText = null,
      winningUserIDs = null,
    }) => {
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

      if (bet.answer_type === "multiple_choice") {
        if (resolutionText !== null || winningUserIDs !== null) {
          return { error: "INVALID_ANSWER_TYPE" };
        }

        if (
          typeof winningOptionID !== "string" ||
          !optionExists.get(winningOptionID, betID)
        ) {
          return { error: "INVALID_OPTION" };
        }

        const updated = resolveLockedMultipleChoiceBet.run(
          winningOptionID,
          betID,
        );

        if (updated.changes !== 1) {
          return { error: "BET_NOT_LOCKED" };
        }

        return {
          bet: betById.get(betID),
          winners: findMultipleChoiceWinners.all(betID),
        };
      }

      if (bet.answer_type === "free_response") {
        if (winningOptionID !== null) {
          return { error: "INVALID_ANSWER_TYPE" };
        }

        if (
          typeof resolutionText !== "string" ||
          resolutionText.trim().length < 1 ||
          resolutionText.trim().length > 2000
        ) {
          return { error: "INVALID_RESOLUTION_TEXT" };
        }

        if (!Array.isArray(winningUserIDs)) {
          return { error: "INVALID_WINNERS" };
        }

        // Verify all winners before changing any persistent state.
        const seen = new Set();

        for (const winnerID of winningUserIDs) {
          if (
            !Number.isSafeInteger(winnerID) ||
            winnerID <= 0 ||
            seen.has(winnerID) ||
            !participantExists.get(betID, winnerID)
          ) {
            return { error: "INVALID_WINNERS" };
          }

          seen.add(winnerID);
        }

        const updated = resolveLockedFreeResponseBet.run(
          resolutionText.trim(),
          betID,
        );

        if (updated.changes !== 1) {
          return { error: "BET_NOT_LOCKED" };
        }

        // Inserting zero winner rows is intentional and valid.
        for (const winnerID of winningUserIDs) {
          insertFreeResponseWinner.run(betID, winnerID);
        }

        return {
          bet: betById.get(betID),
          winners: findFreeResponseWinners.all(betID),
        };
      }

      // Historical legacy bets have no new resolution contract.
      return { error: "INVALID_ANSWER_TYPE" };
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

    unlockById: (params) => unlockTransaction.immediate(params),

    resolveById: (params) => resolveTransaction.immediate(params),
  };
}
