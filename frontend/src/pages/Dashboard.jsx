
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  getMyBets,
  isDemoMode,
} from "../services/betService";
import "./Dashboard.css";

function Dashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const demoMode = searchParams.get("demo") || "success";
  const userId = user?.userID ?? user?.id;

  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBets() {
      setLoading(true);
      setError("");

      try {
        const data = await getMyBets(
          userId,
          demoMode
        );

        if (!cancelled) {
          setBets(data);
        }
      } catch (err) {
        if (!cancelled) {
          setBets([]);
          setError(
            err.message || "Unable to load bets."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBets();

    return () => {
      cancelled = true;
    };
  }, [demoMode, userId]);

  const activeBets = bets.filter(
    (bet) =>
      bet.status === "active" ||
      bet.status === "open"
  ).length;

  const completedBets = bets.filter(
    (bet) =>
      bet.status === "completed" ||
      bet.status === "resolved"
  ).length;

  const formatDeadline = (deadline) => {
    if (!deadline) {
      return null;
    }

    const date = new Date(deadline);

    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleString();
  };

  return (
    <div className="dashboard">
      <section>
        <h1>Dashboard</h1>

        <p>
          Welcome back, {user?.username || "User"}!
        </p>

        <p>Create and manage your bets here.</p>

        <Link
          to="/create"
          className="create-bet-button"
        >
          + Create New Bet
        </Link>
      </section>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Total Bets</h3>
          <strong>
            {loading || error ? "—" : bets.length}
          </strong>
        </div>

        <div className="summary-card">
          <h3>Active Bets</h3>
          <strong>
            {loading || error ? "—" : activeBets}
          </strong>
        </div>

        <div className="summary-card">
          <h3>Completed Bets</h3>
          <strong>
            {loading || error ? "—" : completedBets}
          </strong>
        </div>
      </div>

      <section className="my-bets">
        <div className="bets-heading">
          <h2>My Bets</h2>

          {isDemoMode && (
            <span className="demo-label">
              Demo Data
            </span>
          )}
        </div>

        {loading ? (
          <p role="status">Loading bets...</p>
        ) : error ? (
          <div className="error-state" role="alert">
            <h3>Something went wrong</h3>
            <p>{error}</p>
          </div>
        ) : bets.length === 0 ? (
          <div className="empty-state">
            <h3>No bets to display yet</h3>

            <p>
              Create your first bet to get started.
            </p>

            <Link
              to="/create"
              className="create-bet-button"
            >
              Create Bet
            </Link>
          </div>
        ) : (
          <div className="bets-grid">
            {bets.map((bet) => (
              <article
                className="bet-card"
                key={bet.id}
              >
                <div className="bet-card-header">
                  <h3>{bet.title}</h3>

                  <span
                    className={`bet-status ${
                      bet.status === "open"
                        ? "active"
                        : bet.status === "resolved"
                          ? "completed"
                          : bet.status
                    }`}
                  >
                    {bet.status}
                  </span>
                </div>

                <p>{bet.description}</p>

                <div className="bet-card-footer">
                  {formatDeadline(bet.deadline) ? (
                    <span>
                      Deadline:{" "}
                      {formatDeadline(bet.deadline)}
                    </span>
                  ) : (
                    <span>
                      Created:{" "}
                      {bet.created_at || bet.createdAt
                        ? new Date(
                            bet.created_at ||
                            bet.createdAt
                          ).toLocaleString()
                        : "Not available"}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
