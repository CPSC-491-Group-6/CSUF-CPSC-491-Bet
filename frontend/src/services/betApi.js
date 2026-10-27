/*
 * SCRUM-744 - Bet API integration
 *
 * Based on the proposed Sprint 3 API contract.
 *
 * These endpoints are not yet confirmed as implemented.
 * The frontend stays in demo mode until integration
 * is approved and tested.
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
  const response = await fetch(BET_API_URL, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: betData.title.trim(),
      description: betData.description.trim(),
      max_participants: 2,
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
 * These API routes are provisional until the Sprint 4
 * backend contracts are confirmed.
 */

// GET /api/bets/:betId
export async function getBetApi(betId) {
  if (betId === undefined || betId === null || String(betId).trim() === "") {
    throw new Error("A bet ID is required.");
  }

  const response = await fetch(
    `${BET_API_URL}/${encodeURIComponent(betId)}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = await handleResponse(response);

  if (!data?.bet || typeof data.bet !== "object") {
    throw new Error("Invalid Bet Detail API response.");
  }

  return data.bet;
}

// POST /api/bets/join
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
