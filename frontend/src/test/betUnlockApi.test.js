import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { unlockBetApi } from "../services/betApi";

vi.mock("../config/betUnlock", () => ({ BET_UNLOCK_ENABLED: true }));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("Unlock Bet API adapter", () => {
  test("posts to the planned endpoint with the authenticated session", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bet: { id: "bet-1", status: "open" } }),
    });
    expect(await unlockBetApi("bet-1")).toMatchObject({
      id: "bet-1",
      status: "open",
    });
    expect(fetch).toHaveBeenCalledWith("/api/bets/bet-1/unlock", {
      method: "POST",
      credentials: "include",
    });
  });
  test("rejects a response that did not confirm the transition", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bet: { id: "bet-1", status: "locked" } }),
    });
    await expect(unlockBetApi("bet-1")).rejects.toThrow(
      "Invalid Unlock Bet API response.",
    );
  });
  test("rejects API errors without returning a false successful state", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "Only creator can unlock" } }),
    });
    await expect(unlockBetApi("bet-1")).rejects.toThrow(
      "Only creator can unlock",
    );
  });
});
