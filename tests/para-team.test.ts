// Para Team: the rules (shared/paraTeam.ts) and every route (server/paraTeam.ts) against an
// in-memory team, so who may see and change what is checked without a database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canAdd, canCheckOff, canEdit, cleanItemData, cleanUrl, eventsOn, goalSummary, isInviteCode, logsCsv, makeInviteCode, scheduleOn, sortTasks,
  type ParaItem,
} from "../shared/paraTeam";
import { registerParaTeamRoutes, uploadExtension, type ItemRow, type MemberRow, type ParaDb, type TeamRow } from "../server/paraTeam";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ─── rules ───

test("items are cleaned: required fields, real dates and times, capped lengths, safe links", () => {
  assert.deepEqual(cleanItemData("message", { text: "  " }), { ok: false, message: "Write a message first." });
  const ev = cleanItemData("event", { title: "IEP for J.", date: "2026-10-22", start: "13:00", finish: "12:00", end: "2026-10-21", type: "meeting" });
  assert.ok(ev.ok && ev.data.finish === "" && ev.data.end === "" && ev.data.type === "meeting", "an end before the start is dropped");
  assert.equal(cleanItemData("event", { title: "x", date: "2026-02-30" }).ok, false, "no February 30th");
  const absence = cleanItemData("event", { date: "2026-10-23", type: "absence", who: 7 });
  assert.ok(absence.ok, "an absence needs no title");
  const block = cleanItemData("schedule", { activity: "Math small group", start: "09:00", end: "08:00", days: [1, 3, 9, 3] });
  assert.ok(block.ok && block.data.end === "" && block.data.days.join() === "1,3");
  const everyDay = cleanItemData("schedule", { activity: "Lunch duty", start: "11:30" });
  assert.ok(everyDay.ok && everyDay.data.days.join() === "1,2,3,4,5", "no days picked means every weekday");
  assert.equal(cleanItemData("student", { name: "" }).ok, false);
  const log = cleanItemData("log", { studentId: "s1", date: "2026-10-20", type: "goal", goal: "Reads CVC words", result: "prompted", antecedent: "ignored" });
  assert.ok(log.ok && log.data.result === "prompted" && log.data.antecedent === "", "only the fields for that kind of entry are kept");
  assert.equal(cleanItemData("log", { studentId: "s1", date: "2026-10-20", type: "behavior" }).ok, false, "a behavior entry needs the behavior");
  assert.equal(cleanItemData("message", { text: "x".repeat(5000) }).ok && (cleanItemData("message", { text: "x".repeat(5000) }) as any).data.text.length, 2000);
  assert.equal(cleanUrl("docs.google.com/document/d/abc"), "https://docs.google.com/document/d/abc");
  assert.equal(cleanUrl("javascript:alert(1)"), "", "only web links");
  assert.equal(cleanUrl("not a link"), "");
  assert.equal(cleanItemData("link", { url: "javascript:alert(1)", title: "x" }).ok, false);
});

test("who may do what: leads run the plan, paras add and change their own, anyone ticks off their to-dos", () => {
  for (const k of ["student", "schedule", "note"] as const) {
    assert.equal(canAdd("para", k), false, `${k} is the teacher's`);
    assert.equal(canAdd("lead", k), true);
  }
  for (const k of ["message", "event", "task", "log", "lesson", "link"] as const) assert.equal(canAdd("para", k), true, k);
  assert.equal(canAdd("lead", "file"), false, "files only come from uploading");
  assert.equal(canEdit("para", 5, { kind: "lesson", createdBy: 5 }), true);
  assert.equal(canEdit("para", 5, { kind: "lesson", createdBy: 6 }), false);
  assert.equal(canEdit("para", 5, { kind: "student", createdBy: 5 }), false, "even one they made while they were a lead");
  assert.equal(canEdit("lead", 1, { kind: "message", createdBy: 9 }), true);
  const task = { title: "x", note: "", due: "", assignee: 0, done: false, doneBy: 0, doneAt: "" };
  assert.equal(canCheckOff(5, task), true);
  assert.equal(canCheckOff(5, { ...task, assignee: 6 }), false);
});

test("invite codes are 12 unmistakable characters", () => {
  const code = makeInviteCode((n) => new Uint8Array(n).map((_, i) => i * 37));
  assert.equal(code.length, 12);
  assert.ok(isInviteCode(code));
  assert.equal(isInviteCode("abc"), false);
  assert.equal(isInviteCode("ABCDEFGHJKMN"), false);
  assert.equal(isInviteCode("abcdefghjk0l"), false, "no 0 or l");
});

const item = <K extends ParaItem["kind"]>(kind: K, data: any, extra: Partial<ParaItem> = {}): ParaItem<K> => ({ id: Math.random().toString(36).slice(2), kind, data, createdBy: 1, createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T10:00:00Z", ...extra } as ParaItem<K>);

test("the day's schedule, events, to-do order, goal percent and the data spreadsheet", () => {
  const items: ParaItem[] = [
    item("schedule", { days: [2], start: "10:00", end: "", activity: "Reading", place: "", staffId: 5, students: "", notes: "" }),
    item("schedule", { days: [2, 4], start: "08:30", end: "", activity: "Arrival", place: "", staffId: 0, students: "", notes: "" }),
    item("schedule", { days: [2], start: "09:00", end: "", activity: "Speech push-in", place: "", staffId: 6, students: "", notes: "" }),
    item("event", { title: "Field trip", date: "2026-10-19", end: "2026-10-21", start: "", finish: "", type: "event", who: 0, note: "" }),
    item("event", { title: "Other day", date: "2026-10-22", end: "", start: "", finish: "", type: "event", who: 0, note: "" }),
  ];
  // 2026-10-20 is a Tuesday.
  assert.deepEqual(scheduleOn(items, "2026-10-20").map((i) => i.data.activity), ["Arrival", "Speech push-in", "Reading"]);
  assert.deepEqual(scheduleOn(items, "2026-10-20", 5).map((i) => i.data.activity), ["Arrival", "Reading"], "mine and everyone's");
  assert.deepEqual(eventsOn(items, "2026-10-20").map((i) => i.data.title), ["Field trip"], "a run of days covers the middle");
  const tasks = sortTasks([
    item("task", { title: "done", due: "", assignee: 0, done: true, doneBy: 1, doneAt: "2026-10-19", note: "" }),
    item("task", { title: "no date", due: "", assignee: 0, done: false, doneBy: 0, doneAt: "", note: "" }),
    item("task", { title: "soon", due: "2026-10-21", assignee: 0, done: false, doneBy: 0, doneAt: "", note: "" }),
  ]);
  assert.deepEqual(tasks.map((t) => t.data.title), ["soon", "no date", "done"]);
  const logs = [
    item("log", { studentId: "s1", date: "2026-10-20", time: "09:00", type: "goal", goal: "CVC words", result: "correct", count: 0, antecedent: "", behavior: "", consequence: "", text: "" }),
    item("log", { studentId: "s1", date: "2026-10-20", time: "09:05", type: "goal", goal: "cvc words", result: "incorrect", count: 0, antecedent: "", behavior: "", consequence: "", text: "" }),
    item("log", { studentId: "s1", date: "2026-10-20", time: "09:10", type: "behavior", goal: "", result: "", count: 0, antecedent: "Asked to write", behavior: "=SUM(1,2)", consequence: "Break card", text: "Said \"no\"" }),
  ];
  assert.deepEqual(goalSummary(logs, "s1", "CVC words"), { trials: 2, correct: 1, prompted: 0, percent: 50 });
  const csv = logsCsv(logs, () => "J.", () => "Ms. P");
  assert.match(csv.split("\n")[0], /^Date,Time,Student,Type/);
  assert.ok(csv.includes("'=SUM(1,2)"), "a cell that looks like a formula stays text");
  assert.ok(csv.includes('"Said ""no"""'));
  assert.equal(csv.split("\n")[1].split(",")[1], "9:10 AM", "newest first");
});

test("uploads are named by their extension, else their type, else their first bytes", () => {
  assert.equal(uploadExtension("IEP at a glance.PDF", "", Buffer.from("x")), "pdf");
  assert.equal(uploadExtension("photo", "image/png", Buffer.from("x")), "png");
  assert.equal(uploadExtension("scan", "application/octet-stream", Buffer.from("%PDF-1.7 ....")), "pdf");
  assert.equal(uploadExtension("run.exe", "application/x-msdownload", Buffer.from("MZ....")), null);
  assert.equal(uploadExtension("page.html", "text/html", Buffer.from("<html>")), null, "no web pages that could run script");
});

// ─── routes ───

function memoryDb() {
  const teams = new Map<string, TeamRow>();
  let members: MemberRow[] = [];
  let items: ItemRow[] = [];
  const files = new Map<string, Buffer>();
  const names = new Map<number, string>([[1, "Ms. Rivera"], [2, "Dana (para)"], [3, "Sam (1:1)"], [4, "Stranger"]]);
  const db: ParaDb = {
    async teamsOf(u) { return members.filter((m) => m.userId === u).map((m) => ({ team: teams.get(m.teamId)!, member: m, members: members.filter((x) => x.teamId === m.teamId).length })); },
    async getTeam(id) { return teams.get(id) || null; },
    async teamByCode(code) { return [...teams.values()].find((t) => t.inviteCode === code) || null; },
    async createTeam(t) { teams.set(t.id, { ...t }); },
    async updateTeam(id, p) { teams.set(id, { ...teams.get(id)!, ...p }); },
    async deleteTeam(id) { teams.delete(id); members = members.filter((m) => m.teamId !== id); items = items.filter((i) => i.teamId !== id); },
    async members(t) { return members.filter((m) => m.teamId === t); },
    async member(t, u) { return members.find((m) => m.teamId === t && m.userId === u) || null; },
    async addMember(m) { if (!members.some((x) => x.teamId === m.teamId && x.userId === m.userId)) members.push(m); },
    async updateMember(t, u, p) { members = members.map((m) => (m.teamId === t && m.userId === u ? { ...m, ...p } : m)); },
    async removeMember(t, u) { members = members.filter((m) => !(m.teamId === t && m.userId === u)); },
    async userNames(ids) { return new Map(ids.filter((i) => names.has(i)).map((i) => [i, names.get(i)!])); },
    async items(t, k, limit) { return items.filter((i) => i.teamId === t && i.kind === k).slice(-limit).reverse(); },
    async countItems(t, k) { return items.filter((i) => i.teamId === t && i.kind === k).length; },
    async latest(t) { const mine = items.filter((i) => i.teamId === t); return { at: mine.reduce((m, i) => (i.updatedAt > m ? i.updatedAt : m), ""), count: mine.length }; },
    async fileBytes(t) { return items.filter((i) => i.teamId === t && i.kind === "file").reduce((s, i) => s + i.data.size, 0); },
    async getItem(t, id) { return items.find((i) => i.teamId === t && i.id === id) || null; },
    async insertItem(r) { items.push(r); },
    async updateItem(t, id, data, at) { items = items.map((i) => (i.teamId === t && i.id === id ? { ...i, data, updatedAt: at } : i)); },
    async deleteItem(t, id) { items = items.filter((i) => !(i.teamId === t && i.id === id)); },
    async upload(path, body) { files.set(path, body); },
    async signedUrl(path) { return files.has(path) ? `https://files.example/${path}?sig=1` : null; },
    async removeFiles(paths) { for (const p of paths) files.delete(p); },
  };
  return { db, files, all: () => items };
}

function server() {
  const routes: Record<string, Function> = {};
  const add = (method: string) => (path: string, ...h: any[]) => { routes[`${method} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), patch: add("PATCH"), delete: add("DELETE") };
  const mem = memoryDb();
  let n = 0;
  registerParaTeamRoutes(app, { auth: (_q: any, _s: any, next: any) => next(), raw: () => (_q: any, _s: any, next: any) => next(), db: mem.db, now: () => new Date("2026-10-20T15:00:00Z"), random: (k) => new Uint8Array(k).map(() => (n++ * 7) % 256) });
  const users: Record<number, any> = { 1: { id: 1, role: "teacher" }, 2: { id: 2, role: "todo" }, 3: { id: 3, role: "todo" }, 4: { id: 4, role: "teacher" }, 9: { id: 9, role: "student" } };
  const call = async (method: string, path: string, as: number, body: any = {}, params: any = {}, headers: any = {}) => {
    let out: any; let status = 200;
    const res: any = { json: (b: any) => { out = b; return res; }, status: (s: number) => { status = s; return res; } };
    await routes[`${method} ${path}`]({ user: users[as], body, params, headers, query: {}, socket: { remoteAddress: "1.2.3.4" } }, res);
    return { status, body: out };
  };
  return { call, mem, routes };
}

test("routes: a teacher makes a team, a para joins by link, and each sees only what they should", async () => {
  const { call, mem, routes } = server();
  // The staff-only check is a separate step in front of every route (not run by this fake), so check it's there.
  assert.match(read("server/paraTeam.ts"), /const auth: RequestHandler\[\] = \[deps\.auth, adultOnly\];/);
  const made = await call("POST", "/api/para-teams", 1, { name: "Room 112 Team" });
  assert.equal(made.status, 200);
  const team = made.body;
  assert.equal(team.role, "lead");
  assert.ok(isInviteCode(team.invite.code));
  const code = team.invite.code;

  const preview = await call("GET", "/api/public/para-teams/join/:code", 0, {}, { code });
  assert.deepEqual(preview.body, { name: "Room 112 Team", teacher: "Ms. Rivera" });

  assert.equal((await call("GET", "/api/para-teams/:teamId", 2, {}, { teamId: team.id })).status, 403, "not on the team yet");
  const joined = await call("POST", "/api/para-teams/join/:code", 2, { title: "Para" }, { code });
  assert.equal(joined.body.role, "para");
  assert.equal(joined.body.invite, null, "paras never see the invite code");
  assert.deepEqual(joined.body.members.map((m: any) => [m.name, m.role, m.owner]), [["Ms. Rivera", "lead", true], ["Dana (para)", "para", false]]);
  const again = await call("POST", "/api/para-teams/join/:code", 2, {}, { code });
  assert.equal(again.body.members.length, 2, "joining twice doesn't add twice");
  assert.equal((await call("POST", "/api/para-teams/join/:code", 3, {}, { code: "zzzzzzzzzzzz" })).status, 404);

  const p = { teamId: team.id };
  // Students: the teacher's. Messages and data: anyone's.
  assert.equal((await call("POST", "/api/para-teams/:teamId/items", 2, { kind: "student", data: { name: "J." } }, p)).status, 403);
  const student = (await call("POST", "/api/para-teams/:teamId/items", 1, { kind: "student", data: { name: "J.", accommodations: "Visual schedule" } }, p)).body;
  assert.equal(student.kind, "student");
  const pinTry = (await call("POST", "/api/para-teams/:teamId/items", 2, { kind: "message", data: { text: "Hi team", pinned: true } }, p)).body;
  assert.equal(pinTry.data.pinned, false, "only the teacher pins");
  const log = (await call("POST", "/api/para-teams/:teamId/items", 2, { kind: "log", data: { studentId: student.id, date: "2026-10-20", type: "tally", goal: "Hand raises", count: 3 } }, p)).body;
  assert.equal(log.createdBy, 2);
  assert.equal((await call("PATCH", "/api/para-teams/:teamId/items/:itemId", 2, { data: { name: "Changed" } }, { ...p, itemId: student.id })).status, 403);
  assert.equal((await call("DELETE", "/api/para-teams/:teamId/items/:itemId", 1, {}, { ...p, itemId: log.id })).status, 200, "the teacher can delete anything");

  // To-dos: the teacher's to-do for everyone can be ticked off by a para, but not rewritten.
  const task = (await call("POST", "/api/para-teams/:teamId/items", 1, { kind: "task", data: { title: "Laminate visuals", assignee: 0 } }, p)).body;
  const ticked = await call("PATCH", "/api/para-teams/:teamId/items/:itemId", 2, { data: { done: true, title: "hacked" } }, { ...p, itemId: task.id });
  assert.equal(ticked.status, 200);
  assert.deepEqual([ticked.body.data.title, ticked.body.data.done, ticked.body.data.doneBy], ["Laminate visuals", true, 2]);
  const forSam = (await call("POST", "/api/para-teams/:teamId/items", 1, { kind: "task", data: { title: "Sam's", assignee: 3 } }, p)).body;
  assert.equal((await call("PATCH", "/api/para-teams/:teamId/items/:itemId", 2, { data: { done: true } }, { ...p, itemId: forSam.id })).status, 403, "someone else's to-do");

  // Files: uploaded, opened by signed link only through the team, removed with the item.
  const up = await call("POST", "/api/para-teams/:teamId/files", 2, Buffer.from("%PDF-1.7 hello"), p, { "x-file-name": encodeURIComponent("Behavior plan.pdf"), "x-folder": "Behavior", "content-type": "application/pdf" });
  assert.equal(up.status, 200);
  assert.equal(up.body.data.folder, "Behavior");
  assert.ok(up.body.data.path.startsWith(`${team.id}/`));
  assert.equal(mem.files.size, 1);
  const url = await call("POST", "/api/para-teams/:teamId/files/:itemId/url", 1, {}, { ...p, itemId: up.body.id });
  assert.match(url.body.url, /^https:\/\/files\.example\//);
  assert.equal((await call("POST", "/api/para-teams/:teamId/files/:itemId/url", 4, {}, { ...p, itemId: up.body.id })).status, 403, "not on the team, no link");
  const moved = await call("PATCH", "/api/para-teams/:teamId/items/:itemId", 2, { data: { path: "other-team/secret.pdf", name: "Plan v2.pdf" } }, { ...p, itemId: up.body.id });
  assert.equal(moved.body.data.path, up.body.data.path, "an edit can't point a file somewhere else");
  assert.equal(moved.body.data.name, "Plan v2.pdf");
  assert.equal((await call("POST", "/api/para-teams/:teamId/items", 2, { kind: "file", data: { name: "x", path: "y" } }, p)).status, 403);
  assert.equal((await call("POST", "/api/para-teams/:teamId/files", 2, Buffer.from("<script>"), p, { "x-file-name": "x.html", "content-type": "text/html" })).status, 415);
  await call("DELETE", "/api/para-teams/:teamId/items/:itemId", 2, {}, { ...p, itemId: up.body.id });
  assert.equal(mem.files.size, 0);

  // The refresh stamp moves when anything changes, and only for people on the team.
  const s1 = (await call("GET", "/api/para-teams/:teamId/stamp", 2, {}, p)).body.stamp;
  assert.equal((await call("GET", "/api/para-teams/:teamId/stamp", 2, {}, p)).body.stamp, s1, "nothing changed");
  await call("POST", "/api/para-teams/:teamId/items", 2, { kind: "message", data: { text: "Running late" } }, p);
  assert.notEqual((await call("GET", "/api/para-teams/:teamId/stamp", 2, {}, p)).body.stamp, s1);
  assert.equal((await call("GET", "/api/para-teams/:teamId/stamp", 4, {}, p)).status, 403);

  // A new link stops the old one; turning invites off stops joining.
  const fresh = await call("POST", "/api/para-teams/:teamId/invite/new", 1, {}, p);
  assert.notEqual(fresh.body.invite.code, code);
  assert.equal((await call("POST", "/api/para-teams/join/:code", 3, {}, { code })).status, 404);
  assert.equal((await call("POST", "/api/para-teams/:teamId/invite/new", 2, {}, p)).status, 403);
  await call("PATCH", "/api/para-teams/:teamId", 1, { inviteOn: false }, p);
  assert.equal((await call("POST", "/api/para-teams/join/:code", 3, {}, { code: fresh.body.invite.code })).status, 404);

  // People: a para can rename their own title and leave; the maker can't leave or be removed.
  assert.equal((await call("PATCH", "/api/para-teams/:teamId/members/:userId", 2, { title: "1:1 for J." }, { ...p, userId: "2" })).body.members[1].title, "1:1 for J.");
  assert.equal((await call("PATCH", "/api/para-teams/:teamId/members/:userId", 2, { role: "lead" }, { ...p, userId: "2" })).status, 403);
  assert.equal((await call("DELETE", "/api/para-teams/:teamId/members/:userId", 2, {}, { ...p, userId: "1" })).status, 400);
  assert.equal((await call("DELETE", "/api/para-teams/:teamId/members/:userId", 1, {}, { ...p, userId: "1" })).status, 400);
  const promoted = await call("PATCH", "/api/para-teams/:teamId/members/:userId", 1, { role: "lead" }, { ...p, userId: "2" });
  assert.equal(promoted.body.members.find((m: any) => m.userId === 2).role, "lead");
  const left = await call("DELETE", "/api/para-teams/:teamId/members/:userId", 2, {}, { ...p, userId: "2" });
  assert.deepEqual(left.body, { ok: true, left: true });
  const after = (await call("GET", "/api/para-teams/:teamId", 1, {}, p)).body;
  const former = after.members.find((m: any) => m.userId === 2);
  assert.ok(former?.left, "what a person added still says who, after they leave");

  // Only the maker deletes the team, and its files go with it.
  await call("POST", "/api/para-teams/:teamId/files", 1, Buffer.from("\x89PNG...."), p, { "x-file-name": "chart.png" });
  assert.equal(mem.files.size, 1);
  assert.equal((await call("DELETE", "/api/para-teams/:teamId", 4, {}, p)).status, 403);
  assert.equal((await call("DELETE", "/api/para-teams/:teamId", 1, {}, p)).status, 200);
  assert.equal(mem.files.size, 0);
  assert.equal((await call("GET", "/api/para-teams/:teamId", 1, {}, p)).status, 404);
  assert.ok(routes["GET /api/para-teams"], "the list of my teams");
});

test("Para Team is reachable from WorkHub, LifeHub and the teacher Reader, and invite links survive signing in", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /<Route path="\/para-team\/join\/:code">\s*<JoinParaTeam \/>/);
  assert.match(app, /<Route path="\/para-team">\s*\{!user \? <Redirect to="\/signin" replace \/> : <ParaTeam \/>\}/);
  assert.match(app, /const paraJoin = pendingParaJoin\(\);\s*if \(paraJoin && isHubAccount\(user\)\) return <Redirect to=\{`\/para-team\/join\/\$\{paraJoin\}`\} replace \/>;/);
  assert.match(app, /<ParaJoinResume \/>/);
  assert.match(read("client/src/lib/paraTeam.ts"), /export const PENDING_JOIN_KEY = "para_team_join_code";/, "the same key App.tsx reads");
  assert.match(read("client/src/lib/paraTeam.ts"), /export const inviteLink = \(code: string\) => `\$\{TODO_APP\}#\/para-team\/join\/\$\{code\}`;/, "invites open on arisetodo.com, where paras can make a free account");
  const join = read("client/src/pages/ParaTeam.tsx");
  assert.match(join, /useEffect\(\(\) => \{ if \(user\) store\.set\(PENDING_JOIN_KEY, ""\); \}, \[user\]\);/, "a failed join can't loop");
  assert.match(read("client/src/pages/TeacherHub.tsx"), /\{navItem\(entry\.item, menu\.indexOf\(entry\.item\)\)\}\{paraBlock\}/);
  assert.match(read("client/src/pages/TeacherHub.tsx"), /data-testid="hub-para-team"/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /data-testid="life-para-team"/);
  const reader = read("client/src/pages/TeacherReader.tsx");
  assert.match(reader, /\{ id: "paraTeam", label: "Para Team", icon: HeartHandshake \}/);
  assert.match(reader, /if \(v === "paraTeam"\) \{ window\.location\.assign\(appHref\("\/para-team"\)\); return; \}/);
  // Uploads arrive raw, before the JSON reader can empty the request.
  assert.match(read("server/index.ts"), /app\.use\(\/\^\\\/api\\\/para-teams\\\/\[\^\/\]\+\\\/files\$\/, express\.raw\(\{ type: "\*\/\*", limit: "26mb" \}\)\);/);
  assert.match(read("server/routes.ts"), /registerParaTeamRoutes\(app, \{ auth: authMiddleware, raw: raw as any, db: supabaseParaDb\(getAdminSupabase\) \}\);/);
  // The tables only the server can reach.
  const sql = read("migrations/para_teams.sql");
  for (const t of ["para_teams", "para_team_members", "para_team_items"]) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`));
  assert.match(sql, /revoke all on table public\.para_teams, public\.para_team_members, public\.para_team_items from anon, authenticated;/);
});
