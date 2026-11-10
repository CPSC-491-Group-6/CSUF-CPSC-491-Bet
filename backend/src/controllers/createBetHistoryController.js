/**
 * HTTP controller for authenticated participant history.
 *
 * Authentication is enforced by the existing Bet router.
 */
export function createBetHistoryController({ betService }) {
  return {
    /**
     * Return the current user's history using validated query filters.
     *
     * Response format:
     * {
     *   bets: [...]
     * }
     */
    list(req, res) {
      const bets = betService.listHistory(req.session.userID, req.query);

      return res.status(200).json({ bets });
    },
  };
}
