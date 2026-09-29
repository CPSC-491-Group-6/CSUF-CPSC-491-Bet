// backend/src/middleware/errorHandler.js

import { AppError } from "../errors/AppError.js";

/**
 * Global Express error-handling middleware.
 *
 * Expected application errors, such as validation failures or duplicate
 * accounts, are represented by AppError and may safely expose their
 * configured code/message to the client.
 *
 * Unexpected errors are logged on the server but are returned to the client
 * as a generic INTERNAL_ERROR. This prevents implementation details,
 * database messages, stack traces, or other sensitive information from
 * leaking through the API.
 *
 * This middleware MUST be registered after all application routes because
 * Express identifies error middleware by its four-argument signature.
 */
export function errorHandler(error, req, res, next) {
  /*
   * If another handler has already started writing the response, delegate
   * back to Express. Attempting to send another response would cause a
   * "headers already sent" error.
   */
  if (res.headersSent) {
    return next(error);
  }

  /*
   * AppError represents an expected failure that our application explicitly
   * knows how to communicate to API consumers.
   */
  if (error instanceof AppError) {
    const responseBody = {
      error: {
        code: error.code,
        message: error.message,
      },
    };

    /*
     * Validation errors may include safe field-level details. We only add
     * this property when details were explicitly supplied by the AppError.
     */
    if (error.details !== undefined) {
      responseBody.error.details = error.details;
    }

    return res.status(error.statusCode).json(responseBody);
  }

  /*
   * Unexpected failures should be visible to developers/operators but not
   * exposed directly to API clients.
   */
  console.error("Unhandled application error:", error);

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
}
