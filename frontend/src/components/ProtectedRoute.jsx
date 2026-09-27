import {Navigate} from "react-router-dom";
import { useAuth } from "../context/useAuth";

function ProtectedRoute({children}) {
    const {user, loading} = useAuth();

    if (loading) {
        return <p>Checking authentication...</p>
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;
