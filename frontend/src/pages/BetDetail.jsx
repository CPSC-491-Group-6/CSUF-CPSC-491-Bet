
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getBet, joinBet, lockBet } from "../services/betService";
import "../styles/BetDetail.css";

export default function BetDetail() {
  const { betId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const previewBet =
    String(location.state?.bet?.id) === String(betId)
      ? location.state.bet
      : null;

  const [bet, setBet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [locking, setLocking] = useState(false);
  const [usingPreview, setUsingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBet() {
      setLoading(true);
      setError("");
      setNotice("");
      setBet(null);
      setUsingPreview(false);

      try {
        const result = await getBet(betId);

        if (!cancelled) {
          setBet(result);
        }
      } catch (err) {
        if (!cancelled) {
          if (previewBet) {
            setBet(previewBet);
            setUsingPreview(true);
            setError(
              "Live bet details are unavailable. Showing preview data.",
            );
          } else {
            setError(err.message || "Unable to load bet details.");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBet();

    return () => {
      cancelled = true;
    };
  }, [betId, previewBet]);

  async function refreshBet() {
    const updated = await getBet(betId);
    setBet(updated);
    setUsingPreview(false);
    return updated;
  }

  async function handleJoin(event) {
    event.preventDefault();
    if (joining || locking || usingPreview) return;

    setError("");
    setNotice("");

    const code = inviteCode.trim();

    if (!code) {
      setError("Please enter an invite code.");
      return;
    }

    setJoining(true);

    try {
      await joinBet(code);
      try {
        await refreshBet();
        setNotice("You successfully joined this bet.");
      } catch {
        setNotice(
          "Join request succeeded, but the updated bet could not be loaded.",
        );
      }
      setInviteCode("");
    } catch (err) {
      setError(err.message || "Unable to join this bet.");
    } finally {
      setJoining(false);
    }
  }

  async function handleLock() {
    if (joining || locking || usingPreview) return;

    setError("");
    setNotice("");
    setLocking(true);

    try {
      await lockBet(betId);

      try {
        await refreshBet();
        setNotice("Bet locked successfully.");
      } catch {
        setNotice(
          "Lock request succeeded, but the updated bet could not be loaded.",
        );
      }
    } catch (err) {
      setError(err.message || "Unable to lock this bet.");
    } finally {
      setLocking(false);
    }
  }

  if (loading) {
    return (
      <main className="bet-detail-page">
        <p role="status">Loading bet details...</p>
      </main>
    );
  }

  if (!bet) {
    return (
      <main className="bet-detail-page">
        <h1>Bet Not Found</h1>
        <p role="alert">
          {error || "We could not find the requested bet."}
        </p>
        <button type="button" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
      </main>
    );
  }

  const participants = Array.isArray(bet.participants)
    ? bet.participants
    : [];

  const participantCount =
    typeof bet.current_participants === "number"
      ? bet.current_participants
      : participants.length;

  const maxParticipants = Number(bet.max_participants);

  const isFull =
    Number.isFinite(maxParticipants) &&
    participantCount >= maxParticipants;

  const status = String(bet.status || "unknown").toLowerCase();

  const displayStatus =
    status === "open" && isFull
      ? "Full"
      : status.charAt(0).toUpperCase() + status.slice(1);

  const creatorId = bet.creator_id ?? bet.created_by;
  const isCreator =
    user?.id != null &&
    creatorId != null &&
    String(user.id) === String(creatorId);

  const isParticipant = participants.some(
    (participant) =>
      user?.id != null &&
      String(participant.user_id ?? participant.id) ===
        String(user.id),
  );

  const canJoin =
    status === "open" &&
    !isFull &&
    !isCreator &&
    !isParticipant &&
    !usingPreview;

  const canLock =
    status === "open" && isCreator && !usingPreview;

  return (
    <main className="bet-detail-page">
      <button
        type="button"
        className="bet-back-button"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      {error && (
        <p className="bet-detail-error" role="alert">
          {error}
        </p>
      )}

      {notice && <p role="status">{notice}</p>}

      <section className="bet-detail-card">
        <div className="bet-detail-header">
          <h1>{bet.title}</h1>
          <span className="bet-detail-status">
            {displayStatus}
          </span>
        </div>

        <p className="bet-detail-description">
          {bet.description || "No description provided."}
        </p>

        <div className="bet-detail-info">
          <div>
            <h3>Participants</h3>
            <p>
              {participantCount} /{" "}
              {Number.isFinite(maxParticipants)
                ? maxParticipants
                : "N/A"}
            </p>
          </div>

          <div>
            <h3>Visibility</h3>
            <p>{bet.visibility || "Not specified"}</p>
          </div>

          <div>
            <h3>Bet Status</h3>
            <p>{displayStatus}</p>
          </div>
        </div>

        <h2>Participants</h2>

        {participants.length > 0 ? (
          <ul>
            {participants.map((participant, index) => (
              <li
                key={
                  participant.user_id ??
                  participant.id ??
                  index
                }
              >
                {participant.username ??
                  participant.name ??
                  "Participant"}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {usingPreview
              ? "Participant details are unavailable in preview mode."
              : "No participant details are available."}
          </p>
        )}

        {isCreator && (
          <p className="bet-detail-note">
            You are the creator of this bet.
          </p>
        )}
      </section>

      {status === "locked" && (
        <p className="bet-detail-note">
          This bet is locked and cannot accept new participants.
        </p>
      )}

      {status === "open" && isFull && (
        <p className="bet-detail-note">
          This bet has reached its participant limit.
        </p>
      )}

      {isParticipant && (
        <p className="bet-detail-note">
          You are already participating in this bet.
        </p>
      )}

      {canJoin && (
        <section className="bet-detail-card">
          <h2>Join Bet</h2>

          <form onSubmit={handleJoin}>
            <label htmlFor="betInviteCode">
              Invite Code
            </label>

            <input
              id="betInviteCode"
              type="text"
              value={inviteCode}
              onChange={(event) =>
                setInviteCode(event.target.value)
              }
              placeholder="Enter invite code"
              disabled={joining}
            />

            <button
              className="bet-join-button"
              type="submit"
              disabled={joining || locking}
            >
              {joining ? "Joining..." : "Join Bet"}
            </button>
          </form>
        </section>
      )}

      {canLock && (
        <section className="bet-detail-card">
          <h2>Manage Bet</h2>
          <p>
            Locking this bet will prevent additional users
            from joining.
          </p>

          <button
            className="bet-join-button"
            type="button"
            onClick={handleLock}
            disabled={locking || joining}
          >
            {locking ? "Locking..." : "Lock Bet"}
          </button>
        </section>
      )}

      {usingPreview && (
        <p className="bet-detail-note">
          Joining and locking are unavailable until live
          bet details can be retrieved.
        </p>
      )}
    </main>
  );
}
