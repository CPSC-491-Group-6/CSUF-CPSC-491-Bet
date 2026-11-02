import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import InviteCode from "../components/InviteCode";
import { useAuth } from "../context/useAuth";
import { getBet, joinBet, lockBet } from "../services/betService";
import "../styles/BetDetail.css";

export default function BetDetail() {
  const { betId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

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
          const preview = location.state?.bet;

          if (preview && String(preview.id) === String(betId)) {
            setBet(preview);
            setUsingPreview(true);
            setError("Live bet details are unavailable. Showing preview data.");
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
  }, [betId, location.state]);

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
          "Join succeeded, but updated bet details could not be loaded.",
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

    if (!window.confirm("Are you sure you want to lock this bet?")) {
      return;
    }

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
          "Lock request succeeded, but the latest bet status could not be loaded.",
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
        <p role="alert">{error || "We could not find the requested bet."}</p>
        <button type="button" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
      </main>
    );
  }

  const participants = Array.isArray(bet.participants) ? bet.participants : [];

  const participantCount =
    typeof bet.current_participants === "number"
      ? bet.current_participants
      : participants.length;

  const maxParticipants = Number(bet.max_participants);

  const isFull =
    Number.isFinite(maxParticipants) &&
    maxParticipants > 0 &&
    participantCount >= maxParticipants;

  const status = String(bet.status || "unknown").toLowerCase();

  const visibility = String(bet.visibility || "private").toLowerCase();

  const isPublic = visibility === "public";

  const displayStatus =
    status === "open" && isFull
      ? "Full"
      : status.charAt(0).toUpperCase() + status.slice(1);

  const creatorId = bet.creator_id ?? bet.created_by;

  const isCreator =
    (user?.id ?? user?.userID) != null &&
    creatorId != null &&
    String(user.id ?? user.userID) === String(creatorId);

  const isParticipant = participants.some(
    (participant) =>
      (user?.id ?? user?.userID) != null &&
      String(participant.user_id ?? participant.id) ===
        String(user.id ?? user.userID),
  );

  const canJoin =
    status === "open" &&
    !isFull &&
    !isCreator &&
    !isParticipant &&
    !usingPreview;

  const canLock = status === "open" && isCreator && !usingPreview;

  const betInviteCode =
    isCreator && !usingPreview
      ? (bet.join_code ?? bet.invite_code ?? bet.inviteCode ?? "")
      : "";

  const showInviteSection = isCreator || usingPreview;

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

      {notice && (
        <p role="status" className="bet-detail-note">
          {notice}
        </p>
      )}

      <section className="bet-detail-card">
        <div className="bet-detail-header">
          <h1>{bet.title}</h1>
          <span className="bet-detail-status">{displayStatus}</span>
        </div>

        <p className="bet-detail-description">
          {bet.description || "No description provided."}
        </p>

        <div className="bet-detail-info">
          <div>
            <h3>Participants</h3>
            <p>
              {participantCount} /{" "}
              {Number.isFinite(maxParticipants) && maxParticipants > 0
                ? maxParticipants
                : "N/A"}
            </p>
          </div>

          <div>
            <h3>Visibility</h3>
            <p>{isPublic ? "Public" : "Private"}</p>
          </div>

          <div>
            <h3>Status</h3>
            <p>{displayStatus}</p>
          </div>
        </div>

        <h2>Participant List</h2>

        {participants.length > 0 ? (
          <ul className="bet-participant-list">
            {participants.map((participant, index) => {
              const participantId = participant.user_id ?? participant.id;

              const participantName =
                participant.username ??
                participant.name ??
                `Participant ${index + 1}`;

              const isParticipantCreator =
                creatorId != null &&
                participantId != null &&
                String(participantId) === String(creatorId);

              return (
                <li
                  key={participantId ?? index}
                  className="bet-participant-item"
                >
                  <span>{participantName}</span>

                  {isParticipantCreator && (
                    <span className="bet-creator-label">Creator</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="bet-detail-note">
            {usingPreview
              ? "Participant details are unavailable in preview mode."
              : participantCount > 0
                ? "Participant names are not available."
                : "No participants yet."}
          </p>
        )}

        {isCreator && (
          <p className="bet-detail-note">You are the creator of this bet.</p>
        )}

        {isParticipant && !isCreator && (
          <p className="bet-detail-note">You are participating in this bet.</p>
        )}
      </section>

      {showInviteSection && (
        <section className="bet-detail-card">
          <InviteCode inviteCode={betInviteCode} />

          {usingPreview && (
            <p className="bet-detail-note">
              Invite codes cannot be retrieved while viewing preview data.
            </p>
          )}
        </section>
      )}

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

      {canJoin && (
        <section className="bet-detail-card">
          <h2>Join Bet</h2>

          {isPublic ? (
            <>
              <p>
                This is a public bet. Anyone with an account can join while
                spots are available.
              </p>

              <p className="bet-detail-note" role="status">
                Direct joining for public bets is awaiting backend support.
              </p>

              <h3>Join with Invite Code</h3>
              <p>If you have an invite code, you can still use it below.</p>
            </>
          ) : (
            <p>
              This is a private bet. A valid invite code is required to join.
            </p>
          )}

          <form onSubmit={handleJoin}>
            <label htmlFor="betInviteCode">Invite Code</label>

            <input
              id="betInviteCode"
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Enter invite code"
              disabled={joining || locking}
              autoComplete="off"
            />

            <button
              className="bet-join-button"
              type="submit"
              disabled={joining || locking}
            >
              {joining ? "Joining..." : "Join with Invite Code"}
            </button>
          </form>
        </section>
      )}

      {canLock && (
        <section className="bet-detail-card">
          <h2>Manage Bet</h2>

          <p>Locking this bet will prevent additional users from joining.</p>

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
          Joining and locking are unavailable until live bet details can be
          retrieved.
        </p>
      )}
    </main>
  );
}
