// Saving Arise Office files and premium-app data to the person's account (server/userDocs.ts).
//
// Every change saves by itself a moment after typing stops. A copy is also kept on this device the
// whole time, so nothing is lost if the signal drops or the tab closes mid-save: it is sent the next
// time the file opens. Two devices editing one file are told, instead of one quietly writing over
// the other.
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

export type DocKind = "sheet" | "doc" | "slides";
export type DocEntry = { id: string; kind: DocKind; name: string; createdAt: string; updatedAt: string; size: number; trashedAt?: string; starred?: boolean };
export type SaveState = "saved" | "saving" | "unsaved" | "offline" | "conflict" | "error";

async function call<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as any).message || "Something went wrong. Try again."), { status: res.status, data });
  return data as T;
}

export const docsApi = (token: string | null) => ({
  list: (kind?: DocKind, trash = false) => call<{ docs: DocEntry[] }>(token, `/api/docs?${kind ? `kind=${kind}&` : ""}${trash ? "trash=1" : ""}`).then((r) => r.docs),
  create: (kind: DocKind, name: string, content: unknown) => call<{ doc: DocEntry }>(token, "/api/docs", { method: "POST", body: JSON.stringify({ kind, name, content }) }).then((r) => r.doc),
  open: <C>(id: string) => call<DocEntry & { content: C }>(token, `/api/docs/${id}`),
  save: (id: string, body: { name?: string; content?: unknown; baseUpdatedAt?: string; force?: boolean; starred?: boolean }) => call<{ doc: DocEntry }>(token, `/api/docs/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.doc),
  trash: (id: string) => call<{ ok: true }>(token, `/api/docs/${id}`, { method: "DELETE" }),
  restore: (id: string) => call<{ ok: true }>(token, `/api/docs/${id}/restore`, { method: "POST" }),
  versions: (id: string) => call<{ versions: { at: number }[] }>(token, `/api/docs/${id}/versions`).then((r) => r.versions),
  version: <C>(id: string, at: number) => call<DocEntry & { content: C }>(token, `/api/docs/${id}/versions/${at}`),
});

const pendingKey = (id: string) => `arise-doc-pending:${id}`;
const readPending = <C,>(id: string): { content: C; name: string; base: string } | null => {
  try { const raw = localStorage.getItem(pendingKey(id)); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const writePending = (id: string, v: unknown) => { try { localStorage.setItem(pendingKey(id), JSON.stringify(v)); } catch { /* full: the server copy still saves */ } };
const clearPending = (id: string) => { try { localStorage.removeItem(pendingKey(id)); } catch { /* nothing */ } };

/**
 * One open file. `content` and `name` are what's on screen; `setContent` changes it and saving
 * follows by itself. `flush` saves right now (before closing).
 */
export function useCloudDoc<C>(id: string | null, clean: (raw: unknown) => C) {
  const { token } = useAuth();
  const api = docsApi(token);
  const [content, setContentState] = useState<C | null>(null);
  const [name, setNameState] = useState("");
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const base = useRef("");
  const timer = useRef<number | null>(null);
  const latest = useRef<{ content: C | null; name: string }>({ content: null, name: "" });
  const dirty = useRef(false);
  const saving = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true); setError("");
    api.open<C>(id).then((doc) => {
      if (!alive) return;
      const pending = readPending<C>(id);
      // A save that never reached the server (closed tab, no signal) comes back and goes out now.
      const diverged = !!pending && pending.base !== doc.updatedAt;
      base.current = doc.updatedAt;
      // Never discard unsent edits just because another device saved first.
      const c = clean(pending ? pending.content : doc.content);
      latest.current = { content: c, name: pending ? pending.name : doc.name };
      setContentState(c); setNameState(latest.current.name);
      if (diverged) { dirty.current = true; setState("conflict"); }
      else if (pending) { dirty.current = true; schedule(50); }
      else { clearPending(id); setState("saved"); }
    }).catch((e) => {
      if (!alive) return;
      const pending = readPending<C>(id);
      if (pending) { const c = clean(pending.content); latest.current = { content: c, name: pending.name }; setContentState(c); setNameState(pending.name); base.current = pending.base; dirty.current = true; setState("offline"); }
      else setError(e.message);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const save = useCallback(async (force = false) => {
    if (!id || !dirty.current) return;
    if (saving.current) { await saving.current; if (!dirty.current) return; }
    dirty.current = false;
    setState("saving");
    const snap = latest.current;
    const run = api.save(id, { name: snap.name, content: snap.content, baseUpdatedAt: base.current, force }).then((doc) => {
      base.current = doc.updatedAt;
      if (!dirty.current) { clearPending(id); setState("saved"); }
    }).catch((e: any) => {
      if (e.status === 409) { setState("conflict"); return; }
      dirty.current = true;
      setState(navigator.onLine === false ? "offline" : "error");
      setError(e.message);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), 8000);
    }).finally(() => { saving.current = null; });
    saving.current = run;
    await run;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const schedule = (ms = 900) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), ms);
  };

  const touch = () => {
    dirty.current = true;
    setState("unsaved");
    if (id) writePending(id, { content: latest.current.content, name: latest.current.name, base: base.current });
    schedule();
  };
  const setContent = useCallback((update: C | ((prev: C) => C)) => {
    // Update the ref synchronously. React may defer a functional state updater:
    // writing the pending backup before it runs used to back up the OLD value.
    const next = typeof update === "function" ? (update as (p: C) => C)(latest.current.content as C) : update;
    latest.current = { ...latest.current, content: next };
    setContentState(next);
    touch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const setName = (n: string) => { latest.current = { ...latest.current, name: n }; setNameState(n); touch(); };

  // Save on leaving the page or switching apps.
  useEffect(() => {
    const go = () => { if (dirty.current) void save(); };
    const vis = () => { if (document.visibilityState === "hidden") go(); };
    window.addEventListener("beforeunload", go);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("online", go);
    return () => { window.removeEventListener("beforeunload", go); document.removeEventListener("visibilitychange", vis); window.removeEventListener("online", go); go(); };
  }, [save]);

  return {
    content, name, setContent, setName, state, error, loading,
    flush: () => save(),
    /** Two devices changed it: keep what's on this screen. */
    keepMine: () => { dirty.current = true; void save(true); },
    /** Two devices changed it: take the other copy. */
    reload: async () => { if (!id) return; const doc = await api.open<C>(id); base.current = doc.updatedAt; const c = clean(doc.content); latest.current = { content: c, name: doc.name }; setContentState(c); setNameState(doc.name); clearPending(id); setState("saved"); },
  };
}

export function saveLabel(s: SaveState): string {
  return s === "saved" ? "All changes saved" : s === "saving" ? "Saving…" : s === "unsaved" ? "Saving soon…" : s === "offline" ? "Offline — kept on this device" : s === "conflict" ? "Changed on another device" : "Couldn't save — retrying";
}

// ─── A premium app's own data ───────────────────────────────────────────────

const appKey = (app: string) => `arise-app-data:${app}`;

/**
 * State for a premium app that saves itself to the account (and to this device, so it opens
 * instantly and works offline). `clean` makes whatever comes back safe to use.
 */
export function useAppData<T>(app: string, clean: (raw: unknown) => T) {
  const { token } = useAuth();
  const [data, setDataState] = useState<T>(() => {
    try { const raw = localStorage.getItem(appKey(app)); return clean(raw ? JSON.parse(raw).data : null); } catch { return clean(null); }
  });
  const [state, setState] = useState<SaveState>("saved");
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(data);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    if (!token) { setLoaded(true); return; }
    call<{ data: unknown; updatedAt: string | null }>(token, `/api/app-data/${app}`).then((r) => {
      if (!alive) return;
      let localAt = "";
      try { localAt = JSON.parse(localStorage.getItem(appKey(app)) || "{}").at || ""; } catch { /* none */ }
      const unsent = (() => { try { return !!JSON.parse(localStorage.getItem(appKey(app)) || "{}").unsent; } catch { return false; } })();
      if (r.data !== null && !(unsent && localAt > (r.updatedAt || ""))) {
        const c = clean(r.data);
        latest.current = c; setDataState(c);
        try { localStorage.setItem(appKey(app), JSON.stringify({ data: r.data, at: r.updatedAt })); } catch { /* fine */ }
      } else if (unsent) { dirty.current = true; void push(); }
    }).catch(() => setState("offline")).finally(() => alive && setLoaded(true));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, token]);

  const push = useCallback(async () => {
    if (!dirty.current || !token) return;
    dirty.current = false;
    setState("saving");
    try {
      const r = await call<{ updatedAt: string }>(token, `/api/app-data/${app}`, { method: "PUT", body: JSON.stringify({ data: latest.current }) });
      try { localStorage.setItem(appKey(app), JSON.stringify({ data: latest.current, at: r.updatedAt })); } catch { /* fine */ }
      if (!dirty.current) setState("saved");
    } catch (e: any) {
      dirty.current = true;
      setState(e.status === 413 ? "error" : "offline");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void push(), 10_000);
    }
  }, [app, token]);

  const setData = useCallback((update: T | ((prev: T) => T)) => {
    const next = typeof update === "function" ? (update as (p: T) => T)(latest.current) : update;
    latest.current = next;
    setDataState(next);
    try { localStorage.setItem(appKey(app), JSON.stringify({ data: next, at: new Date().toISOString(), unsent: true })); } catch { /* fine */ }
    dirty.current = true;
    setState("unsaved");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void push(), 800);
  }, [app, push]);

  useEffect(() => {
    const go = () => { if (dirty.current) void push(); };
    const vis = () => { if (document.visibilityState === "hidden") go(); };
    window.addEventListener("beforeunload", go);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("beforeunload", go); document.removeEventListener("visibilitychange", vis); go(); };
  }, [push]);

  return { data, setData, state, loaded };
}

/** Ask the premium apps' AI (server/proAppsAI.ts) for one of its fixed tasks. */
export async function askAppAi<T = any>(token: string | null, task: string, input: Record<string, string | number>): Promise<T> {
  const r = await call<{ result: T }>(token, "/api/apps/ai", { method: "POST", body: JSON.stringify({ task, input }) });
  return r.result;
}
