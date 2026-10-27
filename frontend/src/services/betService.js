
import {
  createBetApi,
  getMyBetsApi,
  getBetApi,
  joinBetApi,
  lockBetApi,
} from "./betApi";

/*
 * SCRUM-744 - Sprint 3 Backend Integration
 * SCRUM-747 - Sprint 4 Frontend Integration
 *
 * Centralized frontend service layer for bet operations.
 */

export const BET_DATA_MODE = "api";
export const isDemoMode = false;

// Sprint 3 - Create Bet
export async function createBet(_userId, betData) {
  return createBetApi(betData);
}

// Sprint 3 - Dashboard / My Bets
export async function getMyBets() {
  return getMyBetsApi();
}

// Sprint 4 - Bet Detail
export async function getBet(betId) {
  return getBetApi(betId);
}

// Sprint 4 - Join Bet
export async function joinBet(inviteCode) {
  return joinBetApi(inviteCode);
}

// Sprint 4 - Lock Bet
export async function lockBet(betId) {
  return lockBetApi(betId);
}
