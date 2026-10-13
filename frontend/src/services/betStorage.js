const STORAGE_PREFIX = "bet-demo-bets";

function getStorageKey(userId) {
  if (!userId) {
    throw new Error("A user account is required.");
  }

  return `${STORAGE_PREFIX}-${userId}`;
}

export function getSavedBets(userId) {
  const key = getStorageKey(userId);
  const stored = localStorage.getItem(key);

  if (!stored) {
    return [];
  }

  try {
    const bets = JSON.parse(stored);

    if (!Array.isArray(bets)) {
      throw new Error("Saved bets must be an array.");
    }

    return bets;
  } catch {
    throw new Error("Unable to read saved demo bets.");
  }
}

export function saveBet(userId, betData) {
  const key = getStorageKey(userId);
  const existingBets = getSavedBets(userId);

  const newBet = {
    id: crypto.randomUUID(),
    title: betData.title.trim(),
    description: betData.description.trim(),
    deadline: new Date(betData.deadline).toISOString(),
    status: "active",
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(key, JSON.stringify([newBet, ...existingBets]));

  return newBet;
}
