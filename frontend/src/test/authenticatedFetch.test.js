import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { authenticatedFetch } from "../services/authenticatedFetch";

describe("Authenticated API request handling", () => {
  const originalFetch = globalThis.fetch;
  let expiredHandler;

  beforeEach(() => {
    expiredHandler = vi.fn();

    window.addEventListener("auth:session-expired", expiredHandler);
  });

  afterEach(() => {
    window.removeEventListener("auth:session-expired", expiredHandler);
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("401 invalidates the frontend authentication session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
    });

    await authenticatedFetch("/api/bets");

    expect(expiredHandler).toHaveBeenCalledTimes(1);

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/bets", {
      credentials: "include",
    });
  });

  test("403 does not invalidate authentication", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
    });

    await authenticatedFetch("/api/bets");

    expect(expiredHandler).not.toHaveBeenCalled();
  });

  test("successful requests preserve authentication", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
    });

    await authenticatedFetch("/api/bets");

    expect(expiredHandler).not.toHaveBeenCalled();
  });

  test("304 is not treated as an authentication failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 304,
      ok: false,
    });

    await authenticatedFetch("/api/bets");

    expect(expiredHandler).not.toHaveBeenCalled();
  });
});
