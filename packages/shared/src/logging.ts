const SECRET_PATTERNS = [/sk-[A-Za-z0-9_-]+/g, /Bearer\s+[A-Za-z0-9._-]+/gi, /(DEEPSEEK_API_KEY=)[^\s]+/gi];

export function redactSecrets(input: unknown): unknown {
  if (typeof input === "string") {
    return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "$1[REDACTED]"), input);
  }
  if (Array.isArray(input)) return input.map(redactSecrets);
  if (input && typeof input === "object") {
    const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => {
      if (/key|token|secret|password|authorization/i.test(key)) return [key, "[REDACTED]"];
      return [key, redactSecrets(value)];
    });
    return Object.fromEntries(entries);
  }
  return input;
}
