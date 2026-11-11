import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import ResolveBet from "../components/ResolveBet";

const testBet = {
  id: "bet-123",
  creator_id: 1,
  title: "Will it rain tomorrow?",
  status: "locked",
  options: [
    { id: "option-yes", label: "Yes" },
    { id: "option-no", label: "No" },
  ],
};

function renderResolveBet({
  bet = testBet,
  currentUserId = 1,
  onResolve = vi.fn(),
} = {}) {
  render(
    <ResolveBet
      bet={bet}
      currentUserId={currentUserId}
      onResolve={onResolve}
    />,
  );

  return { onResolve };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Sprint 4 Member B - Resolve Bet Component", () => {
  // RB-T01: Creator can resolve a locked bet.
  test("RB-T01: Creator sees Resolve Bet controls", () => {
    renderResolveBet();

    expect(
      screen.getByRole("heading", { name: "Resolve Bet" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Winning Outcome")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Resolve Bet" })).toBeDisabled();
  });

  // RB-T02: Non-creator cannot access Resolve controls.
  test("RB-T02: Non-creator cannot see Resolve Bet", () => {
    const { onResolve } = renderResolveBet({
      currentUserId: 2,
    });

    expect(
      screen.queryByRole("heading", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();

    expect(onResolve).not.toHaveBeenCalled();
  });

  // RB-T03: Open bets cannot be resolved.
  test("RB-T03: Creator cannot resolve an open bet", () => {
    renderResolveBet({
      bet: { ...testBet, status: "open" },
    });

    expect(
      screen.queryByRole("button", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();
  });

  // RB-T04: Already resolved bets cannot be resolved again.
  test("RB-T04: Creator cannot resolve an already resolved bet", () => {
    renderResolveBet({
      bet: {
        ...testBet,
        status: "resolved",
        winning_option_id: "option-yes",
      },
    });

    expect(
      screen.queryByRole("button", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();
  });

  // RB-T05: Creator selects a valid winning option.
  test("RB-T05: Selecting an outcome enables resolution", () => {
    renderResolveBet();

    const select = screen.getByLabelText("Winning Outcome");

    fireEvent.change(select, {
      target: { value: "option-yes" },
    });

    expect(select).toHaveValue("option-yes");

    const resolveButton = screen.getByRole("button", {
      name: "Resolve Bet",
    });

    expect(resolveButton).toBeEnabled();

    fireEvent.click(resolveButton);

    expect(
      screen.getByRole("heading", {
        name: "Confirm Resolution",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Winning Outcome:/).closest("p")).toHaveTextContent(
      "Winning Outcome: Yes",
    );
  });

  // RB-T06: Cancel confirmation without submitting.
  test("RB-T06: Cancel does not resolve the bet", () => {
    const { onResolve } = renderResolveBet();

    fireEvent.change(screen.getByLabelText("Winning Outcome"), {
      target: { value: "option-no" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Resolve Bet" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onResolve).not.toHaveBeenCalled();

    expect(screen.getByLabelText("Winning Outcome")).toHaveValue("option-no");
  });

  // RB-T07: Confirm resolution with correct option ID.
  test("RB-T07: Confirm sends selected winning option", async () => {
    const onResolve = vi.fn().mockResolvedValue({
      bet: {
        ...testBet,
        status: "resolved",
        winning_option_id: "option-yes",
      },
    });

    renderResolveBet({ onResolve });

    fireEvent.change(screen.getByLabelText("Winning Outcome"), {
      target: { value: "option-yes" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Resolve Bet" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm Resolution",
      }),
    );

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledTimes(1);
      expect(onResolve).toHaveBeenCalledWith("option-yes");
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: "Confirm Resolution",
        }),
      ).not.toBeInTheDocument();
    });
  });

  // RB-T08: Backend failure displays an error.
  test("RB-T08: Failed resolution displays error", async () => {
    const onResolve = vi
      .fn()
      .mockRejectedValue(new Error("Only locked bets may be resolved."));

    renderResolveBet({ onResolve });

    fireEvent.change(screen.getByLabelText("Winning Outcome"), {
      target: { value: "option-no" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Resolve Bet" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm Resolution",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only locked bets may be resolved.",
    );

    expect(
      screen.getByRole("button", {
        name: "Confirm Resolution",
      }),
    ).toBeEnabled();

    expect(onResolve).toHaveBeenCalledWith("option-no");
  });
});