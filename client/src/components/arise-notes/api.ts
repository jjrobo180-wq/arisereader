// Talking to the Arise Notes server (server/ariseNotes.ts) and the shapes it answers with.
import { API_BASE } from "@/lib/queryClient";
import type { IepDraft, NoteSummary, NotesPlanId, NotesSettings, NotesTemplateId, ParentEmail, Segment, StudyTools, UsageView, MemoIdea, NotesPlan, NotesProduct } from "@shared/ariseNotes";

export class NotesError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly body?: any) { super(message); }
}

let tokenGetter: () => string | null = () => null;
export const setNotesToken = (get: () => string | null) => { tokenGetter = get; };

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; raw?: Blob; query?: Record<string, string | number>; signal?: AbortSignal } = {}): Promise<T> {
  const q = init.query ? `?${new URLSearchParams(Object.entries(init.query).map(([k, v]) => [k, String(v)]))}` : "";
  const token = tokenGetter();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  let body: BodyInit | undefined;
  if (init.raw) { body = init.raw; headers["Content-Type"] = init.raw.type || "application/octet-stream"; }
  else if (init.body !== undefined) { body = JSON.stringify(init.body); headers["Content-Type"] = "application/json"; }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/${path}${q}`, { method: init.method || (body ? "POST" : "GET"), headers, body, cache: "no-store", signal: init.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new NotesError("You seem to be offline. Check your connection and try again.", 0, "offline");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new NotesError(data?.message || (res.status === 401 ? "Please sign in again." : "Arise Notes couldn't do that just now. Try again."), res.status, data?.code, data);
  return data as T;
}

export type Family = { role: "owner" | "member"; people: { id: number; name: string; owner: boolean }[]; code: string | null; active: boolean } | null;
export type Me = {
  user: { id: number; name: string; role: string; teacher: boolean; admin: boolean; workHub: boolean; email: boolean };
  plan: NotesPlanId; planName: string; usage: UsageView; settings: NotesSettings;
  features: Record<string, boolean>;
  templates: { id: NotesTemplateId; label: string; emoji: string; blurb: string; allowed: boolean }[];
  services: { speech: boolean; speakers: boolean; ai: boolean };
  limits: { pieceSecs: number; pieceBytes: number; maxSecs: number; memoSecs: number };
  family: Family;
};
export type ListNote = { id: string; title: string; template: NotesTemplateId; source: "record" | "upload" | "memo"; status: string; durationSecs: number; createdAt: string; folder: string; tags: string[]; familyShared: boolean; mine: boolean; gist: string; actions: number; minutes: number; by?: string };
export type PieceInfo = { idx: number; start: number; secs: number; state: "new" | "done" | "stored" | "no_minutes" | "failed"; error: string; kept: boolean };
export type ActionRow = { id: string; noteId: string; text: string; who: string; due: string | null; sentTo: string | null; sentAt: string | null };
export type FullNote = {
  id: string; ownerId: number; title: string; template: NotesTemplateId; source: string; status: string; durationSecs: number; chargedMinutes: number;
  highlights: number[]; speakers: Record<string, string>; summary: NoteSummary | null; summaryTemplate: NotesTemplateId | null; summaryAt: string | null; stale: boolean;
  extras: { autoTitle?: boolean; speakers?: boolean; diarized?: boolean; parent?: Record<string, ParentEmail>; translations?: Record<string, NoteSummary>; study?: StudyTools; memo?: MemoIdea | null; readerQuiz?: number; iepSent?: { student: string; at: string } };
  folder: string; tags: string[]; audioKeep: "delete" | "30d" | "keep"; shareToken: string | null; shareOn: boolean; familyShared: boolean; createdAt: string; updatedAt: string;
  mine: boolean; segments: Segment[]; pieces: PieceInfo[]; actions: ActionRow[]; audio: boolean;
};
export type PieceReply = { ok: boolean; code?: string; message?: string; segments?: Segment[]; usage?: UsageView; minutes?: number; retry?: boolean; diarized?: boolean };
export type Billing = { payment: boolean; plan: NotesPlanId; product: NotesProduct | null; endsAt: string | null; cancelAtPeriodEnd: boolean; paidOnline: boolean; canManage: boolean; given: boolean; plans: Record<NotesPlanId, NotesPlan>; admin: boolean; canBuy: boolean };
export type HubTargets = { life: { lists: { id: string; name: string; color: string }[]; calendars: { id: string; name: string; color: string }[] } | null; work: { students: string[] } | null };
export type AskReply = { answer: string; found: boolean; cites: { n: number; noteId: string; title: string; t: number; date: string; text: string }[] };

export const notesApi = {
  me: () => api<Me>("notes/me"),
  settings: (s: Partial<NotesSettings>) => api<{ settings: NotesSettings }>("notes/settings", { method: "PATCH", body: s }),
  list: (q = "") => api<{ notes: ListNote[] }>("notes", { query: q ? { q } : undefined }),
  create: (b: { source: "record" | "upload"; title?: string; defaultTitle?: string; template?: NotesTemplateId; expectedSecs?: number; folder?: string; saveOnly?: boolean; speakers?: boolean }) => api<{ note: FullNote; usage: UsageView; limits: { pieceSecs: number; maxSecs: number } }>("notes", { body: b }),
  get: (id: string) => api<{ note: FullNote }>(`notes/${id}`),
  patch: (id: string, b: Record<string, unknown>) => api<{ note: FullNote }>(`notes/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => api(`notes/${id}`, { method: "DELETE" }),
  piece: (id: string, p: { idx: number; start: number; secs: number; ext: string; blob: Blob }, signal?: AbortSignal) => api<PieceReply>(`notes/${id}/pieces`, { method: "POST", raw: p.blob, query: { idx: p.idx, start: p.start, secs: p.secs, ext: p.ext }, signal }),
  resume: (id: string) => api<{ done: number; left: number; message: string; note: FullNote; usage: UsageView }>(`notes/${id}/resume`, { body: {} }),
  finish: (id: string, b: { durationSecs: number; highlights: number[] }) => api<{ note: FullNote }>(`notes/${id}/finish`, { body: b }),
  summary: (id: string, b: { template?: NotesTemplateId; force?: boolean } = {}) => api<{ note: FullNote }>(`notes/${id}/summary`, { body: b }),
  editLine: (id: string, idx: number, b: { text?: string; speaker?: string | null }) => api(`notes/${id}/segments/${idx}`, { method: "PATCH", body: b }),
  audio: (id: string) => api<{ pieces: { idx: number; start: number; secs: number; url: string }[] }>(`notes/${id}/audio`),
  parent: (id: string, language: string, force = false) => api<{ email: ParentEmail }>(`notes/${id}/parent`, { body: { language, force } }),
  translate: (id: string, language: string) => api<{ language: string; summary: NoteSummary }>(`notes/${id}/translate`, { body: { language } }),
  study: (id: string, force = false) => api<{ study: StudyTools }>(`notes/${id}/study`, { body: { force } }),
  studyToReader: (id: string) => api<{ ok: boolean; quizId: number }>(`notes/${id}/study/reader`, { body: {} }),
  targets: () => api<HubTargets>("notes/hubs/targets"),
  send: (id: string, b: { hub: "life" | "work"; listId?: string; calendarId?: string; tasks: { id?: string; title: string; who: string; due: string; time: string; notes?: string }[]; events: { title: string; date: string; time: string; notes?: string }[] }) => api<{ ok: boolean; hub: string; list?: string; tasks: number; events: number; actions: ActionRow[] }>(`notes/${id}/send`, { body: b }),
  iep: (id: string, b: { student: string; iep: IepDraft }) => api<{ ok: boolean; student: string; goals: number; services: number; meetings: number; reminders: number }>(`notes/${id}/iep/send`, { body: b }),
  memo: (blob: Blob, ext: string, secs: number, today: string) => api<{ noteId: string; text: string; idea: MemoIdea | null; usage: UsageView }>("notes/memo", { method: "POST", raw: blob, query: { ext, secs: Math.round(secs * 10) / 10, today } }),
  ask: (question: string, today: string) => api<AskReply>("notes/ask", { body: { question, today } }),
  email: (id: string) => api<{ ok: boolean; to: string }>(`notes/${id}/email`, { body: {} }),
  share: (id: string, on: boolean) => api<{ on: boolean; token: string; path: string }>(`notes/${id}/share`, { body: { on } }),
  shared: (token: string) => api<{ note: { title: string; createdAt: string; durationSecs: number; template: NotesTemplateId; summary: NoteSummary | null; segments: Segment[]; speakers: Record<string, string> } }>(`notes/shared/${encodeURIComponent(token)}`),
  familyCode: () => api<{ code: string }>("notes/family/code", { body: {} }),
  familyJoin: (code: string) => api<{ ok: boolean; owner: string }>("notes/family/join", { body: { code } }),
  familyRemove: (memberId: number) => api("notes/family/remove", { body: { memberId } }),
  familyLeave: () => api("notes/family/remove", { body: { leave: true } }),
  wipe: () => api<{ ok: boolean }>("notes/wipe", { body: { confirm: "DELETE" } }),
  billing: () => api<Billing>("notes/billing"),
  checkout: (product: NotesProduct, returnPath: string) => api<{ url: string }>("notes/billing/checkout", { body: { product, returnPath } }),
  change: (product: NotesProduct) => api<{ ok: boolean; plan: NotesPlanId }>("notes/billing/change", { body: { product } }),
  portal: (returnPath: string) => api<{ url: string }>("notes/billing/portal", { body: { returnPath } }),
  confirmPaid: (sessionId: string) => api("billing/confirm", { body: { sessionId } }),
  adminUsage: () => api<{ since: string; people: { userId: number; name: string; minutes: number; costCents: number; jobs: number }[] }>("notes/admin/usage"),
};

/** Today on this device, YYYY-MM-DD. */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
