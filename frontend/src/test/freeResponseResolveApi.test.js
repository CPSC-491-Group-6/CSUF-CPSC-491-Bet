import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../config/freeResponse", () => ({
  FREE_RESPONSE_JOIN_ENABLED: false,
  FREE_RESPONSE_RESOLVE_ENABLED: true,
}));

import { resolveFreeResponseBetApi } from "../services/betApi";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SCRUM-770 free-response resolution API", () => {
  test("sends the final result and selected user IDs", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        bet: {
          status: "resolved",
          resolution_text: "112 - 105",
          winning_user_ids: ["p1"],
        },
      }),
    });

    await resolveFreeResponseBetApi("bet 1", {
      resolution_text: " 112 - 105 ",
      winning_user_ids: ["p1"],
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/bets/bet%201/resolve",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          resolution_text: "112 - 105",
          winning_user_ids: ["p1"],
        }),
      }),
    );
  });

  test("accepts zero winners", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        bet: {
          status: "resolved",
          resolution_text: "Nobody won",
          winning_user_ids: [],
        },
      }),
    });
    await expect(
      resolveFreeResponseBetApi("abc", {
        resolution_text: "Nobody won",
        winning_user_ids: [],
      }),
    ).resolves.toBeDefined();
  });

  test("rejects invalid final results without sending a request", async () => {
    await expect(
      resolveFreeResponseBetApi("abc", {
        resolution_text: " ",
        winning_user_ids: [],
      }),
    ).rejects.toThrow("Final outcome");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("rejects HTTP errors without reporting a successful resolution", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "Not the creator" } }),
    });
    await expect(
      resolveFreeResponseBetApi("abc", {
        resolution_text: "Final score",
        winning_user_ids: [],
      }),
    ).rejects.toThrow("Not the creator");
  });

  test("rejects a response that does not confirm resolved status", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bet: { status: "locked" } }),
    });
    await expect(
      resolveFreeResponseBetApi("abc", {
        resolution_text: "Final score",
        winning_user_ids: [],
      }),
    ).rejects.toThrow("Invalid Free-response Resolve API response");
  });
});
