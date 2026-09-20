export type ApiResponse<T> = { success: true; data: T } | { success: false; error: { code: string; message: string; details?: unknown } };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/^http/, "ws");

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aeta.token");
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("aeta.token", token);
  else localStorage.removeItem("aeta.token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("content-type") && options.body) headers.set("content-type", "application/json");
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  const json = (await response.json().catch(() => ({ success: false, error: { code: "INVALID_RESPONSE", message: "Invalid API response" } }))) as ApiResponse<T>;
  if (!response.ok || !json.success) {
    const message = json.success ? response.statusText : json.error.message;
    throw new Error(message);
  }
  return json.data;
}

export function terminalUrl(workspaceId: string): string {
  const token = encodeURIComponent(getToken() || "");
  return `${WS_URL}/ws/terminal?workspaceId=${encodeURIComponent(workspaceId)}&token=${token}`;
}

export { API_URL, WS_URL };
