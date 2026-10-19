import type { ListingSort } from './enums.js';

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'INVALID_STATE_TRANSITION',
  'CAPACITY_UNAVAILABLE',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'ACCOUNT_SUSPENDED',
  'RATE_LIMITED',
  'PAYMENT_FAILED',
  'PAYMENT_WEBHOOK_INVALID',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface FieldIssue {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  issues?: FieldIssue[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ResponseMeta {
  pagination?: PageMeta;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  requestId: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface PageQuery {
  page?: number;
  limit?: number;
}

export interface ListQuery extends PageQuery {
  q?: string;
  sort?: ListingSort;
}

export function isSuccess<T>(res: ApiResult<T>): res is ApiSuccess<T> {
  return res.success === true;
}
