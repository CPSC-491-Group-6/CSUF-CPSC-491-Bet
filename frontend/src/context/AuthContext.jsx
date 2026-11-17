import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthContext } from "./authContextObject";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Verify the current server-side session.
   *
   * Authentication responses must not be loaded from cache.
   * The initial loading state is already true, so the session
   * check does not need to set it again on startup.
   */
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        setUser(null);
        return null;
      }

      const data = await response.json();
      const authenticatedUser = data?.user ?? null;

      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      console.error("Session check failed:", error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear frontend authentication when an authenticated API
   * request receives HTTP 401.
   */
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setLoading(false);
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);

    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  /**
   * Validate authentication once when the provider mounts.
   *
   * Session verification is asynchronous, and protected routes
   * remain blocked while loading is true.
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void checkSession();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [checkSession]);

  /**
   * Store the user returned by a successful backend login.
   */
  const login = useCallback((userData) => {
    setUser(userData);
    setLoading(false);
  }, []);

  /**
   * Invalidate the session on the backend before clearing
   * the authenticated frontend state.
   */
  const logout = useCallback(async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to log out. Please try again.");
    }

    setUser(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      checkSession,
    }),
    [user, loading, login, logout, checkSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
