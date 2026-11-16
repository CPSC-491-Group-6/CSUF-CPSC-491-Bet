// Enable only after the backend implements creator-authorized
// LOCKED -> OPEN and reliably returns the persisted OPEN bet.
// This is a rollout flag, NOT an authorization mechanism.
export const BET_UNLOCK_ENABLED =
  import.meta.env.VITE_BET_UNLOCK_ENABLED === "true";
