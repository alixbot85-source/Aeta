import { AppError } from "@aeta/shared";

export class DeepSeekConfigurationError extends AppError {
  constructor(message = "DeepSeek API key is not configured.") {
    super("DEEPSEEK_CONFIGURATION_ERROR", message, 500);
  }
}

export class DeepSeekApiError extends AppError {
  constructor(public readonly deepSeekStatus: number, message: string, details?: unknown) {
    super(deepSeekStatus === 429 ? "DEEPSEEK_RATE_LIMITED" : "DEEPSEEK_API_ERROR", message, deepSeekStatus === 429 ? 429 : 502, details);
  }
}

export class DeepSeekTimeoutError extends AppError {
  constructor(message = "DeepSeek request timed out.") {
    super("DEEPSEEK_TIMEOUT", message, 504);
  }
}
