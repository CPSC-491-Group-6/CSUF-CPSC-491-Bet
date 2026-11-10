import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getMyBets } from "../services/betService";
import { Layers, Clock3, CircleCheck } from "lucide-react";
import "../styles/Dashboard.css";

function Dashboard() {
  const { user } = useAuth();

  const [bets, setBets] = useState([]);
  const [publicBets, setPublicBets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [publicLoading, setPublicLoading] = useState(true);

  const [error, setError] = useState("");
  const [publicError, setPublicError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBets() {
      setLoading(true);
      setError("");

      try {
        const data = await getMyBets();

        if (!cancelled) {
          setBets(data);
        }
      } catch (err) {
        if (!cancelled) {
          setBets([]);
          setError(err.message || "Unable to load bets.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function loadPublicBets() {
      setPublicLoading(true);
      setPublicError("");

      try {
        const res = await fetch("/api/bets/public", {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Unable to load public bets.");
        }

        const data = await res.json();

        if (!cancelled) {
          setPublicBets(Array.isArray(data.bets) ? data.bets : []);
        }
      } catch (err) {
        if (!cancelled) {
          setPublicBets([]);
          setPublicError(err.message || "Unable to load public bets.");
        }
      } finally {
        if (!cancelled) {
          setPublicLoading(false);
        }
      }
    }

    loadBets();
    loadPublicBets();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeBets = bets.filter(
    (bet) => bet.status === "active" || bet.status === "open",
  ).length;

  const completedBets = bets.filter(
    (bet) => bet.status === "completed" || bet.status === "resolved",
  ).length;

  const exploreBets = publicBets.filter(
    (bet) => String(bet.creator_id) !== String(user?.id ?? user?.userID),
  );

  const formatDeadline = (deadline) => {
    if (!deadline) return null;

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

        <p>Welcome back, {user?.username || "User"}!</p>

        <p>Create and manage your bets here.</p>

        <Link to="/create" className="create-bet-button">
          + Create New Bet
        </Link>
      </section>

      {/* Dashboard Statistics with Icons */}
      <div className="dashboard-summary">
        <div className="summary-card summary-card--total">
          <span className="summary-card-icon" aria-hidden="true">
            <Layers size={28} strokeWidth={2} />
          </span>

          <div className="summary-card-info">
            <strong>{loading || error ? "—" : bets.length}</strong>
            <h3>Total Bets</h3>
          </div>
        </div>

        <div className="summary-card summary-card--active">
          <span className="summary-card-icon" aria-hidden="true">
            <Clock3 size={28} strokeWidth={2} />
          </span>

          <div className="summary-card-info">
            <strong>{loading || error ? "—" : activeBets}</strong>
            <h3>Active Bets</h3>
          </div>
        </div>

        <div className="summary-card summary-card--completed">
          <span className="summary-card-icon" aria-hidden="true">
            <CircleCheck size={28} strokeWidth={2} />
          </span>

          <div className="summary-card-info">
            <strong>{loading || error ? "—" : completedBets}</strong>
            <h3>Completed Bets</h3>
          </div>
        </div>
      </div>

      <section className="my-bets">
        <div className="bets-heading">
          <h2>My Bets</h2>
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

            <p>Create your first bet to get started.</p>

            <Link to="/create" className="create-bet-button">
              Create Bet
            </Link>
          </div>
        ) : (
          <div className="bets-grid">
            {bets.map((bet) => (
              <article className="bet-card" key={bet.id}>
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
                    <span>Deadline: {formatDeadline(bet.deadline)}</span>
                  ) : (
                    <span>
                      Created:{" "}
                      {bet.created_at || bet.createdAt
                        ? new Date(
                            bet.created_at || bet.createdAt,
                          ).toLocaleString()
                        : "Not available"}
                    </span>
                  )}
                </div>

                <Link
                  to={`/bets/${encodeURIComponent(bet.id)}`}
                  state={{ bet }}
                  className="bet-view-details"
                >
                  View Details
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="my-bets">
        <div className="bets-heading">
          <h2>Explore Public Bets</h2>
        </div>

        <p>Discover public bets created by other users.</p>

        {publicLoading ? (
          <p role="status">Loading public bets...</p>
        ) : publicError ? (
          <div className="error-state" role="alert">
            <h3>Unable to load public bets</h3>
            <p>{publicError}</p>
          </div>
        ) : exploreBets.length === 0 ? (
          <div className="empty-state">
            <h3>No public bets available</h3>
            <p>Public bets created by other users will appear here.</p>
          </div>
        ) : (
          <div className="bets-grid">
            {exploreBets.map((bet) => (
              <article className="bet-card" key={bet.id}>
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
                  <span>
                    Participants: {bet.current_participants ?? 0} /{" "}
                    {bet.max_participants}
                  </span>
                </div>

                <Link
                  to={`/bets/${encodeURIComponent(bet.id)}`}
                  className="create-bet-button"
                  state={{ bet }}
                >
                  View Details
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
