import { useState } from "react";
import "./App.css";

function App() {
  const [page, setPage] = useState("login");
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLogin = (event) => {
    event.preventDefault();

    // Authentication will eventually connect to Firebase.
    setLoggedIn(true);
  };

  const handleRegister = (event) => {
    event.preventDefault();

    // Registration will eventually connect to Firebase.
    alert("Account created! Verification email would be sent here.");
    setPage("login");
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setPage("login");
  };

  if (loggedIn) {
    return (
      <div className="app">
        <nav className="navbar">
          <h1>Bet</h1>

          <div className="nav-links">
            <button>Home</button>
            <button>Create Bet</button>
            <button>My Bets</button>
            <button>Profile</button>
            <button onClick={handleLogout}>Logout</button>
          </div>
        </nav>

        <main className="dashboard">
          <h2>Welcome to Bet</h2>
          <p>Create and join friendly wagers with your friends.</p>

          <section className="bet-grid">
            <BetCard
              title="MCU"
              description="Will ___ appear in Avengers Doomsday?"
              amount="$10"
            />

            <BetCard
              title="Weather"
              description="Will it rain today?"
              amount="$5"
            />

            <BetCard
              title="Pineapple Pizza"
              description="Which do more people believe? Pineapple on pizza, good or bad?"
              amount="$10"
            />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Bet</h1>

        {page === "login" ? (
          <>
            <h2>Login</h2>

            <form onSubmit={handleLogin}>
              <label>Email</label>
              <input
                type="email"
                placeholder="email@example.com"
                required
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Password"
                required
              />

              <button className="primary-button" type="submit">
                Login
              </button>
            </form>

            <p>
              Don't have an account?{" "}
              <button
                className="text-button"
                onClick={() => setPage("register")}
              >
                Register
              </button>
            </p>
          </>
        ) : (
          <>
            <h2>Create Account</h2>

            <form onSubmit={handleRegister}>
              <label>Username</label>
              <input
                type="text"
                placeholder="Username"
                required
              />

              <label>Email</label>
              <input
                type="email"
                placeholder="email@example.com"
                required
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Password"
                required
              />

              <button className="primary-button" type="submit">
                Register
              </button>
            </form>

            <p>
              Already have an account?{" "}
              <button
                className="text-button"
                onClick={() => setPage("login")}
              >
                Login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function BetCard({ title, description, amount }) {
  return (
    <div className="bet-card">
      <h3>{title}</h3>

      <p>{description}</p>

      <p>
        <strong>Entry:</strong> {amount}
      </p>

      <div className="bet-buttons">
        <button className="yes-button">Yes</button>
        <button className="no-button">No</button>
      </div>
    </div>
  );
}

export default App;