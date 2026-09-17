const TOKEN_KEY = "amp_token";

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

function errMsg(data: unknown, status: number) {
  const m = (data as { error?: string })?.error;
  if (typeof m === "string" && m.trim()) return m;
  return `Request failed (${status})`;
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const method = (init?.method || "GET").toUpperCase();
  let url = path;
  if (token && method === "GET") {
    url += (path.includes("?") ? "&" : "?") + "access_token=" + encodeURIComponent(token);
  }
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}`, "X-Amp-Token": token } : {}),
        ...(init?.headers || {})
      }
    });
  } catch (e) {
    if (method === "GET") {
      console.warn("[amp]", path, e);
      return {} as T;
    }
    throw e instanceof Error ? e : new Error("Network error");
  }
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const msg = errMsg(data, res.status);
    if (method === "GET") {
      console.warn("[amp]", path, msg);
      return data as T;
    }
    throw new Error(msg);
  }
  return data as T;
}

export async function apiForm<T = unknown>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}`, "X-Amp-Token": token } : {},
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errMsg(data, res.status));
  return data as T;
}
