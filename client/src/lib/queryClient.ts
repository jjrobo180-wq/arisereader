import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Fetch with retry is handled globally in main.tsx
// This is kept for backward compatibility

// The signed-in account's token, for apiRequest. The server only accepts "Authorization: Bearer …"; without
// it every apiRequest was turned away as signed out (which is why no iPhone ever got registered for
// notifications). AuthContext sets it; before that, it is read from the sign-in kept on the device.
let authToken: string | null = null;
export function setApiAuthToken(token: string | null): void { authToken = token || null; }
function savedToken(): string | null {
  try {
    const cookie = /(?:^|;\s*)arise_session=([^;]+)/.exec(document.cookie)?.[1];
    const raw = (cookie && decodeURIComponent(cookie)) || window.localStorage.getItem("arise_session_backup");
    if (!raw) return null;
    const token = JSON.parse(atob(raw))?.token;
    return typeof token === "string" && token ? token : null;
  } catch { return null; }
}
export const apiAuthToken = (): string | null => authToken || savedToken();

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...(apiAuthToken() ? { Authorization: `Bearer ${apiAuthToken()}` } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
