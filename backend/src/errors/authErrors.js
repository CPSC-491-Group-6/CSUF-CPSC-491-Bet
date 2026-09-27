import { AppError } from "./AppError.js";

/**
 * Create a standardized request-validation error.
 *
 * Field-level details are optional and are safe to return to the client
 * because they describe only problems with input supplied by that client.
 */
export function validationError(details) {
  return new AppError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message: "The authentication request contains invalid input.",
    details,
  });
}

/**
 * Create an error indicating that the supplied email is already registered.
 */
export function emailAlreadyExistsError() {
  return new AppError({
    statusCode: 409,
    code: "EMAIL_ALREADY_EXISTS",
    message: "An account with that email already exists.",
  });
}

/**
 * Create an error indicating that the requested username is unavailable.
 */
export function usernameAlreadyExistsError() {
  return new AppError({
    statusCode: 409,
    code: "USERNAME_ALREADY_EXISTS",
    message: "That username is already in use.",
  });
}

/**
 * Create the generic credential error used during login.
 *
 * Login deliberately does not distinguish between an unknown account and
 * an incorrect password. This avoids exposing whether a particular account
 * exists through the authentication endpoint.
 */
export function invalidCredentialsError() {
  return new AppError({
    statusCode: 401,
    code: "INVALID_CREDENTIALS",
    message: "Invalid email or password.",
  });
}

/**
 * Create the error returned when a protected endpoint is accessed without
 * a valid authenticated session.
 */
export function authenticationRequiredError() {
  return new AppError({
    statusCode: 401,
    code: "AUTH_REQUIRED",
    message: "Authentication is required.",
  });
}
