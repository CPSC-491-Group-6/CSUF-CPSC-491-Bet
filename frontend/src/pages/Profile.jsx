import { Link } from "react-router-dom";

import { getMockCurrentUser } from "../services/mockAuth";

function Profile() {
  const user = getMockCurrentUser();

  if (!user) {
    return (
      <section>
        <h1>Profile</h1>
        <p>No mock user is currently logged in.</p>
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
        <strong>Verification Status:</strong> {user.verificationStatus}
      </p>

      <Link to="/logout">Logout</Link>
    </section>
  );
}

export default Profile;