import { Link } from "react-router-dom";

function NotFound() {
  return (
    <section>
      <h1>404</h1>
      <p>Page not found.</p>
      <Link to="/">Return to Dashboard</Link>
    </section>
  );
}

export default NotFound;
