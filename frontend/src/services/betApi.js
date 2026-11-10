/*
 * SCRUM-744 - Bet API integration
 * SCRUM-747 - Sprint 4 Frontend Integration
 *
 * API service for creating, retrieving,
 * joining, and locking bets.
 *
 * Public joining without an invite code requires
 * a separate confirmed backend endpoint.
 */

const BET_API_URL = "/api/bets";

/**
 * Parse the standard API response and preserve
 * backend validation/error messages.
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
 * POST /api/bets
 *
 * Create a bet using the existing authenticated session.
 * Answer choices are optional for legacy compatibility.
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

  // The backend supports 2-20 unique answer choices.
  // Omit this property entirely for bets without options.
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

    payload.options = options;
  }

  const response = await fetch(BET_API_URL, {
    method: "POST",
    credentials: "include",
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
 * GET /api/bets
 *
 * Retrieve bets created by the authenticated user.
 */
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

/**
 * GET /api/bets/public
 *
 * Retrieve publicly discoverable bets.
 */
export async function getPublicBetsApi() {
  const response = await fetch(`${BET_API_URL}/public`, {
    method: "GET",
    credentials: "include",
  });

  const data = await handleResponse(response);

  if (!Array.isArray(data?.bets)) {
    throw new Error("Invalid Public Bets API response.");
  }

  return data.bets;
}

/**
 * GET /api/bets/:betId
 *
 * Retrieve bet details using server-side authorization.
 */
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

/**
 * POST /api/bets/join
 *
 * Join by invite code with an optional selected answer.
 *
 * The backend expects:
 * {
 *   join_code: string,
 *   selected_option_id?: string
 * }
 *
 * The backend returns:
 * {
 *   participation: object,
 *   bet: object
 * }
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

  // Send a selected option only when one was provided.
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

  const response = await fetch(`${BET_API_URL}/join`, {
    method: "POST",
    credentials: "include",
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

  // The frontend consumes updated bet details.
  // Membership information remains available in the API response.
  return data.bet;
}

/**
 * POST /api/bets/:betId/lock
 *
 * Lock a bet through the existing creator-only endpoint.
 */
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
