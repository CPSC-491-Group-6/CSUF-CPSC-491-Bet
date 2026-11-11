import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CircleCheck,
  CircleDot,
  Globe2,
  KeyRound,
  LockKeyhole,
  Ticket,
  UserRound,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
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
  const [selectedOptionId, setSelectedOptionId] = useState("");
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
      setSelectedOptionId("");
      setUsingPreview(false);

      try {
        const result = await getBet(betId);
        if (!cancelled) setBet(result);
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
        if (!cancelled) setLoading(false);
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
    if (bet.options?.length > 0 && !selectedOptionId) {
      setError("Please select an answer before joining.");
      return;
    }
    setJoining(true);

    try {
      await joinBet(code, selectedOptionId || undefined);
      try {
        await refreshBet();
        setNotice("You successfully joined this bet.");
      } catch {
        setNotice(
          "Join succeeded, but updated bet details could not be loaded.",
        );
      }
      setInviteCode("");
      setSelectedOptionId("");
    } catch (err) {
      setError(err.message || "Unable to join this bet.");
    } finally {
      setJoining(false);
    }
  }

  async function handleLock() {
    if (joining || locking || usingPreview) return;
    if (!window.confirm("Are you sure you want to lock this bet?")) return;

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
        <div className="bet-detail-card bet-detail-message" role="status">
          Loading bet details...
        </div>
      </main>
    );
  }

  if (!bet) {
    return (
      <main className="bet-detail-page">
        <section className="bet-detail-card bet-detail-message">
          <h1>Bet Not Found</h1>
          <p role="alert">{error || "We could not find the requested bet."}</p>
          <button
            type="button"
            className="bet-join-button"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </button>
        </section>
      </main>
    );
  }

  const participants = Array.isArray(bet.participants) ? bet.participants : [];
  const options = Array.isArray(bet.options) ? bet.options : [];

  const optionById = new Map(
    options.map((option) => [String(option.id), option.label]),
  );
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
  const statusClass = `bet-detail-status--${displayStatus.toLowerCase()}`;

  const creatorId = bet.creator_id ?? bet.created_by;
  const currentUserId = user?.id ?? user?.userID;
  const isCreator =
    currentUserId != null &&
    creatorId != null &&
    String(currentUserId) === String(creatorId);
  const myParticipation = participants.find(
    (participant) =>
      currentUserId != null &&
      String(participant.user_id ?? participant.id) === String(currentUserId),
  );

  const isParticipant = Boolean(myParticipation) || bet.is_participant === true;
  const canSeeVotes = isCreator || isParticipant;

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
        <ArrowLeft size={17} aria-hidden="true" />
        Back
      </button>

      {error && (
        <p className="bet-detail-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="bet-detail-success">
          <CircleCheck size={18} aria-hidden="true" />
          {notice}
        </p>
      )}

      <section className="bet-detail-card">
        <div className="bet-detail-header">
          <div className="bet-detail-heading">
            <span className="bet-detail-title-icon" aria-hidden="true">
              <Ticket size={26} />
            </span>
            <h1>{bet.title}</h1>
          </div>
          <span className={`bet-detail-status ${statusClass}`}>
            {displayStatus}
          </span>
        </div>

        <p className="bet-detail-description">
          {bet.description || "No description provided."}
        </p>

        <div className="bet-detail-info">
          <div className="bet-detail-info-item">
            <UsersRound size={20} aria-hidden="true" />
            <div>
              <h3>Participants</h3>
              <p>
                {participantCount} /{" "}
                {Number.isFinite(maxParticipants) && maxParticipants > 0
                  ? maxParticipants
                  : "N/A"}
              </p>
            </div>
          </div>
          <div className="bet-detail-info-item">
            {isPublic ? (
              <Globe2 size={20} aria-hidden="true" />
            ) : (
              <LockKeyhole size={20} aria-hidden="true" />
            )}
            <div>
              <h3>Visibility</h3>
              <p>{isPublic ? "Public" : "Private"}</p>
            </div>
          </div>
          <div className="bet-detail-info-item">
            <CircleDot size={20} aria-hidden="true" />
            <div>
              <h3>Status</h3>
              <p>{displayStatus}</p>
            </div>
          </div>
        </div>

        {options.length > 0 && (
          <div className="bet-answer-section">
            <h2 className="bet-detail-section-title">Answer Choices</h2>

            <ul className="bet-answer-list">
              {options.map((option) => {
                const optionId = String(option.id);

                const selectedForJoin =
                  canJoin && selectedOptionId === optionId;

                const savedByMe =
                  myParticipation?.selected_option_id != null &&
                  String(myParticipation.selected_option_id) === optionId;

                const count = canSeeVotes
                  ? participants.filter(
                      (participant) =>
                        participant.selected_option_id != null &&
                        String(participant.selected_option_id) === optionId,
                    ).length
                  : 0;

                return (
                  <li
                    key={optionId}
                    className={`bet-answer-item ${
                      selectedForJoin || savedByMe
                        ? "bet-answer-item--selected"
                        : ""
                    }`}
                  >
                    {canJoin ? (
                      <label className="bet-answer-choice">
                        <input
                          type="radio"
                          name="bet-detail-selected-answer"
                          value={optionId}
                          checked={selectedForJoin}
                          onChange={() => setSelectedOptionId(optionId)}
                          disabled={joining || locking}
                        />
                        <span>{option.label}</span>
                      </label>
                    ) : (
                      <span>{option.label}</span>
                    )}

                    <span className="bet-answer-meta">
                      {savedByMe && (
                        <span className="bet-answer-marker">
                          <CircleCheck size={20} aria-hidden="true" />
                          Your Answer
                        </span>
                      )}

                      {canSeeVotes && (
                        <span className="bet-answer-count">
                          {count} {count === 1 ? "selection" : "selections"}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            {canJoin && (
              <p className="bet-detail-note">
                Select your answer above, then join the bet below. Your answer
                will be saved when you successfully join.
              </p>
            )}

            {myParticipation && !myParticipation.selected_option_id && (
              <p className="bet-detail-note">
                No answer was recorded for your participation.
              </p>
            )}
          </div>
        )}

        <h2 className="bet-detail-section-title">
          <UsersRound size={21} aria-hidden="true" />
          Participant List
        </h2>

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
                  <span className="bet-participant-identity">
                    <UserRound size={17} aria-hidden="true" />
                    {participantName}
                  </span>
                  <span className="bet-participant-meta">
                    {isParticipantCreator && (
                      <span className="bet-creator-label">Creator</span>
                    )}
                    {options.length > 0 && (
                      <span className="bet-participant-answer">
                        {participant.selected_option_id
                          ? (optionById.get(
                              String(participant.selected_option_id),
                            ) ?? "Unknown answer")
                          : "No answer recorded"}
                      </span>
                    )}
                  </span>
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
        <section className="bet-detail-card bet-detail-invite-card">
          <InviteCode inviteCode={betInviteCode} />
          {usingPreview && (
            <p className="bet-detail-note">
              Invite codes cannot be retrieved while viewing preview data.
            </p>
          )}
        </section>
      )}

      {status === "locked" && (
        <p className="bet-detail-note bet-detail-state-note">
          This bet is locked and cannot accept new participants.
        </p>
      )}
      {status === "open" && isFull && (
        <p className="bet-detail-note bet-detail-state-note">
          This bet has reached its participant limit.
        </p>
      )}

      {canJoin && (
        <section className="bet-detail-card">
          <h2 className="bet-detail-section-title">
            <UserRoundPlus size={21} aria-hidden="true" />
            Join Bet
          </h2>
          {isPublic ? (
            <>
              <p>
                This is a public bet. Anyone with an account can join while
                spots are available.
              </p>
              <p className="bet-detail-note" role="status">
                This page currently uses invite-code joining, including for
                public bets.
              </p>
              <h3>Join with Invite Code</h3>
              <p>If you have an invite code, you can still use it below.</p>
            </>
          ) : (
            <p>
              This is a private bet. A valid invite code is required to join.
            </p>
          )}
          <form className="bet-detail-join-form" onSubmit={handleJoin}>
            <label htmlFor="betInviteCode">
              <KeyRound size={17} aria-hidden="true" />
              Invite Code
            </label>
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
          <h2 className="bet-detail-section-title">
            <LockKeyhole size={21} aria-hidden="true" />
            Manage Bet
          </h2>
          <p>Locking this bet will prevent additional users from joining.</p>
          <button
            className="bet-join-button"
            type="button"
            onClick={handleLock}
            disabled={locking || joining}
          >
            <LockKeyhole size={18} aria-hidden="true" />
            {locking ? "Locking..." : "Lock Bet"}
          </button>
        </section>
      )}

      {usingPreview && (
        <p className="bet-detail-note bet-detail-state-note">
          Joining and locking are unavailable until live bet details can be
          retrieved.
        </p>
      )}
    </main>
  );
}
