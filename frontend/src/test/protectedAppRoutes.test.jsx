import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../App";
import { useAuth } from "../context/useAuth";

// Mock authentication so route behavior can be tested independently.
vi.mock("../context/useAuth", () => ({
  useAuth: vi.fn(),
}));

// Mock individual pages to keep routing tests isolated.
vi.mock("../pages/Dashboard", () => ({
  default: () => <h1>Dashboard Page</h1>,
}));

vi.mock("../pages/CreateBet", () => ({
  default: () => <h1>Create Bet Page</h1>,
}));

vi.mock("../pages/JoinBet", () => ({
  default: () => <h1>Join Bet Page</h1>,
}));

vi.mock("../pages/Profile", () => ({
  default: () => <h1>Profile Page</h1>,
}));

vi.mock("../pages/Logout", () => ({
  default: () => <h1>Logout Page</h1>,
}));

vi.mock("../pages/BetDetail", () => ({
  default: () => <h1>Bet Detail Page</h1>,
}));

vi.mock("../pages/Login", () => ({
  default: () => <h1>Login Page</h1>,
}));

vi.mock("../pages/Register", () => ({
  default: () => <h1>Register Page</h1>,
}));

vi.mock("../pages/NotFound", () => ({
  default: () => <h1>Not Found Page</h1>,
}));

/**
 * Render the real application routing configuration using a
 * simulated browser location.
 *
 * This tests direct URL navigation without starting a server.
 */
function renderRoute(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Application authentication route protection", () => {
  beforeEach(() => {
    // Remove any DOM left by earlier tests.
    cleanup();

    // Reset mock usage and restore the default signed-out state.
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    // Ensure every test releases its rendered React tree.
    cleanup();
  });

  test.each([
    "/",
    "/create",
    "/join",
    "/profile",
    "/logout",
    "/bets/test-bet-123",
    "/unknown-route",
  ])("redirects unauthenticated users requesting %s to login", async (path) => {
    renderRoute(path);

    expect(
      await screen.findByRole("heading", {
        name: "Login Page",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Dashboard Page",
      }),
    ).not.toBeInTheDocument();
  });

  test.each(["/login", "/register"])(
    "allows unauthenticated access to %s",
    (path) => {
      renderRoute(path);

      expect(
        screen.getByRole("heading", {
          name: path === "/login" ? "Login Page" : "Register Page",
        }),
      ).toBeInTheDocument();
    },
  );

  test("allows authenticated users to access the dashboard", () => {
    useAuth.mockReturnValue({
      user: {
        id: 1,
        username: "testuser",
      },
      loading: false,
      isAuthenticated: true,
    });

    renderRoute("/");

    expect(
      screen.getByRole("heading", {
        name: "Dashboard Page",
      }),
    ).toBeInTheDocument();
  });

  test("does not render protected pages during session checks", () => {
    useAuth.mockReturnValue({
      user: null,
      loading: true,
      isAuthenticated: false,
    });

    renderRoute("/");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking authentication...",
    );

    expect(
      screen.queryByRole("heading", {
        name: "Dashboard Page",
      }),
    ).not.toBeInTheDocument();
  });
});
