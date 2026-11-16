/*
 * SCRUM-744 - Bet API integration
 * SCRUM-747 - Sprint 4 Frontend Integration
 *
 * Authenticated Bet API service.
 * HTTP 401 responses invalidate the frontend authentication state.
 */

import { authenticatedFetch } from "./authenticatedFetch";

const BET_API_URL = "/api/bets";

/**
 * Parse API responses and preserve backend error messages.
 */
async function handleResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message || `Bet request failed (${response.status}).`;

    throw new Error(message);
  }

  return data;
}

/**
 * Create a bet with optional answer choices and a creator selection.
 */
export async function createBetApi(betData) {
  const visibility = betData.visibility ?? "private";
  const maxParticipants = Number(betData.max_participants);

  if (!["public", "private"].includes(visibility)) {
    throw new Error("Invalid bet visibility.");
  }

  if (
    !Number.isInteger(maxParticipants) ||
    maxParticipants < 2 ||
    maxParticipants > 100
  ) {
    throw new Error("Maximum participants must be between 2 and 100.");
  }

  const payload = {
    title: betData.title.trim(),
    description: betData.description.trim(),
    visibility,
    max_participants: maxParticipants,
  };

  // Preserve optional answer choices for supported bet types.
  if (betData.options !== undefined) {
    if (!Array.isArray(betData.options)) {
      throw new Error("Answer options must be an array.");
    }

    const options = betData.options.map((option) =>
      typeof option === "string" ? option.trim() : "",
    );

    if (
      options.length < 2 ||
      options.length > 20 ||
      options.some((option) => !option || option.length > 150)
    ) {
      throw new Error("Provide between 2 and 20 valid answer options.");
    }

    const uniqueOptions = new Set(
      options.map((option) => option.toLowerCase()),
    );

    if (uniqueOptions.size !== options.length) {
      throw new Error("Answer options must be unique.");
    }

    const selectedIndex = betData.creator_selected_option_index;

    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= options.length
    ) {
      throw new Error("Please select a valid answer.");
    }

    payload.options = options;
    payload.creator_selected_option_index = selectedIndex;
  }

  const response = await authenticatedFetch(BET_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);

  if (!data?.bet || typeof data.bet !== "object") {
    throw new Error("Invalid Create Bet API response.");
  }

  return data.bet;
}

/**
 * Retrieve bets created by the authenticated user.
 */
export async function getMyBetsApi() {
  const response = await authenticatedFetch(BET_API_URL, {
    method: "GET",
  });

  const data = await handleResponse(response);

  if (!Array.isArray(data?.bets)) {
    throw new Error("Invalid My Bets API response.");
  }

  return data.bets;
}

/**
 * Retrieve publicly discoverable bets for an authenticated user.
 */
export async function getPublicBetsApi() {
  const response = await authenticatedFetch(`${BET_API_URL}/public`, {
    method: "GET",
  });

  const data = await handleResponse(response);

  if (!Array.isArray(data?.bets)) {
    throw new Error("Invalid Public Bets API response.");
  }

  return data.bets;
}

/**
 * Retrieve a bet using backend authorization.
 */
export async function getBetApi(betId) {
  if (betId === undefined || betId === null || String(betId).trim() === "") {
    throw new Error("A bet ID is required.");
  }

  const response = await authenticatedFetch(
    `${BET_API_URL}/${encodeURIComponent(betId)}`,
    {
      method: "GET",
    },
  );

  const data = await handleResponse(response);

  if (!data?.bet || typeof data.bet !== "object") {
    throw new Error("Invalid Bet Detail API response.");
  }

  return data.bet;
}

/**
 * Join a bet by invite code with an optional selected answer.
 */
export async function joinBetApi(inviteCode, selectedOptionID) {
  const code =
    typeof inviteCode === "string" ? inviteCode.trim().toUpperCase() : "";

  if (!code) {
    throw new Error("Please enter an invite code.");
  }

  const payload = {
    join_code: code,
  };

  if (selectedOptionID !== undefined && selectedOptionID !== null) {
    if (
      typeof selectedOptionID !== "string" ||
      selectedOptionID.trim().length === 0 ||
      selectedOptionID.length > 100
    ) {
      throw new Error("Invalid selected answer.");
    }

    payload.selected_option_id = selectedOptionID;
  }

  const response = await authenticatedFetch(`${BET_API_URL}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);

  if (
    !data?.participation ||
    !data?.bet ||
    typeof data.bet !== "object" ||
    data.bet.id == null
  ) {
    throw new Error("Invalid Join Bet API response.");
  }

  return data.bet;
}

/**
 * Lock a bet through the existing creator-only endpoint.
 */
export async function lockBetApi(betId) {
  if (betId === undefined || betId === null || String(betId).trim() === "") {
    throw new Error("A bet ID is required.");
  }

  const response = await authenticatedFetch(
    `${BET_API_URL}/${encodeURIComponent(betId)}/lock`,
    {
      method: "POST",
    },
  );

  const data = await handleResponse(response);

  if (!data?.bet || typeof data.bet !== "object") {
    throw new Error("Invalid Lock Bet API response.");
  }

  return data.bet;
}

/**
 * Resolve a bet with the selected winning option.
 */
export async function resolveBetApi(betId, winningOptionId) {
  const response = await authenticatedFetch(
    `/api/bets/${encodeURIComponent(betId)}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        winning_option_id: winningOptionId,
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error?.message || `Resolve Bet request failed (${response.status}).`,
    );
  }

  return data;
}
