export function createBetParticipationController({ betService }) {
  return {
    /**
     * Join an eligible open bet.
     *
     * Authentication is enforced by the bet router.
     * The existing service validates the join request,
     * permissions, capacity, and optional answer choice.
     */
    join(req, res) {
      // The service atomically records participant membership.
      const participation = betService.joinByCode(req.body, req.session.userID);

      // Retrieve the updated bet after the membership is saved.
      // The participant is now authorized to view private details.
      const bet = betService.getBetById(
        participation.bet_id,
        req.session.userID,
      );

      // Preserve the original participation response while
      // supplying the bet object expected by the frontend.
      return res.status(201).json({
        participation,
        bet,
      });
    },

    /**
     * Lock an open bet.
     *
     * Only the creator may perform this transition.
     * Existing transaction and authorization behavior is retained.
     */
    lock(req, res) {
      const bet = betService.lockById(req.params.betId, req.session.userID);

      return res.status(200).json({ bet });
    },

    /**
     * Resolve a locked bet using a stored winning option.
     *
     * The service and repository enforce creator authorization,
     * outcome validity, and locked-to-resolved transition rules.
     *
     * Winners are calculated from stored participant answers.
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
