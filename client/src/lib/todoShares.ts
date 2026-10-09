// A.R.I.S.E. To-Do share links on the owner's side: the links they've made, votes that came in
// through poll links, and making / turning off a link. One copy for the whole page, so the
// "Share link" buttons and the list in Family & settings always agree.
import { useEffect, useSyncExternalStore } from "react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

export type ShareLink = { token: string; target: string; url: string; label: string; createdAt: string };
export type GuestVotes = Record<string, { name: string; optionId: string }[]>;
type State = { shares: ShareLink[]; guestVotes: GuestVotes; loadedAt: number; error: string };

let state: State = { shares: [], guestVotes: {}, loadedAt: 0, error: "" };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

async function call(token: string | null, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init, cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

export function loadShares(token: string | null): Promise<void> {
  if (!token) return Promise.resolve();
  if (!loading) {
    loading = call(token, "/api/arise-todo/shares")
      .then((d) => set({ shares: d.shares || [], guestVotes: d.guestVotes || {}, loadedAt: Date.now(), error: "" }))
      .catch((e) => set({ error: e.message, loadedAt: Date.now() }))
      .finally(() => { loading = null; });
  }
  return loading;
}

/** Makes (or finds) the link for something, e.g. "poll:abc", "bills", "trip:xyz". */
export async function makeShare(token: string | null, target: string): Promise<ShareLink> {
  const made = await call(token, "/api/arise-todo/shares", { method: "POST", body: JSON.stringify({ target }) });
  await loadShares(token);
  return state.shares.find((s) => s.token === made.token) || { token: made.token, target: made.target, url: made.url, label: "", createdAt: new Date().toISOString() };
}

export async function stopShare(token: string | null, shareToken: string): Promise<void> {
  await call(token, `/api/arise-todo/shares/${encodeURIComponent(shareToken)}`, { method: "DELETE" });
  set({ shares: state.shares.filter((s) => s.token !== shareToken) });
}

/** The owner's links. `refreshEvery` (ms) keeps it fresh while a page is open (for incoming votes). */
export function useTodoShares(refreshEvery = 0) {
  const { token } = useAuth();
  const snapshot = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state);
  useEffect(() => {
    if (!token) return;
    if (Date.now() - state.loadedAt > 15_000) void loadShares(token);
    if (!refreshEvery) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadShares(token); }, refreshEvery);
    return () => window.clearInterval(timer);
  }, [token, refreshEvery]);
  return { ...snapshot, token };
}

/** Copies a link, or opens the phone's share sheet where there is one. Returns how it went out. */
export async function sendLink(url: string, title: string): Promise<"shared" | "copied" | "shown" | "cancelled"> {
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && typeof navigator !== "undefined" && "share" in navigator) {
    try { await navigator.share({ title, url }); return "shared"; } catch (e: any) { if (e?.name === "AbortError") return "cancelled"; }
  }
  try { await navigator.clipboard.writeText(url); return "copied"; } catch { /* fall through */ }
  window.prompt("Copy this link and send it to your family:", url);
  return "shown";
}
