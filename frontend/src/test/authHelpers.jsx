
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { AuthContext } from "../context/authContextObject";
import {
  authenticatedState,
  unauthenticatedState,
} from "./authFixtures";

export function createAuthValue(overrides = {}) {
  return {
    ...unauthenticatedState,
    login: vi.fn(),
    logout: vi.fn(),
    checkSession: vi.fn(),
    ...overrides,
  };
}

export function createAuthenticatedAuthValue(overrides = {}) {
  return createAuthValue({
    ...authenticatedState,
    ...overrides,
  });
}

export function renderWithAuthState(
  component,
  {
    authState = unauthenticatedState,
    route = "/",
  } = {},
) {
  const authValue = createAuthValue(authState);

  const result = render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        {component}
      </MemoryRouter>
    </AuthContext.Provider>,
  );

  return {
    ...result,
    authValue,
  };
}

export function mockAuthFetch(response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function resetAuthTestState() {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();

  window.localStorage.clear();
  window.sessionStorage.clear();
}
