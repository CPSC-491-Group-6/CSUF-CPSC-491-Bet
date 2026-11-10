export function createBetParticipationController({ betService }) {
  return {
    /**
     * Existing invite-code joining.
     *
     * The backend derives the user ID from the authenticated session
     * and uses the atomic participation transaction.
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
     * New public joining endpoint.
     *
     * Public visibility and membership eligibility are enforced
     * by the service and repository, not the client.
     */
    joinPublic(req, res) {
      const participation = betService.joinPublicById(
        req.params.betId,
        req.body,
        req.session.userID,
      );

      // Fetch the complete authorized bet after the join commits.
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
     * Preserve existing creator-only bet locking.
     */
    lock(req, res) {
      const bet = betService.lockById(req.params.betId, req.session.userID);

      return res.status(200).json({ bet });
    },

    /**
     * Preserve the existing Resolve Bet contract.
     *
     * Resolution authorization and winner calculation
     * remain inside the resolution service.
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
