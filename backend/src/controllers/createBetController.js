export function createBetController({ betService }) {
  return {
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
      return res.status(200).json({
        bets: betService.listPublic(),
      });
    },

    findByCode(req, res) {
      return res.status(200).json({
        bet: betService.findByCode(req.params.joinCode),
      });
    },

    // Sprint 4 - Get individual bet details.
    getById(req, res) {
      const bet = betService.getBetById(req.params.betId, req.session.userID);

      return res.status(200).json({ bet });
    },
  };
}
