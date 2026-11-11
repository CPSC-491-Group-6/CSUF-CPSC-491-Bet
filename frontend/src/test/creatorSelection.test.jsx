import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import CreateBet from "../pages/CreateBet";
import { createBet } from "../services/betService";

vi.mock("../services/betService", () => ({
  createBet: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { id: 42 } }),
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <CreateBet />
    </MemoryRouter>,
  );
}

function fillTitle() {
  fireEvent.change(screen.getByLabelText("Bet Title"), {
    target: { value: "Sprint 5 Creator Selection Test" },
  });
}

function toggleOptions() {
  fireEvent.click(screen.getByLabelText("Include Answer Choices"));
}

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: "Create Bet" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  createBet.mockResolvedValue({
    bet: {
      id: "bet-823",
      title: "Sprint 5 Creator Selection Test",
      visibility: "private",
      join_code: "TEST823",
    },
  });
});

afterEach(() => {
  cleanup();
});

describe("SCRUM-823 Create Bet Creator Selection UI", () => {
  test("displays creator answer radio buttons", () => {
    renderForm();
    toggleOptions();

    expect(screen.getByText("Select Your Answer")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "No" })).toBeInTheDocument();

    expect(screen.getByRole("radio", { name: "Yes" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "No" })).not.toBeChecked();
  });

  test("blocks submission without creator selection", () => {
    renderForm();
    fillTitle();
    toggleOptions();
    submitForm();

    expect(screen.getByText("Please select your answer.")).toBeInTheDocument();

    expect(createBet).not.toHaveBeenCalled();
  });

  test("selecting Yes submits index 0", async () => {
    renderForm();
    fillTitle();
    toggleOptions();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    submitForm();

    await waitFor(() => {
      expect(createBet).toHaveBeenCalledTimes(1);
    });

    const payload = createBet.mock.calls[0][1];

    expect(payload.options).toEqual(["Yes", "No"]);
    expect(payload.creator_selected_option_index).toBe(0);
  });

  test("selecting No submits index 1", async () => {
    renderForm();
    fillTitle();
    toggleOptions();

    fireEvent.click(screen.getByRole("radio", { name: "No" }));

    expect(screen.getByRole("radio", { name: "No" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Yes" })).not.toBeChecked();

    submitForm();

    await waitFor(() => {
      expect(createBet).toHaveBeenCalledTimes(1);
    });

    expect(createBet.mock.calls[0][1].creator_selected_option_index).toBe(1);
  });

  test("removing an answer updates the selected index", async () => {
    renderForm();
    fillTitle();
    toggleOptions();

    fireEvent.click(screen.getByRole("button", { name: "Add Answer" }));

    fireEvent.change(screen.getByLabelText("Answer 3"), {
      target: { value: "Maybe" },
    });

    fireEvent.click(screen.getByRole("radio", { name: "Maybe" }));

    // Remove Yes. Maybe should move from index 2 to index 1.
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove Answer" })[0],
    );

    expect(screen.getByRole("radio", { name: "Maybe" })).toBeChecked();

    submitForm();

    await waitFor(() => {
      expect(createBet).toHaveBeenCalledTimes(1);
    });

    const payload = createBet.mock.calls[0][1];

    expect(payload.options).toEqual(["No", "Maybe"]);
    expect(payload.creator_selected_option_index).toBe(1);
  });

  test("changing the selected answer resets the selection", () => {
    renderForm();
    fillTitle();
    toggleOptions();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));

    fireEvent.change(screen.getByLabelText("Answer 1"), {
      target: { value: "Maybe" },
    });

    expect(screen.getByRole("radio", { name: "Maybe" })).not.toBeChecked();

    submitForm();

    expect(screen.getByText("Please select your answer.")).toBeInTheDocument();

    expect(createBet).not.toHaveBeenCalled();
  });

  test("disabling options preserves legacy bet creation", async () => {
    renderForm();
    fillTitle();
    toggleOptions();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));

    // Disable answer choices.
    toggleOptions();

    expect(screen.queryByRole("radio", { name: "Yes" })).toBeNull();

    submitForm();

    await waitFor(() => {
      expect(createBet).toHaveBeenCalledTimes(1);
    });

    const payload = createBet.mock.calls[0][1];

    expect(payload).not.toHaveProperty("options");
    expect(payload).not.toHaveProperty("creator_selected_option_index");
  });

  test("reenabling options requires a new selection", () => {
    renderForm();
    fillTitle();
    toggleOptions();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));

    toggleOptions();
    toggleOptions();

    expect(screen.getByRole("radio", { name: "Yes" })).not.toBeChecked();

    submitForm();

    expect(createBet).not.toHaveBeenCalled();
  });

  test("successful creation preserves invite code and navigation", async () => {
    renderForm();
    fillTitle();
    toggleOptions();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    submitForm();

    expect(
      await screen.findByRole("heading", {
        name: "Bet Created Successfully!",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("TEST823")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "View Bet Details" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Back to Dashboard" }),
    ).toBeInTheDocument();
  });

  test("backend validation errors are displayed", async () => {
    createBet.mockRejectedValue(new Error("Selected answer index is invalid."));

    renderForm();
    fillTitle();
    toggleOptions();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    submitForm();

    expect(
      await screen.findByText("Selected answer index is invalid."),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Bet Created Successfully!"),
    ).not.toBeInTheDocument();
  });
});
