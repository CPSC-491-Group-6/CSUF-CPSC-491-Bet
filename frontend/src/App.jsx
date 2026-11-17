import { Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import CreateBet from "./pages/CreateBet";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Logout from "./pages/Logout";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import JoinBet from "./pages/JoinBet";
import BetDetail from "./pages/BetDetail";
import BetHistory from "./pages/BetHistory";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Authentication pages remain publicly accessible. */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Every other application route requires authentication. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/join" element={<JoinBet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/create" element={<CreateBet />} />
          <Route path="/bets/:betId" element={<BetDetail />} />
          <Route path="/history" element={<BetHistory />} />

          {/* Unknown routes also require authentication. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
