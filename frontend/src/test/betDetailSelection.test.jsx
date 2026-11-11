import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import BetDetail from "../pages/BetDetail";
import { getBet, joinBet, lockBet } from "../services/betService";

vi.mock("../services/betService", () => ({
  getBet: vi.fn(),
  joinBet: vi.fn(),
  lockBet: vi.fn(),
}));

let activeUser = { id: "friend-1" };

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: activeUser }),
}));

const creator = {
  user_id: "creator-1",
  username: "Test_Creator",
  selected_option_id: "option-yes",
};

const friend = {
  user_id: "friend-1",
  username: "friend",
  selected_option_id: "option-no",
};

function makeBet(overrides = {}) {
  return {
    id: "bet-823",
    title: "Sprint 5 Answer Selection Test",
    description: "Testing saved participant answers",
    status: "open",
    visibility: "public",
    creator_id: "creator-1",
    max_participants: 5,
    current_participants: 1,
    join_code: "INVITE823",
    options: [
      { id: "option-yes", label: "Yes" },
      { id: "option-no", label: "No" },
    ],
    participants: [{ ...creator }],
    ...overrides,
  };
}

function renderBetDetail() {
  return render(
    <MemoryRouter initialEntries={["/bets/bet-823"]}>
      <Routes>
        <Route path="/bets/:betId" element={<BetDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function answerRow(label) {
  const list = document.querySelector(".bet-answer-list");
  expect(list).not.toBeNull();

  const option = within(list).getByText(label);
  return option.closest("li");
}

function enterInviteCode() {
  fireEvent.change(screen.getByLabelText("Invite Code"), {
    target: { value: "INVITE823" },
  });
}

function submitJoin() {
  fireEvent.click(
    screen.getByRole("button", { name: "Join with Invite Code" }),
  );
}

beforeEach(() => {
  activeUser = { id: "friend-1" };

  getBet.mockReset();
  joinBet.mockReset();
  lockBet.mockReset();

  getBet.mockResolvedValue(makeBet());
  joinBet.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SCRUM-823 Bet Details Answer Selection Regression", () => {
  test("creator sees their saved Yes answer", async () => {
    activeUser = { id: "creator-1" };

    renderBetDetail();

    await screen.findByRole("heading", { name: "Answer Choices" });

    expect(answerRow("Yes")).toHaveTextContent("Your Answer");
    expect(answerRow("Yes")).toHaveTextContent("1 selection");

    expect(answerRow("No")).not.toHaveTextContent("Your Answer");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(joinBet).not.toHaveBeenCalled();
  });

  test("creator sees their saved No answer", async () => {
    activeUser = { id: "creator-1" };

    getBet.mockResolvedValue(
      makeBet({
        participants: [
          {
            ...creator,
            selected_option_id: "option-no",
          },
        ],
      }),
    );

    renderBetDetail();

    await screen.findByRole("heading", { name: "Answer Choices" });

    expect(answerRow("No")).toHaveTextContent("Your Answer");
    expect(answerRow("No")).toHaveTextContent("1 selection");
    expect(answerRow("Yes")).not.toHaveTextContent("Your Answer");
  });

  test("nonparticipant can select an answer without duplicate controls", async () => {
    getBet.mockResolvedValue(
      makeBet({
        participants: [],
      }),
    );

    renderBetDetail();

    await screen.findByRole("heading", { name: "Answer Choices" });

    const yes = screen.getByRole("radio", { name: "Yes" });
    const no = screen.getByRole("radio", { name: "No" });

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(yes).not.toBeChecked();
    expect(no).not.toBeChecked();

    fireEvent.click(no);

    expect(no).toBeChecked();
    expect(yes).not.toBeChecked();

    // Selecting is not the same as saving an answer.
    expect(screen.queryByText("Your Answer")).not.toBeInTheDocument();
    expect(joinBet).not.toHaveBeenCalled();
  });

  test("missing answer blocks Join Bet submission", async () => {
    getBet.mockResolvedValue(
      makeBet({
        participants: [],
      }),
    );

    renderBetDetail();

    await screen.findByRole("heading", { name: "Answer Choices" });

    enterInviteCode();
    submitJoin();

    expect(
      screen.getByText("Please select an answer before joining."),
    ).toBeInTheDocument();

    expect(joinBet).not.toHaveBeenCalled();
  });

  test("successful joining saves No and refreshes Bet Details", async () => {
    const beforeJoin = makeBet({
      participants: [],
    });

    const afterJoin = makeBet({
      current_participants: 2,
      participants: [{ ...creator }, { ...friend }],
    });

    getBet.mockReset();
    getBet.mockResolvedValueOnce(beforeJoin).mockResolvedValueOnce(afterJoin);

    renderBetDetail();

    await screen.findByRole("heading", { name: "Answer Choices" });

    fireEvent.click(screen.getByRole("radio", { name: "No" }));

    enterInviteCode();
    submitJoin();

    await waitFor(() => {
      expect(joinBet).toHaveBeenCalledExactlyOnceWith("INVITE823", "option-no");
    });

    expect(
      await screen.findByText("You successfully joined this bet."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(answerRow("No")).toHaveTextContent("Your Answer");
    });

    expect(answerRow("Yes")).toHaveTextContent("1 selection");
    expect(answerRow("No")).toHaveTextContent("1 selection");

    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("Test_Creator")).toBeInTheDocument();
    expect(screen.getByText("friend")).toBeInTheDocument();

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Join with Invite Code" }),
    ).not.toBeInTheDocument();

    expect(joinBet).toHaveBeenCalledTimes(1);
    expect(getBet).toHaveBeenCalledTimes(2);
  });

  test("failed joining does not falsely mark an answer as saved", async () => {
    getBet.mockResolvedValue(
      makeBet({
        participants: [],
      }),
    );

    joinBet.mockRejectedValue(new Error("Invalid invite code."));

    renderBetDetail();

    await screen.findByRole("heading", { name: "Answer Choices" });

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));

    enterInviteCode();
    submitJoin();

    expect(await screen.findByText("Invalid invite code.")).toBeInTheDocument();

    expect(screen.getByRole("radio", { name: "Yes" })).toBeChecked();
    expect(screen.queryByText("Your Answer")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You successfully joined this bet."),
    ).not.toBeInTheDocument();

    expect(getBet).toHaveBeenCalledTimes(1);
  });

  test("existing participant sees saved answer and cannot join again", async () => {
    activeUser = { id: "friend-1" };

    getBet.mockResolvedValue(
      makeBet({
        current_participants: 2,
        participants: [{ ...creator }, { ...friend }],
      }),
    );

    renderBetDetail();

    await screen.findByRole("heading", { name: "Answer Choices" });

    expect(answerRow("No")).toHaveTextContent("Your Answer");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Join with Invite Code" }),
    ).not.toBeInTheDocument();

    expect(joinBet).not.toHaveBeenCalled();
  });

  test("legacy bets allow joining without an answer", async () => {
    getBet.mockResolvedValue(
      makeBet({
        options: [],
        participants: [],
      }),
    );

    renderBetDetail();

    await screen.findByRole("heading", {
      name: "Sprint 5 Answer Selection Test",
    });

    expect(
      screen.queryByRole("heading", { name: "Answer Choices" }),
    ).not.toBeInTheDocument();

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    enterInviteCode();
    submitJoin();

    await waitFor(() => {
      expect(joinBet).toHaveBeenCalledExactlyOnceWith("INVITE823", undefined);
    });
  });

  test("vote counts reflect individual participant selections", async () => {
    activeUser = { id: "creator-1" };

    getBet.mockResolvedValue(
      makeBet({
        current_participants: 3,
        participants: [
          { ...creator },
          {
            user_id: "friend-1",
            username: "friend",
            selected_option_id: "option-yes",
          },
          {
            user_id: "friend-2",
            username: "friend2",
            selected_option_id: "option-no",
          },
        ],
      }),
    );

    renderBetDetail();

    await screen.findByRole("heading", { name: "Answer Choices" });

    expect(answerRow("Yes")).toHaveTextContent("2 selections");
    expect(answerRow("No")).toHaveTextContent("1 selection");

    expect(screen.getByText("3 / 5")).toBeInTheDocument();
  });
});
