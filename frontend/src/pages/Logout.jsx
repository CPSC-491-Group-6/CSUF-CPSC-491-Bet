import { useState } from "react";
import { Link } from "react-router-dom";

import { getMockCurrentUser, mockLogout } from "../services/mockAuth";

function Logout() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(getMockCurrentUser()),
  );
  const [status, setStatus] = useState("");

  const handleLogout = async () => {
    await mockLogout();

    setIsLoggedIn(false);
    setStatus("Mock logout successful.");
  };

  return (
    <section>
      <h1>Logout</h1>

      {isLoggedIn ? (
        <>
          <p>Are you sure you want to log out?</p>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </>
      ) : (
        <p>No mock authentication session is currently active.</p>
      )}

      {status && <p>{status}</p>}

      {!isLoggedIn && <Link to="/login">Return to Login</Link>}
    </section>
  );
}

export default Logout;