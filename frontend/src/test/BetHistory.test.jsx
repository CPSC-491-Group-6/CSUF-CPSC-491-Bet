import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BetHistory from "../pages/BetHistory";
import { getBetHistory } from "../services/betService";

vi.mock("../services/betService", () => ({
  getBetHistory: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BetHistory />
    </MemoryRouter>,
  );
}

describe("Bet History", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an empty state when the user has no resolved bets", async () => {
    getBetHistory.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("No resolved bets yet")).toBeInTheDocument();
  });

  it("shows resolved outcomes and the current user's result", async () => {
    getBetHistory.mockResolvedValue([
      {
        id: "bet-1",
        title: "Final score",
        status: "resolved",
        winning_option_label: "Lakers",
        selected_option_label: "Lakers",
        is_winner: true,
        resolved_at: "2026-11-09T11:00:00.000Z",
      },
      {
        id: "bet-2",
        title: "Second bet",
        status: "resolved",
        winning_option_label: "Yes",
        selected_option_label: "No",
        is_winner: false,
      },
    ]);
    renderPage();

    expect(await screen.findByText("Final score")).toBeInTheDocument();
    expect(screen.getByText("Second bet")).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(screen.getAllByText("View Bet Details")).toHaveLength(2);
  });

  it("shows a request error without displaying a false result", async () => {
    getBetHistory.mockRejectedValue(new Error("History service unavailable"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "History service unavailable",
    );
    expect(screen.queryByText("No resolved bets yet")).not.toBeInTheDocument();
  });
});
