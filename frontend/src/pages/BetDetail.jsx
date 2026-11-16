import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CircleCheck,
  CircleDot,
  Globe2,
  KeyRound,
  LockKeyhole,
  LockOpen,
  Ticket,
  Trophy,
  UserRound,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import InviteCode from "../components/InviteCode";
import { useAuth } from "../context/useAuth";
import { FREE_RESPONSE_JOIN_ENABLED } from "../config/freeResponse";
import { BET_UNLOCK_ENABLED } from "../config/betUnlock";
import { getBet, joinBet, lockBet, unlockBet } from "../services/betService";
import "../styles/BetDetail.css";
import ResolveBet from "../components/ResolveBet";
import FreeResponseResolve from "../components/FreeResponseResolve";
import { resolveBet, resolveFreeResponseBet } from "../services/betService";

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
  const [predictionText, setPredictionText] = useState("");
  const [joining, setJoining] = useState(false);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [usingPreview, setUsingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBet() {
      setLoading(true);
      setError("");
      setNotice("");
      setBet(null);
      setSelectedOptionId("");
      setPredictionText("");
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
    if (!bet.options?.length) {
      if (!predictionText.trim()) {
        setError("Please enter your prediction before joining.");
        return;
      }
      if (!FREE_RESPONSE_JOIN_ENABLED) {
        setError("Free-response joining requires backend support.");
        return;
      }
    }
    setJoining(true);

    try {
      if (bet.options?.length > 0) {
        await joinBet(code, selectedOptionId);
      } else {
        await joinBet(code, undefined, predictionText.trim());
      }
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
      setPredictionText("");
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

  async function handleUnlock() {
    // Backend feature flag is a rollout guard, not a security boundary.
    // The backend must independently enforce creator-only authorization.
    if (joining || locking || unlocking || usingPreview || !BET_UNLOCK_ENABLED)
      return;
    if (
      !window.confirm(
        "Unlock this bet? Participants will be able to join again.",
      )
    )
      return;

    setError("");
    setNotice("");
    setUnlocking(true);

    try {
      const updated = await unlockBet(betId);
      if (String(updated?.status).toLowerCase() !== "open") {
        throw new Error("The server did not confirm that this bet is open.");
      }
      // Use the server-confirmed response, never an optimistic state change.
      setBet((previous) => ({ ...previous, ...updated }));
      try {
        await refreshBet();
        setNotice("Bet unlocked successfully.");
      } catch {
        setNotice(
          "Unlock succeeded, but the latest bet details could not be loaded.",
        );
      }
    } catch (err) {
      setError(err.message || "Unable to unlock this bet.");
    } finally {
      setUnlocking(false);
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
  // A multiple-choice winner is anyone whose saved prediction matches
  // the server-confirmed winning option. Never infer winners before resolution.
  const multipleChoiceWinners =
    status === "resolved" && options.length > 0 && bet.winning_option_id != null
      ? participants.filter(
          (participant) =>
            participant.selected_option_id != null &&
            String(participant.selected_option_id) ===
              String(bet.winning_option_id),
        )
      : [];
  const winnerDataIncomplete =
    participantCount > participants.length ||
    participants.some((participant) => participant.selected_option_id == null);
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
  const canUnlock = status === "locked" && isCreator && !usingPreview;
  const betInviteCode =
    isCreator && !usingPreview
      ? (bet.join_code ?? bet.invite_code ?? bet.inviteCode ?? "")
      : "";
  const showInviteSection = isCreator || usingPreview;

  async function handleResolve(winningOptionId) {
    setError("");
    setNotice("");

    // Submit the selected winning outcome.
    const result = await resolveBet(betId, winningOptionId);

    // The backend has successfully resolved the bet.
    // Update local state immediately.
    setBet((previous) => ({
      ...previous,
      ...result.bet,
      options: result.bet?.options ?? previous?.options ?? [],
      participants: result.bet?.participants ?? previous?.participants ?? [],
    }));

    setNotice("Bet resolved successfully.");

    // Attempt to retrieve the latest details.
    try {
      await refreshBet();
    } catch {
      setNotice(
        "Bet resolved successfully, but the latest details could not be loaded.",
      );
    }

    return result;
  }

  async function handleFreeResponseResolve({ resolutionText, winningUserIds }) {
    setError("");
    setNotice("");

    const result = await resolveFreeResponseBet(betId, {
      resolution_text: resolutionText,
      winning_user_ids: winningUserIds,
    });

    // Only accept a confirmed resolved state returned by the server.
    setBet((previous) => ({
      ...previous,
      ...result.bet,
      options: result.bet.options ?? previous.options ?? [],
      participants: result.bet.participants ?? previous.participants ?? [],
    }));
    setNotice("Bet resolved successfully.");
    try {
      await refreshBet();
    } catch {
      setNotice(
        "Bet resolved successfully, but the latest details could not be loaded.",
      );
    }
    return result;
  }

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
                    {options.length === 0 &&
                      typeof participant.prediction_text === "string" &&
                      (status === "resolved" ||
                        (status === "locked" && isCreator) ||
                        String(participantId) === String(currentUserId)) && (
                        <span className="bet-participant-answer">
                          {participant.prediction_text}
                        </span>
                      )}
                    {status === "resolved" &&
                      options.length === 0 &&
                      Array.isArray(bet.winning_user_ids) &&
                      bet.winning_user_ids.some(
                        (id) => String(id) === String(participantId),
                      ) && (
                        <span className="bet-participant-winner">Winner</span>
                      )}
                    {status === "resolved" &&
                      options.length > 0 &&
                      bet.winning_option_id != null &&
                      participant.selected_option_id != null &&
                      String(participant.selected_option_id) ===
                        String(bet.winning_option_id) && (
                        <span className="bet-participant-winner">Winner</span>
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
            {options.length === 0 && (
              <div className="bet-join-prediction">
                <label htmlFor="detailPrediction">Your Prediction</label>
                <textarea
                  id="detailPrediction"
                  rows={3}
                  maxLength={500}
                  value={predictionText}
                  onChange={(event) => setPredictionText(event.target.value)}
                  placeholder="Enter your prediction"
                  disabled={joining || locking}
                />
                {!FREE_RESPONSE_JOIN_ENABLED && (
                  <p className="bet-detail-note" role="status">
                    Free-response joining requires backend support before
                    answers can be saved.
                  </p>
                )}
              </div>
            )}
            <button
              className="bet-join-button"
              type="submit"
              disabled={
                joining ||
                locking ||
                (options.length === 0 && !FREE_RESPONSE_JOIN_ENABLED)
              }
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

      {canUnlock && (
        <section className="bet-detail-card">
          <h2 className="bet-detail-section-title">
            <LockOpen size={21} aria-hidden="true" />
            Manage Bet
          </h2>
          <p>
            Unlocking will reopen this bet for additional participants. Existing
            predictions will be preserved.
          </p>
          <button
            className="bet-join-button"
            type="button"
            onClick={handleUnlock}
            disabled={unlocking || joining || locking || !BET_UNLOCK_ENABLED}
          >
            <LockOpen size={18} aria-hidden="true" />
            {unlocking ? "Unlocking..." : "Unlock Bet"}
          </button>
          {!BET_UNLOCK_ENABLED && (
            <p className="bet-detail-note" role="status">
              Unlocking requires backend support and is not available yet.
            </p>
          )}
        </section>
      )}

      {usingPreview && (
        <p className="bet-detail-note bet-detail-state-note">
          Joining and locking are unavailable until live bet details can be
          retrieved.
        </p>
      )}

      {!usingPreview &&
        (options.length > 0 ? (
          <ResolveBet
            bet={bet}
            currentUserId={user?.id ?? user?.userID}
            onResolve={handleResolve}
          />
        ) : (
          <FreeResponseResolve
            key={bet.id}
            bet={bet}
            currentUserId={user?.id ?? user?.userID}
            onResolve={handleFreeResponseResolve}
          />
        ))}

      {status === "resolved" && options.length === 0 && (
        <section className="bet-detail-card winning-outcome-card">
          <h2>Final Result</h2>
          <p className="winning-outcome-answer">
            {typeof bet.resolution_text === "string" &&
            bet.resolution_text.trim()
              ? bet.resolution_text
              : "Final outcome details are unavailable."}
          </p>
          {Array.isArray(bet.winning_user_ids) ? (
            <p>
              {bet.winning_user_ids.length === 0
                ? "No participants won this bet."
                : `${bet.winning_user_ids.length} winning participant(s).`}
            </p>
          ) : (
            <p>Winner details are unavailable.</p>
          )}
        </section>
      )}

      {status === "resolved" && bet.winning_option_id && (
        <section className="bet-detail-card winning-outcome-card">
          <div className="winning-outcome-header">
            <div className="winning-outcome-heading">
              <span className="winning-outcome-icon">
                <Trophy size={24} aria-hidden="true" />
              </span>

              <div>
                <h2>Winning Outcome</h2>
                <p>Final result of this bet</p>
              </div>
            </div>

            <span className="bet-detail-status bet-detail-status--resolved">
              <CircleCheck size={15} aria-hidden="true" />
              Resolved
            </span>
          </div>

          <div className="winning-outcome-result">
            <p className="winning-outcome-label">Final Winning Answer</p>

            <h3 className="winning-outcome-answer">
              {options.find(
                (option) => String(option.id) === String(bet.winning_option_id),
              )?.label ?? "Winning outcome unavailable"}
            </h3>

            <p className="winning-outcome-confirmed">
              <CircleCheck size={17} aria-hidden="true" />
              Outcome confirmed
            </p>
          </div>

          <section
            className="winning-outcome-winners"
            aria-labelledby="winning-outcome-winners-heading"
          >
            <h3 id="winning-outcome-winners-heading">
              Winners ({multipleChoiceWinners.length})
            </h3>
            {multipleChoiceWinners.length > 0 ? (
              <ul className="winning-outcome-winners-list">
                {multipleChoiceWinners.map((participant, index) => {
                  const participantId = participant.user_id ?? participant.id;
                  return (
                    <li key={participantId ?? index}>
                      <Trophy size={17} aria-hidden="true" />
                      <span>
                        {participant.username ??
                          participant.name ??
                          `Participant ${index + 1}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="winning-outcome-winners-empty">
                No recorded participant selections matched the winning answer.
              </p>
            )}
            {winnerDataIncomplete && (
              <p className="winning-outcome-winners-note">
                Some participant answers are unavailable; the winners list may
                be incomplete.
              </p>
            )}
          </section>
          <p className="winning-outcome-description">
            This bet has been resolved. The final outcome cannot be changed.
          </p>
        </section>
      )}
    </main>
  );
}
