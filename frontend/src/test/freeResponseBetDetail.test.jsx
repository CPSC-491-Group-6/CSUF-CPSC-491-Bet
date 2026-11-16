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

let activeUser = { id: "creator" };
vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: activeUser }),
}));

const bet = {
  id: "bet-typed",
  title: "What was the final score?",
  description: "Predict the final score.",
  creator_id: "creator",
  visibility: "private",
  status: "resolved",
  options: [],
  current_participants: 3,
  max_participants: 5,
  participants: [
    { user_id: "creator", username: "Creator" },
    { user_id: "p1", username: "Alex", prediction_text: "112 - 105" },
    { user_id: "p2", username: "Blair", prediction_text: "110 - 107" },
  ],
  resolution_text: "The actual score was 112 - 105",
  winning_user_ids: ["p1"],
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/bets/bet-typed"]}>
      <Routes>
        <Route path="/bets/:betId" element={<BetDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  activeUser = { id: "creator" };
  getBet.mockReset();
  getBet.mockResolvedValue(bet);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SCRUM-770 Bet Detail for typed outcomes", () => {
  test("displays persisted final result and selected winners", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Final Result" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The actual score was 112 - 105"),
    ).toBeInTheDocument();

    const participants = document.querySelector(".bet-participant-list");
    expect(participants).not.toBeNull();
    const alex = within(participants).getByText("Alex").closest("li");
    const blair = within(participants).getByText("Blair").closest("li");
    expect(alex).toHaveTextContent("Winner");
    expect(alex).toHaveTextContent("112 - 105");
    expect(blair).not.toHaveTextContent("Winner");
  });

  test("hides another participant's prediction while bet is locked", async () => {
    activeUser = { id: "p1" };
    getBet.mockResolvedValue({
      ...bet,
      status: "locked",
      resolution_text: undefined,
      winning_user_ids: undefined,
    });

    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Participant List" }),
    ).toBeInTheDocument();
    expect(screen.getByText("112 - 105")).toBeInTheDocument();
    expect(screen.queryByText("110 - 107")).not.toBeInTheDocument();
    expect(screen.queryByText("Final Result")).not.toBeInTheDocument();
  });
});
