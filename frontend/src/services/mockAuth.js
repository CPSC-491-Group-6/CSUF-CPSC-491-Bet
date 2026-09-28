// Temporary authentication service used for the Sprint 2 Draft.
//
// The Draft requires working authentication screens before the frontend
// is connected to the real backend authentication API.
//
// No passwords are stored here. Only mock user/profile information is
// stored so Login, Profile, and Logout can demonstrate a complete UI flow.
//
// FINAL SPRINT 2 WORK:
// Replace these functions with requests to:
// POST /api/auth/register
// POST /api/auth/login
// GET  /api/auth/me
// POST /api/auth/logout

const REGISTERED_USER_KEY = "bet.mockRegisteredUser";
const SESSION_USER_KEY = "bet.mockSessionUser";

function waitForMockResponse() {
  return new Promise((resolve) => {
    setTimeout(resolve, 250);
  });
}

function readStoredUser(key) {
  const storedUser = localStorage.getItem(key);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function createMockUser({ username, email }) {
  return {
    userID: 1,
    username,
    email: email.trim().toLowerCase(),
    verificationStatus: "unverified",
    timeStamp: new Date().toISOString(),
  };
}

export async function mockRegister({ username, email, password }) {
  await waitForMockResponse();

  if (!username || !email || !password) {
    throw new Error("Registration information is incomplete.");
  }

  const user = createMockUser({
    username: username.trim(),
    email,
  });

  // Registration creates an account but does not automatically log the user in.
  localStorage.setItem(REGISTERED_USER_KEY, JSON.stringify(user));

  return { user };
}

export async function mockLogin({ email, password }) {
  await waitForMockResponse();

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const registeredUser = readStoredUser(REGISTERED_USER_KEY);

  // Reuse the mock registered account when possible.
  // Otherwise create a temporary user so Login can still be demonstrated.
  const user =
    registeredUser?.email === normalizedEmail
      ? registeredUser
      : createMockUser({
          username: normalizedEmail.split("@")[0],
          email: normalizedEmail,
        });

  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));

  return { user };
}

export function getMockCurrentUser() {
  return readStoredUser(SESSION_USER_KEY);
}

export async function mockLogout() {
  await waitForMockResponse();

  localStorage.removeItem(SESSION_USER_KEY);
}