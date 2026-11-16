// Enable only after backend validates and persists participant prediction_text.
// Keeping this off avoids silently discarding participants' typed answers.
export const FREE_RESPONSE_JOIN_ENABLED =
  import.meta.env.VITE_FREE_RESPONSE_JOIN_ENABLED === "true";

// Enable only when the backend accepts and persists resolution_text and
// winning_user_ids, and returns resolved bet data for both fields.
export const FREE_RESPONSE_RESOLVE_ENABLED =
  import.meta.env.VITE_FREE_RESPONSE_RESOLVE_ENABLED === "true";
