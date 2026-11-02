import { createBetApi, getMyBetsApi } from "./betApi";

/*
 * SCRUM-744 - Real Backend API Integration
 *
 * Sprint 3 frontend now uses the real backend API.
 * Bet creation and retrieval are persisted in SQLite.
 */

export const BET_DATA_MODE = "api";
export const isDemoMode = false;

export async function createBet(_userId, betData) {
  return createBetApi(betData);
}

export async function getMyBets() {
  return getMyBetsApi();
}
