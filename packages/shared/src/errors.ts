export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "WORKSPACE_NOT_FOUND"
  | "PROJECT_NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "PATH_TRAVERSAL_BLOCKED"
  | "COMMAND_REJECTED"
  | "COMMAND_TIMEOUT"
  | "DEEPSEEK_CONFIGURATION_ERROR"
  | "DEEPSEEK_API_ERROR"
  | "DEEPSEEK_RATE_LIMITED"
  | "DEEPSEEK_TIMEOUT"
  | "NOT_SUPPORTED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(code: ErrorCode, message: string, statusCode = 500, details?: unknown, expose = true) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.expose = expose;
  }
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessBody<T> | ApiErrorBody;

export function ok<T>(data: T): ApiSuccessBody<T> {
  return { success: true, data };
}

export function fail(error: AppError): ApiErrorBody {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.expose ? error.message : "An internal error occurred.",
      ...(error.details === undefined ? {} : { details: error.details })
    }
  };
}
