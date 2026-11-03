/*
 * SCRUM-744 - Bet API integration
 * SCRUM-747 - Sprint 4 Frontend Integration
 *
 * API service for creating, retrieving,
 * joining, and locking bets.
 *
 * Public joining requires a confirmed backend
 * endpoint before it can be enabled.
 */

const BET_API_URL = "/api/bets";

async function handleResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message || `Bet request failed (${response.status}).`;

    throw new Error(message);
  }

  return data;
}

// POST /api/bets
// Create a bet using the existing login session.
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

  const response = await fetch(BET_API_URL, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: betData.title.trim(),
      description: betData.description.trim(),
      visibility,
      max_participants: maxParticipants,
    }),
  });

  const data = await handleResponse(response);

  if (!data?.bet) {
    throw new Error("Invalid Create Bet API response.");
  }

  return data.bet;
}

// GET /api/bets
// Retrieve bets belonging to the authenticated user.
export async function getMyBetsApi() {
  const response = await fetch(BET_API_URL, {
    method: "GET",
    credentials: "include",
  });

  const data = await handleResponse(response);

  if (!Array.isArray(data?.bets)) {
    throw new Error("Invalid My Bets API response.");
  }

  return data.bets;
}

/*
 * SCRUM-747 - Sprint 4 Bet Details, Join, and Lock
 *
 * These API routes remain subject to
 * backend contract verification.
 */

// GET /api/bets/:betId
export async function getBetApi(betId) {
  if (betId === undefined || betId === null || String(betId).trim() === "") {
    throw new Error("A bet ID is required.");
  }

  const response = await fetch(`${BET_API_URL}/${encodeURIComponent(betId)}`, {
    method: "GET",
    credentials: "include",
  });

  const data = await handleResponse(response);

  if (!data?.bet || typeof data.bet !== "object") {
    throw new Error("Invalid Bet Detail API response.");
  }

  return data.bet;
}

// POST /api/bets/join
// Join using a valid invitation code.
export async function joinBetApi(inviteCode) {
  const code = inviteCode?.trim().toUpperCase();

  if (!code) {
    throw new Error("Please enter an invite code.");
  }

  const response = await fetch(`${BET_API_URL}/join`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invite_code: code,
    }),
  });

  const data = await handleResponse(response);

  if (!data?.bet || typeof data.bet !== "object") {
    throw new Error("Invalid Join Bet API response.");
  }

  return data.bet;
}

// POST /api/bets/:betId/lock
export async function lockBetApi(betId) {
  if (betId === undefined || betId === null || String(betId).trim() === "") {
    throw new Error("A bet ID is required.");
  }

  const response = await fetch(
    `${BET_API_URL}/${encodeURIComponent(betId)}/lock`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  const data = await handleResponse(response);

  if (!data?.bet || typeof data.bet !== "object") {
    throw new Error("Invalid Lock Bet API response.");
  }

  return data.bet;
}
