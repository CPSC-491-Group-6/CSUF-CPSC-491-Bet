
import { createBetApi, getMyBetsApi } from "./betApi";
import { getMockBets } from "./mockBets";
import { getSavedBets, saveBet } from "./betStorage";

/*
 * SCRUM-744 - Bet data service
 *
 * "demo": localStorage + mock data
 * "api": real backend requests
 *
 * Keep demo enabled until the backend integration
 * has been reviewed and verified.
 */

export const BET_DATA_MODE = "demo";

export const isDemoMode = BET_DATA_MODE === "demo";

export async function createBet(userId, betData) {
  if (isDemoMode) {
    return saveBet(userId, betData);
  }

  return createBetApi(betData);
}

export async function getMyBets(
  userId,
  demoMode = "success"
) {
  if (!isDemoMode) {
    return getMyBetsApi();
  }

  const mockData = await getMockBets(demoMode);

  const savedData =
    demoMode === "success" && userId != null
      ? getSavedBets(userId)
      : [];

  return [...savedData, ...mockData];
}
