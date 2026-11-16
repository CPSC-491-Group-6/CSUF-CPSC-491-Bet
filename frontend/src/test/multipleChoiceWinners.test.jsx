import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BetDetail from "../pages/BetDetail";
import { getBet } from "../services/betService";

vi.mock("../services/betService", () => ({
  getBet: vi.fn(),
  joinBet: vi.fn(),
  lockBet: vi.fn(),
  resolveBet: vi.fn(),
  resolveFreeResponseBet: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { id: "creator" } }),
}));

function bet(overrides = {}) {
  return {
    id: "mc-winners-bet",
    title: "Will the team win?",
    description: "Choose your prediction.",
    creator_id: "creator",
    status: "resolved",
    visibility: "private",
    current_participants: 3,
    max_participants: 5,
    winning_option_id: "yes",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
    participants: [
      {
        user_id: "creator",
        username: "Test_Creator",
        selected_option_id: "yes",
      },
      { user_id: "friend-1", username: "friend", selected_option_id: "yes" },
      { user_id: "friend-2", username: "friend2", selected_option_id: "no" },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/bets/mc-winners-bet"]}>
      <Routes>
        <Route path="/bets/:betId" element={<BetDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getBet.mockReset();
  getBet.mockResolvedValue(bet());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SCRUM-770 multiple-choice winners", () => {
  test("lists participants who selected the winning answer", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Winners (2)" }),
    ).toBeInTheDocument();
    const winners = document.querySelector(".winning-outcome-winners-list");
    expect(winners).not.toBeNull();
    expect(within(winners).getByText("Test_Creator")).toBeInTheDocument();
    expect(within(winners).getByText("friend")).toBeInTheDocument();
    expect(within(winners).queryByText("friend2")).not.toBeInTheDocument();

    const participants = document.querySelector(".bet-participant-list");
    const winningParticipant = within(participants)
      .getByText("friend")
      .closest("li");
    const losingParticipant = within(participants)
      .getByText("friend2")
      .closest("li");
    expect(winningParticipant).toHaveTextContent("Winner");
    expect(losingParticipant).not.toHaveTextContent("Winner");
  });

  test("explains when no recorded selections matched", async () => {
    getBet.mockResolvedValue(
      bet({
        winning_option_id: "no",
        participants: [
          {
            user_id: "creator",
            username: "Test_Creator",
            selected_option_id: "yes",
          },
          {
            user_id: "friend-1",
            username: "friend",
            selected_option_id: "yes",
          },
        ],
        current_participants: 2,
      }),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Winners (0)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No recorded participant selections matched the winning answer.",
      ),
    ).toBeInTheDocument();
  });

  test("marks incomplete participant details rather than claiming a final count", async () => {
    getBet.mockResolvedValue(bet({ current_participants: 4 }));
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Winners (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/some participant answers are unavailable/i),
    ).toBeInTheDocument();
  });

  test("does not show winners for an unresolved bet", async () => {
    getBet.mockResolvedValue(
      bet({ status: "locked", winning_option_id: undefined }),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Participant List" });
    expect(
      screen.queryByRole("heading", { name: /Winners \(/ }),
    ).not.toBeInTheDocument();
  });
});
