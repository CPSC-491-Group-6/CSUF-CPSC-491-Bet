
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
      data?.error?.message ||
      `Bet request failed (${response.status}).`;

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
