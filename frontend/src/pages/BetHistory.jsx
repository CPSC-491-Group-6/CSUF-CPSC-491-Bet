import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, History, Trophy } from "lucide-react";
import { getBetHistory } from "../services/betService";
import "../styles/BetHistory.css";

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function getResultLabel(bet) {
  if (bet.is_winner === true) return "Won";
  if (bet.is_winner === false) return "Lost";
  return "Not determined";
}

function nonEmptyText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isFreeResponseBet(bet) {
  return (
    nonEmptyText(bet.resolution_text) !== null ||
    nonEmptyText(bet.prediction_text) !== null ||
    Array.isArray(bet.winning_user_ids) ||
    (Array.isArray(bet.options) && bet.options.length === 0) ||
    (Array.isArray(bet.participants) &&
      bet.participants.some(
        (participant) => nonEmptyText(participant.prediction_text) !== null,
      ))
  );
}

function FreeResponsePredictions({ bet }) {
  const participants = Array.isArray(bet.participants)
    ? bet.participants.filter(
        (participant) => nonEmptyText(participant.prediction_text) !== null,
      )
    : [];
  const hasWinnerData = Array.isArray(bet.winning_user_ids);
  const winningIds = hasWinnerData
    ? new Set(bet.winning_user_ids.map(String))
    : null;

  return (
    <section
      className="bet-history-predictions"
      aria-label="Participant predictions"
    >
      <h3>Participant predictions</h3>
      {hasWinnerData && bet.winning_user_ids.length === 0 && (
        <p className="bet-history-no-winners">No winners were selected.</p>
      )}
      {participants.length === 0 ? (
        <p className="bet-history-predictions-note">
          Participant predictions are not included in this history entry. View
          Bet Details for available participant information.
        </p>
      ) : (
        <ul className="bet-history-prediction-list">
          {participants.map((participant, index) => {
            const userId = participant.user_id ?? participant.id;
            const isWinner =
              winningIds !== null &&
              userId != null &&
              winningIds.has(String(userId));
            return (
              <li key={userId ?? index}>
                <div className="bet-history-prediction-person">
                  <strong>
                    {participant.username ??
                      participant.name ??
                      `Participant ${index + 1}`}
                  </strong>
                  {hasWinnerData && (
                    <span
                      className={
                        isWinner
                          ? "bet-history-prediction-winner"
                          : "bet-history-prediction-not-winner"
                      }
                    >
                      {isWinner ? "Winner" : "Not selected"}
                    </span>
                  )}
                  {!hasWinnerData && (
                    <span className="bet-history-prediction-not-winner">
                      Result unavailable
                    </span>
                  )}
                </div>
                <p>{nonEmptyText(participant.prediction_text)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function BetHistory() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError("");
      try {
        const result = await getBetHistory();
        if (!cancelled) setBets(result);
      } catch (err) {
        if (!cancelled) {
          setBets([]);
          setError(err.message || "Unable to load bet history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="bet-history-page">
      <header className="bet-history-header">
        <Link className="bet-history-back" to="/">
          <ArrowLeft size={17} aria-hidden="true" />
          Dashboard
        </Link>
        <h1>
          <History size={28} aria-hidden="true" />
          Bet History
        </h1>
        <p>View your completed bets and their recorded outcomes.</p>
      </header>

      {loading ? (
        <p role="status" className="bet-history-message">
          Loading bet history...
        </p>
      ) : error ? (
        <section className="bet-history-message" role="alert">
          <h2>Unable to load bet history</h2>
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Try Again
          </button>
        </section>
      ) : bets.length === 0 ? (
        <section className="bet-history-message">
          <h2>No resolved bets yet</h2>
          <p>Bets you create or join will appear here once resolved.</p>
          <Link className="bet-history-action" to="/">
            Return to Dashboard
          </Link>
        </section>
      ) : (
        <div className="bet-history-list">
          {bets.map((bet) => (
            <article className="bet-history-card" key={bet.id}>
              <div className="bet-history-card-top">
                <h2>{bet.title}</h2>
                <span className="bet-history-status">Resolved</span>
              </div>
              {bet.description && <p>{bet.description}</p>}
              <p className="bet-history-date">
                Resolved: {formatDate(bet.resolved_at)}
              </p>
              <div className="bet-history-results">
                <div>
                  <span>
                    {isFreeResponseBet(bet)
                      ? "Final outcome"
                      : "Winning outcome"}
                  </span>
                  <strong>
                    {isFreeResponseBet(bet)
                      ? (nonEmptyText(bet.resolution_text) ??
                        "Outcome unavailable")
                      : (nonEmptyText(bet.winning_option_label) ??
                        "Outcome unavailable")}
                  </strong>
                </div>
                <div>
                  <span>Your prediction</span>
                  <strong>
                    {isFreeResponseBet(bet)
                      ? (nonEmptyText(bet.prediction_text) ?? "Not recorded")
                      : (nonEmptyText(bet.selected_option_label) ??
                        "Not recorded")}
                  </strong>
                </div>
                <div>
                  <span>Your result</span>
                  <strong className="bet-history-result">
                    <Trophy size={17} aria-hidden="true" />
                    {getResultLabel(bet)}
                  </strong>
                </div>
              </div>
              {isFreeResponseBet(bet) && <FreeResponsePredictions bet={bet} />}
              <Link
                className="bet-history-action"
                to={`/bets/${encodeURIComponent(bet.id)}`}
              >
                View Bet Details
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
