import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { joinBet } from "../services/betService";
import "../styles/JoinBet.css";

export default function JoinBet() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [joinCode, setJoinCode] = useState("");
  const [selectedBet, setSelectedBet] = useState(null);
  const [selectedOptionID, setSelectedOptionID] = useState("");

  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Authentication currently identifies users by userID.
  // Retain id as a compatibility fallback.
  const currentUserID = user?.userID ?? user?.id;

  const normalizedCode = joinCode.trim().toUpperCase();

  /**
   * Look up an invitation code and display a preview.
   *
   * Do not join automatically: users must first review
   * the bet and select an answer when required.
   */
  async function handleFindBet(event) {
    event.preventDefault();

    if (loading || joining) return;

    setError("");
    setSuccess("");
    setSelectedBet(null);
    setSelectedOptionID("");

    if (!normalizedCode) {
      setError("Please enter an invite code.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/bets/code/${encodeURIComponent(normalizedCode)}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (response.status === 404) {
        setError("Invalid invite code. Please try again.");
        return;
      }

      if (response.status === 401) {
        setError("Please log in to find a bet.");
        return;
      }

      if (!response.ok) {
        setError("Unable to find the bet. Please try again.");
        return;
      }

      const data = await response.json();

      if (!data?.bet || data.bet.id == null) {
        setError("Bet information is unavailable.");
        return;
      }

      setSelectedBet(data.bet);
    } catch {
      setError("Cannot connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Submit the Join Bet request.
   *
   * The existing backend validates capacity, membership,
   * bet status, and selected answer in one transaction.
   */
  async function handleJoinBet() {
    if (!selectedBet || joining || loading) return;

    setError("");
    setSuccess("");

    if (!canJoin(selectedBet)) {
      setError("This bet is not available to join.");
      return;
    }

    const options = Array.isArray(selectedBet.options)
      ? selectedBet.options
      : [];

    if (options.length > 0 && !selectedOptionID) {
      setError("Please select an answer before joining.");
      return;
    }

    setJoining(true);

    try {
      const joinedBet = await joinBet(
        normalizedCode,
        selectedOptionID || undefined,
      );

      const betId = joinedBet?.id ?? selectedBet.id;

      setSuccess("You successfully joined this bet.");

      // Open the updated bet details after membership is saved.
      navigate(`/bets/${encodeURIComponent(betId)}`, {
        state: {
          bet: joinedBet ?? selectedBet,
        },
      });
    } catch (err) {
      setError(err.message || "Unable to join this bet.");
    } finally {
      setJoining(false);
    }
  }

  /**
   * Convert the persisted state and participant capacity
   * into the label displayed in the preview.
   */
  function getBetDisplayStatus(bet) {
    const status = String(bet.status || "").toLowerCase();

    if (status === "resolved") return "Resolved";
    if (status === "locked") return "Locked";

    if (status !== "open" && status !== "active") {
      return status || "Unknown";
    }

    if (
      bet.max_participants != null &&
      Number(bet.current_participants) >= Number(bet.max_participants)
    ) {
      return "Full";
    }

    return "Open";
  }

  /**
   * Check whether the authenticated user created this bet.
   */
  function isCreator(bet) {
    const creatorID = bet.creator_id ?? bet.created_by;

    return (
      currentUserID != null &&
      creatorID != null &&
      String(currentUserID) === String(creatorID)
    );
  }

  /**
   * Detect existing membership.
   *
   * Invite-code previews use the backend is_participant
   * flag rather than exposing the private participant list.
   */
  function isParticipant(bet) {
    if (bet.is_participant === true) {
      return true;
    }

    if (!Array.isArray(bet.participants)) {
      return false;
    }

    return bet.participants.some(
      (participant) =>
        currentUserID != null &&
        String(participant.user_id ?? participant.id) === String(currentUserID),
    );
  }

  /**
   * The UI performs eligibility checks for user feedback.
   * The backend remains responsible for final enforcement.
   */
  function canJoin(bet) {
    return (
      getBetDisplayStatus(bet) === "Open" &&
      !isCreator(bet) &&
      !isParticipant(bet)
    );
  }

  /**
   * Explain why a discovered bet cannot be joined.
   */
  function getJoinMessage(bet) {
    const status = getBetDisplayStatus(bet);

    if (status === "Locked") {
      return "This bet is locked and cannot accept new participants.";
    }

    if (status === "Resolved") {
      return "This bet has already been resolved.";
    }

    if (status === "Full") {
      return "This bet has reached its participant limit.";
    }

    if (isCreator(bet)) {
      return "You are the creator of this bet.";
    }

    if (isParticipant(bet)) {
      return "You are already participating in this bet.";
    }

    if (status !== "Open") {
      return "This bet is not currently accepting participants.";
    }

    return "";
  }

  /**
   * Navigate to the detail page without modifying membership.
   */
  function handleViewDetails() {
    if (!selectedBet) return;

    navigate(`/bets/${encodeURIComponent(selectedBet.id)}`, {
      state: {
        bet: selectedBet,
      },
    });
  }

  const options = Array.isArray(selectedBet?.options)
    ? selectedBet.options
    : [];

  return (
    <main className="join-page">
      <div className="join-header">
        <h1>Join a Bet</h1>
        <p>
          Enter an invite code to find a bet, review its details, and join if
          eligible.
        </p>
      </div>

      <div className="join-card">
        <form onSubmit={handleFindBet}>
          <div>
            <label htmlFor="joinCode">Invite Code</label>
            <input
              id="joinCode"
              type="text"
              placeholder="Enter invite code (e.g. BET123)"
              value={joinCode}
              onChange={(event) => {
                setJoinCode(event.target.value);
                setSelectedBet(null);
                setSelectedOptionID("");
                setError("");
                setSuccess("");
              }}
              disabled={loading || joining}
              autoComplete="off"
            />
          </div>

          <button
            className="join-button"
            type="submit"
            disabled={loading || joining}
          >
            {loading ? "Finding Bet..." : "Find Bet"}
          </button>
        </form>

        {error && (
          <p className="join-error" role="alert">
            {error}
          </p>
        )}

        {success && <p role="status">{success}</p>}
      </div>

      {selectedBet && (
        <section className="join-card bet-preview">
          <div className="bet-preview-header">
            <h2>Bet Found</h2>

            <span className="bet-status">
              {getBetDisplayStatus(selectedBet)}
            </span>
          </div>

          <h3>{selectedBet.title}</h3>

          <p>{selectedBet.description || "No description provided."}</p>

          <div className="bet-preview-info">
            <span>
              Participants: {selectedBet.current_participants ?? 0} /{" "}
              {selectedBet.max_participants ?? "N/A"}
            </span>

            <span>{selectedBet.visibility || "Private"}</span>
          </div>

          {getJoinMessage(selectedBet) && (
            <p role="status">{getJoinMessage(selectedBet)}</p>
          )}

          {/* Require a choice only when this bet has options. */}
          {canJoin(selectedBet) && options.length > 0 && (
            <fieldset disabled={joining || loading}>
              <legend>Select Your Answer</legend>

              <p>Choose one answer before joining this bet.</p>

              {options.map((option) => (
                <div key={option.id}>
                  <label>
                    <input
                      type="radio"
                      name="selectedOptionID"
                      value={option.id}
                      checked={selectedOptionID === option.id}
                      onChange={() => setSelectedOptionID(option.id)}
                    />{" "}
                    {option.label}
                  </label>
                </div>
              ))}
            </fieldset>
          )}

          {canJoin(selectedBet) && (
            <button
              className="join-button"
              type="button"
              onClick={handleJoinBet}
              disabled={joining || loading}
            >
              {joining ? "Joining..." : "Join Bet"}
            </button>
          )}

          <button
            className="join-button"
            type="button"
            onClick={handleViewDetails}
            disabled={joining || loading}
          >
            View Bet Details
          </button>
        </section>
      )}
    </main>
  );
}
