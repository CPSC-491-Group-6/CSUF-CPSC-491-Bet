import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <Link className="brand" to="/">
        Bet
      </Link>

      <div className="nav-links">
        <Link to="/">Dashboard</Link>
        <Link to="/create">Create Bet</Link>
        <Link to="/profile">Profile</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </div>
    </nav>
  );
}

export default Navbar;
