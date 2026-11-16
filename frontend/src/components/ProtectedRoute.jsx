import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

/**
 * Prevent unauthenticated users from accessing protected routes.
 *
 * Supports both nested routes through Outlet and existing routes
 * that pass their protected component as children.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Do not render protected content until session verification finishes.
  if (loading) {
    return <p role="status">Checking authentication...</p>;
  }

  // Redirect users without a valid authenticated session.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Preserve compatibility with existing component-based route guards.
  return children ?? <Outlet />;
}

export default ProtectedRoute;
