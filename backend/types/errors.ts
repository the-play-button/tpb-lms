// entropy-one-export-per-types-file-ok: the canonical HTTP error-class module (NotFoundError + ValidationError + ServiceUnavailableError — a cohesive throwable hierarchy, not a DTO drawer)
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

