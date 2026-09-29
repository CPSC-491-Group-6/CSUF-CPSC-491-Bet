import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";

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
      <section>
        <h1>Logout</h1>
        <p>No authentication session is currently active.</p>
        <Link to="/login">Return to Login</Link>
      </section>
    );
  }

  return (
    <section>
      <h1>Logout</h1>

      <p>
        Are you sure you want to log out, <strong>{user.username}</strong>?
      </p>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Logging out..." : "Logout"}
      </button>

      {status && <p>{status}</p>}
    </section>
  );
}

export default Logout;