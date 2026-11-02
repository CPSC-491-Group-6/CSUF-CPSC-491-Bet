
import { afterEach, describe, expect, test, vi } from "vitest";
import { joinBetApi } from "../services/betApi";

const testBet = {
  id: "synthetic-bet-001",
  title: "Sprint 4 Test Bet",
  status: "open",
  creator_id: 100,
  current_participants: 2,
  max_participants: 5,
};

function mockResponse(status, data) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SCRUM-760 Join Bet API Tests", () => {
  test("valid invite code sends a join request", async () => {
    const fetchMock = mockResponse(200, { bet: testBet });

    const result = await joinBetApi("  abc123  ");

    expect(result).toEqual(testBet);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bets/join",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invite_code: "ABC123",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("empty invite code is rejected", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(joinBetApi("   ")).rejects.toThrow(
      "Please enter an invite code.",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("unknown invite code is rejected", async () => {
    mockResponse(404, {
      error: { message: "Invalid invite code." },
    });

    await expect(joinBetApi("UNKNOWN123")).rejects.toThrow(
      "Invalid invite code.",
    );
  });

  test("duplicate join is rejected by API response", async () => {
    mockResponse(409, {
      error: {
        message: "Already participating in this bet.",
      },
    });

    await expect(joinBetApi("ABC123")).rejects.toThrow(
      "Already participating in this bet.",
    );
  });

  test("locked bet join is rejected by API response", async () => {
    mockResponse(409, {
      error: { message: "This bet is locked." },
    });

    await expect(joinBetApi("ABC123")).rejects.toThrow(
      "This bet is locked.",
    );
  });

  test("unauthenticated join is rejected", async () => {
    mockResponse(401, {
      error: { message: "Authentication required." },
    });

    await expect(joinBetApi("ABC123")).rejects.toThrow(
      "Authentication required.",
    );
  });

  test("server failure does not return successful join data", async () => {
    mockResponse(500, {
      error: { message: "Internal server error." },
    });

    await expect(joinBetApi("ABC123")).rejects.toThrow(
      "Internal server error.",
    );
  });

  test("network failure rejects the join request", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("Network unavailable"));

    vi.stubGlobal("fetch", fetchMock);

    await expect(joinBetApi("ABC123")).rejects.toThrow(
      "Network unavailable",
    );
  });

  test("malformed success response is rejected", async () => {
    mockResponse(200, {});

    await expect(joinBetApi("ABC123")).rejects.toThrow(
      "Invalid Join Bet API response.",
    );
  });
});
