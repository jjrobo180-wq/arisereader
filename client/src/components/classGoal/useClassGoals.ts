// The class goals on this screen: what the server last said, plus the changes made here that
// haven't been saved yet. A tap shows at once; the change is sent in the background and kept (even
// through a reload or a dropped connection) until the server has it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { applyAll, cleanClassGoals, emptyClassGoals, type ClassGoals, type Op } from "@shared/classGoals";

export type Link = "loading" | "saved" | "saving" | "offline" | "signin" | "error";
type OpInput = Op extends infer T ? T extends Op ? Omit<T, "opId" | "at"> : never : never;

export const newId = (prefix: string) => {
  const raw = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return (prefix + raw).slice(0, 40);
};

const POLL_MS = 4000;
const storeKey = (userId: unknown) => `arise-class-goals:${userId}`;
function readCache(userId: unknown): { server: ClassGoals | null; pending: Op[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey(userId)) || "null");
    if (!raw) return { server: null, pending: [] };
    return { server: raw.server ? cleanClassGoals(raw.server) : null, pending: Array.isArray(raw.pending) ? raw.pending.filter((o: any) => o && typeof o.opId === "string" && typeof o.type === "string").slice(-300) : [] };
  } catch { return { server: null, pending: [] }; }
}
function writeCache(userId: unknown, server: ClassGoals | null, pending: Op[]) {
  try { localStorage.setItem(storeKey(userId), JSON.stringify({ server, pending })); } catch { /* private window or full: the live copy still works */ }
}

export function useClassGoals(userId: unknown, token: string | null) {
  const first = useRef<ReturnType<typeof readCache> | null>(null);
  if (!first.current) first.current = readCache(userId);
  const [server, setServer] = useState<ClassGoals | null>(first.current.server);
  const [pending, setPending] = useState<Op[]>(first.current.pending);
  const [link, setLink] = useState<Link>(first.current.server ? "saved" : "loading");
  const serverRef = useRef(server); serverRef.current = server;
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const sending = useRef(false);
  const retryAt = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const headers = useCallback((json: boolean) => ({ ...(json ? { "Content-Type": "application/json" } : {}), Authorization: "Bearer " + token }), [token]);

  const keep = useCallback((s: ClassGoals | null, p: Op[]) => { writeCache(userId, s, p); }, [userId]);

  const flush = useCallback(async () => {
    if (sending.current || !token) return;
    const batch = pendingRef.current.slice(0, 60);
    if (!batch.length) return;
    sending.current = true;
    setLink("saving");
    try {
      const res = await fetch(API_BASE + "/api/class-goals/ops", { method: "POST", headers: headers(true), body: JSON.stringify({ ops: batch }), cache: "no-store" });
      if (res.status === 401) { setLink("signin"); retryAt.current = Date.now() + 15000; return; }
      if (res.status === 400 || res.status === 403) {
        // The server will never accept these; keeping them would block everything behind them.
        const ids = new Set(batch.map((o) => o.opId));
        const rest = pendingRef.current.filter((o) => !ids.has(o.opId));
        pendingRef.current = rest; setPending(rest); keep(serverRef.current, rest);
        setLink(res.status === 403 ? "error" : "saved");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      const state = cleanClassGoals(body.state);
      const ids = new Set(batch.map((o) => o.opId));
      const rest = pendingRef.current.filter((o) => !ids.has(o.opId));
      if (!alive.current) return;
      pendingRef.current = rest;
      if (!serverRef.current || state.rev >= serverRef.current.rev) { serverRef.current = state; setServer(state); }
      setPending(rest); keep(serverRef.current, rest);
      setLink(rest.length ? "saving" : "saved");
      retryAt.current = 0;
    } catch {
      setLink("offline");
      retryAt.current = Date.now() + 4000;
    } finally {
      sending.current = false;
    }
    if (pendingRef.current.length && !retryAt.current) void flush();
  }, [token, headers, keep]);

  const poll = useCallback(async () => {
    if (!token || sending.current) return;
    try {
      const rev = serverRef.current?.rev;
      const res = await fetch(API_BASE + "/api/class-goals" + (rev !== undefined ? `?rev=${rev}` : ""), { headers: headers(false), cache: "no-store" });
      if (res.status === 401) { setLink("signin"); return; }
      if (res.status === 403) { setLink("error"); return; }
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (!alive.current) return;
      if (!body.unchanged && body.state && !sending.current) {
        const state = cleanClassGoals(body.state);
        // A slow answer to an earlier look must not undo a newer one.
        if (!serverRef.current || state.rev >= serverRef.current.rev) { serverRef.current = state; setServer(state); keep(state, pendingRef.current); }
      } else if (!serverRef.current && body.unchanged) {
        // can't happen (no rev is sent without a copy), but never stay on "loading"
        const empty = emptyClassGoals(); serverRef.current = empty; setServer(empty);
      }
      setLink(pendingRef.current.length ? "saving" : "saved");
      if (pendingRef.current.length) void flush();
    } catch {
      setLink((l) => (l === "loading" && !serverRef.current ? "error" : "offline"));
    }
  }, [token, headers, keep, flush]);

  // First load, then keep looking for changes made on another device.
  useEffect(() => {
    void poll().then(() => flush());
    const t = window.setInterval(() => {
      if (document.hidden) return;
      if (pendingRef.current.length) { if (Date.now() >= retryAt.current) { retryAt.current = 0; void flush(); } return; }
      void poll();
    }, POLL_MS);
    const wake = () => { if (!document.hidden) { retryAt.current = 0; void (pendingRef.current.length ? flush() : poll()); } };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); window.removeEventListener("focus", wake); };
  }, [poll, flush]);

  const send = useCallback((op: OpInput): string => {
    const full = { ...op, opId: newId("o"), at: new Date().toISOString() } as Op;
    const next = [...pendingRef.current, full];
    pendingRef.current = next; setPending(next); keep(serverRef.current, next);
    setLink("saving");
    retryAt.current = 0;
    void flush();
    return full.opId;
  }, [flush, keep]);

  const view = useMemo(() => (server ? applyAll(server, pending) : null), [server, pending]);
  return { state: view, link, pendingCount: pending.length, send, retry: () => { retryAt.current = 0; void (pendingRef.current.length ? flush() : poll()); } };
}
