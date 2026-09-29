import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import App from "../App";
import ProtectedRoute from "../components/ProtectedRoute";
import { AuthProvider } from "../context/AuthContext";
import { AuthContext } from "../context/authContextObject";
import Login from "../pages/Login";
import Logout from "../pages/Logout";

const testUser = {
  userID: 1,
  username: "demo_creator",
  email: "creator@example.com",
  verificationStatus: 1,
};

function createAuthValue(overrides = {}) {
  return {
    user: null,
    loading: false,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkSession: vi.fn(),
    ...overrides,
  };
}

describe("Authentication flow", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("1. app renders for a signed-out user", () => {
    const authValue = createAuthValue();

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Login" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Register" }),
    ).toBeInTheDocument();
  });

  test("2. login shows required-field validation", () => {
    const login = vi.fn();

    render(
      <AuthContext.Provider
        value={createAuthValue({ login })}
      >
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Login" }),
    );

    expect(
      screen.getByText("Email is required."),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Password is required."),
    ).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("3. successful login calls the auth endpoint and redirects to profile", async () => {
    const login = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: testUser,
      }),
    });

    render(
      <AuthContext.Provider
        value={createAuthValue({ login })}
      >
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/profile"
              element={<h1>Profile destination</h1>}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    fireEvent.change(
      screen.getByLabelText("Email"),
      {
        target: {
          value: "creator@example.com",
        },
      },
    );

    fireEvent.change(
      screen.getByLabelText("Password"),
      {
        target: {
          value: "DemoPassword123!",
        },
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Login" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Profile destination",
      }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: "creator@example.com",
          password: "DemoPassword123!",
        }),
      },
    );

    expect(login).toHaveBeenCalledWith(testUser);
  });

  test("4. failed login displays the backend authentication error", async () => {
    const login = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      }),
    });

    render(
      <AuthContext.Provider
        value={createAuthValue({ login })}
      >
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    fireEvent.change(
      screen.getByLabelText("Email"),
      {
        target: {
          value: "creator@example.com",
        },
      },
    );

    fireEvent.change(
      screen.getByLabelText("Password"),
      {
        target: {
          value: "WrongPassword123!",
        },
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Login" }),
    );

    expect(
      await screen.findByText(
        "Invalid email or password.",
      ),
    ).toBeInTheDocument();

    expect(login).not.toHaveBeenCalled();
  });

  test("5. logout ends the session and protected pages redirect to login", async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === "/api/auth/me") {
        return {
          ok: true,
          json: async () => ({
            user: testUser,
          }),
        };
      }

      if (url === "/api/auth/logout") {
        return {
          ok: true,
          status: 204,
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/logout"]}>
          <Routes>
            <Route
              path="/logout"
              element={
                <ProtectedRoute>
                  <Logout />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <p>Protected profile content</p>
                </ProtectedRoute>
              }
            />

            <Route
              path="/login"
              element={
                <section>
                  <h1>Login destination</h1>
                  <Link to="/profile">
                    Try protected profile
                  </Link>
                </section>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    const logoutButton = await screen.findByRole(
      "button",
      {
        name: "Logout",
      },
    );

    fireEvent.click(logoutButton);

    expect(
      await screen.findByRole("heading", {
        name: "Login destination",
      }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      {
        method: "POST",
        credentials: "include",
      },
    );

    fireEvent.click(
      screen.getByRole("link", {
        name: "Try protected profile",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Login destination",
        }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Protected profile content"),
    ).not.toBeInTheDocument();
  });
});