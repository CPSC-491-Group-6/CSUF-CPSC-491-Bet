export const validCredentials = {
  email: "testuser@example.com",
  password: "TestPassword123!",
};

export const invalidCredentials = {
  email: "invalid@example.com",
  password: "WrongPassword123!",
};

export const testUser = {
  userID: 999,
  username: "test_user",
  email: validCredentials.email,
  verificationStatus: 1,
};

export const unauthenticatedState = {
  user: null,
  loading: false,
  isAuthenticated: false,
};

export const authenticatedState = {
  user: testUser,
  loading: false,
  isAuthenticated: true,
};

export function createSuccessfulAuthResponse(user = testUser) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ user }),
  };
}

export function createFailedAuthResponse() {
  return {
    ok: false,
    status: 401,
    json: async () => ({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    }),
  };
}
