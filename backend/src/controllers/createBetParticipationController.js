export function createBetParticipationController({ betService }) {
  return {
    /**
     * Join an eligible open bet.
     *
     * Authentication is enforced by the bet router.
     * The service validates the join request and applies business rules.
     */
    join(req, res) {
      const participation = betService.joinByCode(req.body, req.session.userID);

      return res.status(201).json({ participation });
    },

    /**
     * Lock an open bet.
     *
     * Only the bet creator is authorized to perform this transition.
     */
    lock(req, res) {
      const bet = betService.lockById(req.params.betId, req.session.userID);

      return res.status(200).json({ bet });
    },

    /**
     * Resolve a locked bet using its selected winning option.
     *
     * The service and repository enforce creator authorization,
     * outcome validity, and the locked-to-resolved transition.
     *
     * Winners are calculated from the persisted participant answers.
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
