// Apple Health link for the Family Hub food diary (see server/appleHealth.ts).
import { API_BASE } from "@/lib/queryClient";
import type { SyncDay } from "@shared/appleHealth";

export type HealthLink = { memberId: string; createdAt: string; lastSyncAt: string | null };
const base = `${API_BASE}/api/arise-todo/apple-health`;

async function call<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, { ...init, cache: "no-store", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "Apple Health can't be reached right now.");
  return body as T;
}
export const healthStatus = (token: string | null) => call<{ links: HealthLink[]; days: SyncDay[] }>(token, "/status");
export const makeHealthKey = (token: string | null, memberId: string) => call<{ token: string }>(token, "/link", { method: "POST", body: JSON.stringify({ memberId }) }).then((b) => b.token);
export const removeHealthLink = (token: string | null, memberId: string) => call(token, `/link?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" });
/** The address the iPhone Shortcut posts to. */
export const syncAddress = () => `${API_BASE || (typeof window !== "undefined" ? window.location.origin : "")}/api/arise-todo/apple-health/sync`;
