import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BetHistory from "../pages/BetHistory";
import { getBetHistory } from "../services/betService";

vi.mock("../services/betService", () => ({
  getBetHistory: vi.fn(),
}));

function renderHistory(bets) {
  getBetHistory.mockResolvedValue(bets);
  return render(
    <MemoryRouter>
      <BetHistory />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("SCRUM-770 free-response Bet History", () => {
  it("shows the persisted written outcome, participant predictions, and winners", async () => {
    renderHistory([
      {
        id: "typed-1",
        title: "Final game score",
        status: "resolved",
        resolution_text: "Lakers won 112 - 105",
        prediction_text: "112 - 105",
        is_winner: true,
        winning_user_ids: ["participant-1"],
        participants: [
          {
            user_id: "participant-1",
            username: "Alex",
            prediction_text: "112 - 105",
          },
          {
            user_id: "participant-2",
            username: "Blair",
            prediction_text: "110 - 105",
          },
        ],
      },
    ]);

    expect(await screen.findByText("Final game score")).toBeInTheDocument();
    expect(screen.getByText("Lakers won 112 - 105")).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
    const predictions = screen.getByRole("region", {
      name: "Participant predictions",
    });
    const alex = within(predictions).getByText("Alex").closest("li");
    const blair = within(predictions).getByText("Blair").closest("li");
    expect(alex).toHaveTextContent("112 - 105");
    expect(alex).toHaveTextContent("Winner");
    expect(blair).toHaveTextContent("110 - 105");
    expect(blair).toHaveTextContent("Not selected");
  });

  it("supports zero winners without showing a false win", async () => {
    renderHistory([
      {
        id: "typed-2",
        title: "Nobody got the final score",
        status: "resolved",
        resolution_text: "Final score was 101 - 99",
        prediction_text: "99 - 98",
        is_winner: false,
        winning_user_ids: [],
        participants: [
          {
            user_id: "participant-5",
            username: "Morgan",
            prediction_text: "99 - 98",
          },
        ],
      },
    ]);

    expect(
      await screen.findByText("No winners were selected."),
    ).toBeInTheDocument();
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(screen.getByText("Morgan").closest("li")).toHaveTextContent(
      "Not selected",
    );
  });

  it("keeps unavailable fields unknown instead of inventing winners", async () => {
    renderHistory([
      {
        id: "typed-3",
        title: "Backend has not returned participant details",
        status: "resolved",
        resolution_text: "Game ended 3 - 2",
      },
    ]);

    expect(await screen.findByText("Game ended 3 - 2")).toBeInTheDocument();
    expect(screen.getByText("Not determined")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(
      screen.getByText(/Participant predictions are not included/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
  });

  it("preserves the existing multiple-choice results without typed fields", async () => {
    renderHistory([
      {
        id: "multiple-choice",
        title: "Who wins the match?",
        status: "resolved",
        winning_option_label: "Team Blue",
        selected_option_label: "Team Red",
        is_winner: false,
      },
    ]);

    expect(await screen.findByText("Who wins the match?")).toBeInTheDocument();
    expect(screen.getByText("Team Blue")).toBeInTheDocument();
    expect(screen.getByText("Team Red")).toBeInTheDocument();
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Participant predictions" }),
    ).not.toBeInTheDocument();
  });
});
