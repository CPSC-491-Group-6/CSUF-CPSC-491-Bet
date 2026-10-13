import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import Register from "../pages/Register";
import { testUser, validCredentials } from "./authFixtures";
import { resetAuthTestState } from "./authHelpers";

describe("SCRUM-730 Registration Validation", () => {
  let fetchMock;

  const validRegistration = {
    username: testUser.username,
    email: validCredentials.email,
    password: validCredentials.password,
    confirmPassword: validCredentials.password,
  };

  function renderRegister() {
    return render(<Register />);
  }

  function fillRegistration(overrides = {}) {
    const data = { ...validRegistration, ...overrides };

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: data.username },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: data.email },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: data.password },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: data.confirmPassword },
    });
  }

  function submitRegistration() {
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
  }

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    resetAuthTestState();
  });

  test("renders all required Registration fields", () => {
    renderRegister();

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Password", { exact: true }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  test("rejects all empty required fields", () => {
    renderRegister();
    submitRegistration();

    expect(screen.getByText("Username is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(
      screen.getByText("Please confirm your password."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects username shorter than 3 characters", () => {
    renderRegister();
    fillRegistration({ username: "ab" });
    submitRegistration();

    expect(
      screen.getByText("Username must contain at least 3 characters."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("accepts the minimum 3-character username", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { ...testUser, username: "abc" } }),
    });

    renderRegister();
    fillRegistration({ username: "abc" });
    submitRegistration();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.username).toBe("abc");
  });

  test("rejects password shorter than 12 characters", () => {
    renderRegister();
    fillRegistration({
      password: "12345678901",
      confirmPassword: "12345678901",
    });
    submitRegistration();

    expect(
      screen.getByText("Password must contain at least 12 characters."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("accepts a 12-character password boundary", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ user: testUser }),
    });

    renderRegister();
    fillRegistration({
      password: "123456789012",
      confirmPassword: "123456789012",
    });
    submitRegistration();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  test("rejects mismatched passwords", () => {
    renderRegister();
    fillRegistration({
      confirmPassword: "DifferentPassword123!",
    });
    submitRegistration();

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects missing password confirmation", () => {
    renderRegister();
    fillRegistration({ confirmPassword: "" });
    submitRegistration();

    expect(
      screen.getByText("Please confirm your password."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("email input identifies invalid formatting", () => {
    renderRegister();

    const emailInput = screen.getByLabelText("Email");

    fireEvent.change(emailInput, {
      target: { value: "invalid-email" },
    });

    expect(emailInput.validity.typeMismatch).toBe(true);
    expect(emailInput.checkValidity()).toBe(false);
  });

  test("successful Registration submits valid data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ user: testUser }),
    });

    renderRegister();
    fillRegistration();
    submitRegistration();

    expect(
      await screen.findByText(
        `Registration successful for ${testUser.username}. You can now log in.`,
      ),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body).toEqual({
      username: validRegistration.username,
      email: validRegistration.email,
      password: validRegistration.password,
    });

    expect(body).not.toHaveProperty("confirmPassword");
  });

  test("trims username and email before submitting", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ user: testUser }),
    });

    renderRegister();
    fillRegistration({
      username: `  ${testUser.username}  `,
      email: `  ${validCredentials.email}  `,
    });
    submitRegistration();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.username).toBe(testUser.username);
    expect(body.email).toBe(validCredentials.email);
  });

  test("rejected Registration displays the server error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: { message: "Email already registered." },
      }),
    });

    renderRegister();
    fillRegistration();
    submitRegistration();

    expect(
      await screen.findByText("Email already registered."),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/Registration successful/),
    ).not.toBeInTheDocument();
  });

  test("network failure does not report successful Registration", async () => {
    fetchMock.mockRejectedValue(new Error("Network unavailable"));

    renderRegister();
    fillRegistration();
    submitRegistration();

    expect(await screen.findByText("Network unavailable")).toBeInTheDocument();

    expect(
      screen.queryByText(/Registration successful/),
    ).not.toBeInTheDocument();
  });

  test("correcting invalid inputs allows Registration", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ user: testUser }),
    });

    renderRegister();
    fillRegistration({ username: "ab" });
    submitRegistration();

    expect(
      screen.getByText("Username must contain at least 3 characters."),
    ).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();

    fillRegistration();
    submitRegistration();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    expect(
      screen.queryByText("Username must contain at least 3 characters."),
    ).not.toBeInTheDocument();
  });
});
