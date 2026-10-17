import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/JoinBet.css";

export default function JoinBet() {
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [selectedBet, setSelectedBet] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleJoin(event) {
    event.preventDefault();

    setError("");
    setSelectedBet(null);

    const code = joinCode.trim().toUpperCase();

    // empty join code
    if (!code) {
      setError("Please enter a join code!");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/bets/code/${encodeURIComponent(code)}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      // invalid or unknown join code
      if (response.status === 404) {
        setError("Invalid join code! Please enter a valid code.");
        return;
      }

      // expired or missing login session
      if (response.status === 401) {
        setError("Please log in to find a bet.");
        return;
      }

      // other backend errors
      if (!response.ok) {
        setError("Unable to find the bet. Please try again.");
        return;
      }

      // read the API response
      const data = await response.json();

      if (!data.bet) {
        setError("Bet information is unavailable.");
        return;
      }

      // store the bet returned by the backend
      setSelectedBet(data.bet);
    } catch (error) {
      console.error("Failed to find bet:", error);
      setError("Cannot connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function getBetDisplayStatus(bet) {
    if (bet.status === "resolved") {
      return "Resolved";
    }

    if (bet.status === "locked") {
      return "Locked";
    }

    if (bet.current_participants >= bet.max_participants) {
      return "Full";
    }

    return "Open";
  }

  function handleViewDetails() {
    if (selectedBet) {
      navigate(`/bets/${selectedBet.id}`, {
        state: { bet: selectedBet },
      });
    }
  }

  return (
    <div className="join-page">
      <div className="join-header">
        <h1>Join a bet</h1>
        <p>
          Have an invite code? Enter it below to find a bet and review its
          details.
        </p>
      </div>

      <div className="join-card">
        <form onSubmit={handleJoin}>
          <div>
            <label htmlFor="joinCode">Invite Code</label>

            <input
              id="joinCode"
              type="text"
              placeholder="Enter invite code (e.g. BET123)"
              value={joinCode}
              onChange={(event) => {
                setJoinCode(event.target.value);
                setError("");
                setSelectedBet(null);
              }}
            />
          </div>

          <button className="join-button" type="submit" disabled={loading}>
            {loading ? "Finding Bet..." : "Find Bet →"}
          </button>
        </form>

        {error && <p className="join-error">{error}</p>}
      </div>

      {selectedBet && (
        <div className="join-card bet-preview">
          <div className="bet-preview-header">
            <h2>Bet Found</h2>
            <span className="bet-status">
              {getBetDisplayStatus(selectedBet)}
            </span>
          </div>

          <h3>{selectedBet.title}</h3>

          <div className="bet-preview-info">
            <span>
              Participants: {selectedBet.current_participants} /{" "}
              {selectedBet.max_participants}
            </span>
            <span>{selectedBet.visibility}</span>
          </div>

          <button
            className="join-button"
            type="button"
            onClick={handleViewDetails}
          >
            View Bet Details →
          </button>
        </div>
      )}
    </div>
  );
}
