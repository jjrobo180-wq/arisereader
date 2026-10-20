// Para Team on the device: talking to /api/para-teams and keeping one team's items fresh.
// The rules are in shared/paraTeam.ts and the routes in server/paraTeam.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { TODO_APP } from "@/lib/hubs";
import type { ParaData, ParaItem, ParaKind, ParaTeamSummary, ParaTeamView, DocFolder } from "@shared/paraTeam";

/** The code from an invite link, kept while someone signs in or makes an account. */
export const PENDING_JOIN_KEY = "para_team_join_code";
/** The team last opened on this device. */
export const LAST_TEAM_KEY = "para_team_last";

/** The link a teacher sends: it opens on arisetodo.com, where a para can make a free account. */
export const inviteLink = (code: string) => `${TODO_APP}#/para-team/join/${code}`;

export class ParaError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function paraApi<T = any>(token: string | null | undefined, path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && typeof init.body === "string") headers["Content-Type"] = "application/json";
  let r: Response;
  try {
    r = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ParaError("You seem to be offline. Check the connection and try again.", 0);
  }
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new ParaError(body?.message || "Something went wrong. Try again.", r.status);
  return body as T;
}

export function useMyTeams(token: string | null | undefined) {
  const [teams, setTeams] = useState<ParaTeamSummary[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    if (!token) return Promise.resolve();
    return paraApi<ParaTeamSummary[]>(token, "/api/para-teams").then((t) => { setTeams(t); setError(""); }).catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  return { teams, error, reload: load };
}

/** One team, kept fresh: every 15 seconds while the page is in front (and whenever the person comes
 *  back to it) it asks whether anything changed, and only then fetches the team again, so a message
 *  or a ticked-off to-do from someone else shows up without re-sending the whole team each time. */
export function useParaTeam(token: string | null | undefined, teamId: string | null) {
  const [team, setTeam] = useState<ParaTeamView | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const alive = useRef(true);
  const busy = useRef(0);
  const stamp = useRef("");

  const load = useCallback(async () => {
    if (!token || !teamId) return;
    try {
      const t = await paraApi<ParaTeamView>(token, `/api/para-teams/${teamId}`);
      // A save in flight would be overwritten by an older copy: skip this refresh, the next one catches up.
      if (alive.current && busy.current === 0) { setTeam(t); setError(null); }
    } catch (e: any) {
      if (alive.current) setError({ message: e.message, status: e.status ?? 0 });
    }
  }, [token, teamId]);

  useEffect(() => {
    alive.current = true;
    setTeam(null); setError(null);
    void load();
    stamp.current = "";
    const tick = async () => {
      if (document.visibilityState !== "visible" || !token || !teamId) return;
      try {
        const { stamp: now } = await paraApi<{ stamp: string }>(token, `/api/para-teams/${teamId}/stamp`);
        if (now !== stamp.current) { const first = !stamp.current; stamp.current = now; if (!first) void load(); }
      } catch { void load(); } // let the full load say what's wrong (removed from the team, offline…)
    };
    void tick();
    const timer = window.setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T> => {
    busy.current++;
    try { return await work(); } finally { busy.current--; }
  }, []);

  const put = (item: ParaItem) => setTeam((t) => (t ? { ...t, items: [item, ...t.items.filter((i) => i.id !== item.id)] } : t));

  const add = useCallback(<K extends ParaKind>(kind: K, data: Partial<ParaData[K]>) => run(async () => {
    const item = await paraApi<ParaItem<K>>(token, `/api/para-teams/${teamId}/items`, { method: "POST", body: JSON.stringify({ kind, data }) });
    put(item);
    return item;
  }), [token, teamId, run]);

  const update = useCallback(<K extends ParaKind>(id: string, data: Partial<ParaData[K]>) => run(async () => {
    const item = await paraApi<ParaItem<K>>(token, `/api/para-teams/${teamId}/items/${id}`, { method: "PATCH", body: JSON.stringify({ data }) });
    put(item);
    return item;
  }), [token, teamId, run]);

  const remove = useCallback((id: string) => run(async () => {
    await paraApi(token, `/api/para-teams/${teamId}/items/${id}`, { method: "DELETE" });
    setTeam((t) => (t ? { ...t, items: t.items.filter((i) => i.id !== id) } : t));
  }), [token, teamId, run]);

  const upload = useCallback((file: File, folder: DocFolder, note = "") => run(async () => {
    const item = await paraApi<ParaItem<"file">>(token, `/api/para-teams/${teamId}/files`, {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-Folder": encodeURIComponent(folder), "X-Note": encodeURIComponent(note) },
    });
    put(item);
    return item;
  }), [token, teamId, run]);

  const openFile = useCallback(async (id: string, download = false) => {
    // Opened before the link arrives, so a phone doesn't block it as a pop-up.
    const tab = download ? null : window.open("about:blank", "_blank");
    try {
      const { url } = await paraApi<{ url: string }>(token, `/api/para-teams/${teamId}/files/${id}/url`, { method: "POST", body: JSON.stringify({ download }) });
      if (tab) { tab.opener = null; tab.location.href = url; } else window.location.assign(url);
    } catch (e) {
      tab?.close();
      throw e;
    }
  }, [token, teamId]);

  /** Team-level changes (name, invites, people) answer with the whole team. */
  const teamCall = useCallback((path: string, init: RequestInit) => run(async () => {
    const t = await paraApi<ParaTeamView & { left?: boolean }>(token, `/api/para-teams/${teamId}${path}`, init);
    if (!(t as any).left && (t as any).id) setTeam(t);
    return t;
  }), [token, teamId, run]);

  return { team, error, reload: load, add, update, remove, upload, openFile, teamCall };
}

export type ParaTeamApi = ReturnType<typeof useParaTeam>;
