// backend/src/repositories/createBetRepository.js

/**
 * Create prepared SQLite queries for the Bet API.
 * All participant counts come from bet_participants, never a cached bets field.
 * Injecting the connection keeps unit tests isolated from the live database.
 */
export function createBetRepository(database) {
  const projection = `
    b.*,
    (SELECT COUNT(*) FROM bet_participants AS bp WHERE bp.bet_id = b.id)
      AS current_participants
  `;

  const findByIdStatement = database.prepare(`
    SELECT ${projection} FROM bets AS b WHERE b.id = ?
  `);
  const findByCodeStatement = database.prepare(`
    SELECT ${projection} FROM bets AS b WHERE b.join_code = ? COLLATE NOCASE
  `);
  const findByCreatorStatement = database.prepare(`
    SELECT ${projection} FROM bets AS b
    WHERE b.creator_id = ?
    ORDER BY b.created_at DESC, b.id DESC
  `);
  // Never retrieve join_code when preparing data for publicly browsable bets.
  const findPublicStatement = database.prepare(`
    SELECT
      b.id, b.creator_id, b.title, b.description, b.status,
      b.visibility, b.max_participants, b.outcome_user_id,
      b.created_at, b.locked_at, b.resolved_at,
      (SELECT COUNT(*) FROM bet_participants AS bp WHERE bp.bet_id = b.id)
        AS current_participants
    FROM bets AS b
    WHERE b.visibility = 'public'
    ORDER BY b.created_at DESC, b.id DESC
  `);
  const insertBetStatement = database.prepare(`
    INSERT INTO bets (
      id, creator_id, title, description, join_code, visibility,
      max_participants
    ) VALUES (
      @id, @creator_id, @title, @description, @join_code, @visibility,
      @max_participants
    )
  `);
  const insertCreatorStatement = database.prepare(`
    INSERT INTO bet_participants (bet_id, user_id) VALUES (?, ?)
  `);

  // The creator occupies one participant slot; rollback both inserts together.
  const createTransaction = database.transaction((bet) => {
    insertBetStatement.run(bet);
    insertCreatorStatement.run(bet.id, bet.creator_id);
    return findByIdStatement.get(bet.id);
  });

  return {
    createBet: (bet) => createTransaction(bet),
    findById: (id) => findByIdStatement.get(id),
    findByCreatorId: (userID) => findByCreatorStatement.all(userID),
    findPublic: () => findPublicStatement.all(),
    findByJoinCode: (joinCode) => findByCodeStatement.get(joinCode),
  };
}
