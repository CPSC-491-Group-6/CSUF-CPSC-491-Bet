/*
 * SCRUM-744 - Bet API integration
 * SCRUM-747 - Sprint 4 Frontend Integration
 *
 * Authenticated Bet API service.
 * HTTP 401 responses invalidate the frontend authentication state.
 */

import { authenticatedFetch } from "./authenticatedFetch";

import { FREE_RESPONSE_RESOLVE_ENABLED } from "../config/freeResponse";
import { BET_UNLOCK_ENABLED } from "../config/betUnlock";

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
 * POST /api/bets/join
 *
 * Join by invite code with one answer format.
 *
 * Expected payload after the free-response backend update:
 * {
 *   join_code: string,
 *   selected_option_id?: string,
 *   prediction_text?: string
 * }
 *
 * The backend returns:
 * {
 *   participation: object,
 *   bet: object
 * }
 */
export async function joinBetApi(inviteCode, selectedOptionID, predictionText) {
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

  if (predictionText !== undefined) {
    if (selectedOptionID !== undefined && selectedOptionID !== null) {
      throw new Error("Choose an option or enter a prediction, not both.");
    }
    if (
      typeof predictionText !== "string" ||
      !predictionText.trim() ||
      predictionText.trim().length > 500
    ) {
      throw new Error("Prediction must be between 1 and 500 characters.");
    }
    payload.prediction_text = predictionText.trim();
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
 * Future creator-only API contract:
 * POST /api/bets/:betId/unlock
 * Returns { bet: { ..., status: "open" } }
 * Backend must enforce LOCKED -> OPEN (never RESOLVED -> OPEN).
 */
export async function unlockBetApi(betId) {
  if (!BET_UNLOCK_ENABLED) {
    throw new Error("Unlock Bet requires backend support.");
  }
  if (betId == null || !String(betId).trim()) {
    throw new Error("A bet ID is required.");
  }
  const response = await fetch(
    `${BET_API_URL}/${encodeURIComponent(betId)}/unlock`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  const data = await handleResponse(response);
  if (!data?.bet || String(data.bet.status).toLowerCase() !== "open") {
    throw new Error("Invalid Unlock Bet API response.");
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

/**
 * Future backend contract for free-response resolution.
 * POST /api/bets/:betId/resolve
 * { resolution_text: string, winning_user_ids: string[] }
 *
 * Keep this endpoint gated until backend verification is complete.
 */
export async function resolveFreeResponseBetApi(betId, resolution) {
  if (!FREE_RESPONSE_RESOLVE_ENABLED) {
    throw new Error("Free-response resolution requires backend support.");
  }

  if (betId == null || !String(betId).trim()) {
    throw new Error("A bet ID is required.");
  }

  const resolutionText = resolution?.resolution_text;
  const winningUserIds = resolution?.winning_user_ids;
  if (
    typeof resolutionText !== "string" ||
    !resolutionText.trim() ||
    resolutionText.trim().length > 500
  ) {
    throw new Error("Final outcome must be between 1 and 500 characters.");
  }
  if (
    !Array.isArray(winningUserIds) ||
    winningUserIds.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(winningUserIds).size !== winningUserIds.length
  ) {
    throw new Error("Invalid winning participant selections.");
  }

  const response = await fetch(
    `${BET_API_URL}/${encodeURIComponent(betId)}/resolve`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resolution_text: resolutionText.trim(),
        winning_user_ids: winningUserIds,
      }),
    },
  );

  const data = await handleResponse(response);
  if (
    String(data?.bet?.status).toLowerCase() !== "resolved" ||
    typeof data.bet.resolution_text !== "string" ||
    !Array.isArray(data.bet.winning_user_ids)
  ) {
    throw new Error("Invalid Free-response Resolve API response.");
  }
  return data;
}

/**
 * GET /api/bets/history?status=resolved
 * Fetch only resolved bets visible to the authenticated participant.
 */
export async function getBetHistoryApi() {
  const response = await fetch(`${BET_API_URL}/history?status=resolved`, {
    method: "GET",
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!Array.isArray(data?.bets)) {
    throw new Error("Invalid Bet History API response.");
  }
  return data.bets;
}
