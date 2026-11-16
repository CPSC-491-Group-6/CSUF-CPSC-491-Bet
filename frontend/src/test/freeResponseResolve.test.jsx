import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import FreeResponseResolve from "../components/FreeResponseResolve";

const lockedBet = {
  id: "bet-free",
  creator_id: "creator",
  status: "locked",
  current_participants: 3,
  options: [],
  participants: [
    { user_id: "creator", username: "Creator" },
    { user_id: "p1", username: "Alex", prediction_text: "112 - 105" },
    { user_id: "p2", username: "Blair", prediction_text: "112 - 105" },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderResolver(bet = lockedBet, overrides = {}) {
  const onResolve = vi.fn().mockResolvedValue({ bet: { status: "resolved" } });
  render(
    <FreeResponseResolve
      bet={bet}
      currentUserId="creator"
      onResolve={onResolve}
      enabled
      {...overrides}
    />,
  );
  return onResolve;
}

describe("SCRUM-770 free-response resolution", () => {
  test("only the creator of a locked free-response bet gets the resolver", () => {
    const { unmount } = render(
      <FreeResponseResolve
        bet={lockedBet}
        currentUserId="p1"
        onResolve={vi.fn()}
        enabled
      />,
    );
    expect(
      screen.queryByText("Resolve Free-Response Bet"),
    ).not.toBeInTheDocument();
    unmount();

    renderResolver({ ...lockedBet, status: "open" });
    expect(
      screen.queryByText("Resolve Free-Response Bet"),
    ).not.toBeInTheDocument();
  });

  test("passes multiple selected winners and the final outcome", async () => {
    const onResolve = renderResolver();
    fireEvent.click(screen.getByRole("checkbox", { name: /Alex/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Blair/i }));
    fireEvent.change(screen.getByLabelText("Final outcome"), {
      target: { value: "Final score: 112 - 105" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review Resolution" }));
    expect(
      screen.getByText("Winning participants:").parentElement,
    ).toHaveTextContent("Alex, Blair");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Resolution" }));
    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith({
        resolutionText: "Final score: 112 - 105",
        winningUserIds: ["p1", "p2"],
      });
    });
  });

  test("allows no winners with a documented final outcome", async () => {
    const onResolve = renderResolver();
    fireEvent.change(screen.getByLabelText("Final outcome"), {
      target: { value: "Nobody guessed correctly" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review Resolution" }));
    expect(
      screen.getByText("Winning participants:").parentElement,
    ).toHaveTextContent("None");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Resolution" }));
    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith({
        resolutionText: "Nobody guessed correctly",
        winningUserIds: [],
      });
    });
  });

  test("blocks submission when backend support is disabled", () => {
    const onResolve = renderResolver(lockedBet, { enabled: false });
    fireEvent.change(screen.getByLabelText("Final outcome"), {
      target: { value: "Answer" },
    });
    expect(
      screen.getByRole("button", { name: "Review Resolution" }),
    ).toBeDisabled();
    expect(onResolve).not.toHaveBeenCalled();
    expect(
      screen.getByText(/waiting for backend support/i),
    ).toBeInTheDocument();
  });

  test("does not submit if some participants have missing predictions", () => {
    const onResolve = renderResolver({
      ...lockedBet,
      participants: [
        lockedBet.participants[0],
        lockedBet.participants[1],
        { user_id: "p2", username: "Blair" },
      ],
    });
    fireEvent.change(screen.getByLabelText("Final outcome"), {
      target: { value: "Final score" },
    });
    expect(
      screen.getByRole("button", { name: "Review Resolution" }),
    ).toBeDisabled();
    expect(onResolve).not.toHaveBeenCalled();
    expect(
      screen.getByText(/predictions are unavailable/i),
    ).toBeInTheDocument();
  });

  test("keeps the confirmation visible and reports rejected API requests", async () => {
    const onResolve = vi.fn().mockRejectedValue(new Error("Forbidden"));
    renderResolver(lockedBet, { onResolve });
    fireEvent.change(screen.getByLabelText("Final outcome"), {
      target: { value: "Final score" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review Resolution" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Resolution" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    expect(
      screen.getByRole("heading", { name: "Confirm Resolution" }),
    ).toBeInTheDocument();
  });
});
