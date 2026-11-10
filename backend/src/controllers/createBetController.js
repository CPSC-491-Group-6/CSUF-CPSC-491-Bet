export function createBetController({ betService }) {
  return {
    /**
     * Create a bet using the authenticated session.
     */
    create(req, res) {
      const bet = betService.createBet(req.body, req.session.userID);

      return res.status(201).json({ bet });
    },

    /**
     * List bets created by the current user.
     */
    listMine(req, res) {
      return res.status(200).json({
        bets: betService.listMine(req.session.userID),
      });
    },

    /**
     * Return publicly discoverable bets.
     */
    listPublic(req, res) {
      return res.status(200).json({
        bets: betService.listPublic(),
      });
    },

    /**
     * Look up a bet by its invite code.
     *
     * Pass the authenticated identity so the service
     * can report membership without exposing private
     * participant information.
     */
    findByCode(req, res) {
      const bet = betService.findByCode(
        req.params.joinCode,
        req.session.userID,
      );

      return res.status(200).json({ bet });
    },

    /**
     * Return one bet with authorized detail fields.
     */
    getById(req, res) {
      const bet = betService.getBetById(req.params.betId, req.session.userID);

      return res.status(200).json({ bet });
    },
  };
}
