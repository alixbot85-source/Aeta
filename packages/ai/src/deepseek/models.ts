export const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";

// Official DeepSeek API docs on 2026-09-20 list `deepseek-flash` and `deepseek-v4-pro`.
// `deepseek-flash` is chosen as the default coding-assistant model because it is the documented Flash model.
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-flash";

export const SUPPORTED_DEEPSEEK_MODELS = ["deepseek-flash", "deepseek-v4-pro"] as const;
export type SupportedDeepSeekModel = (typeof SUPPORTED_DEEPSEEK_MODELS)[number];

export function resolveDeepSeekModel(model?: string): string {
  return model || process.env.DEEPSEEK_MODEL || DEEPSEEK_DEFAULT_MODEL;
}

export function resolveDeepSeekBaseUrl(baseUrl?: string): string {
  return (baseUrl || process.env.DEEPSEEK_BASE_URL || DEEPSEEK_DEFAULT_BASE_URL).replace(/\/$/, "");
}
