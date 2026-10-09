// Account-backed To-Do sync: local safety copy + automatic cloud saves,
// periodic cross-device refresh, and an explicit choice when two devices edit at once.
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { API_BASE } from "@/lib/queryClient";
import { HubSaver, type SaveView } from "@/lib/hubSaver";

const api = `${API_BASE}/api/arise-todo/workspace`;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const backupKey = (id: number) => `arise-todo-draft-v2:${id}`;

export function useTodoCloud<W extends object>({
  userId, token, blank, isValid,
}: {
  userId?: number;
  token: string | null;
  blank: () => W;
  isValid: (value: unknown) => value is W;
}) {
  const [workspace, rawSetWorkspace] = useState<W>(blank);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<SaveView>({ kind: "saved" });
  const [recovery, setRecovery] = useState<W | null>(null);
  const [round, setRound] = useState(0);
  const saver = useRef<HubSaver<W> | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const lastCheck = useRef(0);
  const userRef = useRef(userId);
  userRef.current = userId;

  const saveDraft = useCallback((current: W, dirty: boolean) => {
    if (!userRef.current) return;
    try { localStorage.setItem(backupKey(userRef.current), JSON.stringify({ workspace: current, dirty })); } catch {}
  }, []);

  useEffect(() => {
    if (!token || !userId) {
      saver.current?.dispose();
      saver.current = null;
      rawSetWorkspace(blank());
      setLoaded(false);
      setRecovery(null);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    setError("");
    setRecovery(null);
    (async () => {
      try {
        const response = await fetch(api, { headers: auth(token), cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message || "Could not load your account's tasks.");
        const remote = body?.workspace === null ? blank() : body?.workspace;
        if (!isValid(remote)) throw new Error("The account returned an invalid task list. Nothing was changed.");
        if (cancelled) return;
        saver.current?.dispose();
        const instance = new HubSaver<W>({
          put: async (request, options) => {
            const json = JSON.stringify(request);
            const res = await fetch(api, {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...auth(tokenRef.current || "") },
              body: json, keepalive: options.keepalive && json.length < 60_000,
            });
            return { status: res.status, body: await res.json().catch(() => null) };
          },
          onView: next => {
            if (cancelled) return;
            setView(next);
            if (next.kind === "saved" && saver.current) saveDraft(saver.current.current(), false);
          },
          setTimer: (fn, ms) => window.setTimeout(fn, ms),
          clearTimer: timer => window.clearTimeout(timer as number),
          debounceMs: 650,
        }, {
          workspace: remote,
          updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
        });
        saver.current = instance;
        let unsavedCopy: W | null = null;
        try {
          const raw = localStorage.getItem(backupKey(userId));
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached?.dirty === true && isValid(cached.workspace) && JSON.stringify(cached.workspace) !== JSON.stringify(remote)) {
              unsavedCopy = cached.workspace;
            }
          }
        } catch {}
        setRecovery(unsavedCopy);
        rawSetWorkspace(remote);
        if (!unsavedCopy) saveDraft(remote, false);
        setView({ kind: "saved" });
        setLoaded(true);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Unable to load your saved tasks.");
        setLoaded(false); // Never allow an empty copy to overwrite cloud data after a failed load.
      }
    })();
    return () => { cancelled = true; saver.current?.dispose(); saver.current = null; };
  }, [token, userId, round, blank, isValid, saveDraft]);

  // Every change creates an account-specific safety copy before being synced.
  useEffect(() => {
    if (!loaded || recovery || !saver.current) return;
    saver.current.change(workspace);
    saveDraft(workspace, saver.current.hasUnsaved());
  }, [workspace, loaded, recovery, saveDraft]);

  const check = useCallback(async () => {
    const instance = saver.current;
    if (!instance || !tokenRef.current || !loaded || recovery || instance.hasUnsaved()) return;
    if (Date.now() - lastCheck.current < 10000) return;
    lastCheck.current = Date.now();
    try {
      const since = instance.baseUpdatedAt;
      const response = await fetch(`${api}${since ? `?since=${encodeURIComponent(since)}` : ""}`, {
        headers: auth(tokenRef.current), cache: "no-store",
      });
      if (!response.ok) return;
      const body = await response.json().catch(() => null);
      if (!body || body.unchanged) return;
      const latest = body.workspace === null ? blank() : body.workspace;
      if (!isValid(latest) || saver.current !== instance || instance.hasUnsaved()) return;
      instance.rebase(latest, typeof body.updatedAt === "string" ? body.updatedAt : null);
      rawSetWorkspace(latest);
      saveDraft(latest, false);
    } catch { /* reconnecting later */ }
  }, [loaded, recovery, blank, isValid, saveDraft]);

  useEffect(() => {
    const send = () => { void saver.current?.flush(); };
    const visibility = () => { if (document.visibilityState === "hidden") send(); else void check(); };
    const online = () => { saver.current?.retryNow(); void check(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saver.current?.hasUnsaved()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("pagehide", send);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void check(); }, 30000);
    return () => {
      window.removeEventListener("pagehide", send);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
      window.clearInterval(timer);
    };
  }, [check]);

  const setWorkspace: Dispatch<SetStateAction<W>> = useCallback(next => {
    rawSetWorkspace(previous => typeof next === "function"
      ? (next as (value: W) => W)(previous) : next);
  }, []);
  const keepMine = useCallback(() => saver.current?.keepMine(), []);
  const useNewest = useCallback(async () => {
    const current = saver.current;
    if (!current || !tokenRef.current) return;
    const response = await fetch(api, { headers: auth(tokenRef.current), cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || "Could not load the newer copy.");
    const remote = body?.workspace === null ? blank() : body?.workspace;
    if (!isValid(remote)) throw new Error("The newer copy could not be opened.");
    if (saver.current !== current) return;
    current.rebase(remote, typeof body.updatedAt === "string" ? body.updatedAt : null);
    rawSetWorkspace(remote);
    saveDraft(remote, false);
  }, [blank, isValid, saveDraft]);
  const recoverMine = useCallback(() => {
    if (!recovery) return;
    const copy = recovery;
    setRecovery(null);
    rawSetWorkspace(copy);
    saver.current?.change(copy);
    saveDraft(copy, true);
  }, [recovery, saveDraft]);
  const discardRecovery = useCallback(() => {
    setRecovery(null);
    saveDraft(workspace, false);
  }, [workspace, saveDraft]);

  return {
    workspace, setWorkspace, loaded, error, view, recovery,
    keepMine, useNewest, recoverMine, discardRecovery,
    flush: () => saver.current?.flush() || Promise.resolve(),
    retry: () => { if (error) setRound(r => r + 1); else saver.current?.retryNow(); },
    refresh: () => { void check(); },
  };
}
