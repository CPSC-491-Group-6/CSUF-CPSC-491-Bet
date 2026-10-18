import { useLocation, useNavigate } from "react-router-dom";
import "../styles/BetDetail.css";

export default function BetDetail() {
  const navigate = useNavigate();
  const location = useLocation();

  const bet = location.state?.bet;

  // bet does not exist
  if (!bet) {
    return (
      <div className="bet-detail-page">
        <h1>Bet Not Found</h1>
        <p>We could not find the requested bet.</p>
        <button type="button" onClick={() => navigate("/join")}>
          Back to Join bet
        </button>
      </div>
    );
  }

  let displayStatus = "Open";

  if (bet.status === "locked") {
    displayStatus = "Locked";
  } else if (bet.status === "resolved") {
    displayStatus = "Resolved";
  } else if (bet.current_participants >= bet.max_participants) {
    displayStatus = "Full";
  }

  // check if user can join
  const canJoin =
    bet.status === "open" && bet.current_participants < bet.max_participants;

  return (
    <div className="bet-detail-page">
      <button
        type="button"
        className="bet-back-button"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <div className="bet-detail-card">
        <div className="bet-detail-header">
          <h1>{bet.title}</h1>
          <span className="bet-detail-status">{displayStatus}</span>
        </div>

        <p className="bet-detail-description">{bet.description}</p>

        <div className="bet-detail-info">
          <div>
            <h3>Participants</h3>
            <p>
              {bet.current_participants} / {bet.max_participants}
            </p>
          </div>

          <div>
            <h3>Visibility</h3>
            <p>{bet.visibility}</p>
          </div>

          <div>
            <h3>Bet Status</h3>
            <p>{displayStatus}</p>
          </div>
        </div>
      </div>

      {!canJoin && (
        <p className="bet-detail-error">
          {displayStatus === "Full"
            ? "This bet has reached its maximum number of participants"
            : displayStatus === "Locked"
              ? "This bet is locked and cannot accept new participants."
              : "This bet is not available for joining."}
        </p>
      )}

      <button className="bet-join-button" type="button" disabled>
        {canJoin ? "Join Bet (Coming Soon)" : "Joining Unavailable"}
      </button>

      {canJoin && (
        <p className="bet-detail-note">
          Joining will be available once the Join Bet API is implemented.
        </p>
      )}
    </div>
  );
}
