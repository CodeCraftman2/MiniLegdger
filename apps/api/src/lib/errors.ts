/** Razorpay-style error codes. One shape everywhere: { error: { code, description, field? } } */
export type ErrorCode =
  | "BAD_REQUEST_ERROR"
  | "AUTHENTICATION_ERROR"
  | "NOT_FOUND_ERROR"
  | "TOO_MANY_REQUESTS"
  | "SERVER_ERROR";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    public readonly description: string,
    public readonly field?: string,
  ) {
    super(description);
  }
}

export const badRequest = (description: string, field?: string) =>
  new AppError(400, "BAD_REQUEST_ERROR", description, field);
export const unauthorized = (description = "Authentication failed") =>
  new AppError(401, "AUTHENTICATION_ERROR", description);
export const notFound = (description: string) => new AppError(404, "NOT_FOUND_ERROR", description);
export const tooManyRequests = (description: string) =>
  new AppError(429, "TOO_MANY_REQUESTS", description);
