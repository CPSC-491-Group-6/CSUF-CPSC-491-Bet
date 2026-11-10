import { randomUUID } from "node:crypto";

/**
 * Create prepared SQLite queries for the Bet API.
 *
 * Participant counts come from bet_participants.
 * Answer choices are stored in bet_options.
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
      b.winning_option_id,
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
   * Retrieve participant details for an authorized bet viewer.
   *
   * No credentials or sensitive account fields are returned.
   */
  const findParticipantsByBetIdStatement = database.prepare(`
    SELECT
      bp.user_id,
      u.username,
      bp.joined_at,
      bp.selected_option_id
    FROM bet_participants AS bp
    JOIN users AS u
      ON u.userID = bp.user_id
    WHERE bp.bet_id = ?
    ORDER BY bp.joined_at, bp.user_id
  `);

  /**
   * Insert the basic bet record.
   *
   * Ownership is determined by the authenticated session
   * in the calling service, not by client-submitted values.
   */
  const insertBetStatement = database.prepare(`
    INSERT INTO bets (
      id,
      creator_id,
      title,
      description,
      join_code,
      visibility,
      max_participants
    )
    VALUES (
      @id,
      @creator_id,
      @title,
      @description,
      @join_code,
      @visibility,
      @max_participants
    )
  `);

  /**
   * Insert the creator as the initial participant.
   *
   * The selected_option_id must point to an option already
   * inserted for this bet, or be NULL for a legacy bet.
   */
  const insertCreatorStatement = database.prepare(`
    INSERT INTO bet_participants (
      bet_id,
      user_id,
      selected_option_id
    )
    VALUES (?, ?, ?)
  `);

  /**
   * Insert a backend-generated answer option.
   *
   * Position is zero-based and corresponds to the order
   * of the options submitted during bet creation.
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
   * Create the bet, answer options, and creator membership
   * in one atomic SQLite transaction.
   *
   * The options must be persisted before the creator membership
   * because selected_option_id references bet_options.id.
   *
   * A failed operation rolls back all associated inserts.
   */
  const createTransaction = database.transaction((bet) => {
    const {
      options = [],
      creator_selected_option_index: creatorOptionIndex,
      ...betRecord
    } = bet;

    // Step 1: Persist the basic bet record.
    insertBetStatement.run(betRecord);

    // Step 2: Generate and persist each answer option.
    // Keep the IDs in the same order as the original labels.
    const optionIDs = [];

    for (const [position, label] of options.entries()) {
      const optionID = randomUUID();

      insertOptionStatement.run(optionID, betRecord.id, label, position);

      optionIDs.push(optionID);
    }

    // Step 3: Resolve the creator's selected index to
    // the actual server-generated option identifier.
    const selectedOptionID =
      creatorOptionIndex === undefined ? null : optionIDs[creatorOptionIndex];

    // Defense in depth when the repository is called directly,
    // bypassing the service's Zod request validation.
    if (selectedOptionID === undefined) {
      throw new RangeError(
        "Creator selection must reference an existing answer option.",
      );
    }

    // Step 4: Insert the creator as participant #1 with
    // their actual answer, or NULL for legacy clients.
    insertCreatorStatement.run(
      betRecord.id,
      betRecord.creator_id,
      selectedOptionID,
    );

    // Step 5: Return the existing Create Bet response shape.
    return findByIdStatement.get(betRecord.id);
  });

  return {
    /**
     * Atomically create a bet and associated records.
     */
    createBet: (bet) => createTransaction(bet),

    /**
     * Retrieve one bet by its identifier.
     */
    findById: (id) => findByIdStatement.get(id),

    /**
     * List bets owned by the authenticated creator.
     */
    findByCreatorId: (userID) => findByCreatorStatement.all(userID),

    /**
     * List publicly discoverable bets without join codes.
     */
    findPublic: () => findPublicStatement.all(),

    /**
     * Find a bet using a case-insensitive invite code.
     */
    findByJoinCode: (joinCode) => findByCodeStatement.get(joinCode),

    /**
     * Retrieve answer options in their stored order.
     */
    findOptionsByBetId: (betID) => findOptionsByBetIdStatement.all(betID),

    /**
     * Determine whether an authenticated user is a participant.
     */
    isParticipant: (betID, userID) => {
      if (userID === undefined || userID === null) {
        return false;
      }

      return Boolean(participantExistsStatement.get(betID, userID));
    },

    /**
     * Retrieve participant records for an authorized viewer.
     */
    findParticipantsByBetId: (betID) =>
      findParticipantsByBetIdStatement.all(betID),
  };
}
