import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import JoinBet from "../pages/JoinBet";
import { joinBet } from "../services/betService";

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { id: "friend-1" } }),
}));
vi.mock("../services/betService", () => ({
  joinBet: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SCRUM-770 free-response Join page", () => {
  test("shows a prediction field but blocks joins while backend support is off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          bet: {
            id: "bet-1",
            title: "Predict the final score",
            status: "open",
            creator_id: "creator-1",
            current_participants: 1,
            max_participants: 10,
            options: [],
          },
        }),
      }),
    );

    render(
      <MemoryRouter>
        <JoinBet />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Invite Code"), {
      target: { value: "invite123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find Bet" }));

    await screen.findByRole("heading", { name: "Bet Found" });
    const field = screen.getByRole("textbox", { name: "Your Prediction" });
    fireEvent.change(field, { target: { value: "Lakers 112-105" } });

    expect(field).toHaveValue("Lakers 112-105");
    expect(screen.getByRole("button", { name: "Join Bet" })).toBeDisabled();
    expect(
      screen.getByText(/Free-response joining requires backend support/),
    ).toBeInTheDocument();
    expect(joinBet).not.toHaveBeenCalled();
  });
});
