
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Dashboard.css";

function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <section>
        <h1>Dashboard</h1>

        <p>
          Welcome back, {user?.username || "User"}!
        </p>

        <p>Create and manage your bets here.</p>

        <Link to="/create" className="create-bet-button">
          + Create New Bet
        </Link>
      </section>

      <section className="my-bets">
        <h2>My Bets</h2>

        <div className="empty-state">
          <h3>No bets to display yet</h3>

          <p>
            Once you create a bet, it will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
