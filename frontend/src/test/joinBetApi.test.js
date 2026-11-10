import { afterEach, describe, expect, test, vi } from "vitest";
import { joinBetApi } from "../services/betApi";

// Synthetic bet data used by the Join Bet API tests.
const testBet = {
  id: "synthetic-bet-001",
  title: "Sprint 4 Test Bet",
  status: "open",
  creator_id: 100,
  current_participants: 2,
  max_participants: 5,
};

// Expected participation returned after a successful join.
const testParticipation = {
  bet_id: testBet.id,
  user_id: 101,
  selected_option_id: null,
  current_participants: 2,
};

/**
 * Mock an HTTP response returned by fetch.
 *
 * Tests can provide successful or unsuccessful response data
 * without requiring a running backend.
 */
function mockResponse(status, data) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Restore mocked globals and calls after each test.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SCRUM-760 Join Bet API Tests", () => {
  test("valid invite code sends a join request", async () => {
    // The updated backend returns both participation and bet.
    const fetchMock = mockResponse(201, {
      participation: testParticipation,
      bet: testBet,
    });

    const result = await joinBetApi("  abc123  ");

    // The frontend service returns the updated bet.
    expect(result).toEqual(testBet);

    // The backend expects join_code, not invite_code.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bets/join",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          join_code: "ABC123",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("valid selected option is included in join request", async () => {
    const selectedOptionID = "option-001";

    const fetchMock = mockResponse(201, {
      participation: {
        ...testParticipation,
        selected_option_id: selectedOptionID,
      },
      bet: testBet,
    });

    const result = await joinBetApi("ABC123", selectedOptionID);

    expect(result).toEqual(testBet);

    // A selected answer is forwarded using the backend field name.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bets/join",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          join_code: "ABC123",
          selected_option_id: selectedOptionID,
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

    // Invalid input should never generate a request.
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

    await expect(joinBetApi("ABC123")).rejects.toThrow("This bet is locked.");
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

    await expect(joinBetApi("ABC123")).rejects.toThrow("Network unavailable");
  });

  test("malformed success response is rejected", async () => {
    mockResponse(201, {});

    await expect(joinBetApi("ABC123")).rejects.toThrow(
      "Invalid Join Bet API response.",
    );
  });

  test("missing participation data is rejected", async () => {
    // A bet object alone does not satisfy the new contract.
    mockResponse(201, {
      bet: testBet,
    });

    await expect(joinBetApi("ABC123")).rejects.toThrow(
      "Invalid Join Bet API response.",
    );
  });
});
