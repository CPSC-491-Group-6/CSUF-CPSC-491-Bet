// frontend/src/services/authenticatedFetch.js

/**
 * Make an API request using the existing session cookie.
 *
 * An HTTP 401 indicates that the server did not accept the
 * current authentication session.
 */
export async function authenticatedFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  // Clear local authentication when the server rejects the session.
  if (response.status === 401) {
    window.dispatchEvent(new Event("auth:session-expired"));
  }

  return response;
}
