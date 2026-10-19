// Linked profiles in the browser: the calls to server/profileLinks.ts.
import { API_BASE } from "@/lib/queryClient";
import type { Grants } from "@shared/profileLinks";

export type MyLink = { id: string; email: string; nickname: string; status: "pending" | "active"; grants: Grants; viewerName: string; createdAt?: string };
export type SharedLink = { id: string; ownerId: number; ownerName: string; status: "pending" | "active"; grants: Grants };
export type LinksState = { mine: MyLink[]; withMe: SharedLink[]; myEmail: string };

async function call<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as any).message || "Something went wrong. Try again."), { status: res.status });
  return data as T;
}

export const linksApi = (token: string | null) => ({
  list: () => call<LinksState>(token, "/api/profile-links"),
  invite: (email: string, nickname: string, grants: Grants) => call<{ link: MyLink }>(token, "/api/profile-links", { method: "POST", body: JSON.stringify({ email, nickname, grants }) }).then((r) => r.link),
  update: (id: string, patch: { grants?: Grants; nickname?: string }) => call<{ link: MyLink }>(token, `/api/profile-links/${id}`, { method: "PUT", body: JSON.stringify(patch) }).then((r) => r.link),
  remove: (id: string) => call<{ ok: true }>(token, `/api/profile-links/${id}`, { method: "DELETE" }),
  accept: (ownerId: number, id: string) => call<{ ok: true }>(token, `/api/profile-links/from/${ownerId}/${id}/accept`, { method: "POST" }),
  leave: (ownerId: number, id: string) => call<{ ok: true }>(token, `/api/profile-links/from/${ownerId}/${id}/leave`, { method: "POST" }),
  lifeView: (ownerId: number, item: string, today: string) => call<{ view: any; today: string; owner: string }>(token, `/api/profile-links/from/${ownerId}/life/${encodeURIComponent(item)}?today=${today}`),
});

/** Where a shared premium app opens: the apps page with the owner's id, which shows their copy. */
export const sharedAppHref = (appId: string, ownerId: number) => `#/pro?app=${encodeURIComponent(appId)}&owner=${ownerId}&hub=life`;
