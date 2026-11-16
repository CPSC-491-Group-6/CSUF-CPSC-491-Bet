import { afterEach, describe, expect, test, vi } from "vitest";
import { joinBetApi } from "../services/betApi";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SCRUM-770 free-response Join API contract", () => {
  test("prepares trimmed text prediction for the planned backend payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        participation: { user_id: "user-1" },
        bet: { id: "bet-1" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await joinBetApi("invite123", undefined, "  Lakers 112-105  ");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      join_code: "INVITE123",
      prediction_text: "Lakers 112-105",
    });
    expect(body).not.toHaveProperty("selected_option_id");
  });

  test.each(["", "  ", "x".repeat(501)])(
    "rejects invalid prediction input without submitting",
    async (prediction) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        joinBetApi("invite123", undefined, prediction),
      ).rejects.toThrow("Prediction must be between 1 and 500 characters.");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test("rejects providing both a multiple-choice answer and typed prediction", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(joinBetApi("invite123", "option-yes", "Yes")).rejects.toThrow(
      "Choose an option or enter a prediction, not both.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("multiple-choice joining preserves the existing payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        participation: { user_id: "user-1" },
        bet: { id: "bet-1" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await joinBetApi("invite123", "option-yes");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      join_code: "INVITE123",
      selected_option_id: "option-yes",
    });
  });
});
