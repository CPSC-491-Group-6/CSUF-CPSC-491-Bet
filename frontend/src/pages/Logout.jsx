import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "../context/useAuth";
import "../styles/Logout.css";

function Logout() {
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setStatus("");
    setIsSubmitting(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <main className="logout-page">
        <section className="logout-card">
          <span className="logout-icon" aria-hidden="true">
            <LogOut size={30} />
          </span>
          <h1>Logout</h1>
          <p>No authentication session is currently active.</p>
          <Link className="logout-secondary" to="/login">
            Return to Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="logout-page">
      <section className="logout-card">
        <span className="logout-icon" aria-hidden="true">
          <LogOut size={30} />
        </span>
        <h1>Logout</h1>
        <p>
          Are you sure you want to log out, <strong>{user.username}</strong>?
        </p>

        <div className="logout-actions">
          <Link className="logout-secondary" to="/profile">
            <ArrowLeft size={17} aria-hidden="true" />
            Cancel
          </Link>
          <button
            className="logout-confirm"
            type="button"
            onClick={handleLogout}
            disabled={isSubmitting}
          >
            <LogOut size={18} aria-hidden="true" />
            {isSubmitting ? "Logging out..." : "Logout"}
          </button>
        </div>

        {status && (
          <p className="logout-status" role="alert">
            {status}
          </p>
        )}
      </section>
    </main>
  );
}

export default Logout;
