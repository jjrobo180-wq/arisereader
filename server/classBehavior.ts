// A.R.I.S.E. class behavior: points for chosen behaviors, hall passes and what parents see.
//
// Rules kept here, on the server:
// - Teachers give points to and run passes for only their own approved students.
// - Students see only their own points and passes, and can ask for a pass only from their own teacher,
//   one at a time, when the teacher allows it.
// - Parents see only their linked children, and only what the teacher shared (points and notes marked
//   to share; hall passes are always shown). A shared note sends the parent a notification.
// Tables: migrations/class_behavior.sql.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { cleanSettings, defaultSettings, totals, type BehaviorEvent, type BehaviorSettings, type HallPass, type PassStatus } from "../shared/classBehavior";

export type BUser = { id: number; role: "student" | "teacher" | "parent" | "admin"; displayName: string; teacherId: number | null; approvedByTeacher: boolean; archived: boolean };
export type BehaviorDirectory = {
  user: (id: number) => Promise<BUser | null>;
  studentsOf: (teacherId: number) => Promise<BUser[]>;
  childrenOf: (parentId: number) => Promise<number[]>;
  parentsOf: (studentId: number) => Promise<number[]>;
  notify?: (userId: number, message: { title: string; body: string; url?: string }) => Promise<unknown> | void;
};
export interface BehaviorStore {
  getSettings(teacherId: number): Promise<BehaviorSettings>;
  saveSettings(teacherId: number, s: BehaviorSettings): Promise<void>;
  addEvents(rows: BehaviorEvent[]): Promise<void>;
  events(q: { teacherId?: number; studentIds?: number[]; since?: string; limit?: number }): Promise<BehaviorEvent[]>;
  deleteEvent(id: string, teacherId: number): Promise<boolean>;
  addPass(p: HallPass): Promise<void>;
  getPass(id: string): Promise<HallPass | null>;
  updatePass(id: string, patch: Partial<HallPass>): Promise<void>;
  passes(q: { teacherId?: number; studentIds?: number[]; since?: string; statuses?: PassStatus[] }): Promise<HallPass[]>;
}
export class BehaviorNotSetUp extends Error {}

export function createMemoryBehaviorStore(): BehaviorStore {
  const settings = new Map<number, BehaviorSettings>(); let ev: BehaviorEvent[] = []; const ps: HallPass[] = [];
  const inQ = (r: { teacher_id: number; student_id: number }, q: { teacherId?: number; studentIds?: number[] }) => (q.teacherId == null || r.teacher_id === q.teacherId) && (!q.studentIds || q.studentIds.includes(r.student_id));
  return {
    async getSettings(t) { return settings.get(t) ?? defaultSettings(); },
    async saveSettings(t, s) { settings.set(t, s); },
    async addEvents(rows) { ev.push(...rows); },
    async events(q) { return ev.filter((e) => inQ(e, q) && (!q.since || e.created_at >= q.since)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, q.limit ?? 5000); },
    async deleteEvent(id, t) { const before = ev.length; ev = ev.filter((e) => !(e.id === id && e.teacher_id === t)); return ev.length < before; },
    async addPass(p) { ps.push({ ...p }); },
    async getPass(id) { const p = ps.find((x) => x.id === id); return p ? { ...p } : null; },
    async updatePass(id, patch) { const p = ps.find((x) => x.id === id); if (p) Object.assign(p, patch); },
    async passes(q) { return ps.filter((p) => inQ(p, q) && (!q.since || p.asked_at >= q.since) && (!q.statuses || q.statuses.includes(p.status))).map((p) => ({ ...p })).sort((a, b) => b.asked_at.localeCompare(a.asked_at)); },
  };
}

const isMissingTable = (e: any) => e?.code === "42P01" || e?.code === "PGRST205" || /could not find the table|does not exist/i.test(String(e?.message || ""));
export function createSupabaseBehaviorStore(client?: any): BehaviorStore {
  const db = async () => client ?? (await import("./supabase")).supabase;
  const fail = (e: any) => { if (!e) return; if (isMissingTable(e)) throw new BehaviorNotSetUp(String(e.message)); throw e; };
  const scope = (q: any, f: { teacherId?: number; studentIds?: number[] }) => { if (f.teacherId != null) q = q.eq("teacher_id", f.teacherId); if (f.studentIds) q = q.in("student_id", f.studentIds.length ? f.studentIds : [-1]); return q; };
  return {
    async getSettings(t) { const r = await (await db()).from("behavior_settings").select("data").eq("teacher_id", t).maybeSingle(); fail(r.error); return cleanSettings(r.data?.data); },
    async saveSettings(t, s) { const r = await (await db()).from("behavior_settings").upsert({ teacher_id: t, data: s, updated_at: new Date().toISOString() }); fail(r.error); },
    async addEvents(rows) { if (!rows.length) return; const r = await (await db()).from("behavior_events").insert(rows); fail(r.error); },
    async events(f) { let q = scope((await db()).from("behavior_events").select("*"), f); if (f.since) q = q.gte("created_at", f.since); const r = await q.order("created_at", { ascending: false }).limit(f.limit ?? 5000); fail(r.error); return (r.data || []).map((x: any) => ({ ...x, teacher_id: Number(x.teacher_id), student_id: Number(x.student_id) })); },
    async deleteEvent(id, t) { const r = await (await db()).from("behavior_events").delete().eq("id", id).eq("teacher_id", t).select("id"); fail(r.error); return !!r.data?.length; },
    async addPass(p) { const r = await (await db()).from("hall_passes").insert(p); fail(r.error); },
    async getPass(id) { const r = await (await db()).from("hall_passes").select("*").eq("id", id).maybeSingle(); fail(r.error); return r.data ? { ...r.data, teacher_id: Number(r.data.teacher_id), student_id: Number(r.data.student_id) } : null; },
    async updatePass(id, patch) { const r = await (await db()).from("hall_passes").update(patch).eq("id", id); fail(r.error); },
    async passes(f) { let q = scope((await db()).from("hall_passes").select("*"), f); if (f.since) q = q.gte("asked_at", f.since); if (f.statuses) q = q.in("status", f.statuses); const r = await q.order("asked_at", { ascending: false }).limit(2000); fail(r.error); return (r.data || []).map((x: any) => ({ ...x, teacher_id: Number(x.teacher_id), student_id: Number(x.student_id) })); },
  };
}

const shortName = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || "Student"; };
const text = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function registerClassBehaviorRoutes(app: Express, auth: RequestHandler, deps: { directory: BehaviorDirectory; store?: BehaviorStore; now?: () => number }) {
  const store = deps.store ?? createSupabaseBehaviorStore();
  const dir = deps.directory, now = deps.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  const daysAgo = (n: number) => new Date(now() - n * 86_400_000).toISOString();
  const handle = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
    try { await fn(req, res); }
    catch (e: any) {
      if (e?.code === 401) return res.status(401).json({ message: "Sign in again." });
      if (e instanceof BehaviorNotSetUp) return res.status(503).json({ message: "Behavior isn't set up on this site yet. The site owner needs to run migrations/class_behavior.sql.", setup: true });
      console.error("[behavior]", e?.message || e); res.status(500).json({ message: "Something went wrong. Try again." });
    }
  };
  async function me(req: any) { const u = await dir.user(Number(req.user?.id)); if (!u || u.archived) throw Object.assign(new Error("no"), { code: 401 }); return u; }
  const isTeacher = (u: BUser) => u.role === "teacher" || u.role === "admin";
  async function myStudents(t: BUser) { return (await dir.studentsOf(t.id)).filter((s) => s.role === "student" && s.approvedByTeacher && !s.archived); }
  const passOut = (p: HallPass) => ({ id: p.id, studentId: p.student_id, place: p.place, status: p.status, limit: p.limit_min, askedAt: p.asked_at, outAt: p.out_at, backAt: p.back_at });
  const eventOut = (e: BehaviorEvent) => ({ id: e.id, studentId: e.student_id, points: e.points, label: e.label, note: e.note, share: e.share, at: e.created_at });
  async function tellParents(studentId: number, studentName: string, body: string) {
    if (!dir.notify) return;
    for (const p of await dir.parentsOf(studentId).catch(() => [])) { try { await dir.notify(p, { title: `${studentName.split(" ")[0]} at school`, body, url: "/#/parent-dashboard" }); } catch { /* no device */ } }
  }

  /* ---------- teacher ---------- */
  app.get("/api/behavior/class", auth, handle(async (req, res) => {
    const t = await me(req); if (!isTeacher(t)) return res.status(403).json({ message: "Teachers only." });
    const kids = await myStudents(t), ids = kids.map((k) => k.id);
    const [settings, events, passes] = await Promise.all([store.getSettings(t.id), store.events({ teacherId: t.id, studentIds: ids, since: daysAgo(120) }), store.passes({ teacherId: t.id, studentIds: ids, since: daysAgo(1) })]);
    const tot = totals(events, now());
    res.json({
      settings, serverNow: now(),
      students: kids.map((k) => ({ id: k.id, name: k.displayName, short: shortName(k.displayName), ...(tot[k.id] ?? { all: 0, week: 0, today: 0, pos: 0, neg: 0 }) })).sort((a, b) => a.name.localeCompare(b.name)),
      recent: events.slice(0, 60).map(eventOut),
      passes: passes.filter((p) => p.status === "asked" || p.status === "out" || (p.back_at && p.back_at >= daysAgo(0.5))).map(passOut),
    });
  }));
  app.get("/api/behavior/students/:id", auth, handle(async (req, res) => {
    const t = await me(req); if (!isTeacher(t)) return res.status(403).json({ message: "Teachers only." });
    const sid = Number(req.params.id); if (!(await myStudents(t)).some((k) => k.id === sid)) return res.status(404).json({ message: "Not your student." });
    const [events, passes] = await Promise.all([store.events({ teacherId: t.id, studentIds: [sid], since: daysAgo(365), limit: 500 }), store.passes({ teacherId: t.id, studentIds: [sid], since: daysAgo(60) })]);
    res.json({ events: events.map(eventOut), passes: passes.map(passOut) });
  }));
  app.post("/api/behavior/points", auth, handle(async (req, res) => {
    const t = await me(req); if (!isTeacher(t)) return res.status(403).json({ message: "Teachers only." });
    const kids = await myStudents(t), mine = new Map(kids.map((k) => [k.id, k]));
    const ids = [...new Set((Array.isArray(req.body?.studentIds) ? req.body.studentIds : []).map(Number))].filter((id) => mine.has(id as number)) as number[];
    if (!ids.length) return res.status(400).json({ message: "Pick at least one of your students." });
    const settings = await store.getSettings(t.id);
    const def = settings.behaviors.find((b) => b.id === req.body?.behaviorId);
    const label = def ? def.label : text(req.body?.label, 40) || "Note";
    const points = def ? def.points : Math.max(-10, Math.min(10, Math.round(Number(req.body?.points) || 0)));
    const note = text(req.body?.note, 300);
    const share = req.body?.share === undefined ? settings.shareDefault : !!req.body.share;
    const at = iso();
    const rows: BehaviorEvent[] = ids.map((sid) => ({ id: randomUUID(), teacher_id: t.id, student_id: sid, points, label, note, share, created_at: at }));
    await store.addEvents(rows);
    if (share) for (const sid of ids) { const k = mine.get(sid)!; void tellParents(sid, k.displayName, `${points > 0 ? `+${points}` : points < 0 ? points : ""} ${label}${note ? `: ${note}` : ""} (from ${t.displayName})`.trim()); }
    res.json({ added: rows.map(eventOut) });
  }));
  app.delete("/api/behavior/events/:id", auth, handle(async (req, res) => {
    const t = await me(req); if (!isTeacher(t)) return res.status(403).json({ message: "Teachers only." });
    res.json({ removed: await store.deleteEvent(String(req.params.id), t.id) });
  }));
  app.put("/api/behavior/settings", auth, handle(async (req, res) => {
    const t = await me(req); if (!isTeacher(t)) return res.status(403).json({ message: "Teachers only." });
    const s = cleanSettings(req.body); await store.saveSettings(t.id, s); res.json({ settings: s });
  }));
  /** A teacher starts a pass for a student, or acts on one: approve, deny, back. */
  app.post("/api/behavior/passes", auth, handle(async (req, res) => {
    const t = await me(req); if (!isTeacher(t)) return res.status(403).json({ message: "Teachers only." });
    const sid = Number(req.body?.studentId), kid = (await myStudents(t)).find((k) => k.id === sid);
    if (!kid) return res.status(404).json({ message: "Not your student." });
    const settings = await store.getSettings(t.id), place = settings.places.find((p) => p.id === req.body?.place) ?? settings.places[0];
    const open = await store.passes({ teacherId: t.id, statuses: ["asked", "out"] });
    if (open.some((p) => p.student_id === sid && p.status === "out")) return res.status(409).json({ message: `${kid.displayName.split(" ")[0]} is already out.` });
    for (const p of open.filter((p) => p.student_id === sid && p.status === "asked")) await store.updatePass(p.id, { status: "denied" });
    const p: HallPass = { id: randomUUID(), teacher_id: t.id, student_id: sid, place: place.label, status: "out", limit_min: place.minutes, asked_at: iso(), out_at: iso(), back_at: null };
    await store.addPass(p); res.json({ pass: passOut(p) });
  }));
  app.post("/api/behavior/passes/:id/:act", auth, handle(async (req, res) => {
    const t = await me(req); if (!isTeacher(t)) return res.status(403).json({ message: "Teachers only." });
    const p = await store.getPass(String(req.params.id)); if (!p || p.teacher_id !== t.id) return res.status(404).json({ message: "Pass not found." });
    const act = String(req.params.act);
    if (act === "approve" && p.status === "asked") {
      const settings = await store.getSettings(t.id), out = (await store.passes({ teacherId: t.id, statuses: ["out"] })).length;
      if (out >= settings.maxOut && req.body?.force !== true) return res.status(409).json({ message: `${out} ${out === 1 ? "student is" : "students are"} already out (your limit is ${settings.maxOut}).`, full: true });
      await store.updatePass(p.id, { status: "out", out_at: iso() });
    } else if (act === "deny" && p.status === "asked") await store.updatePass(p.id, { status: "denied", back_at: iso() });
    else if (act === "back" && p.status === "out") await store.updatePass(p.id, { status: "back", back_at: iso() });
    else return res.status(409).json({ message: "That pass has already changed." });
    res.json({ pass: passOut((await store.getPass(p.id))!) });
  }));

  /* ---------- student ---------- */
  app.get("/api/behavior/me", auth, handle(async (req, res) => {
    const u = await me(req); if (u.role !== "student") return res.status(403).json({ message: "Students only." });
    if (!u.teacherId || !u.approvedByTeacher) return res.json({ hasClass: false });
    const [settings, events, passes] = await Promise.all([store.getSettings(u.teacherId), store.events({ teacherId: u.teacherId, studentIds: [u.id], since: daysAgo(120), limit: 300 }), store.passes({ teacherId: u.teacherId, studentIds: [u.id], since: daysAgo(1) })]);
    const tot = totals(events, now())[u.id] ?? { all: 0, week: 0, today: 0, pos: 0, neg: 0 };
    res.json({ hasClass: true, serverNow: now(), points: tot, recent: events.slice(0, 10).map(eventOut), canAsk: settings.studentAsk, places: settings.places,
      pass: (() => { const p = passes.find((x) => x.status === "asked" || x.status === "out"); return p ? passOut(p) : null; })() });
  }));
  app.post("/api/behavior/me/pass", auth, handle(async (req, res) => {
    const u = await me(req); if (u.role !== "student" || !u.teacherId || !u.approvedByTeacher) return res.status(403).json({ message: "Join a teacher's class first." });
    const settings = await store.getSettings(u.teacherId);
    if (!settings.studentAsk) return res.status(403).json({ message: "Your teacher gives passes in class." });
    const open = await store.passes({ teacherId: u.teacherId, studentIds: [u.id], statuses: ["asked", "out"] });
    if (open.length) return res.status(409).json({ message: open[0].status === "out" ? "You're already out on a pass." : "You already asked. Wait for your teacher." });
    const place = settings.places.find((p) => p.id === req.body?.place); if (!place) return res.status(400).json({ message: "Pick where you're going." });
    const p: HallPass = { id: randomUUID(), teacher_id: u.teacherId, student_id: u.id, place: place.label, status: "asked", limit_min: place.minutes, asked_at: iso(), out_at: null, back_at: null };
    await store.addPass(p);
    void dir.notify?.(u.teacherId, { title: "Hall pass request", body: `${shortName(u.displayName)} asked to go to the ${place.label.toLowerCase()}.`, url: "/#/workhub" });
    res.json({ pass: passOut(p) });
  }));
  app.post("/api/behavior/me/pass/:act", auth, handle(async (req, res) => {
    const u = await me(req); if (u.role !== "student" || !u.teacherId) return res.status(403).json({ message: "Students only." });
    const p = (await store.passes({ teacherId: u.teacherId, studentIds: [u.id], statuses: ["asked", "out"] }))[0];
    if (!p) return res.status(404).json({ message: "No open pass." });
    if (req.params.act === "back" && p.status === "out") await store.updatePass(p.id, { status: "back", back_at: iso() });
    else if (req.params.act === "cancel" && p.status === "asked") await store.updatePass(p.id, { status: "denied", back_at: iso() });
    else return res.status(409).json({ message: "That pass has already changed." });
    res.json({ ok: true });
  }));

  /* ---------- parent ---------- */
  app.get("/api/behavior/children", auth, handle(async (req, res) => {
    const u = await me(req); if (u.role !== "parent" && u.role !== "admin") return res.status(403).json({ message: "Parents only." });
    const ids = await dir.childrenOf(u.id);
    const kids = (await Promise.all(ids.map((id) => dir.user(id)))).filter((k): k is BUser => !!k && k.role === "student" && !k.archived);
    const [events, passes] = await Promise.all([store.events({ studentIds: kids.map((k) => k.id), since: daysAgo(60), limit: 2000 }), store.passes({ studentIds: kids.map((k) => k.id), since: daysAgo(14) })]);
    const shared = events.filter((e) => e.share), tot = totals(shared, now());
    res.json({ children: kids.map((k) => ({
      id: k.id, name: k.displayName.split(" ")[0], points: tot[k.id] ?? { all: 0, week: 0, today: 0, pos: 0, neg: 0 },
      recent: shared.filter((e) => e.student_id === k.id).slice(0, 25).map(eventOut),
      passes: passes.filter((p) => p.student_id === k.id && p.status !== "denied").slice(0, 15).map(passOut),
    })) });
  }));
}
