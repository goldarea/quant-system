export class AppError extends Error {
  constructor(code, message, status = 500, details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = undefined) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message, details = undefined) {
    super('NOT_FOUND', message, 404, details);
  }
}

export class UpstreamError extends AppError {
  constructor(message, details = undefined) {
    super('UPSTREAM_ERROR', message, 502, details);
  }
}

export function toErrorResponse(error) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error'
      }
    }
  };
}
