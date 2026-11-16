import { useState } from "react";
import { FREE_RESPONSE_RESOLVE_ENABLED } from "../config/freeResponse";
import "../styles/FreeResponseResolve.css";

/**
 * Frontend for resolving a locked bet with written predictions.
 *
 * Backend contract (not yet implemented):
 * POST /api/bets/:betId/resolve
 * { resolution_text: string, winning_user_ids: string[] }
 *
 * Only participant user IDs from the authenticated bet detail response are sent.
 */
export default function FreeResponseResolve({
  bet,
  currentUserId,
  onResolve,
  enabled = FREE_RESPONSE_RESOLVE_ENABLED,
}) {
  const [winningUserIds, setWinningUserIds] = useState([]);
  const [resolutionText, setResolutionText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  const creatorId = bet?.creator_id ?? bet?.created_by;
  const isCreator =
    currentUserId != null &&
    creatorId != null &&
    String(currentUserId) === String(creatorId);
  const isLocked = String(bet?.status).toLowerCase() === "locked";
  const options = Array.isArray(bet?.options) ? bet.options : [];
  const canResolve = isCreator && isLocked && options.length === 0;
  const participants = Array.isArray(bet?.participants) ? bet.participants : [];
  const candidates = participants.filter((participant) => {
    const userId = participant.user_id ?? participant.id;
    return (
      userId != null &&
      String(userId) !== String(creatorId) &&
      typeof participant.prediction_text === "string" &&
      participant.prediction_text.trim().length > 0
    );
  });

  // Do not resolve old bets where some participant predictions are missing.
  const missingPredictions =
    participants.some((participant) => {
      const userId = participant.user_id ?? participant.id;
      return (
        userId == null ||
        (String(userId) !== String(creatorId) &&
          (typeof participant.prediction_text !== "string" ||
            !participant.prediction_text.trim()))
      );
    }) ||
    (Number.isFinite(Number(bet?.current_participants)) &&
      Number(bet.current_participants) > participants.length);

  if (!canResolve) return null;

  function toggleWinner(userId) {
    const id = String(userId);
    setWinningUserIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id],
    );
    setError("");
  }

  function startConfirmation(event) {
    event.preventDefault();
    if (!enabled || missingPredictions || resolving) return;
    if (!resolutionText.trim() || resolutionText.trim().length > 500) {
      setError("Enter the final outcome (1-500 characters).");
      return;
    }
    setError("");
    setConfirming(true);
  }

  async function confirmResolution() {
    if (!enabled || missingPredictions || resolving) return;
    const allowedIds = new Set(
      candidates.map((participant) =>
        String(participant.user_id ?? participant.id),
      ),
    );
    if (
      !resolutionText.trim() ||
      resolutionText.trim().length > 500 ||
      winningUserIds.some((id) => !allowedIds.has(id))
    ) {
      setError("Please review the final outcome and selected winners.");
      return;
    }

    setResolving(true);
    setError("");
    try {
      await onResolve({
        resolutionText: resolutionText.trim(),
        winningUserIds,
      });
      setConfirming(false);
    } catch (err) {
      setError(err?.message || "Unable to resolve this bet.");
    } finally {
      setResolving(false);
    }
  }

  const selectedWinners = candidates.filter((participant) =>
    winningUserIds.includes(String(participant.user_id ?? participant.id)),
  );

  return (
    <section className="bet-detail-card free-response-resolve">
      <h2>Resolve Free-Response Bet</h2>
      <p>
        Review the predictions submitted before locking the bet. Select each
        participant who predicted correctly, or leave everyone unselected if
        nobody won.
      </p>

      {!enabled && (
        <p className="free-response-resolve-note" role="status">
          Free-response resolution is waiting for backend support. No results
          can be submitted yet.
        </p>
      )}
      {missingPredictions && (
        <p className="free-response-resolve-note" role="status">
          Some participant predictions are unavailable. This bet cannot be
          resolved until complete prediction data is returned by the backend.
        </p>
      )}

      {!confirming ? (
        <form onSubmit={startConfirmation}>
          <fieldset
            className="free-response-resolve-choices"
            disabled={resolving}
          >
            <legend>Participant predictions</legend>
            {candidates.length === 0 ? (
              <p>No written predictions are available for this bet.</p>
            ) : (
              <ul className="free-response-resolve-list">
                {candidates.map((participant, index) => {
                  const userId = String(participant.user_id ?? participant.id);
                  const isSelected = winningUserIds.includes(userId);
                  const displayName =
                    participant.username ??
                    participant.name ??
                    `Participant ${index + 1}`;
                  return (
                    <li key={userId}>
                      <label className="free-response-resolve-choice">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleWinner(userId)}
                        />
                        <span>
                          <strong>{displayName}</strong>
                          <span className="free-response-resolve-prediction">
                            {participant.prediction_text}
                          </span>
                        </span>
                        {isSelected && (
                          <span className="free-response-resolve-winner">
                            Winner
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <label className="free-response-resolve-label" htmlFor="finalOutcome">
            Final outcome
          </label>
          <textarea
            id="finalOutcome"
            rows={3}
            maxLength={500}
            value={resolutionText}
            onChange={(event) => {
              setResolutionText(event.target.value);
              setError("");
            }}
            placeholder="Describe what actually happened"
            disabled={resolving}
          />
          <p className="free-response-resolve-hint">
            {winningUserIds.length} winner(s) selected. Choosing no winners is
            allowed.
          </p>
          {error && (
            <p role="alert" className="free-response-resolve-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="bet-join-button"
            disabled={
              !enabled ||
              missingPredictions ||
              !resolutionText.trim() ||
              resolving
            }
          >
            Review Resolution
          </button>
        </form>
      ) : (
        <div className="free-response-resolve-confirmation">
          <h3>Confirm Resolution</h3>
          <p>This action cannot be undone.</p>
          <p>
            <strong>Final outcome:</strong> {resolutionText.trim()}
          </p>
          <p>
            <strong>Winning participants:</strong>{" "}
            {selectedWinners.length
              ? selectedWinners
                  .map(
                    (participant) =>
                      participant.username ?? participant.name ?? "Participant",
                  )
                  .join(", ")
              : "None"}
          </p>
          {error && (
            <p role="alert" className="free-response-resolve-error">
              {error}
            </p>
          )}
          <div className="free-response-resolve-actions">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              disabled={resolving}
            >
              Back to Edit
            </button>
            <button
              type="button"
              className="bet-join-button"
              onClick={confirmResolution}
              disabled={resolving || !enabled || missingPredictions}
            >
              {resolving ? "Resolving..." : "Confirm Resolution"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
