// "@arise" asks in Arise To Do's tasks (shared/ariseAsks.ts, server/todoAsks.ts): sending one, the list of
// every ask (one store for the whole app, refreshed while any is still being made) and opening one from a
// notification. The Tasks screen (components/teacher-hub/HubTasks.tsx) and the Add task sheet in
// pages/AriseTodo.tsx both send asks through startTaskAsk.
import { useEffect, useSyncExternalStore } from "react";
import { API_BASE } from "@/lib/queryClient";
import { askKind, askTaskTitle, askTiming, parseTaskAsk, type AriseAsk } from "@shared/ariseAsks";

type State = { asks: AriseAsk[]; loaded: boolean; open: string | null; token: string | null };
let state: State = { asks: [], loaded: false, open: null, token: null };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Told when an ask finishes while the app is open (a toast in To Do). */
const finishedListeners = new Set<(a: AriseAsk) => void>();
export const onAskFinished = (l: (a: AriseAsk) => void) => { finishedListeners.add(l); return () => { finishedListeners.delete(l); }; };

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const token = state.token;
  const res = await fetch(`${API_BASE}/api/arise-todo/asks${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } }).catch(() => null);
  if (!res) throw new Error("You seem to be offline. Try again when you're connected.");
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.message || "Arise couldn't do that. Try again.");
  return d;
}

export async function refreshAsks(): Promise<AriseAsk[]> {
  if (!state.token) return state.asks;
  const before = new Map(state.asks.map((a) => [a.id, a.status]));
  try {
    const d = await api("");
    const asks: AriseAsk[] = Array.isArray(d?.asks) ? d.asks : [];
    set({ asks, loaded: true });
    for (const a of asks) if ((a.status === "done" || a.status === "failed") && (before.get(a.id) === "working" || before.get(a.id) === "scheduled")) finishedListeners.forEach((l) => l(a));
  } catch { set({ loaded: true }); }
  return state.asks;
}

/** The asks, kept fresh: checked every 15 seconds while one is being made, and when the app comes back. */
export function useAriseAsks(token: string | null | undefined) {
  const snap = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if ((token || null) === state.token && state.loaded) return;
    set({ token: token || null, ...(token !== state.token ? { asks: [], loaded: false } : {}) });
    if (token) void refreshAsks();
  }, [token]);
  const busy = snap.asks.some((a) => a.status === "working" || (a.status === "scheduled" && Date.parse(a.runAt) <= Date.now() + 60_000));
  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => { if (busy || document.visibilityState === "visible") void refreshAsks(); }, busy ? 15_000 : 120_000);
    const back = () => { if (document.visibilityState === "visible") void refreshAsks(); };
    document.addEventListener("visibilitychange", back);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", back); };
  }, [token, busy]);
  return snap;
}

/** Opens the Arise tab on one ask (a notification tap, or a task's "Open" chip). */
export const openAsk = (id: string | null) => set({ open: id });

export type TaskFromAsk = { title: string; due: string; dueTime: string; notes: string };

/**
 * When a task's name starts with @arise: sends it to Arise and gives back the task to add (its name, due day
 * and a note), or null when it isn't an @arise task. `taskId` is the id the new task will have. A question
 * ("@arise what's the weather tomorrow") is just answered: `task` is null and no to-do is added.
 */
export function startTaskAsk(text: string, taskId: string, people: string[] = [], hub: "work" | "life" = "life"): { task: TaskFromAsk | null; sent: Promise<AriseAsk> } | null {
  const ask = parseTaskAsk(text);
  if (!ask) return null;
  const t = askTiming(ask);
  const question = askKind(ask) === "answer";
  // The phone's time zone: "the weather" means here unless the ask names a place.
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* none */ }
  const task: TaskFromAsk | null = question ? null : {
    title: askTaskTitle(t.title),
    due: t.due, dueTime: t.dueTime,
    notes: t.mode === "later" ? `Arise will make this ${t.when.replace(/^Made /, "")}. You'll get a notification when it's ready.` : "Arise is making this now. You'll get a notification when it's ready.",
  };
  const sent = api("", { method: "POST", body: JSON.stringify({ ask, ...(question ? {} : { taskId }), runAt: t.runAt.toISOString(), due: t.due, when: t.when, people, tz, ...(hub === "work" ? { hub } : {}) }) })
    .then((d) => { const a = d.ask as AriseAsk; set({ asks: [a, ...state.asks.filter((x) => x.id !== a.id)] }); if (a.status === "working") setTimeout(() => void refreshAsks(), 12_000); return a; });
  return { task, sent };
}

export async function markAskSeen(id: string) {
  set({ asks: state.asks.map((a) => (a.id === id ? { ...a, seen: true } : a)) });
  await api(`/${id}/seen`, { method: "POST" }).catch(() => {});
}
export async function retryAsk(id: string) {
  const d = await api(`/${id}/retry`, { method: "POST" });
  set({ asks: state.asks.map((a) => (a.id === id ? { ...a, ...(d.ask || {}), status: "working" } : a)) });
  setTimeout(() => void refreshAsks(), 12_000);
}
export async function deleteAsk(id: string) {
  await api(`/${id}`, { method: "DELETE" });
  set({ asks: state.asks.filter((a) => a.id !== id), open: state.open === id ? null : state.open });
}
