import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import BetDetail from "../pages/BetDetail";
import { getBet, joinBet, lockBet, resolveBet } from "../services/betService";

// Mock backend API service functions.
vi.mock("../services/betService", () => ({
  getBet: vi.fn(),
  joinBet: vi.fn(),
  lockBet: vi.fn(),
  resolveBet: vi.fn(),
}));

// Simulate the authenticated creator.
let activeUser = { userID: 1 };

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: activeUser }),
}));

const testBet = {
  id: "bet-123",
  creator_id: 1,
  title: "Will it rain tomorrow?",
  description: "Resolve Bet integration test",
  status: "locked",
  visibility: "public",
  max_participants: 3,
  current_participants: 1,
  join_code: "TEST123",
  options: [
    { id: "option-yes", label: "Yes", position: 0 },
    { id: "option-no", label: "No", position: 1 },
  ],
  participants: [
    {
      user_id: 1,
      username: "creator",
      selected_option_id: "option-yes",
    },
  ],
  winning_option_id: null,
};

function renderBetDetail() {
  return render(
    <MemoryRouter initialEntries={["/bets/bet-123"]}>
      <Routes>
        <Route path="/bets/:betId" element={<BetDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function selectWinningOutcome(optionId = "option-yes") {
  fireEvent.change(screen.getByLabelText("Winning Outcome"), {
    target: { value: optionId },
  });
}

function confirmResolution() {
  fireEvent.click(screen.getByRole("button", { name: "Resolve Bet" }));

  fireEvent.click(screen.getByRole("button", { name: "Confirm Resolution" }));
}

beforeEach(() => {
  activeUser = { userID: 1 };

  getBet.mockReset();
  joinBet.mockReset();
  lockBet.mockReset();
  resolveBet.mockReset();

  getBet.mockResolvedValue({ ...testBet });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Sprint 4 Member B - Resolve Bet Integration", () => {
  test("RB-I01: Creator sees Resolve Bet on locked bet", async () => {
    renderBetDetail();

    expect(
      await screen.findByRole("heading", { name: "Resolve Bet" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Winning Outcome")).toBeInTheDocument();

    expect(resolveBet).not.toHaveBeenCalled();
  });

  test("RB-I02: Confirm sends correct bet ID and option ID", async () => {
    resolveBet.mockResolvedValue({
      bet: {
        ...testBet,
        status: "resolved",
        winning_option_id: "option-yes",
        resolved_at: "2026-11-11T10:00:00.000Z",
      },
      winners: [],
    });

    getBet.mockResolvedValueOnce({ ...testBet }).mockResolvedValueOnce({
      ...testBet,
      status: "resolved",
      winning_option_id: "option-yes",
    });

    renderBetDetail();

    await screen.findByRole("heading", { name: "Resolve Bet" });

    selectWinningOutcome("option-yes");
    confirmResolution();

    await waitFor(() => {
      expect(resolveBet).toHaveBeenCalledExactlyOnceWith(
        "bet-123",
        "option-yes",
      );
    });
  });

  test("RB-I03: Successful resolution updates displayed status", async () => {
    const resolvedBet = {
      ...testBet,
      status: "resolved",
      winning_option_id: "option-yes",
      resolved_at: "2026-11-11T10:00:00.000Z",
    };

    resolveBet.mockResolvedValue({
      bet: resolvedBet,
      winners: [],
    });

    getBet
      .mockResolvedValueOnce({ ...testBet })
      .mockResolvedValueOnce(resolvedBet);

    renderBetDetail();

    await screen.findByRole("heading", { name: "Resolve Bet" });

    selectWinningOutcome("option-yes");
    confirmResolution();

    expect(
      await screen.findByText("Bet resolved successfully."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Resolve Bet" }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("heading", { name: "Winning Outcome" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Outcome confirmed")).toBeInTheDocument();
  });

  test("RB-I04: Failed resolution does not change bet status", async () => {
    resolveBet.mockRejectedValue(
      new Error("Only locked bets may be resolved."),
    );

    renderBetDetail();

    await screen.findByRole("heading", { name: "Resolve Bet" });

    selectWinningOutcome("option-no");
    confirmResolution();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only locked bets may be resolved.",
    );

    expect(
      screen.getByRole("button", { name: "Confirm Resolution" }),
    ).toBeEnabled();

    expect(
      screen.queryByRole("heading", { name: "Winning Outcome" }),
    ).not.toBeInTheDocument();

    expect(getBet).toHaveBeenCalledTimes(1);
  });
});
