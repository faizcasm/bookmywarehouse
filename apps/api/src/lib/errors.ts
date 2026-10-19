import type { ErrorCode, FieldIssue } from '@bmw/shared-types';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly issues?: FieldIssue[];
  readonly expose: boolean;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    issues?: FieldIssue[],
    options?: { expose?: boolean },
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
    this.expose = options?.expose ?? statusCode < 500;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const errors = {
  badRequest: (message = 'Bad request', issues?: FieldIssue[]) =>
    new AppError(400, 'BAD_REQUEST', message, issues),
  validation: (issues: FieldIssue[], message = 'Validation failed') =>
    new AppError(422, 'VALIDATION_ERROR', message, issues),
  unauthenticated: (message = 'Authentication required') =>
    new AppError(401, 'UNAUTHENTICATED', message),
  tokenExpired: (message = 'Session expired, please sign in again') =>
    new AppError(401, 'TOKEN_EXPIRED', message),
  invalidCredentials: (message = 'Invalid email or password') =>
    new AppError(401, 'INVALID_CREDENTIALS', message),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message = 'Resource already exists') => new AppError(409, 'CONFLICT', message),
  emailTaken: (message = 'An account with this email already exists') =>
    new AppError(409, 'EMAIL_TAKEN', message),
  precondition: (message = 'Precondition failed') =>
    new AppError(412, 'PRECONDITION_FAILED', message),
  invalidTransition: (message = 'This action is not allowed for the current status') =>
    new AppError(409, 'INVALID_STATE_TRANSITION', message),
  capacityUnavailable: (message = 'The requested capacity is not available for these dates') =>
    new AppError(409, 'CAPACITY_UNAVAILABLE', message),
  accountSuspended: (message = 'This account is suspended. Contact support.') =>
    new AppError(403, 'ACCOUNT_SUSPENDED', message),
  rateLimited: (message = 'Too many requests, please try again shortly') =>
    new AppError(429, 'RATE_LIMITED', message),
  paymentFailed: (message = 'Payment could not be processed') =>
    new AppError(402, 'PAYMENT_FAILED', message),
  webhookInvalid: (message = 'Webhook signature verification failed') =>
    new AppError(400, 'PAYMENT_WEBHOOK_INVALID', message),
  internal: (message = 'Something went wrong') =>
    new AppError(500, 'INTERNAL_ERROR', message, undefined, { expose: false }),
};

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
