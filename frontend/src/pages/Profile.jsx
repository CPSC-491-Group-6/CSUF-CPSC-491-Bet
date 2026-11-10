import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CircleUserRound,
  Fingerprint,
  LogOut,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import "../styles/Profile.css";

function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <main className="profile-page">
        <section className="profile-card profile-empty">
          <CircleUserRound size={36} aria-hidden="true" />
          <h1>Profile</h1>
          <p>No authenticated user is currently available.</p>
          <Link className="profile-primary-link" to="/login">
            Go to Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <div className="profile-page-heading">
        <span className="profile-heading-icon" aria-hidden="true">
          <CircleUserRound size={29} />
        </span>

        <div>
          <h1>Profile</h1>
          <p>View your BET account information.</p>
        </div>
      </div>

      <section className="profile-card">
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">
            <UserRound size={30} />
          </span>

          <div>
            <h2>{user.username || "BET User"}</h2>
            <p>{user.email || "Email not available"}</p>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-detail">
            <Fingerprint size={20} aria-hidden="true" />

            <div>
              <span>User ID</span>
              <strong>{user.userID ?? user.id ?? "Not available"}</strong>
            </div>
          </div>

          <div className="profile-detail">
            <BadgeCheck size={20} aria-hidden="true" />

            <div>
              <span>Verification Status</span>

              <strong
                className={
                  user.verificationStatus
                    ? "profile-verified"
                    : "profile-unverified"
                }
              >
                {user.verificationStatus ? "Verified" : "Not Verified"}
              </strong>
            </div>
          </div>
        </div>

        <Link className="profile-logout-link" to="/logout">
          <LogOut size={18} aria-hidden="true" />
          Logout
        </Link>
      </section>
    </main>
  );
}

export default Profile;
