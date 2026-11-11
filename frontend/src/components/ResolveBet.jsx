import { useState } from "react";
import "../styles/ResolveBet.css";

export default function ResolveBet({ bet, currentUserId, onResolve }) {
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  const creatorId = bet?.creator_id ?? bet?.created_by;

  const isCreator =
    currentUserId != null &&
    creatorId != null &&
    String(currentUserId) === String(creatorId);

  const canResolve = isCreator && bet?.status === "locked";

  const options = Array.isArray(bet?.options) ? bet.options : [];

  const selectedOption = options.find(
    (option) => String(option.id) === selectedOptionId,
  );

  if (!canResolve) {
    return null;
  }

  async function handleConfirm() {
    if (!selectedOption) {
      setError("Please select a valid winning outcome.");
      return;
    }

    setResolving(true);
    setError("");

    try {
      await onResolve(selectedOption.id);
      setShowConfirmation(false);
    } catch (err) {
      setError(err.message || "Unable to resolve this bet.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <section className="bet-detail-card">
      <h2>Resolve Bet</h2>

      {!showConfirmation ? (
        <>
          <p>Select the final winning outcome for this bet.</p>

          <div className="form-group">
            <label htmlFor="winningOption">Winning Outcome</label>

            <select
              id="winningOption"
              value={selectedOptionId}
              onChange={(event) => {
                setSelectedOptionId(event.target.value);
                setError("");
              }}
              disabled={resolving}
            >
              <option value="">Select an outcome</option>

              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {options.length === 0 && (
            <p role="status">
              This bet has no answer options available for resolution.
            </p>
          )}

          {error && <p role="alert">{error}</p>}

          <button
            type="button"
            className="bet-join-button"
            onClick={() => setShowConfirmation(true)}
            disabled={!selectedOption || resolving}
          >
            Resolve Bet
          </button>
        </>
      ) : (
        <>
          <h3>Confirm Resolution</h3>

          <p>
            Are you sure you want to resolve this bet? This action cannot be
            undone.
          </p>

          <p>
            <strong>Winning Outcome:</strong> {selectedOption?.label}
          </p>

          {error && <p role="alert">{error}</p>}

          <button
            type="button"
            onClick={() => setShowConfirmation(false)}
            disabled={resolving}
          >
            Cancel
          </button>

          <button type="button" onClick={handleConfirm} disabled={resolving}>
            {resolving ? "Resolving..." : "Confirm Resolution"}
          </button>
        </>
      )}
    </section>
  );
}
