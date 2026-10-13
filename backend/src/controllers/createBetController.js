// backend/src/controllers/createBetController.js

/** Keep HTTP/response handling separate from input validation and SQLite. */
export function createBetController({ betService }) {
  return {
    // Ownership is always derived from the authenticated server-side session.
    create(req, res) {
      const bet = betService.createBet(req.body, req.session.userID);
      return res.status(201).json({ bet });
    },
    listMine(req, res) {
      return res.status(200).json({
        bets: betService.listMine(req.session.userID),
      });
    },
    listPublic(req, res) {
      return res.status(200).json({ bets: betService.listPublic() });
    },
    findByCode(req, res) {
      return res.status(200).json({
        bet: betService.findByCode(req.params.joinCode),
      });
    },
  };
}
