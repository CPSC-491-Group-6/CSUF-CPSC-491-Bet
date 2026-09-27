/**
 * Error type used for expected application/API failures.
 *
 * AppError lets business logic describe an error without knowing anything
 * about Express. The HTTP error middleware added later will translate these
 * properties into a standardized JSON response.
 */
export class AppError extends Error {
  /**
   * @param {object} options
   * @param {number} options.statusCode HTTP status that should be returned.
   * @param {string} options.code Stable machine-readable error identifier.
   * @param {string} options.message Human-readable explanation.
   * @param {unknown} [options.details] Optional structured validation details.
   */
  constructor({ statusCode, code, message, details }) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;

    // Validation failures may contain safe field-level information.
    // Other errors generally leave this undefined.
    if (details !== undefined) {
      this.details = details;
    }

    // Preserve a useful stack trace in supported Node environments.
    Error.captureStackTrace?.(this, AppError);
  }
}
