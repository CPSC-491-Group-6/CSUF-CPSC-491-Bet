export function createBetParticipationController({ betService }) {
  return {
    // The router has already verified the user session.
    join(req, res) {
      const participation = betService.joinByCode(req.body, req.session.userID);

      return res.status(201).json({ participation });
    },

    lock(req, res) {
      const bet = betService.lockById(req.params.betId, req.session.userID);

      return res.status(200).json({ bet });
    },
  };
}
