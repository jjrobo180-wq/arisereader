// Para Team (Arise WorkHub): the routes behind a teacher's shared space with their paras and 1:1s.
// What each kind of item holds and who may change it is in shared/paraTeam.ts; this file checks
// that the person is on the team before anything is read or written, and keeps uploaded files in a
// private storage bucket that is only ever opened through short-lived signed links.
//
// The database and storage are passed in (ParaDb), so tests/para-team.test.ts runs every route
// against an in-memory team without Supabase.
import type { Express, RequestHandler } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";
import {
  KIND_LIMIT, KIND_LOAD, PARA_KINDS, canAdd, canCheckOff, canEdit, checkOff, cleanItemData, cleanMemberTitle, cleanTeamName,
  finalData, isInviteCode, isParaKind, makeInviteCode,
  type FileData, type ParaItem, type ParaKind, type ParaMember, type ParaRole, type ParaTeamSummary, type ParaTeamView, type TaskData,
} from "@shared/paraTeam";

export type TeamRow = { id: string; ownerId: number; name: string; inviteCode: string; inviteOn: boolean; createdAt: string };
export type MemberRow = { teamId: string; userId: number; role: ParaRole; title: string; joinedAt: string };
export type ItemRow = { id: string; teamId: string; kind: ParaKind; data: any; createdBy: number | null; createdAt: string; updatedAt: string };

export type ParaDb = {
  teamsOf(userId: number): Promise<Array<{ team: TeamRow; member: MemberRow; members: number }>>;
  getTeam(id: string): Promise<TeamRow | null>;
  teamByCode(code: string): Promise<TeamRow | null>;
  createTeam(team: TeamRow): Promise<void>;
  updateTeam(id: string, patch: Partial<Pick<TeamRow, "name" | "inviteCode" | "inviteOn">>): Promise<void>;
  deleteTeam(id: string): Promise<void>;
  members(teamId: string): Promise<MemberRow[]>;
  member(teamId: string, userId: number): Promise<MemberRow | null>;
  addMember(row: MemberRow): Promise<void>;
  updateMember(teamId: string, userId: number, patch: Partial<Pick<MemberRow, "role" | "title">>): Promise<void>;
  removeMember(teamId: string, userId: number): Promise<void>;
  userNames(ids: number[]): Promise<Map<number, string>>;
  items(teamId: string, kind: ParaKind, limit: number): Promise<ItemRow[]>;
  countItems(teamId: string, kind: ParaKind): Promise<number>;
  /** The newest change and how many items there are: enough to tell whether anything changed. */
  latest(teamId: string): Promise<{ at: string; count: number }>;
  fileBytes(teamId: string): Promise<number>;
  getItem(teamId: string, id: string): Promise<ItemRow | null>;
  insertItem(row: ItemRow): Promise<void>;
  updateItem(teamId: string, id: string, data: any, updatedAt: string): Promise<void>;
  deleteItem(teamId: string, id: string): Promise<void>;
  upload(path: string, body: Buffer, contentType: string): Promise<void>;
  signedUrl(path: string, downloadName?: string): Promise<string | null>;
  removeFiles(paths: string[]): Promise<void>;
};

export type ParaDeps = {
  auth: RequestHandler;
  raw: (opts: { type: string[] | string; limit: string }) => RequestHandler;
  db: ParaDb;
  now?: () => Date;
  random?: (n: number) => Uint8Array;
};

/** Teams one person may make, and the most people on one team. */
const MAX_TEAMS_OWNED = 20;
const MAX_MEMBERS = 40;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const TEAM_STORAGE_BYTES = 2 * 1024 * 1024 * 1024;

/** File types a team can upload, by extension. The extension names the stored copy; nothing runs. */
const TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif",
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", rtf: "application/rtf",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};
const TYPE_TO_EXT: Record<string, string> = Object.fromEntries(Object.entries(TYPES).reverse().map(([e, t]) => [t, e]));

/** The extension for an upload: from the name, else the type the browser sent, else the file's first bytes. */
export function uploadExtension(name: string, contentType: string, head: Buffer): string | null {
  const fromName = (name.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || "").toLowerCase();
  if (TYPES[fromName]) return fromName;
  if (TYPE_TO_EXT[contentType]) return TYPE_TO_EXT[contentType];
  const ascii = head.subarray(0, 16).toString("latin1");
  if (head[0] === 0xff && head[1] === 0xd8) return "jpg";
  if (ascii.startsWith("\x89PNG")) return "png";
  if (ascii.startsWith("%PDF")) return "pdf";
  if (ascii.startsWith("GIF8")) return "gif";
  if (ascii.startsWith("RIFF") && ascii.includes("WEBP")) return "webp";
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerParaTeamRoutes(app: Express, deps: ParaDeps) {
  const { db } = deps;
  // Staff only: a student account (or an admin previewing as a student) can't make or join a team.
  const adultOnly: RequestHandler = (req: any, res, next) => {
    const u = req.user || {};
    if (u.isAdmin === true || u.role === "teacher" || u.role === "parent" || u.role === "todo") return next();
    res.status(403).json({ message: "Para Team is for school staff. Sign in with your WorkHub account (a free Arise To Duo account works)." });
  };
  const auth: RequestHandler[] = [deps.auth, adultOnly];
  const now = () => (deps.now ? deps.now() : new Date());
  const random = deps.random || ((n: number) => new Uint8Array(randomBytes(n)));
  const badCodes = createAttemptLimiter({ max: 30, windowMs: 60 * 60_000 });
  const writes = createAttemptLimiter({ max: 900, windowMs: 10 * 60_000 });

  const me = (req: any): number => Number(req.user?.id) || 0;
  const fail = (res: any, status: number, message: string) => res.status(status).json({ message });
  const oops = (res: any, where: string, e: any) => {
    console.error(`[para-team] ${where}:`, e?.message || e);
    fail(res, 500, "Something went wrong saving that. Try again.");
  };

  /** The team and the person's place on it, or a reply saying why not. */
  async function onTeam(req: any, res: any): Promise<{ team: TeamRow; member: MemberRow } | null> {
    const id = String(req.params.teamId || "");
    if (!UUID.test(id)) { fail(res, 404, "That team doesn't exist."); return null; }
    const [team, member] = await Promise.all([db.getTeam(id), db.member(id, me(req))]);
    if (!team) { fail(res, 404, "That team doesn't exist any more."); return null; }
    if (!member) { fail(res, 403, "You're not on this team. Ask the teacher for the invite link."); return null; }
    return { team, member };
  }
  const leadOnly = (res: any, member: MemberRow) => {
    if (member.role === "lead") return true;
    fail(res, 403, "Only the team's teacher can do that.");
    return false;
  };
  /** Stops one account flooding a team (a stuck button, a script): generous for real use. */
  const slowDown = (req: any, res: any) => {
    const key = String(me(req));
    const wait = writes.retryAfter(key);
    if (wait) { fail(res, 429, `That's a lot of changes at once. Try again in ${waitWords(wait)}.`); return true; }
    writes.fail(key);
    return false;
  };

  const toItem = (r: ItemRow): ParaItem => ({ id: r.id, kind: r.kind, data: r.data, createdBy: r.createdBy, createdAt: r.createdAt, updatedAt: r.updatedAt });

  async function view(team: TeamRow, member: MemberRow): Promise<ParaTeamView> {
    const [rows, lists] = await Promise.all([db.members(team.id), Promise.all(PARA_KINDS.map((k) => db.items(team.id, k, KIND_LOAD[k])))]);
    const items = lists.flat();
    const ids = [...new Set([...rows.map((m) => m.userId), ...items.map((i) => i.createdBy).filter((x): x is number => x != null)])];
    const names = await db.userNames(ids);
    const members: ParaMember[] = rows
      .map((m) => ({ userId: m.userId, name: names.get(m.userId) || "Team member", role: m.role, title: m.title, joinedAt: m.joinedAt, owner: m.userId === team.ownerId }))
      .sort((a, b) => (a.owner === b.owner ? (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "lead" ? -1 : 1) : a.owner ? -1 : 1));
    // Names of people who made something and have since left, so their entries still say who.
    const former: ParaMember[] = ids.filter((id) => !rows.some((m) => m.userId === id)).map((id) => ({ userId: id, name: names.get(id) || "Former member", role: "para", title: "Left the team", joinedAt: "", owner: false, left: true }));
    return {
      id: team.id, name: team.name, role: member.role, owner: team.ownerId === member.userId, me: member.userId,
      invite: member.role === "lead" ? { code: team.inviteCode, on: team.inviteOn } : null,
      members: [...members, ...former],
      items: items.map(toItem),
    };
  }

  // ─── teams ───

  app.get("/api/para-teams", auth, async (req: any, res) => {
    try {
      const rows = await db.teamsOf(me(req));
      const out: ParaTeamSummary[] = rows.map(({ team, member, members }) => ({ id: team.id, name: team.name, role: member.role, owner: team.ownerId === member.userId, members }));
      res.json(out.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) { oops(res, "list", e); }
  });

  app.post("/api/para-teams", auth, async (req: any, res) => {
    try {
      const name = cleanTeamName(req.body?.name);
      if (!name) return fail(res, 400, "Give your team a name, like \"Room 112 Team\".");
      const owned = (await db.teamsOf(me(req))).filter((t) => t.team.ownerId === me(req)).length;
      if (owned >= MAX_TEAMS_OWNED) return fail(res, 400, `You can make up to ${MAX_TEAMS_OWNED} teams.`);
      const at = now().toISOString();
      const team: TeamRow = { id: randomUUID(), ownerId: me(req), name, inviteCode: makeInviteCode(random), inviteOn: true, createdAt: at };
      await db.createTeam(team);
      const member: MemberRow = { teamId: team.id, userId: me(req), role: "lead", title: cleanMemberTitle(req.body?.title) || "Teacher", joinedAt: at };
      await db.addMember(member);
      res.json(await view(team, member));
    } catch (e) { oops(res, "create", e); }
  });

  app.get("/api/para-teams/:teamId", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (t) res.json(await view(t.team, t.member));
    } catch (e) { oops(res, "read", e); }
  });

  // A cheap "has anything changed?" for the app's refresh: the whole team is only fetched when this moves.
  app.get("/api/para-teams/:teamId/stamp", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t) return;
      const [latest, people] = await Promise.all([db.latest(t.team.id), db.members(t.team.id)]);
      const who = people.map((m) => `${m.userId}:${m.role}:${m.title}`).sort().join(",");
      res.json({ stamp: [latest.at, latest.count, t.team.name, t.team.inviteOn, t.team.inviteCode, who].join("|") });
    } catch (e) { oops(res, "stamp", e); }
  });

  app.patch("/api/para-teams/:teamId", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t || !leadOnly(res, t.member)) return;
      const patch: Partial<Pick<TeamRow, "name" | "inviteOn">> = {};
      if (req.body?.name !== undefined) {
        const name = cleanTeamName(req.body.name);
        if (!name) return fail(res, 400, "The team needs a name.");
        patch.name = name;
      }
      if (typeof req.body?.inviteOn === "boolean") patch.inviteOn = req.body.inviteOn;
      await db.updateTeam(t.team.id, patch);
      res.json(await view({ ...t.team, ...patch }, t.member));
    } catch (e) { oops(res, "rename", e); }
  });

  // A new invite link: the old one stops working at once (for a link that was passed around).
  app.post("/api/para-teams/:teamId/invite/new", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t || !leadOnly(res, t.member)) return;
      const inviteCode = makeInviteCode(random);
      await db.updateTeam(t.team.id, { inviteCode, inviteOn: true });
      res.json(await view({ ...t.team, inviteCode, inviteOn: true }, t.member));
    } catch (e) { oops(res, "new invite", e); }
  });

  app.delete("/api/para-teams/:teamId", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t) return;
      if (t.team.ownerId !== me(req)) return fail(res, 403, "Only the teacher who made this team can delete it.");
      const files = await db.items(t.team.id, "file", KIND_LIMIT.file);
      await db.deleteTeam(t.team.id);
      if (files.length) await db.removeFiles(files.map((f) => String(f.data?.path || "")).filter(Boolean)).catch((e) => console.error("[para-team] file cleanup:", e?.message || e));
      res.json({ ok: true });
    } catch (e) { oops(res, "delete team", e); }
  });

  // ─── joining ───

  /** What an invite link is for, before signing in: the team's name and its teacher. */
  app.get("/api/public/para-teams/join/:code", async (req: any, res) => {
    try {
      const address = clientAddress(req);
      const wait = badCodes.retryAfter(address);
      if (wait) return fail(res, 429, `Too many tries. Try again in ${waitWords(wait)}.`);
      const code = String(req.params.code || "").toLowerCase();
      const team = isInviteCode(code) ? await db.teamByCode(code) : null;
      if (!team || !team.inviteOn) { badCodes.fail(address); return fail(res, 404, "This invite link isn't working. Ask your teacher for a new one."); }
      const names = await db.userNames([team.ownerId]);
      res.json({ name: team.name, teacher: names.get(team.ownerId) || "Your teacher" });
    } catch (e) { oops(res, "invite preview", e); }
  });

  app.post("/api/para-teams/join/:code", auth, async (req: any, res) => {
    try {
      const address = `${clientAddress(req)}:${me(req)}`;
      const wait = badCodes.retryAfter(address);
      if (wait) return fail(res, 429, `Too many tries. Try again in ${waitWords(wait)}.`);
      const code = String(req.params.code || "").toLowerCase();
      const team = isInviteCode(code) ? await db.teamByCode(code) : null;
      if (!team || !team.inviteOn) { badCodes.fail(address); return fail(res, 404, "This invite link isn't working. Ask your teacher for a new one."); }
      const already = await db.member(team.id, me(req));
      if (already) return res.json(await view(team, already));
      if ((await db.members(team.id)).length >= MAX_MEMBERS) return fail(res, 400, `This team is full (${MAX_MEMBERS} people).`);
      const member: MemberRow = { teamId: team.id, userId: me(req), role: "para", title: cleanMemberTitle(req.body?.title) || "Para", joinedAt: now().toISOString() };
      await db.addMember(member);
      res.json(await view(team, member));
    } catch (e) { oops(res, "join", e); }
  });

  // ─── people ───

  app.patch("/api/para-teams/:teamId/members/:userId", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t) return;
      const who = Number(req.params.userId);
      const target = await db.member(t.team.id, who);
      if (!target) return fail(res, 404, "That person isn't on the team.");
      const self = who === me(req);
      // Anyone may change their own job title; only a lead changes someone else's, or anyone's role.
      if (!self && t.member.role !== "lead") return fail(res, 403, "Only the team's teacher can do that.");
      const patch: Partial<Pick<MemberRow, "role" | "title">> = {};
      if (req.body?.title !== undefined) patch.title = cleanMemberTitle(req.body.title);
      if (req.body?.role === "lead" || req.body?.role === "para") {
        if (t.member.role !== "lead") return fail(res, 403, "Only the team's teacher can do that.");
        if (who === t.team.ownerId) return fail(res, 400, "The teacher who made the team is always a lead.");
        patch.role = req.body.role;
      }
      await db.updateMember(t.team.id, who, patch);
      res.json(await view(t.team, self ? { ...t.member, ...patch } : t.member));
    } catch (e) { oops(res, "member", e); }
  });

  // Removing someone (a lead) or leaving (anyone but the team's maker). What they added stays.
  app.delete("/api/para-teams/:teamId/members/:userId", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t) return;
      const who = Number(req.params.userId);
      if (who === t.team.ownerId) return fail(res, 400, who === me(req) ? "You made this team, so you can't leave it. You can delete it in Team settings." : "The teacher who made the team can't be removed.");
      if (who !== me(req) && t.member.role !== "lead") return fail(res, 403, "Only the team's teacher can remove people.");
      await db.removeMember(t.team.id, who);
      if (who === me(req)) return res.json({ ok: true, left: true });
      res.json(await view(t.team, t.member));
    } catch (e) { oops(res, "remove member", e); }
  });

  // ─── items ───

  app.post("/api/para-teams/:teamId/items", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t || slowDown(req, res)) return;
      const kind = req.body?.kind;
      if (!isParaKind(kind)) return fail(res, 400, "That isn't something a Para Team keeps.");
      if (!canAdd(t.member.role, kind)) return fail(res, 403, kind === "file" ? "Upload files with the Upload button." : "Only the team's teacher can add that.");
      const clean = cleanItemData(kind, req.body?.data);
      if (!clean.ok) return fail(res, 400, clean.message);
      if ((await db.countItems(t.team.id, kind)) >= KIND_LIMIT[kind]) return fail(res, 400, "This team has reached its limit for that. Delete some old ones first.");
      const at = now().toISOString();
      let data = finalData(kind, t.member.role, clean.data);
      if (kind === "task" && (data as TaskData).done) data = checkOff(data as TaskData, true, me(req), at) as any;
      const row: ItemRow = { id: randomUUID(), teamId: t.team.id, kind, data, createdBy: me(req), createdAt: at, updatedAt: at };
      await db.insertItem(row);
      res.json(toItem(row));
    } catch (e) { oops(res, "add", e); }
  });

  app.patch("/api/para-teams/:teamId/items/:itemId", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t || slowDown(req, res)) return;
      const id = String(req.params.itemId || "");
      const item = UUID.test(id) ? await db.getItem(t.team.id, id) : null;
      if (!item) return fail(res, 404, "That's been deleted.");
      const at = now().toISOString();
      let data: any;
      if (canEdit(t.member.role, me(req), item)) {
        const clean = cleanItemData(item.kind, { ...item.data, ...(req.body?.data || {}) });
        if (!clean.ok) return fail(res, 400, clean.message);
        data = finalData(item.kind, t.member.role, clean.data, item.data);
        if (item.kind === "task") {
          const was = item.data as TaskData, next = data as TaskData;
          data = next.done === was.done ? { ...next, doneBy: was.doneBy, doneAt: was.doneAt } : checkOff(next, next.done, me(req), at);
        }
      } else if (item.kind === "task" && typeof req.body?.data?.done === "boolean" && canCheckOff(me(req), item.data as TaskData)) {
        data = checkOff(item.data as TaskData, req.body.data.done, me(req), at);
      } else {
        return fail(res, 403, "Only the person who added this, or the team's teacher, can change it.");
      }
      await db.updateItem(t.team.id, id, data, at);
      res.json(toItem({ ...item, data, updatedAt: at }));
    } catch (e) { oops(res, "change", e); }
  });

  app.delete("/api/para-teams/:teamId/items/:itemId", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t) return;
      const id = String(req.params.itemId || "");
      const item = UUID.test(id) ? await db.getItem(t.team.id, id) : null;
      if (!item) return res.json({ ok: true });
      if (!canEdit(t.member.role, me(req), item)) return fail(res, 403, "Only the person who added this, or the team's teacher, can delete it.");
      await db.deleteItem(t.team.id, id);
      if (item.kind === "file" && item.data?.path) await db.removeFiles([String(item.data.path)]).catch((e) => console.error("[para-team] file remove:", e?.message || e));
      res.json({ ok: true });
    } catch (e) { oops(res, "delete", e); }
  });

  // ─── files ───

  app.post("/api/para-teams/:teamId/files", auth, deps.raw({ type: "*/*", limit: "26mb" }), async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t || slowDown(req, res)) return;
      const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!body.length) return fail(res, 400, "That file didn't arrive. Choose it again.");
      if (body.length > MAX_FILE_BYTES) return fail(res, 413, "Keep each file under 25 MB.");
      let name = String(req.headers["x-file-name"] || "");
      try { name = decodeURIComponent(name); } catch { /* use as sent */ }
      name = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "File";
      const contentType = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
      const ext = uploadExtension(name, contentType, body);
      if (!ext) return fail(res, 415, "That kind of file can't be uploaded. Try a PDF, a photo, a Word, Excel or PowerPoint file, or a video.");
      if ((await db.countItems(t.team.id, "file")) >= KIND_LIMIT.file) return fail(res, 400, "This team has reached its file limit. Delete some old files first.");
      if ((await db.fileBytes(t.team.id)) + body.length > TEAM_STORAGE_BYTES) return fail(res, 413, "This team's file space (2 GB) is full. Delete some old files first.");
      const id = randomUUID();
      const path = `${t.team.id}/${id}.${ext}`;
      await db.upload(path, body, TYPES[ext]);
      const clean = cleanItemData("file", { name, path, size: body.length, contentType: TYPES[ext], folder: decodeHeader(req.headers["x-folder"]), note: decodeHeader(req.headers["x-note"]) });
      if (!clean.ok) return fail(res, 400, clean.message);
      const at = now().toISOString();
      const row: ItemRow = { id, teamId: t.team.id, kind: "file", data: clean.data, createdBy: me(req), createdAt: at, updatedAt: at };
      await db.insertItem(row);
      res.json(toItem(row));
    } catch (e) { oops(res, "upload", e); }
  });

  app.post("/api/para-teams/:teamId/files/:itemId/url", auth, async (req: any, res) => {
    try {
      const t = await onTeam(req, res);
      if (!t) return;
      const id = String(req.params.itemId || "");
      const item = UUID.test(id) ? await db.getItem(t.team.id, id) : null;
      if (!item || item.kind !== "file") return fail(res, 404, "That file has been deleted.");
      const data = item.data as FileData;
      const url = await db.signedUrl(data.path, req.body?.download ? data.name : undefined);
      if (!url) return fail(res, 404, "That file couldn't be found.");
      res.json({ url });
    } catch (e) { oops(res, "open file", e); }
  });
}

function decodeHeader(v: unknown): string {
  const s = String(v || "");
  try { return decodeURIComponent(s); } catch { return s; }
}

// ─── Supabase ───

const BUCKET = "para-team-files";

export function supabaseParaDb(getAdminSupabase: () => any): ParaDb {
  const sb = () => getAdminSupabase();
  const check = <T>({ data, error }: { data: T; error: any }): T => { if (error) throw new Error(error.message || String(error)); return data; };
  const team = (r: any): TeamRow => ({ id: r.id, ownerId: r.owner_id, name: r.name, inviteCode: r.invite_code, inviteOn: r.invite_on, createdAt: r.created_at });
  const member = (r: any): MemberRow => ({ teamId: r.team_id, userId: r.user_id, role: r.role, title: r.title || "", joinedAt: r.joined_at });
  const item = (r: any): ItemRow => ({ id: r.id, teamId: r.team_id, kind: r.kind, data: r.data || {}, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at });
  let bucketReady: Promise<void> | null = null;
  const ensureBucket = () => (bucketReady ??= sb().storage.createBucket(BUCKET, { public: false, fileSizeLimit: "25MB" })
    .then(({ error }: any) => { if (error && !/already exists|duplicate/i.test(error.message || "")) console.error("[para-team] bucket:", error.message); })
    .catch((e: any) => console.error("[para-team] bucket check:", e?.message || e)));

  return {
    async teamsOf(userId) {
      const mine = check(await sb().from("para_team_members").select("*").eq("user_id", userId)) as any[];
      if (!mine.length) return [];
      const ids = mine.map((m) => m.team_id);
      const [teams, all] = await Promise.all([
        sb().from("para_teams").select("*").in("id", ids).then(check),
        sb().from("para_team_members").select("team_id").in("team_id", ids).then(check),
      ]) as [any[], any[]];
      return teams.map((t) => ({ team: team(t), member: member(mine.find((m) => m.team_id === t.id)), members: all.filter((m) => m.team_id === t.id).length }));
    },
    async getTeam(id) { const r = check(await sb().from("para_teams").select("*").eq("id", id).maybeSingle()); return r ? team(r) : null; },
    async teamByCode(code) { const r = check(await sb().from("para_teams").select("*").eq("invite_code", code).maybeSingle()); return r ? team(r) : null; },
    async createTeam(t) { check(await sb().from("para_teams").insert({ id: t.id, owner_id: t.ownerId, name: t.name, invite_code: t.inviteCode, invite_on: t.inviteOn, created_at: t.createdAt })); },
    async updateTeam(id, p) {
      const row: any = {};
      if (p.name !== undefined) row.name = p.name;
      if (p.inviteCode !== undefined) row.invite_code = p.inviteCode;
      if (p.inviteOn !== undefined) row.invite_on = p.inviteOn;
      if (Object.keys(row).length) check(await sb().from("para_teams").update(row).eq("id", id));
    },
    async deleteTeam(id) { check(await sb().from("para_teams").delete().eq("id", id)); },
    async members(teamId) { return (check(await sb().from("para_team_members").select("*").eq("team_id", teamId)) as any[]).map(member); },
    async member(teamId, userId) {
      if (!userId) return null;
      const r = check(await sb().from("para_team_members").select("*").eq("team_id", teamId).eq("user_id", userId).maybeSingle());
      return r ? member(r) : null;
    },
    async addMember(m) { check(await sb().from("para_team_members").upsert({ team_id: m.teamId, user_id: m.userId, role: m.role, title: m.title, joined_at: m.joinedAt }, { onConflict: "team_id,user_id", ignoreDuplicates: true })); },
    async updateMember(teamId, userId, p) {
      const row: any = {};
      if (p.role !== undefined) row.role = p.role;
      if (p.title !== undefined) row.title = p.title;
      if (Object.keys(row).length) check(await sb().from("para_team_members").update(row).eq("team_id", teamId).eq("user_id", userId));
    },
    async removeMember(teamId, userId) { check(await sb().from("para_team_members").delete().eq("team_id", teamId).eq("user_id", userId)); },
    async userNames(ids) {
      const out = new Map<number, string>();
      if (!ids.length) return out;
      const rows = check(await sb().from("users").select("id, display_name, username").in("id", ids)) as any[];
      for (const r of rows) out.set(r.id, String(r.display_name || r.username || "Team member"));
      return out;
    },
    async items(teamId, kind, limit) {
      return (check(await sb().from("para_team_items").select("*").eq("team_id", teamId).eq("kind", kind).order("created_at", { ascending: false }).limit(limit)) as any[]).map(item);
    },
    async countItems(teamId, kind) {
      const { count, error } = await sb().from("para_team_items").select("id", { count: "exact", head: true }).eq("team_id", teamId).eq("kind", kind);
      if (error) throw new Error(error.message);
      return count || 0;
    },
    async latest(teamId) {
      const [{ data, error }, { count, error: e2 }] = await Promise.all([
        sb().from("para_team_items").select("updated_at").eq("team_id", teamId).order("updated_at", { ascending: false }).limit(1),
        sb().from("para_team_items").select("id", { count: "exact", head: true }).eq("team_id", teamId),
      ]);
      if (error || e2) throw new Error((error || e2).message);
      return { at: String(data?.[0]?.updated_at || ""), count: count || 0 };
    },
    async fileBytes(teamId) {
      const rows = check(await sb().from("para_team_items").select("data->size").eq("team_id", teamId).eq("kind", "file").limit(KIND_LIMIT.file)) as any[];
      return rows.reduce((sum, r) => sum + (Number(r.size) || 0), 0);
    },
    async getItem(teamId, id) { const r = check(await sb().from("para_team_items").select("*").eq("team_id", teamId).eq("id", id).maybeSingle()); return r ? item(r) : null; },
    async insertItem(r) { check(await sb().from("para_team_items").insert({ id: r.id, team_id: r.teamId, kind: r.kind, data: r.data, created_by: r.createdBy, created_at: r.createdAt, updated_at: r.updatedAt })); },
    async updateItem(teamId, id, data, updatedAt) { check(await sb().from("para_team_items").update({ data, updated_at: updatedAt }).eq("team_id", teamId).eq("id", id)); },
    async deleteItem(teamId, id) { check(await sb().from("para_team_items").delete().eq("team_id", teamId).eq("id", id)); },
    async upload(path, body, contentType) {
      await ensureBucket();
      const { error } = await sb().storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
      if (error) throw new Error(error.message);
    },
    async signedUrl(path, downloadName) {
      const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, 3600, downloadName ? { download: downloadName } : undefined);
      if (error) return null;
      return data?.signedUrl || null;
    },
    async removeFiles(paths) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await sb().storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (error) throw new Error(error.message);
      }
    },
  };
}
