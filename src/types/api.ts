import type { components } from './generated/http';
export type ApiError = components['schemas']['ApiError'];

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: components['schemas']['Meta'];
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiRequestError extends Error {
  code: string;
  details?: ApiError['details'];

  constructor(code: string, message: string, details?: ApiError['details']) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.details = details;
  }
}
