import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";

function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <section>
        <h1>Profile</h1>
        <p>No authenticated user is currently available.</p>
        <Link to="/login">Go to Login</Link>
      </section>
    );
  }

  return (
    <section>
      <h1>Profile</h1>

      <p>
        <strong>User ID:</strong> {user.userID}
      </p>

      <p>
        <strong>Username:</strong> {user.username}
      </p>

      <p>
        <strong>Email:</strong> {user.email}
      </p>

      <p>
        <strong>Verification Status:</strong>{" "}
        {user.verificationStatus ? "Verified" : "Not Verified"}
      </p>

      <Link to="/logout">Logout</Link>
    </section>
  );
}

export default Profile;