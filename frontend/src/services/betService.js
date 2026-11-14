import {
  createBetApi,
  getMyBetsApi,
  getPublicBetsApi,
  getBetApi,
  joinBetApi,
  lockBetApi,
  resolveBetApi,
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
 * selectedOptionID is required for bets with answer choices.
 * Legacy bets without options do not need this parameter.
 */
export async function joinBet(inviteCode, selectedOptionID) {
  return joinBetApi(inviteCode, selectedOptionID);
}

/**
 * Lock a bet using the existing creator-only endpoint.
 */
export async function lockBet(betId) {
  return lockBetApi(betId);
}

/**
 * Resolve bet
 */
export async function resolveBet(betId, winningOptionId) {
  return resolveBetApi(betId, winningOptionId);
}
