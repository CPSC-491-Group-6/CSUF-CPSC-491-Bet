import { randomUUID } from "node:crypto";

/**
 * Create prepared SQLite queries for the Bet API.
 *
 * Participant counts come from bet_participants.
 * Multiple-choice answers come from bet_options.
 * Free-response answers come from prediction_text.
 */
export function createBetRepository(database) {
  const projection = `
    b.*,
    (SELECT COUNT(*)
     FROM bet_participants AS bp
     WHERE bp.bet_id = b.id)
       AS current_participants
  `;

  const findByIdStatement = database.prepare(`
    SELECT ${projection}
    FROM bets AS b
    WHERE b.id = ?
  `);

  const findByCodeStatement = database.prepare(`
    SELECT ${projection}
    FROM bets AS b
    WHERE b.join_code = ? COLLATE NOCASE
  `);

  const findByCreatorStatement = database.prepare(`
    SELECT ${projection}
    FROM bets AS b
    WHERE b.creator_id = ?
    ORDER BY b.created_at DESC, b.id DESC
  `);

  /**
   * Public discovery must not expose private join codes.
   */
  const findPublicStatement = database.prepare(`
    SELECT
      b.id,
      b.creator_id,
      b.title,
      b.description,
      b.status,
      b.visibility,
      b.max_participants,
      b.answer_type,
      b.winning_option_id,
      b.resolution_text,
      b.created_at,
      b.locked_at,
      b.resolved_at,
      (SELECT COUNT(*)
       FROM bet_participants AS bp
       WHERE bp.bet_id = b.id)
         AS current_participants
    FROM bets AS b
    WHERE b.visibility = 'public'
    ORDER BY b.created_at DESC, b.id DESC
  `);

  /**
   * Retrieve answer choices in their original display order.
   */
  const findOptionsByBetIdStatement = database.prepare(`
    SELECT
      id,
      label,
      position
    FROM bet_options
    WHERE bet_id = ?
    ORDER BY position, id
  `);

  /**
   * Check whether an authenticated user belongs to a bet.
   */
  const participantExistsStatement = database.prepare(`
    SELECT 1
    FROM bet_participants
    WHERE bet_id = ?
      AND user_id = ?
    LIMIT 1
  `);

  /**
   * Retrieve participant details for an authorized viewer.
   *
   * No credentials or sensitive account fields are returned.
   */
  const findParticipantsByBetIdStatement = database.prepare(`
    SELECT
      bp.user_id,
      u.username,
      bp.joined_at,
      bp.selected_option_id,
      bp.prediction_text
    FROM bet_participants AS bp
    JOIN users AS u
      ON u.userID = bp.user_id
    WHERE bp.bet_id = ?
    ORDER BY bp.joined_at, bp.user_id
  `);

  /**
   * Retrieve explicitly selected free-response winners.
   *
   * The winning user IDs are scoped to the requested bet.
   */
  const findWinningUserIDsStatement = database.prepare(`
    SELECT user_id
    FROM bet_winners
    WHERE bet_id = ?
    ORDER BY user_id
  `);

  /**
   * Insert the basic bet record.
   *
   * Ownership is derived from the authenticated session,
   * not from user-controlled request fields.
   */
  const insertBetStatement = database.prepare(`
    INSERT INTO bets (
      id,
      creator_id,
      title,
      description,
      join_code,
      visibility,
      max_participants,
      answer_type
    )
    VALUES (
      @id,
      @creator_id,
      @title,
      @description,
      @join_code,
      @visibility,
      @max_participants,
      @answer_type
    )
  `);

  /**
   * Insert the creator as the initial participant.
   *
   * Exactly one answer representation may be provided.
   * Legacy-compatible clients may initially omit both.
   */
  const insertCreatorStatement = database.prepare(`
    INSERT INTO bet_participants (
      bet_id,
      user_id,
      selected_option_id,
      prediction_text
    )
    VALUES (?, ?, ?, ?)
  `);

  /**
   * Insert a backend-generated multiple-choice option.
   */
  const insertOptionStatement = database.prepare(`
    INSERT INTO bet_options (
      id,
      bet_id,
      label,
      position
    )
    VALUES (?, ?, ?, ?)
  `);

  /**
   * Persist a bet, answer options, and creator membership
   * in one atomic SQLite transaction.
   *
   * A failure rolls back all associated inserts.
   */
  const createTransaction = database.transaction((bet) => {
    const {
      options = [],
      creator_selected_option_index: creatorOptionIndex,
      creator_prediction_text: creatorPredictionText,
      ...betRecord
    } = bet;

    const hasOptions = options.length > 0;

    // Determine the answer type from the supplied options.
    const answerType = hasOptions ? "multiple_choice" : "free_response";

    // Defense in depth when called without service validation.
    if (
      (hasOptions && creatorPredictionText !== undefined) ||
      (!hasOptions && creatorOptionIndex !== undefined)
    ) {
      throw new RangeError(
        "Creator prediction must match the bet answer type.",
      );
    }

    if (
      creatorPredictionText !== undefined &&
      (typeof creatorPredictionText !== "string" ||
        creatorPredictionText.trim().length < 1 ||
        creatorPredictionText.trim().length > 2000)
    ) {
      throw new RangeError("Invalid creator prediction text.");
    }

    // Step 1: Persist the basic bet record.
    insertBetStatement.run({
      ...betRecord,
      answer_type: answerType,
    });

    // Step 2: Insert the multiple-choice options, if any.
    const optionIDs = [];

    for (const [position, label] of options.entries()) {
      const optionID = randomUUID();

      insertOptionStatement.run(optionID, betRecord.id, label, position);

      optionIDs.push(optionID);
    }

    // Step 3: Map the creator's option index to its generated ID.
    const selectedOptionID =
      creatorOptionIndex === undefined ? null : optionIDs[creatorOptionIndex];

    if (selectedOptionID === undefined) {
      throw new RangeError(
        "Creator selection must reference an existing answer option.",
      );
    }

    // Step 4: Store creator membership and any submitted answer.
    insertCreatorStatement.run(
      betRecord.id,
      betRecord.creator_id,
      selectedOptionID,
      creatorPredictionText?.trim() ?? null,
    );

    // Step 5: Return the existing Create Bet response shape
    // with the new answer_type and outcome fields.
    return findByIdStatement.get(betRecord.id);
  });

  return {
    /** Atomically create a bet and associated records. */
    createBet: (bet) => createTransaction(bet),

    /** Retrieve one bet by its identifier. */
    findById: (id) => findByIdStatement.get(id),

    /** List bets owned by the authenticated creator. */
    findByCreatorId: (userID) => findByCreatorStatement.all(userID),

    /** List publicly discoverable bets without join codes. */
    findPublic: () => findPublicStatement.all(),

    /** Find a bet using a case-insensitive invite code. */
    findByJoinCode: (joinCode) => findByCodeStatement.get(joinCode),

    /** Retrieve answer options in their stored order. */
    findOptionsByBetId: (betID) => findOptionsByBetIdStatement.all(betID),

    /** Determine whether an authenticated user is a participant. */
    isParticipant: (betID, userID) => {
      if (userID === undefined || userID === null) {
        return false;
      }

      return Boolean(participantExistsStatement.get(betID, userID));
    },

    /** Retrieve participant records for an authorized viewer. */
    findParticipantsByBetId: (betID) =>
      findParticipantsByBetIdStatement.all(betID),

    /** Retrieve explicitly selected free-response winner IDs. */
    findWinningUserIDsByBetId: (betID) =>
      findWinningUserIDsStatement.all(betID).map((row) => row.user_id),
  };
}
