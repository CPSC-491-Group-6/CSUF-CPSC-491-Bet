/**
 * Read-only participant history repository.
 *
 * Uses existing bets, bet_participants, and bet_options tables.
 * No new database migration or duplicate outcome storage is needed.
 */
export function createBetHistoryRepository(database) {
  const findHistoryStatement = database.prepare(`
    SELECT
      b.id,
      b.creator_id,
      b.title,
      b.description,
      b.status,
      b.visibility,
      b.max_participants,
      b.created_at,
      b.locked_at,
      b.resolved_at,
      b.winning_option_id,

      bp.joined_at,
      bp.selected_option_id,

      selected_option.label AS selected_option_label,
      winning_option.label AS winning_option_label,

      CASE
        WHEN b.creator_id = bp.user_id THEN 1
        ELSE 0
      END AS is_creator,

      CASE
        WHEN b.status <> 'resolved' THEN NULL
        WHEN bp.selected_option_id = b.winning_option_id THEN 1
        ELSE 0
      END AS is_winner,

      (
        SELECT COUNT(*)
        FROM bet_participants AS participants
        WHERE participants.bet_id = b.id
      ) AS current_participants

    FROM bet_participants AS bp

    INNER JOIN bets AS b
      ON b.id = bp.bet_id

    LEFT JOIN bet_options AS selected_option
      ON selected_option.bet_id = b.id
      AND selected_option.id = bp.selected_option_id

    LEFT JOIN bet_options AS winning_option
      ON winning_option.bet_id = b.id
      AND winning_option.id = b.winning_option_id

    WHERE bp.user_id = @userID
      AND (@status IS NULL OR b.status = @status)

    ORDER BY b.created_at DESC, b.id DESC
  `);

  /**
   * Return history for one authenticated participant.
   *
   * The user ID must come from the authenticated session.
   * Parameterized SQL prevents client-controlled query fragments.
   *
   * Join codes and other participants' answers are excluded.
   */
  function findHistoryByUserId(userID, status = null) {
    const rows = findHistoryStatement.all({
      userID,
      status,
    });

    return rows.map((row) => ({
      ...row,
      is_creator: Boolean(row.is_creator),
      is_winner: row.is_winner === null ? null : Boolean(row.is_winner),
    }));
  }

  return {
    findHistoryByUserId,
  };
}
