
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import Login from "../pages/Login";
import Profile from "../pages/Profile";
import { useAuth } from "../context/useAuth";

import {
  authenticatedState,
  createFailedAuthResponse,
  createSuccessfulAuthResponse,
  invalidCredentials,
  testUser,
  unauthenticatedState,
  validCredentials,
} from "./authFixtures";

import {
  createAuthenticatedAuthValue,
  createAuthValue,
  mockAuthFetch,
  renderWithAuthState,
  resetAuthTestState,
} from "./authHelpers";

function AuthStateProbe() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div>
      <p data-testid="auth-status">
        {isAuthenticated ? "authenticated" : "unauthenticated"}
      </p>
      <p data-testid="auth-user">
        {user?.username ?? "none"}
      </p>
    </div>
  );
}

afterEach(() => {
  cleanup();
  resetAuthTestState();
});

describe("SCRUM-728 Authentication Test Foundation", () => {
  test("valid synthetic credentials are available", () => {
    expect(validCredentials.email).toBe("testuser@example.com");
    expect(validCredentials.password).toBeTruthy();
    expect(testUser.email).toBe(validCredentials.email);
  });

  test("invalid credentials are independent of valid credentials", () => {
    expect(invalidCredentials.email).not.toBe(
      validCredentials.email,
    );
    expect(invalidCredentials.password).not.toBe(
      validCredentials.password,
    );
  });

  test("unauthenticated state can be initialized", () => {
    const auth = createAuthValue(unauthenticatedState);

    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.loading).toBe(false);
  });

  test("authenticated state can be initialized", () => {
    const auth = createAuthenticatedAuthValue();

    expect(auth.user).toEqual(testUser);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.loading).toBe(false);
  });

  test("Login component renders without a backend connection", () => {
    renderWithAuthState(<Login />);

    expect(
      screen.getByRole("heading", { name: "Login" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  test("Profile component renders with authenticated state", () => {
    renderWithAuthState(<Profile />, {
      authState: authenticatedState,
      route: "/profile",
    });

    expect(
      screen.getByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();
  });

  test("render helper provides unauthenticated context", () => {
    renderWithAuthState(<AuthStateProbe />);

    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "unauthenticated",
    );

    expect(screen.getByTestId("auth-user")).toHaveTextContent(
      "none",
    );
  });

  test("render helper provides authenticated context", () => {
    renderWithAuthState(<AuthStateProbe />, {
      authState: authenticatedState,
    });

    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "authenticated",
    );

    expect(screen.getByTestId("auth-user")).toHaveTextContent(
      testUser.username,
    );
  });

  test("successful authentication response can be mocked", async () => {
    const fetchMock = mockAuthFetch(
      createSuccessfulAuthResponse(),
    );

    const response = await fetch("/api/auth/me");
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.user).toEqual(testUser);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("failed authentication response can be mocked", async () => {
    const fetchMock = mockAuthFetch(
      createFailedAuthResponse(),
    );

    const response = await fetch("/api/auth/login");
    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
    expect(data.error.code).toBe("INVALID_CREDENTIALS");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("authentication mocks are independently initialized", () => {
    const first = createAuthValue();
    const second = createAuthValue();

    first.login(testUser);

    expect(first.login).toHaveBeenCalledOnce();
    expect(second.login).not.toHaveBeenCalled();
  });

  test("authentication states do not share mutable user data", () => {
    const first = createAuthenticatedAuthValue({
      user: { ...testUser },
    });

    const second = createAuthenticatedAuthValue({
      user: { ...testUser },
    });

    first.user.username = "modified_test_user";

    expect(second.user.username).toBe("test_user");
  });

  test("test helpers support explicit failing assertions", () => {
    const auth = createAuthValue();

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isAuthenticated).not.toBe(true);
    expect(vi.isMockFunction(auth.login)).toBe(true);
  });
});
