// backend/src/controllers/createAuthController.js

import { authenticationRequiredError } from "../errors/authErrors.js";

/**
 * Convert express-session's callback-based regenerate() operation into a
 * Promise so login can use normal async/await control flow.
 *
 * Regenerating the session gives the authenticated user a new session ID
 * rather than keeping an identifier that existed before authentication.
 */
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Explicitly persist the current session.
 *
 * express-session normally saves modified sessions when the response ends,
 * but explicitly saving after login ensures authenticated state reaches the
 * SQLite store before the successful response is returned.
 */
function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Destroy the current server-side session.
 *
 * Logout must invalidate server-side authentication state rather than merely
 * deleting the browser cookie. Otherwise the original session could remain
 * usable if its session identifier were recovered elsewhere.
 */
function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Clear the authentication session cookie from the client.
 *
 * Cookie identity primarily depends on its name/path/domain. Our session
 * cookie uses the default "/" path and no custom domain, so clearing it with
 * the same path invalidates the browser-side reference after logout.
 */
function clearSessionCookie(res) {
  res.clearCookie("sid", {
    path: "/",
  });
}

/**
 * Create authentication HTTP controllers using the provided business service.
 *
 * Controllers remain intentionally thin. Validation, password handling,
 * account lookup, and persistence belong to the service/repository layers.
 */
export function createAuthController({ authService }) {
  /**
   * Handle POST /api/auth/register.
   *
   * Creates an account and returns only the safe user representation.
   */
  async function register(req, res) {
    const user = await authService.register(req.body);

    return res.status(201).json({
      user,
    });
  }

  /**
   * Handle POST /api/auth/login.
   *
   * Credentials are verified before any authenticated state is created.
   * Successful authentication regenerates the session ID and stores only the
   * user's database identifier in the server-side session.
   */
  async function login(req, res) {
    const user = await authService.login(req.body);

    await regenerateSession(req);

    req.session.userID = user.userID;

    await saveSession(req);

    return res.status(200).json({
      user,
    });
  }

  /**
   * Handle GET /api/auth/me.
   *
   * requireAuth guarantees that req.session.userID exists before this
   * controller runs. The current profile is then loaded from SQLite rather
   * than storing a duplicate profile object inside the session.
   */
  async function me(req, res) {
    const user = authService.getCurrentUser(req.session.userID);

    /*
     * A session can theoretically outlive its user record if that account is
     * removed administratively. Treat that stale session as unauthenticated
     * and remove it from the server-side session store.
     */
    if (!user) {
      await destroySession(req);
      clearSessionCookie(res);

      throw authenticationRequiredError();
    }

    return res.status(200).json({
      user,
    });
  }

  /**
   * Handle POST /api/auth/logout.
   *
   * Destroy the authenticated session in SQLite first, then instruct the
   * browser to remove its session-ID cookie.
   */
  async function logout(req, res) {
    await destroySession(req);

    clearSessionCookie(res);

    /*
     * 204 No Content is appropriate because successful logout does not need
     * to return a response body.
     */
    return res.status(204).end();
  }

  return {
    register,
    login,
    me,
    logout,
  };
}
