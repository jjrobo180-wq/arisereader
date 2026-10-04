// Study Squad: talking to the server, and the shapes that come back.
import { API_BASE } from "@/lib/queryClient";
import type { StudyRoomView } from "@shared/study/game";
import type { LoungeView } from "@shared/study/lounge";
import type { StudySet, StudySetSummary, SetDraft } from "@shared/study/sets";

export type RoomView = StudyRoomView & { earned: { coins: number; capped: boolean } | null };
export type BoardRow = { place: number; name: string; points: number; games: number; me: boolean };
export type Boot = {
  me: { id: number; name: string; characterId: string; teacher: boolean; student: boolean };
  lounge: LoungeView;
  room: string | null;
  sets: StudySetSummary[];
  rules: { studentSets: boolean; studentAi: boolean };
  ai: { available: boolean; left: number; perDay: number };
  stats: { games: number; wins: number; correct: number; answered: number; coinsToday: number };
  rewards: { finish: number; sharp: number; win: number; dailyCap: number };
  board: BoardRow[];
  phrases: string[];
};
export type Synced = { lounge: LoungeView; room: RoomView | null };
export type AiDraft = SetDraft & { title: string; items: StudySet["items"] };

export function studyClient(token: string | null) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}/api/study${path}`, {
      method, cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "That didn't work. Try again.");
    return data as T;
  }
  return {
    boot: () => call<Boot>("GET", "/bootstrap"),
    sync: (body: { x?: number; z?: number; facing?: number; floor?: number }) => call<Synced>("POST", "/sync", body),
    leaveHall: () => call<{ ok: true }>("POST", "/leave", {}),
    board: () => call<{ board: BoardRow[] }>("GET", "/board"),
    sets: () => call<{ sets: StudySetSummary[] }>("GET", "/sets"),
    set: (id: string) => call<{ set: StudySet }>("GET", `/sets/${encodeURIComponent(id)}`),
    saveSet: (id: string | null, draft: SetDraft) => call<{ set: StudySetSummary }>(id ? "PUT" : "POST", id ? `/sets/${encodeURIComponent(id)}` : "/sets", draft),
    deleteSet: (id: string) => call<{ ok: true }>("DELETE", `/sets/${encodeURIComponent(id)}`),
    generate: (body: { topic: string; notes: string; grade: string; count: number; format: string }) => call<{ draft: AiDraft; left: number }>("POST", "/generate", body),
    klass: () => call<{ rules: Boot["rules"]; sets: StudySetSummary[] }>("GET", "/class"),
    saveRules: (rules: Boot["rules"]) => call<{ rules: Boot["rules"] }>("PUT", "/class/rules", rules),
    removeClassSet: (id: string) => call<{ ok: true }>("DELETE", `/class/sets/${encodeURIComponent(id)}`),
    sit: (body: { table?: number; code?: string }) => call<Synced & { room: RoomView }>("POST", "/tables/sit", body),
    act: (code: string, body: Record<string, unknown>) => call<{ room: RoomView }>("POST", `/tables/${code}/action`, body),
    stand: (code: string) => call<{ ok: true; lounge: LoungeView }>("POST", `/tables/${code}/leave`, {}),
  };
}
export type StudyClient = ReturnType<typeof studyClient>;
