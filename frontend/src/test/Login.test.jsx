
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import Login from "../pages/Login";
import { invalidCredentials, testUser, validCredentials } from "./authFixtures";
import { renderWithAuthState, resetAuthTestState } from "./authHelpers";

describe("SCRUM-730 Login Validation", () => {
  let fetchMock;
  let authValue;

  function renderLogin() {
    const result = renderWithAuthState(<Login />);
    authValue = result.authValue;
    return result;
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

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    resetAuthTestState();
  });

  test("renders required Login fields", () => {
    renderLogin();

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  });

  test("rejects empty Login fields", () => {
    renderLogin();
    submitLogin();

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(authValue.login).not.toHaveBeenCalled();
  });

  test("rejects an empty email", () => {
    renderLogin();
    fillLogin("", validCredentials.password);
    submitLogin();

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects an empty password", () => {
    renderLogin();
    fillLogin(validCredentials.email, "");
    submitLogin();

    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("email input identifies invalid email formats", () => {
    renderLogin();

    const emailInput = screen.getByLabelText("Email");

    fireEvent.change(emailInput, {
      target: { value: "invalid-email" },
    });

    expect(emailInput.validity.typeMismatch).toBe(true);
    expect(emailInput.checkValidity()).toBe(false);
  });

  test("successful Login submits credentials and authenticates", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ user: testUser }),
    });

    renderLogin();
    fillLogin(validCredentials.email, validCredentials.password);
    submitLogin();

    await waitFor(() => {
      expect(authValue.login).toHaveBeenCalledWith(testUser);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify(validCredentials),
      }),
    );
  });

  test("trims email whitespace before submission", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ user: testUser }),
    });

    renderLogin();
    fillLogin(`  ${validCredentials.email}  `, validCredentials.password);
    submitLogin();

    await waitFor(() => {
      expect(authValue.login).toHaveBeenCalledOnce();
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.email).toBe(validCredentials.email);
  });

  test("rejected credentials do not authenticate", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: "Invalid email or password." },
      }),
    });

    renderLogin();
    fillLogin(invalidCredentials.email, invalidCredentials.password);
    submitLogin();

    expect(
      await screen.findByText("Invalid email or password."),
    ).toBeInTheDocument();

    expect(authValue.login).not.toHaveBeenCalled();
    expect(authValue.isAuthenticated).toBe(false);
  });

  test("network failures do not authenticate", async () => {
    fetchMock.mockRejectedValue(new Error("Network unavailable"));

    renderLogin();
    fillLogin(validCredentials.email, validCredentials.password);
    submitLogin();

    expect(
      await screen.findByText("Network unavailable"),
    ).toBeInTheDocument();

    expect(authValue.login).not.toHaveBeenCalled();
  });

  test("corrected credentials can be submitted after validation failure", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ user: testUser }),
    });

    renderLogin();
    submitLogin();

    expect(fetchMock).not.toHaveBeenCalled();

    fillLogin(validCredentials.email, validCredentials.password);
    submitLogin();

    await waitFor(() => {
      expect(authValue.login).toHaveBeenCalledWith(testUser);
    });

    expect(screen.queryByText("Email is required.")).not.toBeInTheDocument();
  });

  test("repeated rejected attempts never call login", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: "Invalid email or password." },
      }),
    });

    renderLogin();
    fillLogin(invalidCredentials.email, invalidCredentials.password);
    submitLogin();

    await screen.findByText("Invalid email or password.");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
    });

    submitLogin();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(authValue.login).not.toHaveBeenCalled();
  });
});
