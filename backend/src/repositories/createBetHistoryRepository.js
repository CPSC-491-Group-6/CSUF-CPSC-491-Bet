/**
 * Read-only participant history repository.
 *
 * History is scoped to the authenticated participant.
 * Supports legacy, multiple-choice, and free-response bets.
 *
 * Join codes and other participants' predictions are not
 * included in the history response.
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
      b.answer_type,
      b.winning_option_id,
      b.resolution_text,

      bp.joined_at,
      bp.selected_option_id,
      bp.prediction_text,

      selected_option.label AS selected_option_label,
      winning_option.label AS winning_option_label,

      CASE
        WHEN b.creator_id = bp.user_id THEN 1
        ELSE 0
      END AS is_creator,

      CASE
        WHEN b.status <> 'resolved' THEN NULL
        WHEN b.answer_type = 'free_response' THEN
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM bet_winners AS bw
              WHERE bw.bet_id = b.id
                AND bw.user_id = bp.user_id
            )
            THEN 1
            ELSE 0
          END
        WHEN b.answer_type = 'multiple_choice' THEN
          CASE
            WHEN bp.selected_option_id = b.winning_option_id
            THEN 1
            ELSE 0
          END
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
   * Retrieve the winning participants for one resolved bet.
   *
   * Multiple-choice winners are derived from matching options.
   * Free-response winners are explicitly stored in bet_winners.
   *
   * This query is called only for bets already returned by the
   * authenticated user's history query.
   */
  const findWinningUserIDsStatement = database.prepare(`
    SELECT bp.user_id
    FROM bet_participants AS bp

    LEFT JOIN bet_winners AS bw
      ON bw.bet_id = bp.bet_id
      AND bw.user_id = bp.user_id

    WHERE bp.bet_id = @betID
      AND (
        (
          @answerType = 'multiple_choice'
          AND bp.selected_option_id = @winningOptionID
        )
        OR
        (
          @answerType = 'free_response'
          AND bw.user_id IS NOT NULL
        )
      )

    ORDER BY bp.user_id
  `);

  /**
   * Return history for one authenticated participant.
   *
   * The authenticated session supplies userID.
   * Status filtering and all SQL parameters are bound values.
   *
   * Winners are included only after resolution.
   * Other participants' predictions are never retrieved.
   */
  function findHistoryByUserId(userID, status = null) {
    const rows = findHistoryStatement.all({
      userID,
      status,
    });

    return rows.map((row) => {
      let winningUserIDs = [];

      // Resolved bets may have one, multiple, or zero winners.
      if (row.status === "resolved") {
        winningUserIDs = findWinningUserIDsStatement
          .all({
            betID: row.id,
            answerType: row.answer_type,
            winningOptionID: row.winning_option_id,
          })
          .map((winner) => winner.user_id);
      }

      return {
        ...row,

        // Preserve the established boolean response types.
        is_creator: Boolean(row.is_creator),

        is_winner: row.is_winner === null ? null : Boolean(row.is_winner),

        // Expose selected winners for the resolved bet.
        winning_user_ids: winningUserIDs,
      };
    });
  }

  return {
    findHistoryByUserId,
  };
}
