import "@testing-library/jest-dom/vitest";
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

import Layout from "../components/Layout";
import CreateBet from "../pages/CreateBet";
import Dashboard from "../pages/Dashboard";
import JoinBet from "../pages/JoinBet";
import BetDetail from "../pages/BetDetail";
import BetHistory from "../pages/BetHistory";
import {
  createBet,
  getMyBets,
  getBet,
  joinBet,
  lockBet,
  resolveBet,
  getBetHistory,
} from "../services/betService";

// UI integration tests: only the service boundary is mocked. The real pages,
// navigation, user-facing validation, and state refresh paths execute together.
vi.mock("../services/betService", () => ({
  createBet: vi.fn(),
  getMyBets: vi.fn(),
  getBet: vi.fn(),
  joinBet: vi.fn(),
  lockBet: vi.fn(),
  unlockBet: vi.fn(),
  resolveBet: vi.fn(),
  resolveFreeResponseBet: vi.fn(),
  getBetHistory: vi.fn(),
}));

let activeUser;
vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: activeUser, isAuthenticated: true, loading: false }),
}));

const creator = { id: "creator-772", username: "Creator" };
const participant = { id: "participant-772", username: "Alex" };
const outsider = { id: "outsider-772", username: "Blair" };
const betId = "lifecycle-772";
const joinCode = "TEST772";
const title = "Sprint 5 lifecycle challenge";
let savedBet;

function snapshot(value) {
  return structuredClone(value);
}

function seedBet(status = "open") {
  savedBet = {
    id: betId,
    title,
    description: "End-to-end frontend workflow",
    status,
    creator_id: creator.id,
    visibility: "private",
    join_code: joinCode,
    max_participants: 4,
    current_participants: 1,
    options: [
      { id: "yes", label: "Yes", position: 0 },
      { id: "no", label: "No", position: 1 },
    ],
    participants: [
      {
        user_id: creator.id,
        username: creator.username,
        selected_option_id: "yes",
      },
    ],
    winning_option_id: null,
  };
}

function renderApplication(path = "/create") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateBet />} />
          <Route path="/join" element={<JoinBet />} />
          <Route path="/bets/:betId" element={<BetDetail />} />
          <Route path="/history" element={<BetHistory />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function navigateTo(label) {
  // Navbar links always exist and trigger real React Router transitions.
  fireEvent.click(
    within(screen.getByRole("navigation")).getByRole("link", { name: label }),
  );
}

function selectWinningOption() {
  fireEvent.change(screen.getByLabelText("Winning Outcome"), {
    target: { value: "yes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Resolve Bet" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Resolution" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  activeUser = creator;
  savedBet = null;

  createBet.mockImplementation(async (_creatorId, payload) => {
    savedBet = {
      id: betId,
      title: payload.title,
      description: payload.description,
      creator_id: creator.id,
      status: "open",
      visibility: payload.visibility,
      join_code: joinCode,
      max_participants: payload.max_participants,
      current_participants: 1,
      options: payload.options.map((label, index) => ({
        id: index === 0 ? "yes" : "no",
        label,
        position: index,
      })),
      participants: [
        {
          user_id: creator.id,
          username: creator.username,
          selected_option_id:
            payload.creator_selected_option_index === 0 ? "yes" : "no",
        },
      ],
      winning_option_id: null,
    };
    return { bet: snapshot(savedBet) };
  });

  getMyBets.mockImplementation(async () =>
    savedBet && savedBet.participants.some((p) => p.user_id === activeUser.id)
      ? [snapshot(savedBet)]
      : [],
  );

  getBet.mockImplementation(async (id) => {
    if (!savedBet || id !== betId) throw new Error("Bet not found");
    return snapshot(savedBet);
  });

  joinBet.mockImplementation(async (code, answerId) => {
    if (code !== joinCode) throw new Error("Invalid invite code.");
    if (savedBet.status !== "open") throw new Error("Bet is locked.");
    if (savedBet.participants.some((p) => p.user_id === activeUser.id)) {
      throw new Error("Already joined.");
    }
    savedBet.participants.push({
      user_id: activeUser.id,
      username: activeUser.username,
      selected_option_id: answerId,
    });
    savedBet.current_participants = savedBet.participants.length;
    return snapshot(savedBet);
  });

  lockBet.mockImplementation(async (id) => {
    if (id !== betId || activeUser.id !== creator.id) {
      throw new Error("Only the creator can lock the bet.");
    }
    if (savedBet.status !== "open") throw new Error("Bet is not open.");
    savedBet.status = "locked";
    return snapshot(savedBet);
  });

  resolveBet.mockImplementation(async (id, winningOptionId) => {
    if (id !== betId || activeUser.id !== creator.id) {
      throw new Error("Only the creator may resolve this bet.");
    }
    if (savedBet.status !== "locked") {
      throw new Error("Only locked bets may be resolved.");
    }
    savedBet.status = "resolved";
    savedBet.winning_option_id = winningOptionId;
    savedBet.resolved_at = "2026-11-16T12:00:00.000Z";
    return { bet: snapshot(savedBet), winners: [] };
  });

  getBetHistory.mockImplementation(async () => {
    if (!savedBet || savedBet.status !== "resolved") return [];
    const myAnswer = savedBet.participants.find(
      (p) => p.user_id === activeUser.id,
    )?.selected_option_id;
    if (!myAnswer) return [];
    const getLabel = (id) => savedBet.options.find((o) => o.id === id)?.label;
    return [
      {
        id: savedBet.id,
        title: savedBet.title,
        status: "resolved",
        resolved_at: savedBet.resolved_at,
        winning_option_label: getLabel(savedBet.winning_option_id),
        selected_option_label: getLabel(myAnswer),
        is_winner: myAnswer === savedBet.winning_option_id,
      },
    ];
  });

  // Dashboard's public list and Join Bet's code lookup use fetch directly.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      if (input === "/api/bets/public") {
        return { ok: true, json: async () => ({ bets: [] }) };
      }
      if (input === `/api/bets/code/${joinCode}` && savedBet) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ bet: snapshot(savedBet) }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SCRUM-772 frontend bet lifecycle regression", () => {
  test("Create -> Dashboard -> Join -> Lock -> Resolve -> History stays consistent", async () => {
    renderApplication("/create");

    fireEvent.change(screen.getByLabelText("Bet Title"), {
      target: { value: title },
    });
    fireEvent.click(screen.getByLabelText("Include Answer Choices"));
    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Bet" }));

    expect(
      await screen.findByRole("heading", { name: "Bet Created Successfully!" }),
    ).toBeInTheDocument();
    expect(createBet).toHaveBeenCalledTimes(1);
    expect(screen.getByText(joinCode)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Dashboard" }));
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "View Details" }));
    expect(
      await screen.findByRole("button", { name: "Lock Bet" }),
    ).toBeEnabled();

    // A different authenticated user joins via the real Join Bet screen.
    activeUser = participant;
    navigateTo("Join Bet");
    fireEvent.change(screen.getByLabelText("Invite Code"), {
      target: { value: joinCode },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find Bet" }));
    expect(
      await screen.findByRole("heading", { name: "Bet Found" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Join Bet" }));
    expect(
      await screen.findByText("You are participating in this bet."),
    ).toBeInTheDocument();
    expect(joinBet).toHaveBeenCalledWith(joinCode, "no");
    expect(savedBet.current_participants).toBe(2);
    expect(
      screen.queryByRole("button", { name: "Lock Bet" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();

    // Only the creator sees Lock, followed by Resolve once locked.
    activeUser = creator;
    navigateTo("Dashboard");
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "View Details" }));
    fireEvent.click(await screen.findByRole("button", { name: "Lock Bet" }));
    expect(
      await screen.findByText("Bet locked successfully."),
    ).toBeInTheDocument();
    expect(savedBet.status).toBe("locked");
    expect(
      screen.queryByRole("button", { name: "Lock Bet" }),
    ).not.toBeInTheDocument();

    // Locked bets cannot be joined by a third user.
    activeUser = outsider;
    navigateTo("Join Bet");
    fireEvent.change(screen.getByLabelText("Invite Code"), {
      target: { value: joinCode },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find Bet" }));
    expect(
      await screen.findByText(
        "This bet is locked and cannot accept new participants.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Join Bet" }),
    ).not.toBeInTheDocument();
    expect(joinBet).toHaveBeenCalledTimes(1);
    expect(savedBet.current_participants).toBe(2);

    activeUser = creator;
    navigateTo("Dashboard");
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "View Details" }));
    await screen.findByRole("heading", { name: "Resolve Bet" });
    selectWinningOption();
    expect(
      await screen.findByText("Bet resolved successfully."),
    ).toBeInTheDocument();
    expect(savedBet.status).toBe("resolved");
    expect(resolveBet).toHaveBeenCalledWith(betId, "yes");
    expect(
      screen.queryByRole("button", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Winning Outcome" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Winners (1)" }),
    ).toBeInTheDocument();

    navigateTo("Bet History");
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(screen.getAllByText("Yes")).toHaveLength(2);
    expect(getBetHistory).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("link", { name: "View Bet Details" }));
    expect(
      await screen.findByRole("heading", { name: "Winning Outcome" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();
  });

  test("a rejected Join preserves OPEN state and allows a later successful attempt", async () => {
    seedBet();
    activeUser = participant;
    joinBet.mockRejectedValueOnce(new Error("Invalid invite code."));
    renderApplication(`/bets/${betId}`);
    await screen.findByRole("heading", { name: "Answer Choices" });
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.change(screen.getByLabelText("Invite Code"), {
      target: { value: joinCode },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Join with Invite Code" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid invite code.",
    );
    expect(savedBet.status).toBe("open");
    expect(savedBet.participants).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "No" })).toBeChecked();

    fireEvent.click(
      screen.getByRole("button", { name: "Join with Invite Code" }),
    );
    expect(
      await screen.findByText("You successfully joined this bet."),
    ).toBeInTheDocument();
    expect(savedBet.participants).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Join with Invite Code" }),
    ).not.toBeInTheDocument();
    expect(getBet).toHaveBeenCalledTimes(2);
  });

  test("rejected Lock stays OPEN, then Lock succeeds without phantom state", async () => {
    seedBet();
    lockBet.mockRejectedValueOnce(new Error("Lock not permitted."));
    renderApplication(`/bets/${betId}`);
    fireEvent.click(await screen.findByRole("button", { name: "Lock Bet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lock not permitted.",
    );
    expect(savedBet.status).toBe("open");
    expect(screen.getByRole("button", { name: "Lock Bet" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lock Bet" }));
    expect(
      await screen.findByText("Bet locked successfully."),
    ).toBeInTheDocument();
    expect(savedBet.status).toBe("locked");
    expect(
      screen.getByRole("heading", { name: "Resolve Bet" }),
    ).toBeInTheDocument();
  });

  test("failed Resolve leaves LOCKED and empty History; successful retry appears in History", async () => {
    seedBet("locked");
    resolveBet.mockRejectedValueOnce(new Error("Resolution rejected."));
    renderApplication(`/bets/${betId}`);
    await screen.findByRole("heading", { name: "Resolve Bet" });
    selectWinningOption();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Resolution rejected.",
    );
    expect(savedBet.status).toBe("locked");
    expect(
      screen.queryByRole("heading", { name: "Winning Outcome" }),
    ).not.toBeInTheDocument();

    navigateTo("Bet History");
    expect(await screen.findByText("No resolved bets yet")).toBeInTheDocument();
    navigateTo("Dashboard");
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "View Details" }));
    await screen.findByRole("heading", { name: "Resolve Bet" });
    selectWinningOption();
    expect(
      await screen.findByText("Bet resolved successfully."),
    ).toBeInTheDocument();
    navigateTo("Bet History");
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(resolveBet).toHaveBeenCalledTimes(2);
  });

  test("a participant sees Lost in History but cannot access creator actions", async () => {
    seedBet("resolved");
    savedBet.winning_option_id = "yes";
    savedBet.current_participants = 2;
    savedBet.participants.push({
      user_id: participant.id,
      username: participant.username,
      selected_option_id: "no",
    });
    activeUser = participant;
    renderApplication("/history");

    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lost")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "View Bet Details" }));
    expect(
      await screen.findByRole("heading", { name: "Winning Outcome" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Winners (1)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lock Bet" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resolve Bet" }),
    ).not.toBeInTheDocument();
    expect(lockBet).not.toHaveBeenCalled();
    expect(resolveBet).not.toHaveBeenCalled();
  });

  test("an invalid code lookup cannot accidentally create a participant", async () => {
    seedBet();
    activeUser = outsider;
    renderApplication("/join");

    fireEvent.change(screen.getByLabelText("Invite Code"), {
      target: { value: "WRONG" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find Bet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid invite code.",
    );
    expect(
      screen.queryByRole("heading", { name: "Bet Found" }),
    ).not.toBeInTheDocument();
    expect(joinBet).not.toHaveBeenCalled();
    expect(savedBet.participants).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Invite Code"), {
      target: { value: joinCode },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find Bet" }));
    expect(
      await screen.findByRole("heading", { name: "Bet Found" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Join Bet" }));
    expect(
      await screen.findByText("You are participating in this bet."),
    ).toBeInTheDocument();
    expect(savedBet.participants).toHaveLength(2);
    expect(joinBet).toHaveBeenCalledExactlyOnceWith(joinCode, "no");
  });

  test("History retries a failed request rather than misreporting an empty history", async () => {
    seedBet("resolved");
    savedBet.winning_option_id = "yes";
    getBetHistory.mockRejectedValueOnce(
      new Error("History temporarily unavailable."),
    );
    renderApplication("/history");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "History temporarily unavailable.",
    );
    expect(screen.queryByText("No resolved bets yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
    await waitFor(() => expect(getBetHistory).toHaveBeenCalledTimes(2));
  });
});
