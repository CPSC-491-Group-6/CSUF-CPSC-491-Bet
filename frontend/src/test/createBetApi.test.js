import { afterEach, describe, expect, test, vi } from "vitest";
import { createBetApi } from "../services/betApi";

const validBet = {
  title: "Sprint 5 Creator Selection",
  description: "Testing creator answers",
  visibility: "public",
  max_participants: 5,
};

const createdBet = {
  id: "test-bet-823",
  title: validBet.title,
  visibility: "public",
  join_code: "TEST823",
};

function mockResponse(status = 201, data = { bet: createdBet }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function getRequestBody(fetchMock) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SCRUM-823 Creator Answer Selection API", () => {
  test("selecting Yes sends numeric index 0", async () => {
    const fetchMock = mockResponse();

    const result = await createBetApi({
      ...validBet,
      options: ["Yes", "No"],
      creator_selected_option_index: 0,
    });

    expect(result).toEqual(createdBet);
    expect(fetchMock).toHaveBeenCalledOnce();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bets",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );

    const body = getRequestBody(fetchMock);

    expect(body.options).toEqual(["Yes", "No"]);
    expect(body.creator_selected_option_index).toBe(0);
    expect(typeof body.creator_selected_option_index).toBe("number");
  });

  test("selecting No sends numeric index 1", async () => {
    const fetchMock = mockResponse();

    await createBetApi({
      ...validBet,
      options: ["Yes", "No"],
      creator_selected_option_index: 1,
    });

    const body = getRequestBody(fetchMock);

    expect(body.creator_selected_option_index).toBe(1);
    expect(typeof body.creator_selected_option_index).toBe("number");
  });

  test("legacy bets omit answer selection fields", async () => {
    const fetchMock = mockResponse();

    await createBetApi(validBet);

    const body = getRequestBody(fetchMock);

    expect(body).not.toHaveProperty("options");
    expect(body).not.toHaveProperty("creator_selected_option_index");
  });

  test("stale selection is omitted when options are disabled", async () => {
    const fetchMock = mockResponse();

    await createBetApi({
      ...validBet,
      creator_selected_option_index: 1,
    });

    const body = getRequestBody(fetchMock);

    expect(body).not.toHaveProperty("creator_selected_option_index");
  });

  test("missing creator selection is rejected", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createBetApi({
        ...validBet,
        options: ["Yes", "No"],
      }),
    ).rejects.toThrow("Please select a valid answer.");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([-1, 2, 0.5, "0", null])(
    "invalid selected index %s is rejected",
    async (invalidIndex) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createBetApi({
          ...validBet,
          options: ["Yes", "No"],
          creator_selected_option_index: invalidIndex,
        }),
      ).rejects.toThrow("Please select a valid answer.");

      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test("backend validation error is preserved", async () => {
    mockResponse(400, {
      error: {
        message: "Selected answer index is invalid.",
      },
    });

    await expect(
      createBetApi({
        ...validBet,
        options: ["Yes", "No"],
        creator_selected_option_index: 0,
      }),
    ).rejects.toThrow("Selected answer index is invalid.");
  });

  test("creator identity and participation are handled by backend", async () => {
    const fetchMock = mockResponse();

    await createBetApi({
      ...validBet,
      options: ["Yes", "No"],
      creator_selected_option_index: 0,
    });

    const body = getRequestBody(fetchMock);

    expect(body).not.toHaveProperty("selected_option_id");
    expect(body).not.toHaveProperty("user_id");
    expect(body).not.toHaveProperty("creator_id");

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
