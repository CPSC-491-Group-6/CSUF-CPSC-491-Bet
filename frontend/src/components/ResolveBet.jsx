import { useState } from "react";
import "../styles/ResolveBet.css";

export default function ResolveBet({ bet, currentUserId, onResolve, }) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  const creatorId = bet?.creator_id ?? bet?.created_by;

  // check whether the current user is the bet creator
  const isCreator =
    currentUserId != null &&
    creatorId != null &&
    String(currentUserId) === String(creatorId);

  // check whether the bet is locked
  const canResolve = isCreator && bet?.status === "locked";

  if (!canResolve) {
    return null;
  }

  async function handleConfirm() {
    setResolving(true);
    setError("");

    try {
      await onResolve();
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
          <p>
            Resolve this bet after confirming the final outcome.
          </p>

          <button
            type="button"
            className="bet-join-button"
            onClick={() => setShowConfirmation(true)}
          >
            Resolve Bet
          </button>
        </>
      ) : (
        <>
          <h3>Confirm Resolution</h3>

          <p>
            Are you sure you want to resolve this bet?
            This action cannot be undone.
          </p>

          {error && <p role="alert">{error}</p>}

          <button
            type="button"
            onClick={() => setShowConfirmation(false)}
            disabled={resolving}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={resolving}
          >
            {resolving ? "Resolving..." : "Confirm Resolution"}
          </button>
        </>
      )}
    </section>
  );
}