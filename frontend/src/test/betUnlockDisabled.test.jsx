import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BetDetail from "../pages/BetDetail";
import { getBet, unlockBet } from "../services/betService";

vi.mock("../config/betUnlock", () => ({ BET_UNLOCK_ENABLED: false }));
vi.mock("../services/betService", () => ({
  getBet: vi.fn(),
  joinBet: vi.fn(),
  lockBet: vi.fn(),
  unlockBet: vi.fn(),
  resolveBet: vi.fn(),
  resolveFreeResponseBet: vi.fn(),
}));
let activeUser = { id: "creator" };
vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: activeUser }),
}));

const baseBet = {
  id: "unlock-example",
  title: "Will it rain?",
  description: "Weather bet",
  creator_id: "creator",
  visibility: "private",
  status: "locked",
  max_participants: 3,
  current_participants: 1,
  options: [
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" },
  ],
  participants: [
    { user_id: "creator", username: "Creator", selected_option_id: "yes" },
  ],
};
function showBet() {
  render(
    <MemoryRouter initialEntries={["/bets/unlock-example"]}>
      <Routes>
        <Route path="/bets/:betId" element={<BetDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  activeUser = { id: "creator" };
  vi.clearAllMocks();
  getBet.mockResolvedValue({ ...baseBet });
});
afterEach(() => cleanup());

describe("Unlock Bet while backend is pending", () => {
  test("shows a disabled Unlock Bet action and an explanation for locked creator bets", async () => {
    showBet();
    const button = await screen.findByRole("button", { name: /unlock bet/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/unlocking requires backend support/i),
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(unlockBet).not.toHaveBeenCalled();
  });
  test("does not show Unlock Bet for a locked non-creator", async () => {
    activeUser = { id: "participant" };
    showBet();
    await screen.findByRole("heading", { name: "Participant List" });
    expect(
      screen.queryByRole("button", { name: /unlock bet/i }),
    ).not.toBeInTheDocument();
  });
  test("does not show Unlock Bet for a resolved bet", async () => {
    getBet.mockResolvedValue({
      ...baseBet,
      status: "resolved",
      winning_option_id: "yes",
    });
    showBet();
    await screen.findByRole("heading", { name: "Participant List" });
    expect(
      screen.queryByRole("button", { name: /unlock bet/i }),
    ).not.toBeInTheDocument();
  });
  test("keeps the existing Lock Bet action on open creator bets", async () => {
    getBet.mockResolvedValue({ ...baseBet, status: "open" });
    showBet();
    expect(
      await screen.findByRole("button", { name: "Lock Bet" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /unlock bet/i }),
    ).not.toBeInTheDocument();
  });
});
