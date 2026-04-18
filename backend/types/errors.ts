// entropy-multiple-exports-ok: errors module has 7 tightly-coupled exports sharing internal state
/**
 * Typed error classes for the BYOC layer
 */

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly statusCode = 404;
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly statusCode = 400;
  readonly details: Record<string, string>;
  constructor(message: string, details: Record<string, string> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN' as const;
  readonly statusCode = 403;
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  readonly statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ServiceUnavailableError extends Error {
  readonly code = 'SERVICE_UNAVAILABLE' as const;
  readonly statusCode = 503;
  constructor(
    public service: string,
    public reason?: string
  ) {
    super(`Service unavailable: ${service}`);
    this.name = 'ServiceUnavailableError';
  }
}

export type AppError =
  | NotFoundError
  | ValidationError
  | ForbiddenError
  | UnauthorizedError
  | ConflictError
  | ServiceUnavailableError;
