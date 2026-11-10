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

  // Public discovery must not expose private join codes.
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
   * Load the available answer choices for a bet.
   *
   * Access control is performed by the calling service before
   * constructing a Bet Detail response.
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
   * Check whether an authenticated user already belongs to a bet.
   *
   * This supports authorization for private bet details
   * without modifying participation records.
   */
  const participantExistsStatement = database.prepare(`
    SELECT 1
    FROM bet_participants
    WHERE bet_id = ?
      AND user_id = ?
    LIMIT 1
  `);

  /**
   * Load participant details for authorized viewers.
   *
   * Never return passwords, email addresses, or session data.
   * The username is sufficient for the frontend participant list.
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
   * A bet's creator is its first participant.
   *
   * This must remain inside the same transaction as bet creation.
   */
  const insertCreatorStatement = database.prepare(`
    INSERT INTO bet_participants (
      bet_id,
      user_id
    )
    VALUES (?, ?)
  `);

  /**
   * Store a server-generated answer option.
   *
   * Position starts at zero and follows the submitted label order.
   * The database enforces unique option IDs, positions, and labels.
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
   * Create a bet, its creator membership, and its answer choices
   * as one atomic SQLite transaction.
   *
   * Any failed insert rolls back the entire operation.
   */
  const createTransaction = database.transaction((bet) => {
    const { options = [], ...betRecord } = bet;

    // Persist the basic bet record first.
    insertBetStatement.run(betRecord);

    // Preserve the creator-as-participant behavior.
    insertCreatorStatement.run(betRecord.id, betRecord.creator_id);

    // Generate option identifiers on the server.
    for (const [position, label] of options.entries()) {
      insertOptionStatement.run(randomUUID(), betRecord.id, label, position);
    }

    // Preserve the existing Create Bet response shape.
    return findByIdStatement.get(betRecord.id);
  });

  return {
    /**
     * Create a bet and all associated records.
     */
    createBet: (bet) => createTransaction(bet),

    /**
     * Find one stored bet by its identifier.
     */
    findById: (id) => findByIdStatement.get(id),

    /**
     * List bets belonging to one creator.
     */
    findByCreatorId: (userID) => findByCreatorStatement.all(userID),

    /**
     * List public bets without their join codes.
     */
    findPublic: () => findPublicStatement.all(),

    /**
     * Find a bet using its case-insensitive join code.
     */
    findByJoinCode: (joinCode) => findByCodeStatement.get(joinCode),

    /**
     * Return the available outcome options.
     */
    findOptionsByBetId: (betID) => findOptionsByBetIdStatement.all(betID),

    /**
     * Check whether an authenticated user belongs to the bet.
     */
    isParticipant: (betID, userID) => {
      if (userID === undefined || userID === null) {
        return false;
      }

      return Boolean(participantExistsStatement.get(betID, userID));
    },

    /**
     * Retrieve participants for a service-authorized bet.
     */
    findParticipantsByBetId: (betID) =>
      findParticipantsByBetIdStatement.all(betID),
  };
}
