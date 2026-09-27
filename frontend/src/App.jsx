import { Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import CreateBet from "./pages/CreateBet";
import NotFound from "./pages/NotFound";
import Logout from "./pages/Logout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
  <Route element={<Layout />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />

    <Route
      path="/profile"
      element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      }
    />

    <Route path="/logout" element={<Logout />} />

    <Route
      path="/create"
      element={
        <ProtectedRoute>
          <CreateBet />
        </ProtectedRoute>
      }
    />

    <Route path="*" element={<NotFound />} />
  </Route>
</Routes>
  );
}

export default App;
