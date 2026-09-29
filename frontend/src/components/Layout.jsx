import { Link, Outlet } from "react-router-dom";

import { useAuth } from "../context/useAuth";

function Layout() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <>
      <nav className="navbar">
        <Link className="brand" to="/">
          Bet
        </Link>

        <div className="nav-links">
          <Link to="/">Dashboard</Link>

          {!loading && isAuthenticated && (
            <>
              <Link to="/create">Create Bet</Link>
              <Link to="/profile">Profile</Link>
              <Link to="/logout">Logout</Link>
            </>
          )}

          {!loading && !isAuthenticated && (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </nav>

      <main className="page-container">
        <Outlet />
      </main>
    </>
  );
}

export default Layout;