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
import { getBet, unlockBet } from "../services/betService";

vi.mock("../config/betUnlock", () => ({ BET_UNLOCK_ENABLED: true }));
vi.mock("../services/betService", () => ({
  getBet: vi.fn(),
  joinBet: vi.fn(),
  lockBet: vi.fn(),
  unlockBet: vi.fn(),
  resolveBet: vi.fn(),
  resolveFreeResponseBet: vi.fn(),
}));
vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { id: "creator" } }),
}));

const lockedBet = {
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
  vi.clearAllMocks();
  getBet.mockResolvedValue({ ...lockedBet });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Unlock Bet after verified backend support", () => {
  test("confirms, submits, and changes the UI only on server-confirmed success", async () => {
    unlockBet.mockResolvedValue({ ...lockedBet, status: "open" });
    getBet
      .mockResolvedValueOnce(lockedBet)
      .mockResolvedValueOnce({ ...lockedBet, status: "open" });
    showBet();
    const button = await screen.findByRole("button", { name: /unlock bet/i });
    fireEvent.click(button);
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(unlockBet).toHaveBeenCalledWith("unlock-example"),
    );
    expect(
      await screen.findByRole("button", { name: "Lock Bet" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /unlock bet/i }),
    ).not.toBeInTheDocument();
  });
  test("canceling confirmation does not send a request", async () => {
    window.confirm.mockReturnValue(false);
    showBet();
    fireEvent.click(await screen.findByRole("button", { name: /unlock bet/i }));
    expect(unlockBet).not.toHaveBeenCalled();
  });
  test("a rejected API request leaves the bet locked and displays an error", async () => {
    unlockBet.mockRejectedValue(new Error("Unlock not authorized"));
    showBet();
    fireEvent.click(await screen.findByRole("button", { name: /unlock bet/i }));
    expect(
      await screen.findByText("Unlock not authorized"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Locked").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Lock Bet" }),
    ).not.toBeInTheDocument();
  });
});
