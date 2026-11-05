// Account-backed LifeHub sync: local safety copy + automatic cloud saves,
// periodic cross-device refresh, and an explicit choice when two devices edit at once.
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { API_BASE } from "@/lib/queryClient";
import { HubSaver, type SaveView } from "@/lib/hubSaver";
import { announceSaved, onOtherCopySaved } from "@/lib/paneSync";
import { markHubOpen, prefetchHub, recallHub, rememberHub } from "@/lib/hubMemory";
import { merge3 } from "@shared/mergeJson";

const api = `${API_BASE}/api/arise-todo/workspace`;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const backupKey = (id: number) => `arise-todo-draft-v2:${id}`;

/** LifeHub's copy, fetched in the background while WorkHub is open, so switching over is instant.
 *  Not when this device holds changes that never reached the account: then LifeHub opens the normal
 *  way, which offers to bring them back. */
export function prefetchLifeHub(userId: number | undefined, token: string | null): Promise<void> {
  return prefetchHub<object>("todo", userId, async () => {
    if (!token || !userId) return null;
    try { const raw = localStorage.getItem(backupKey(userId)); if (raw && JSON.parse(raw)?.dirty === true) return null; } catch { return null; }
    const response = await fetch(api, { headers: auth(token), cache: "no-store" });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    const remote = body?.workspace;
    if (!remote || typeof remote !== "object" || Array.isArray(remote)) return null;
    return { workspace: remote, updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null };
  });
}

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
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const recoveryRef = useRef(recovery);
  recoveryRef.current = recovery;
  const checkRef = useRef<() => Promise<void>>(async () => {});

  const saveDraft = useCallback((current: W, dirty: boolean) => {
    if (!userRef.current) return;
    // The copy last saved to the account goes with it, so changes made offline merge cleanly later.
    const base = saver.current ? saver.current.saved : undefined;
    try { localStorage.setItem(backupKey(userRef.current), JSON.stringify({ workspace: current, dirty, ...(dirty && base ? { base } : {}) })); } catch {}
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
    markHubOpen("todo", userId, true);
    // Coming back from WorkHub (or anywhere else on this page): show the copy kept in memory at
    // once, and catch up with the server in the background — no loading screen. (A copy fetched
    // ahead of time is checked like one from the server.)
    const remembered = recallHub<W>("todo", userId);
    const memo = remembered && isValid(remembered.workspace) && isValid(remembered.saved) ? remembered : null;
    setError("");
    setRecovery(null);
    if (memo) {
      rawSetWorkspace(memo.workspace);
      setView(JSON.stringify(memo.workspace) === JSON.stringify(memo.saved) ? { kind: "saved" } : { kind: "waiting" });
      setLoaded(true);
    } else {
      setLoaded(false);
    }
    const makeSaver = (start: W, updatedAt: string | null) => new HubSaver<W>({
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
      onSaved: () => announceSaved("todo", userRef.current),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: timer => window.clearTimeout(timer as number),
      debounceMs: 650,
      // Two devices saved at once: merged by itself, never a "which copy?" question.
      fetchLatest: async () => {
        const res = await fetch(api, { headers: auth(tokenRef.current || ""), cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error("not reached");
        const remote = body?.workspace === null ? blank() : body?.workspace;
        return isValid(remote) ? { workspace: remote, updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null } : null;
      },
      onMerged: merged => { if (!cancelled) { rawSetWorkspace(merged); saveDraft(merged, true); } },
    }, { workspace: start, updatedAt });
    (async () => {
      try {
        if (memo) {
          // A save left running when this hub was last closed finishes first, so this one names the right copy.
          if (memo.pending) await memo.pending.catch(() => {});
          const latest = recallHub<W>("todo", userId) ?? memo;
          if (cancelled) return;
          saver.current?.dispose();
          const instance = makeSaver(latest.saved, latest.updatedAt);
          saver.current = instance;
          // Anything changed in memory, or while that save finished, goes out as a normal save. (With
          // no save to wait for this runs before the remembered copy has even rendered, so it is
          // handed over directly — never the blank placeholder from before the first render.)
          instance.change(memo.pending ? workspaceRef.current : memo.workspace);
          // Then ask the server for anything newer, once the page has caught up with `loaded`.
          window.setTimeout(() => { if (!cancelled) { lastCheck.current = 0; void checkRef.current(); } }, 60);
          return;
        }
        const response = await fetch(api, { headers: auth(token), cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message || "Could not load your account's tasks.");
        const remote = body?.workspace === null ? blank() : body?.workspace;
        if (!isValid(remote)) throw new Error("The account returned an invalid task list. Nothing was changed.");
        if (cancelled) return;
        saver.current?.dispose();
        const instance = makeSaver(remote, typeof body?.updatedAt === "string" ? body.updatedAt : null);
        saver.current = instance;
        // Changes on this device that never reached the account (no signal, app closed) are merged
        // with the account's copy and saved, by themselves: nothing to choose.
        let merged: W | null = null;
        try {
          const raw = localStorage.getItem(backupKey(userId));
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached?.dirty === true && isValid(cached.workspace) && JSON.stringify(cached.workspace) !== JSON.stringify(remote)) {
              const m = merge3(isValid(cached.base) ? cached.base : undefined, cached.workspace, remote);
              if (isValid(m)) merged = m;
            }
          }
        } catch {}
        setRecovery(null);
        rawSetWorkspace(merged ?? remote);
        setView({ kind: merged ? "waiting" : "saved" });
        setLoaded(true);
        if (merged) { instance.change(merged); saveDraft(merged, true); } else saveDraft(remote, false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Unable to load your saved tasks.");
        setLoaded(false); // Never allow an empty copy to overwrite cloud data after a failed load.
      }
    })();
    return () => {
      cancelled = true;
      markHubOpen("todo", userId, false);
      const instance = saver.current;
      saver.current = null;
      if (!instance) return;
      // Leaving LifeHub (for WorkHub, say): anything typed in the last moment is still saved — it
      // used to be dropped here — and the copy is kept in memory for an instant way back. Not after
      // signing out (no token any more), and not while a recovered copy is waiting to be chosen.
      const signedIn = !!tokenRef.current && userRef.current === userId;
      const unsaved = instance.hasUnsaved();
      const pending = unsaved
        ? instance.finish().then(() => { if (signedIn) rememberHub<W>("todo", userId, { saved: instance.saved, updatedAt: instance.baseUpdatedAt, pending: undefined }); })
        : undefined;
      if (!unsaved) instance.dispose();
      if (signedIn && !recoveryRef.current) rememberHub<W>("todo", userId, { workspace: instance.current(), saved: instance.saved, updatedAt: instance.baseUpdatedAt, pending });
    };
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
  checkRef.current = check;

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
    // The other pane (or tab) just saved: catch up now.
    const stopListening = onOtherCopySaved("todo", userRef.current, () => { lastCheck.current = 0; void check(); });
    return () => {
      stopListening();
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
