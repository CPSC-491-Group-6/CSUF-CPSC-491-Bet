import {
  createBetApi,
  getMyBetsApi,
  getBetHistoryApi,
  getPublicBetsApi,
  getBetApi,
  joinBetApi,
  lockBetApi,
  unlockBetApi,
  resolveBetApi,
  resolveFreeResponseBetApi,
} from "./betApi";

/*
 * SCRUM-744 - Sprint 3 Backend Integration
 * SCRUM-747 - Sprint 4 Frontend Integration
 *
 * Centralized frontend service layer for bet operations.
 */

export const BET_DATA_MODE = "api";
export const isDemoMode = false;

/**
 * Create a bet using the authenticated session.
 *
 * Preserve the existing caller signature.
 * The backend derives the actual creator ID from the session.
 */
export async function createBet(_userId, betData) {
  return createBetApi(betData);
}

/**
 * Retrieve bets created by the current user.
 */
export async function getMyBets() {
  return getMyBetsApi();
}

/**
 * Retrieve publicly discoverable bets.
 */
export async function getPublicBets() {
  return getPublicBetsApi();
}

/**
 * Retrieve one bet's authorized details.
 */
export async function getBet(betId) {
  return getBetApi(betId);
}

/**
 * Join a bet using its invitation code.
 *
 * selectedOptionID is used for multiple-choice bets.
 * predictionText is used for free-response bets once backend support is ready.
 */
export async function joinBet(inviteCode, selectedOptionID, predictionText) {
  // Retain the two-argument API call for existing multiple-choice joins.
  return predictionText === undefined
    ? joinBetApi(inviteCode, selectedOptionID)
    : joinBetApi(inviteCode, selectedOptionID, predictionText);
}

/**
 * Lock a bet using the existing creator-only endpoint.
 */
export async function lockBet(betId) {
  return lockBetApi(betId);
}

/**
 * Unlock a locked bet, after the creator-only backend endpoint is available.
 */
export async function unlockBet(betId) {
  return unlockBetApi(betId);
}

/**
 * Resolve bet
 */
export async function resolveBet(betId, winningOptionId) {
  return resolveBetApi(betId, winningOptionId);
}

/**
 * Resolve a free-response bet after backend support is available.
 * winning_user_ids refer to participants' user_id values, not row IDs.
 */
export async function resolveFreeResponseBet(betId, resolution) {
  return resolveFreeResponseBetApi(betId, resolution);
}

/**
 * Retrieve the authenticated user's resolved bet history.
 */
export async function getBetHistory() {
  return getBetHistoryApi();
}
