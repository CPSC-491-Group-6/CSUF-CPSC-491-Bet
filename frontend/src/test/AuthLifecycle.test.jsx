import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ProtectedRoute from "../components/ProtectedRoute";
import { AuthProvider } from "../context/AuthContext";
import { useAuth } from "../context/useAuth";
import Login from "../pages/Login";
import Logout from "../pages/Logout";
import Profile from "../pages/Profile";

import { invalidCredentials, testUser, validCredentials } from "./authFixtures";
import { resetAuthTestState } from "./authHelpers";

function AuthStatus() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <p data-testid="auth-state">loading</p>;
  }

  return (
    <p data-testid="auth-state">
      {isAuthenticated && user
        ? `authenticated:${user.username}`
        : "unauthenticated"}
    </p>
  );
}

function TestApplication({ initialRoute = "/login" }) {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthStatus />

        <nav>
          <Link to="/profile">Open Profile</Link>
          <Link to="/login">Open Login</Link>
        </nav>

        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/logout"
            element={
              <ProtectedRoute>
                <Logout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function fillLogin(email, password) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });

  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
}

function submitLogin() {
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
}

function createResponse(ok, data = {}, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

describe("SCRUM-734 Authentication Lifecycle Regression", () => {
  let fetchMock;
  let serverAuthenticated;
  let logoutShouldFail;

  beforeEach(() => {
    serverAuthenticated = false;
    logoutShouldFail = false;

    fetchMock = vi.fn(async (url, options = {}) => {
      if (url === "/api/auth/me") {
        if (serverAuthenticated) {
          return createResponse(true, { user: testUser });
        }

        return createResponse(false, {}, 401);
      }

      if (url === "/api/auth/login") {
        const body = JSON.parse(options.body);

        if (
          body.email === validCredentials.email &&
          body.password === validCredentials.password
        ) {
          serverAuthenticated = true;
          return createResponse(true, { user: testUser });
        }

        return createResponse(
          false,
          {
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Invalid email or password.",
            },
          },
          401,
        );
      }

      if (url === "/api/auth/logout") {
        if (logoutShouldFail) {
          return createResponse(false, {}, 500);
        }

        serverAuthenticated = false;
        return createResponse(true, {}, 204);
      }

      throw new Error(`Unexpected authentication request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    resetAuthTestState();
  });

  test("complete login, profile, logout, and access-restriction lifecycle", async () => {
    render(<TestApplication />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "unauthenticated",
      );
    });

    fillLogin(validCredentials.email, validCredentials.password);
    submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        `authenticated:${testUser.username}`,
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();

    expect(screen.getByText(testUser.username)).toBeInTheDocument();
    expect(screen.getByText(testUser.email)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Logout" }));

    expect(
      await screen.findByRole("button", { name: "Logout" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "unauthenticated",
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Login" }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    fireEvent.click(screen.getByRole("link", { name: "Open Profile" }));

    expect(
      await screen.findByRole("heading", { name: "Login" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: "Profile" }),
    ).not.toBeInTheDocument();
  });

  test("failed login preserves unauthenticated state", async () => {
    render(<TestApplication />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "unauthenticated",
      );
    });

    fillLogin(invalidCredentials.email, invalidCredentials.password);

    submitLogin();

    expect(
      await screen.findByText("Invalid email or password."),
    ).toBeInTheDocument();

    expect(screen.getByTestId("auth-state")).toHaveTextContent(
      "unauthenticated",
    );

    expect(serverAuthenticated).toBe(false);

    fireEvent.click(screen.getByRole("link", { name: "Open Profile" }));

    expect(
      await screen.findByRole("heading", { name: "Login" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: "Profile" }),
    ).not.toBeInTheDocument();
  });

  test("failed login can be corrected and followed by successful login", async () => {
    render(<TestApplication />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "unauthenticated",
      );
    });

    fillLogin(invalidCredentials.email, invalidCredentials.password);

    submitLogin();

    expect(
      await screen.findByText("Invalid email or password."),
    ).toBeInTheDocument();

    fillLogin(validCredentials.email, validCredentials.password);
    submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        `authenticated:${testUser.username}`,
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();

    const loginRequests = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/auth/login",
    );

    expect(loginRequests).toHaveLength(2);
  });

  test("successful logout allows a new login", async () => {
    render(<TestApplication />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "unauthenticated",
      );
    });

    fillLogin(validCredentials.email, validCredentials.password);
    submitLogin();

    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Logout" }));

    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "unauthenticated",
      );
    });

    fillLogin(validCredentials.email, validCredentials.password);
    submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        `authenticated:${testUser.username}`,
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();

    const loginRequests = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/auth/login",
    );

    expect(loginRequests).toHaveLength(2);
  });

  test("failed logout retains authentication and displays an error", async () => {
    logoutShouldFail = true;

    render(<TestApplication />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "unauthenticated",
      );
    });

    fillLogin(validCredentials.email, validCredentials.password);
    submitLogin();

    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Logout" }));

    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(
      await screen.findByText("Unable to log out. Please try again."),
    ).toBeInTheDocument();

    expect(screen.getByTestId("auth-state")).toHaveTextContent(
      `authenticated:${testUser.username}`,
    );

    expect(serverAuthenticated).toBe(true);
  });

  test("direct profile access is blocked when unauthenticated", async () => {
    render(<TestApplication initialRoute="/profile" />);

    expect(
      await screen.findByRole("heading", { name: "Login" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "unauthenticated",
      );
    });

    expect(
      screen.queryByRole("heading", { name: "Profile" }),
    ).not.toBeInTheDocument();
  });

  test("existing authenticated session permits profile access", async () => {
    serverAuthenticated = true;

    render(<TestApplication initialRoute="/profile" />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        `authenticated:${testUser.username}`,
      );
    });

    expect(
      screen.getByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();

    expect(screen.getByText(testUser.email)).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", {
      method: "GET",
      credentials: "include",
    });
  });
});
