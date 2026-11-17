export function createBetParticipationController({ betService }) {
  return {
    /**
     * Join a bet using its invitation code.
     *
     * The authenticated session determines participant identity.
     */
    join(req, res) {
      const participation = betService.joinByCode(req.body, req.session.userID);

      const bet = betService.getBetById(
        participation.bet_id,
        req.session.userID,
      );

      return res.status(201).json({
        participation,
        bet,
      });
    },

    /**
     * Join a public bet directly without an invitation code.
     */
    joinPublic(req, res) {
      const participation = betService.joinPublicById(
        req.params.betId,
        req.body,
        req.session.userID,
      );

      const bet = betService.getBetById(
        participation.bet_id,
        req.session.userID,
      );

      return res.status(201).json({
        participation,
        bet,
      });
    },

    /**
     * Lock an open bet.
     */
    lock(req, res) {
      const bet = betService.lockById(req.params.betId, req.session.userID);

      return res.status(200).json({ bet });
    },

    /**
     * Reopen a locked bet while preserving participants.
     */
    unlock(req, res) {
      const bet = betService.unlockById(req.params.betId, req.session.userID);

      return res.status(200).json({ bet });
    },

    /**
     * Resolve a locked bet with its final outcome and winners.
     */
    resolve(req, res) {
      const result = betService.resolveById(
        req.params.betId,
        req.body,
        req.session.userID,
      );

      return res.status(200).json(result);
    },
  };
}
