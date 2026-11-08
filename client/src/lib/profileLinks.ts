// Linked profiles in the browser: the calls to server/profileLinks.ts.
import { API_BASE } from "@/lib/queryClient";
import type { Grants } from "@shared/profileLinks";

export type MyLink = { id: string; email: string; nickname: string; status: "pending" | "active"; grants: Grants; viewerName: string; viewerId?: number | null; createdAt?: string };
export type SharedLink = { id: string; ownerId: number; ownerName: string; status: "pending" | "active"; grants: Grants };
export type ShareRequest = { id: string; fromId: number; fromName: string; nickname: string; grants: Grants; createdAt: string };
export type LinksState = { mine: MyLink[]; withMe: SharedLink[]; myEmail: string; requests?: ShareRequest[] };

async function call<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as any).message || "Something went wrong. Try again."), { status: res.status });
  return data as T;
}

export const linksApi = (token: string | null) => ({
  list: () => call<LinksState>(token, "/api/profile-links"),
  invite: (email: string, nickname: string, grants: Grants) => call<{ link: MyLink }>(token, "/api/profile-links", { method: "POST", body: JSON.stringify({ email, nickname, grants }) }).then((r) => r.link),
  /** Share with someone you're already together with (an Accountability space), by their account. */
  person: (userId: number, grants: Grants, nickname = "") => call<{ link: MyLink }>(token, "/api/profile-links/person", { method: "POST", body: JSON.stringify({ userId, grants, nickname }) }).then((r) => r.link),
  makeLink: (nickname: string, grants?: Grants) => call<{ token: string; link: MyLink }>(token, "/api/profile-links/link", { method: "POST", body: JSON.stringify({ nickname, ...(grants ? { grants } : {}) }) }),
  peekJoin: (joinToken: string) => call<{ ownerName: string; you: boolean }>(token, `/api/profile-links/join/${encodeURIComponent(joinToken)}`),
  join: (joinToken: string) => call<{ ok: true; ownerId: number; ownerName: string }>(token, `/api/profile-links/join/${encodeURIComponent(joinToken)}`, { method: "POST", body: "{}" }),
  update: (id: string, patch: { grants?: Grants; nickname?: string }) => call<{ link: MyLink }>(token, `/api/profile-links/${id}`, { method: "PUT", body: JSON.stringify(patch) }).then((r) => r.link),
  remove: (id: string) => call<{ ok: true }>(token, `/api/profile-links/${id}`, { method: "DELETE" }),
  ask: (email: string, nickname: string, grants: Grants) => call<{ ok: true }>(token, "/api/profile-links/ask", { method: "POST", body: JSON.stringify({ email, nickname, grants }) }),
  approve: (id: string, grants?: Grants) => call<{ ok: true }>(token, `/api/profile-links/requests/${id}/approve`, { method: "POST", body: JSON.stringify(grants ? { grants } : {}) }),
  decline: (id: string) => call<{ ok: true }>(token, `/api/profile-links/requests/${id}/decline`, { method: "POST", body: "{}" }),
  accept: (ownerId: number, id: string) => call<{ ok: true }>(token, `/api/profile-links/from/${ownerId}/${id}/accept`, { method: "POST" }),
  leave: (ownerId: number, id: string) => call<{ ok: true }>(token, `/api/profile-links/from/${ownerId}/${id}/leave`, { method: "POST" }),
  lifeView: (ownerId: number, item: string, today: string) => call<{ view: any; today: string; owner: string }>(token, `/api/profile-links/from/${ownerId}/life/${encodeURIComponent(item)}?today=${today}`),
});

/** Where a shared premium app opens: the apps page with the owner's id, which shows their copy. */
export const sharedAppHref = (appId: string, ownerId: number) => `#/pro?app=${encodeURIComponent(appId)}&owner=${ownerId}&hub=life`;

/** The address to send. The page at /join/<token> moves on to the app. */
export const joinUrl = (token: string, origin = typeof window !== "undefined" && window.location.protocol.startsWith("http") ? window.location.origin : "https://arisetodo.com") => `${origin}/join/${token}`;

/** Where a join link waits while the person signs in or makes an account. */
export const JOIN_PENDING_KEY = "arise-join-token";
