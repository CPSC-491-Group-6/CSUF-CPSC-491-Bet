// backend/src/middleware/requireAuth.js

import { authenticationRequiredError } from "../errors/authErrors.js";

/**
 * Require an authenticated server-side session before allowing a request to
 * continue to the protected route.
 *
 * Successful login stores the authenticated user's ID at:
 *
 *   req.session.userID
 *
 * If that value is missing, the request is considered unauthenticated and a
 * standardized AUTH_REQUIRED error is forwarded to the global error handler.
 *
 * This middleware does not query the database. Its only responsibility is
 * determining whether the current request has authenticated session state.
 */
export function requireAuth(req, res, next) {
  if (!req.session?.userID) {
    return next(authenticationRequiredError());
  }

  return next();
}
