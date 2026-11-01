// Where Arise Notes keeps things (migrations/arise_notes.sql): Supabase tables and a private storage
// bucket for audio while it is kept. Routes in server/ariseNotes.ts only go through this, so tests
// run the same routes on the in-memory copy below.
import { randomUUID } from "node:crypto";
import { DEFAULT_SETTINGS, cleanSettings, isTemplateId, minutesFor, monthStartOf, type AudioKeep, type NotesSettings, type NotesTemplateId, type Segment } from "../shared/ariseNotes";

export type NoteStatus = "recording" | "processing" | "ready" | "no_minutes" | "failed";
export type NoteSource = "record" | "upload" | "memo";
export type StoredSummary = { template: NotesTemplateId; hash: string; at: string; data: unknown };
export type NoteRow = {
  id: string;
  ownerId: number;
  title: string;
  template: NotesTemplateId;
  source: NoteSource;
  status: NoteStatus;
  durationSecs: number;
  chargedSecs: number;
  chargedMinutes: number;
  highlights: number[];
  speakers: Record<string, string>;
  summary: StoredSummary | null;
  extras: Record<string, any>;
  folder: string;
  tags: string[];
  transcript: string;
  audioKeep: AudioKeep;
  shareToken: string | null;
  shareOn: boolean;
  familyShared: boolean;
  createdAt: string;
  updatedAt: string;
};
export type PieceState = "new" | "done" | "stored" | "no_minutes" | "failed";
export type PieceRow = {
  noteId: string; idx: number; ownerId: number; startSecs: number; secs: number; ext: string;
  state: PieceState; path: string | null; provider: string; error: string; bytes: number; createdAt: string; updatedAt: string;
};
export type ActionRow = { id: string; noteId: string; ownerId: number; text: string; who: string; due: string | null; sentTo: string | null; sentAt: string | null; createdAt: string };
export type AccountRow = { userId: number; period: string; used: number; own: number; rollover: number; warned: number; settings: NotesSettings; familyCode: string | null };
export type UsageRow = { userId: number; poolId: number; noteId: string | null; kind: string; minutes: number; secs: number; provider: string; costCents: number };
export type SearchHit = { noteId: string; idx: number; start: number; end: number; speaker: string | null; text: string; title: string; createdAt: string };
export type Charged = { delta: number; poolUsed: number; ownUsed: number; noteSecs: number; noteMinutes: number };

export interface NotesStore {
  getAccount(userId: number): Promise<AccountRow | null>;
  saveAccount(a: AccountRow): Promise<void>;
  /** Adds transcribed seconds to a note and its minutes to the pool and the person, in one step. */
  charge(noteId: string, userId: number, poolId: number, secs: number): Promise<Charged>;
  ownerOfCode(code: string): Promise<number | null>;
  familyOwnerOf(memberId: number): Promise<number | null>;
  familyMembers(ownerId: number): Promise<number[]>;
  addFamilyMember(memberId: number, ownerId: number): Promise<void>;
  removeFamilyMember(memberId: number): Promise<void>;

  createNote(n: Partial<NoteRow> & { ownerId: number }): Promise<NoteRow>;
  getNote(id: string): Promise<NoteRow | null>;
  updateNote(id: string, patch: Partial<NoteRow>): Promise<NoteRow | null>;
  deleteNote(id: string): Promise<void>;
  listNotes(ownerIds: number[], opts?: { ids?: string[]; limit?: number; sharedOnly?: boolean }): Promise<NoteRow[]>;
  findNotes(ownerId: number, query: string): Promise<string[]>;
  noteByShare(token: string): Promise<NoteRow | null>;

  getPieces(noteId: string): Promise<PieceRow[]>;
  savePiece(p: PieceRow): Promise<void>;
  getSegments(noteId: string): Promise<Segment[]>;
  /** Replaces one piece's lines (idx from `from` up to, not including, `to`). */
  replaceSegments(noteId: string, ownerId: number, from: number, to: number, segs: Segment[]): Promise<void>;
  updateSegment(noteId: string, idx: number, patch: { text?: string; speaker?: string | null }): Promise<boolean>;
  search(ownerId: number, query: string, from: string | null, to: string | null, limit: number): Promise<SearchHit[]>;

  getActions(noteId: string): Promise<ActionRow[]>;
  replaceActions(noteId: string, ownerId: number, rows: { text: string; who: string; due: string | null }[]): Promise<ActionRow[]>;
  markActions(ids: string[], ownerId: number, sentTo: "life" | "work"): Promise<void>;

  logUsage(u: UsageRow): Promise<void>;
  usageSince(sinceIso: string): Promise<{ userId: number; minutes: number; costCents: number; jobs: number }[]>;
  /** Pieces whose audio is kept and past its time (30-day notes older than the cutoff). */
  expiredAudio(cutoffIso: string, limit: number): Promise<PieceRow[]>;
  /** Everything this person has in Notes. */
  wipe(ownerId: number): Promise<string[]>;

  putAudio(path: string, bytes: Buffer, type: string): Promise<void>;
  getAudio(path: string): Promise<Buffer | null>;
  removeAudio(paths: string[]): Promise<void>;
  audioLinks(paths: string[], secs: number): Promise<Record<string, string>>;
}

export const NOTES_BUCKET = "arise-notes-audio";
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const iso = (v: unknown) => (typeof v === "string" ? v : v ? new Date(v as any).toISOString() : new Date().toISOString());

// ─── Supabase ───────────────────────────────────────────────────────────────

const noteFrom = (r: any): NoteRow => ({
  id: String(r.id), ownerId: Number(r.owner_id), title: String(r.title || ""), template: isTemplateId(r.template) ? r.template : "general",
  source: r.source === "upload" || r.source === "memo" ? r.source : "record", status: (r.status || "ready") as NoteStatus,
  durationSecs: num(r.duration_secs), chargedSecs: num(r.charged_secs), chargedMinutes: num(r.charged_minutes),
  highlights: Array.isArray(r.highlights) ? r.highlights.map(Number).filter((n: number) => Number.isFinite(n)) : [],
  speakers: r.speakers && typeof r.speakers === "object" ? r.speakers : {}, summary: r.summary && typeof r.summary === "object" ? r.summary : null,
  extras: r.extras && typeof r.extras === "object" ? r.extras : {}, folder: String(r.folder || ""), tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
  transcript: String(r.transcript || ""), audioKeep: r.audio_keep === "30d" || r.audio_keep === "keep" ? r.audio_keep : "delete",
  shareToken: r.share_token || null, shareOn: !!r.share_on, familyShared: !!r.family_shared, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const NOTE_COLS: Record<string, string> = {
  title: "title", template: "template", source: "source", status: "status", durationSecs: "duration_secs", chargedSecs: "charged_secs", chargedMinutes: "charged_minutes",
  highlights: "highlights", speakers: "speakers", summary: "summary", extras: "extras", folder: "folder", tags: "tags", transcript: "transcript", audioKeep: "audio_keep",
  shareToken: "share_token", shareOn: "share_on", familyShared: "family_shared",
};
const noteTo = (patch: Partial<NoteRow>) => {
  const out: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(NOTE_COLS)) if ((patch as any)[k] !== undefined) out[col] = (patch as any)[k];
  return out;
};
const pieceFrom = (r: any): PieceRow => ({
  noteId: String(r.note_id), idx: Number(r.idx), ownerId: Number(r.owner_id), startSecs: num(r.start_secs), secs: num(r.secs), ext: String(r.ext || "webm"),
  state: (r.state || "new") as PieceState, path: r.path || null, provider: String(r.provider || ""), error: String(r.error || ""), bytes: num(r.bytes),
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const actionFrom = (r: any): ActionRow => ({ id: String(r.id), noteId: String(r.note_id), ownerId: Number(r.owner_id), text: String(r.text || ""), who: String(r.who || ""), due: r.due || null, sentTo: r.sent_to || null, sentAt: r.sent_at || null, createdAt: iso(r.created_at) });
const accountFrom = (r: any): AccountRow => ({
  userId: Number(r.user_id), period: String(r.period || "").slice(0, 10), used: num(r.used), own: num(r.own), rollover: num(r.rollover), warned: num(r.warned),
  settings: cleanSettings(r.settings), familyCode: r.family_code || null,
});

type Db = { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any; storage: { from: (b: string) => any } };

export function createSupabaseNotesStore(db: () => Db): NotesStore {
  const must = <T,>(r: { data: T; error: any }): T => { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data; };
  // Notes rows can be large (a two-hour transcript): the list leaves the transcript out.
  const LIST_COLS = "id, owner_id, title, template, source, status, duration_secs, charged_secs, charged_minutes, highlights, speakers, summary, folder, tags, audio_keep, share_token, share_on, family_shared, created_at, updated_at";
  return {
    async getAccount(userId) {
      const row = must(await db().from("arise_notes_accounts").select("*").eq("user_id", userId).maybeSingle());
      return row ? accountFrom(row) : null;
    },
    async saveAccount(a) {
      must(await db().from("arise_notes_accounts").upsert({ user_id: a.userId, period: a.period, used: a.used, own: a.own, rollover: a.rollover, warned: a.warned, settings: a.settings, family_code: a.familyCode, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
    },
    async charge(noteId, userId, poolId, secs) {
      const rows: any[] = must(await db().rpc("arise_notes_charge", { p_note: noteId, p_user: userId, p_pool: poolId, p_secs: secs })) as any;
      const r = Array.isArray(rows) ? rows[0] : rows;
      return { delta: num(r?.delta), poolUsed: num(r?.pool_used), ownUsed: num(r?.own_used), noteSecs: num(r?.note_secs), noteMinutes: num(r?.note_minutes) };
    },
    async ownerOfCode(code) {
      const row = must(await db().from("arise_notes_accounts").select("user_id").eq("family_code", code).maybeSingle()) as any;
      return row ? Number(row.user_id) : null;
    },
    async familyOwnerOf(memberId) {
      const row = must(await db().from("arise_notes_family").select("owner_id").eq("member_id", memberId).maybeSingle()) as any;
      return row ? Number(row.owner_id) : null;
    },
    async familyMembers(ownerId) {
      const rows = must(await db().from("arise_notes_family").select("member_id").eq("owner_id", ownerId).order("joined_at", { ascending: true })) as any[];
      return (rows || []).map((r) => Number(r.member_id));
    },
    async addFamilyMember(memberId, ownerId) {
      must(await db().from("arise_notes_family").upsert({ member_id: memberId, owner_id: ownerId, joined_at: new Date().toISOString() }, { onConflict: "member_id" }));
    },
    async removeFamilyMember(memberId) { must(await db().from("arise_notes_family").delete().eq("member_id", memberId)); },

    async createNote(n) {
      const row = { owner_id: n.ownerId, ...noteTo(n) };
      return noteFrom(must(await db().from("arise_notes").insert(row).select("*").single()));
    },
    async getNote(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const row = must(await db().from("arise_notes").select("*").eq("id", id).maybeSingle());
      return row ? noteFrom(row) : null;
    },
    async updateNote(id, patch) {
      const row = must(await db().from("arise_notes").update({ ...noteTo(patch), updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle());
      return row ? noteFrom(row) : null;
    },
    async deleteNote(id) { must(await db().from("arise_notes").delete().eq("id", id)); },
    async listNotes(ownerIds, opts = {}) {
      if (!ownerIds.length) return [];
      let q = db().from("arise_notes").select(LIST_COLS).in("owner_id", ownerIds).order("created_at", { ascending: false }).limit(Math.min(500, opts.limit ?? 300));
      if (opts.ids) { if (!opts.ids.length) return []; q = q.in("id", opts.ids); }
      if (opts.sharedOnly) q = q.eq("family_shared", true);
      return ((must(await q) as any[]) || []).map(noteFrom);
    },
    async findNotes(ownerId, query) {
      const rows = must(await db().rpc("arise_notes_find", { p_owner: ownerId, p_query: query, p_limit: 100 })) as any[];
      return (rows || []).map((r) => String(r.id));
    },
    async noteByShare(token) {
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
      const row = must(await db().from("arise_notes").select("*").eq("share_token", token).eq("share_on", true).maybeSingle());
      return row ? noteFrom(row) : null;
    },

    async getPieces(noteId) {
      return ((must(await db().from("arise_notes_pieces").select("*").eq("note_id", noteId).order("idx", { ascending: true })) as any[]) || []).map(pieceFrom);
    },
    async savePiece(p) {
      must(await db().from("arise_notes_pieces").upsert({
        note_id: p.noteId, idx: p.idx, owner_id: p.ownerId, start_secs: p.startSecs, secs: p.secs, ext: p.ext, state: p.state, path: p.path,
        provider: p.provider, error: p.error.slice(0, 500), bytes: p.bytes, updated_at: new Date().toISOString(),
      }, { onConflict: "note_id,idx" }));
    },
    async getSegments(noteId) {
      const out: Segment[] = [];
      for (let from = 0; ; from += 1000) {
        const rows = must(await db().from("arise_notes_segments").select("idx, start_s, end_s, speaker, text").eq("note_id", noteId).order("idx", { ascending: true }).range(from, from + 999)) as any[];
        for (const r of rows || []) out.push({ idx: Number(r.idx), start: num(r.start_s), end: num(r.end_s), speaker: r.speaker ?? null, text: String(r.text || "") });
        if (!rows || rows.length < 1000) break;
      }
      return out;
    },
    async replaceSegments(noteId, ownerId, from, to, segs) {
      must(await db().from("arise_notes_segments").delete().eq("note_id", noteId).gte("idx", from).lt("idx", to));
      for (let i = 0; i < segs.length; i += 500) {
        const rows = segs.slice(i, i + 500).map((s) => ({ note_id: noteId, idx: s.idx, owner_id: ownerId, start_s: s.start, end_s: s.end, speaker: s.speaker, text: s.text }));
        if (rows.length) must(await db().from("arise_notes_segments").insert(rows));
      }
    },
    async updateSegment(noteId, idx, patch) {
      const row: Record<string, unknown> = {};
      if (patch.text !== undefined) row.text = patch.text;
      if (patch.speaker !== undefined) row.speaker = patch.speaker;
      const rows = must(await db().from("arise_notes_segments").update(row).eq("note_id", noteId).eq("idx", idx).select("idx")) as any[];
      return !!rows?.length;
    },
    async search(ownerId, query, from, to, limit) {
      const rows = must(await db().rpc("arise_notes_search", { p_owner: ownerId, p_query: query, p_from: from, p_to: to, p_limit: limit })) as any[];
      return (rows || []).map((r) => ({ noteId: String(r.note_id), idx: Number(r.idx), start: num(r.start_s), end: num(r.end_s), speaker: r.speaker ?? null, text: String(r.text || ""), title: String(r.title || ""), createdAt: iso(r.created_at) }));
    },

    async getActions(noteId) {
      return ((must(await db().from("arise_notes_actions").select("*").eq("note_id", noteId).order("created_at", { ascending: true })) as any[]) || []).map(actionFrom);
    },
    async replaceActions(noteId, ownerId, rows) {
      // Ones already added to the planner stay; the rest are replaced by the new list.
      must(await db().from("arise_notes_actions").delete().eq("note_id", noteId).is("sent_to", null));
      if (rows.length) must(await db().from("arise_notes_actions").insert(rows.map((r) => ({ note_id: noteId, owner_id: ownerId, text: r.text, who: r.who, due: r.due }))));
      return this.getActions(noteId);
    },
    async markActions(ids, ownerId, sentTo) {
      if (!ids.length) return;
      must(await db().from("arise_notes_actions").update({ sent_to: sentTo, sent_at: new Date().toISOString() }).in("id", ids).eq("owner_id", ownerId));
    },

    async logUsage(u) {
      must(await db().from("arise_notes_usage").insert({ user_id: u.userId, pool_id: u.poolId, note_id: u.noteId, kind: u.kind, minutes: u.minutes, secs: u.secs, provider: u.provider, cost_cents: u.costCents }));
    },
    async usageSince(sinceIso) {
      const by = new Map<number, { userId: number; minutes: number; costCents: number; jobs: number }>();
      for (let from = 0; from < 50_000; from += 1000) {
        const rows = must(await db().from("arise_notes_usage").select("user_id, minutes, cost_cents").gte("created_at", sinceIso).order("id", { ascending: true }).range(from, from + 999)) as any[];
        for (const r of rows || []) {
          const id = Number(r.user_id);
          const cur = by.get(id) ?? { userId: id, minutes: 0, costCents: 0, jobs: 0 };
          cur.minutes += num(r.minutes); cur.costCents += num(r.cost_cents); cur.jobs++;
          by.set(id, cur);
        }
        if (!rows || rows.length < 1000) break;
      }
      return [...by.values()].sort((a, b) => b.costCents - a.costCents);
    },
    async expiredAudio(cutoffIso, limit) {
      const notes = must(await db().from("arise_notes").select("id").eq("audio_keep", "30d").lt("created_at", cutoffIso).limit(200)) as any[];
      const ids = (notes || []).map((n) => n.id);
      if (!ids.length) return [];
      const rows = must(await db().from("arise_notes_pieces").select("*").in("note_id", ids).not("path", "is", null).eq("state", "done").limit(limit)) as any[];
      return (rows || []).map(pieceFrom);
    },
    async wipe(ownerId) {
      const pieces = must(await db().from("arise_notes_pieces").select("path").eq("owner_id", ownerId).not("path", "is", null)) as any[];
      const paths = (pieces || []).map((p) => String(p.path)).filter(Boolean);
      must(await db().from("arise_notes").delete().eq("owner_id", ownerId));
      must(await db().from("arise_notes_usage").delete().eq("user_id", ownerId));
      must(await db().from("arise_notes_family").delete().eq("member_id", ownerId));
      must(await db().from("arise_notes_family").delete().eq("owner_id", ownerId));
      must(await db().from("arise_notes_accounts").delete().eq("user_id", ownerId));
      return paths;
    },

    async putAudio(path, bytes, type) {
      const { error } = await db().storage.from(NOTES_BUCKET).upload(path, bytes, { contentType: type, upsert: true });
      if (error) throw new Error(error.message || "upload failed");
    },
    async getAudio(path) {
      const { data, error } = await db().storage.from(NOTES_BUCKET).download(path);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },
    async removeAudio(paths) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await db().storage.from(NOTES_BUCKET).remove(paths.slice(i, i + 100));
        if (error) console.warn("[notes] audio not removed:", error.message);
      }
    },
    async audioLinks(paths, secs) {
      if (!paths.length) return {};
      const { data, error } = await db().storage.from(NOTES_BUCKET).createSignedUrls(paths, secs);
      if (error) throw new Error(error.message);
      const out: Record<string, string> = {};
      for (const d of data || []) if (d?.path && d?.signedUrl) out[d.path] = d.signedUrl;
      return out;
    },
  };
}

// ─── In memory (tests) ──────────────────────────────────────────────────────

export function createMemoryNotesStore(nowMs: () => number = Date.now): NotesStore & { _audio: Map<string, Buffer>; _usage: UsageRow[] } {
  const accounts = new Map<number, AccountRow>();
  const notes = new Map<string, NoteRow>();
  const pieces = new Map<string, PieceRow>();
  const segments = new Map<string, Segment[]>();
  const actions = new Map<string, ActionRow>();
  const family = new Map<number, number>();
  const usage: UsageRow[] = [];
  const usageAt: string[] = [];
  const audio = new Map<string, Buffer>();
  const stamp = () => new Date(nowMs()).toISOString();
  const account = (id: number): AccountRow => {
    let a = accounts.get(id);
    if (!a) { a = { userId: id, period: monthStartOf(nowMs()), used: 0, own: 0, rollover: 0, warned: 0, settings: { ...DEFAULT_SETTINGS }, familyCode: null }; accounts.set(id, a); }
    return a;
  };
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  const matches = (text: string, query: string) => { const w = new Set(words(text)); return query.split(/\s+or\s+/).map((x) => x.trim().toLowerCase()).filter(Boolean).some((q) => [...w].some((x) => x === q || x.startsWith(q))); };
  const store: NotesStore & { _audio: Map<string, Buffer>; _usage: UsageRow[] } = {
    _audio: audio,
    _usage: usage,
    async getAccount(id) { const a = accounts.get(id); return a ? { ...a, settings: { ...a.settings } } : null; },
    async saveAccount(a) { accounts.set(a.userId, { ...a, settings: { ...a.settings } }); },
    async charge(noteId, userId, poolId, secs) {
      const n = notes.get(noteId);
      if (!n) throw new Error("note not found");
      const total = n.chargedSecs + Math.max(0, secs);
      const minutes = Math.max(minutesFor(total), n.chargedMinutes);
      const delta = minutes - n.chargedMinutes;
      n.chargedSecs = total; n.chargedMinutes = minutes;
      account(poolId).used += delta;
      account(userId).own += delta;
      return { delta, poolUsed: account(poolId).used, ownUsed: account(userId).own, noteSecs: total, noteMinutes: minutes };
    },
    async ownerOfCode(code) { for (const a of accounts.values()) if (a.familyCode === code) return a.userId; return null; },
    async familyOwnerOf(m) { return family.get(m) ?? null; },
    async familyMembers(o) { return [...family.entries()].filter(([, owner]) => owner === o).map(([m]) => m); },
    async addFamilyMember(m, o) { family.set(m, o); },
    async removeFamilyMember(m) { family.delete(m); },

    async createNote(n) {
      const row: NoteRow = {
        id: randomUUID(), ownerId: n.ownerId, title: n.title ?? "", template: n.template ?? "general", source: n.source ?? "record", status: n.status ?? "recording",
        durationSecs: n.durationSecs ?? 0, chargedSecs: 0, chargedMinutes: 0, highlights: n.highlights ?? [], speakers: n.speakers ?? {}, summary: null, extras: n.extras ?? {},
        folder: n.folder ?? "", tags: n.tags ?? [], transcript: "", audioKeep: n.audioKeep ?? "delete", shareToken: null, shareOn: false, familyShared: false, createdAt: stamp(), updatedAt: stamp(),
      };
      notes.set(row.id, row);
      return { ...row };
    },
    async getNote(id) { const n = notes.get(id); return n ? structuredClone(n) : null; },
    async updateNote(id, patch) {
      const n = notes.get(id);
      if (!n) return null;
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      Object.assign(n, clean, { updatedAt: stamp() });
      return structuredClone(n);
    },
    async deleteNote(id) {
      notes.delete(id); segments.delete(id);
      for (const k of [...pieces.keys()]) if (k.startsWith(`${id}:`)) pieces.delete(k);
      for (const [k, a] of actions) if (a.noteId === id) actions.delete(k);
    },
    async listNotes(ownerIds, opts = {}) {
      return [...notes.values()].filter((n) => ownerIds.includes(n.ownerId) && (!opts.ids || opts.ids.includes(n.id)) && (!opts.sharedOnly || n.familyShared))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, opts.limit ?? 300).map((n) => ({ ...structuredClone(n), transcript: "" }));
    },
    async findNotes(ownerId, query) { return [...notes.values()].filter((n) => n.ownerId === ownerId && (matches(`${n.title} ${n.transcript}`, query) || n.title.toLowerCase().includes(query.toLowerCase()))).map((n) => n.id); },
    async noteByShare(token) { const n = [...notes.values()].find((x) => x.shareToken === token && x.shareOn); return n ? structuredClone(n) : null; },

    async getPieces(noteId) { return [...pieces.values()].filter((p) => p.noteId === noteId).sort((a, b) => a.idx - b.idx).map((p) => ({ ...p })); },
    async savePiece(p) { pieces.set(`${p.noteId}:${p.idx}`, { ...p, updatedAt: stamp() }); },
    async getSegments(noteId) { return (segments.get(noteId) ?? []).map((s) => ({ ...s })).sort((a, b) => a.idx - b.idx); },
    async replaceSegments(noteId, _ownerId, from, to, segs) {
      const keep = (segments.get(noteId) ?? []).filter((s) => s.idx < from || s.idx >= to);
      segments.set(noteId, [...keep, ...segs.map((s) => ({ ...s }))].sort((a, b) => a.idx - b.idx));
    },
    async updateSegment(noteId, idx, patch) {
      const s = (segments.get(noteId) ?? []).find((x) => x.idx === idx);
      if (!s) return false;
      if (patch.text !== undefined) s.text = patch.text;
      if (patch.speaker !== undefined) s.speaker = patch.speaker;
      return true;
    },
    async search(ownerId, query, from, to, limit) {
      const out: SearchHit[] = [];
      for (const n of notes.values()) {
        if (n.ownerId !== ownerId) continue;
        const d = n.createdAt.slice(0, 10);
        if ((from && d < from) || (to && d > to)) continue;
        for (const s of segments.get(n.id) ?? []) if (matches(s.text, query)) out.push({ noteId: n.id, idx: s.idx, start: s.start, end: s.end, speaker: s.speaker, text: s.text, title: n.title, createdAt: n.createdAt });
      }
      return out.slice(0, limit);
    },

    async getActions(noteId) { return [...actions.values()].filter((a) => a.noteId === noteId).map((a) => ({ ...a })); },
    async replaceActions(noteId, ownerId, rows) {
      for (const [k, a] of actions) if (a.noteId === noteId && !a.sentTo) actions.delete(k);
      for (const r of rows) { const id = randomUUID(); actions.set(id, { id, noteId, ownerId, text: r.text, who: r.who, due: r.due, sentTo: null, sentAt: null, createdAt: stamp() }); }
      return this.getActions(noteId);
    },
    async markActions(ids, ownerId, sentTo) { for (const id of ids) { const a = actions.get(id); if (a && a.ownerId === ownerId) { a.sentTo = sentTo; a.sentAt = stamp(); } } },

    async logUsage(u) { usage.push({ ...u }); usageAt.push(stamp()); },
    async usageSince(sinceIso) {
      const by = new Map<number, { userId: number; minutes: number; costCents: number; jobs: number }>();
      usage.forEach((u, i) => {
        if (usageAt[i] < sinceIso) return;
        const cur = by.get(u.userId) ?? { userId: u.userId, minutes: 0, costCents: 0, jobs: 0 };
        cur.minutes += u.minutes; cur.costCents += u.costCents; cur.jobs++;
        by.set(u.userId, cur);
      });
      return [...by.values()].sort((a, b) => b.costCents - a.costCents);
    },
    async expiredAudio(cutoffIso, limit) {
      return [...pieces.values()].filter((p) => { const n = notes.get(p.noteId); return !!n && n.audioKeep === "30d" && n.createdAt < cutoffIso && !!p.path && p.state === "done"; }).slice(0, limit);
    },
    async wipe(ownerId) {
      const paths = [...pieces.values()].filter((p) => p.ownerId === ownerId && p.path).map((p) => p.path!);
      for (const n of [...notes.values()]) if (n.ownerId === ownerId) await this.deleteNote(n.id);
      for (let i = usage.length - 1; i >= 0; i--) if (usage[i].userId === ownerId) { usage.splice(i, 1); usageAt.splice(i, 1); }
      family.delete(ownerId);
      for (const [m, o] of [...family]) if (o === ownerId) family.delete(m);
      accounts.delete(ownerId);
      return paths;
    },

    async putAudio(path, bytes) { audio.set(path, Buffer.from(bytes)); },
    async getAudio(path) { return audio.get(path) ?? null; },
    async removeAudio(paths) { for (const p of paths) audio.delete(p); },
    async audioLinks(paths) { return Object.fromEntries(paths.filter((p) => audio.has(p)).map((p) => [p, `memory://${p}`])); },
  };
  return store;
}
