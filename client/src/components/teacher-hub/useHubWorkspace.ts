// Opens the teacher's Hub, keeps it saved, and keeps it fresh.
//
// What it promises:
//  - a Hub that did not load properly is never saved over the real one;
//  - changes are saved a moment after typing stops, one save at a time, and again by themselves
//    if the signal drops;
//  - leaving the page, switching apps or signing out saves first;
//  - a phone or computer left open picks up newer work done elsewhere (and if both changed,
//    the teacher is asked which copy to keep, so nothing is written over silently).
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { API_BASE } from "@/lib/queryClient";
import { HubSaver, type SaveView } from "@/lib/hubSaver";
import { HUB_REQUIRED } from "@shared/plans";
import { workspaceBytes } from "@shared/hubSave";
import { emptyWorkspace, normalizeWorkspace, type Workspace } from "@shared/teacherHub";

export type HubSync = {
  workspace: Workspace;
  setWorkspace: Dispatch<SetStateAction<Workspace>>;
  loaded: boolean;
  loadError: string;
  needsPlan: boolean;
  seats: number | null;
  view: SaveView;
  /** How much of the saved Hub's space is used, in bytes. */
  bytes: number;
  /** Tries a save that failed again right now. */
  retryNow(): void;
  /** Two devices changed the Hub: keep this one. */
  keepMine(): void;
  /** Two devices changed the Hub: take the other one. */
  useNewest(): Promise<void>;
  /** Saves anything waiting (before signing out). */
  flush(): Promise<void>;
  /** A copy was brought back from the backups: show it. */
  adopt(workspace: Workspace, updatedAt: string | null): void;
  /** Opens the Hub again from the server. */
  reload(): void;
};

const authHeaders = (token: string | null): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

/** The workspace out of a server answer, or an error if the answer is not a Hub. */
function workspaceFrom(data: any): Workspace {
  if (!data || typeof data.workspace !== "object" || data.workspace === null || Array.isArray(data.workspace)) {
    throw new Error("Teacher Hub sent back something unexpected, so nothing was opened or changed. Try again in a moment.");
  }
  return normalizeWorkspace(data.workspace);
}

export function useHubWorkspace({ enabled, token, userId }: { enabled: boolean; token: string | null; userId?: number }): HubSync {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [needsPlan, setNeedsPlan] = useState(false);
  const [seats, setSeats] = useState<number | null>(null);
  const [view, setView] = useState<SaveView>({ kind: "saved" });
  const [bytes, setBytes] = useState(0);
  const [round, setRound] = useState(0);
  const saver = useRef<HubSaver<Workspace> | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const lastCheck = useRef(0);

  // Opening the Hub.
  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;
    setLoaded(false);
    setLoadError("");
    setNeedsPlan(false);
    fetch(`${API_BASE}/api/teacher-hub/workspace`, { headers: authHeaders(token), cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (r.status === 402 && data?.code === HUB_REQUIRED) return { needsPlan: true } as const;
        if (!r.ok) throw new Error(data?.message || "Could not load Teacher Hub.");
        return { data, start: workspaceFrom(data) } as const;
      })
      .then((result) => {
        if (cancelled) return;
        if ("needsPlan" in result) { setNeedsPlan(true); setLoaded(true); return; }
        const { data, start } = result;
        saver.current?.dispose();
        saver.current = new HubSaver<Workspace>(
          {
            put: async (request, options) => {
              const body = JSON.stringify(request);
              // A save sent while the page is closing has to be small enough to be allowed to finish.
              const res = await fetch(`${API_BASE}/api/teacher-hub/workspace`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeaders(tokenRef.current) },
                body,
                keepalive: options.keepalive && body.length < 60_000,
              });
              return { status: res.status, body: await res.json().catch(() => null) };
            },
            onView: setView,
            onSaved: ({ bytes: size }) => setBytes(size),
            setTimer: (run, ms) => window.setTimeout(run, ms),
            clearTimer: (handle) => window.clearTimeout(handle as number),
          },
          { workspace: start, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null },
        );
        setSeats(typeof data.seats === "number" ? data.seats : null);
        setWorkspace(start);
        setBytes(workspaceBytes(start));
        setView({ kind: "saved" });
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.message || "Could not load Teacher Hub.");
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [enabled, token, userId, round]);

  // Every change goes to the saver.
  useEffect(() => { saver.current?.change(workspace); }, [workspace]);

  // Leaving the page saves it first.
  useEffect(() => () => { void saver.current?.finish(); saver.current = null; }, []);

  // Has the Hub been changed somewhere else? Only asked when nothing here is waiting to be saved.
  const check = useCallback(async () => {
    const current = saver.current;
    const key = tokenRef.current;
    if (!current || !key || current.hasUnsaved()) return;
    if (Date.now() - lastCheck.current < 10_000) return;
    lastCheck.current = Date.now();
    try {
      const since = current.baseUpdatedAt;
      const r = await fetch(`${API_BASE}/api/teacher-hub/workspace${since ? `?since=${encodeURIComponent(since)}` : ""}`, { headers: authHeaders(key), cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json().catch(() => null);
      if (!data || data.unchanged || !data.workspace) return;
      const next = workspaceFrom(data);
      // Something was typed while the answer came back: the next save will ask which copy to keep.
      if (saver.current !== current || current.hasUnsaved()) return;
      current.rebase(next, typeof data.updatedAt === "string" ? data.updatedAt : null);
      setWorkspace(next);
      setBytes(workspaceBytes(next));
    } catch {
      /* offline: nothing to refresh */
    }
  }, []);

  useEffect(() => {
    const save = () => { void saver.current?.flush(); };
    const onVisibility = () => { if (document.visibilityState === "hidden") save(); else void check(); };
    const onOnline = () => { saver.current?.retryNow(); void check(); };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saver.current?.hasUnsaved()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    // A tab left open all day still catches up with work done on another device.
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void check(); }, 90_000);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(timer);
    };
  }, [check]);

  const useNewest = useCallback(async () => {
    const key = tokenRef.current;
    if (!key) return;
    const r = await fetch(`${API_BASE}/api/teacher-hub/workspace`, { headers: authHeaders(key), cache: "no-store" });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.message || "Could not load the newest copy.");
    const next = workspaceFrom(data);
    saver.current?.rebase(next, typeof data.updatedAt === "string" ? data.updatedAt : null);
    setWorkspace(next);
    setBytes(workspaceBytes(next));
  }, []);

  const adopt = useCallback((next: Workspace, updatedAt: string | null) => {
    const clean = normalizeWorkspace(next);
    saver.current?.rebase(clean, updatedAt);
    setWorkspace(clean);
    setBytes(workspaceBytes(clean));
  }, []);

  return {
    workspace, setWorkspace, loaded, loadError, needsPlan, seats, view, bytes,
    retryNow: () => saver.current?.retryNow(),
    keepMine: () => saver.current?.keepMine(),
    useNewest,
    flush: async () => { await saver.current?.flush(); },
    adopt,
    reload: () => setRound((n) => n + 1),
  };
}
