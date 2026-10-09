// The Teacher Hub's setup check: finds what the database is missing and hands the site owner the
// exact SQL to paste. Run with: npx tsx --test tests/hub-setup.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SETUP_ITEMS, checkSetup, fixSql, registerHubSetupRoutes, sqlEditorUrl } from "../server/hubSetup";
import { SETUP_SQL } from "../server/hubSetupSql";
import { fakeSupabase } from "./helpers/fakeSupabase";

function setup(options: Parameters<typeof fakeSupabase>[1] = {}, opts: { cacheMs?: number; allowed?: boolean } = {}) {
  const db = fakeSupabase({}, options);
  const routes: Record<string, Function[]> = {};
  const app: any = { get: (path: string, ...handlers: Function[]) => { routes[`GET ${path}`] = handlers; } };
  registerHubSetupRoutes(app, ((_req: any, _res: any, next: any) => next()) as any, {
    gate: async (_req, res) => { if (opts.allowed === false) { res.status(403).json({ message: "no" }); return null; } return {}; },
    db,
    url: "https://swsyalnajzizfwazqwpd.supabase.co",
    cacheMs: opts.cacheMs ?? 0,
  });
  async function call(user: any, query: any = {}) {
    const out: any = { status: 200, body: null };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; }, set() { return res; } };
    const chain = routes["GET /api/teacher-hub/setup-check"];
    const req: any = { user, query, body: {} };
    let i = 0;
    const next = async () => { const handler = chain[i++]; if (handler) await handler(req, res, next); };
    await next();
    return out;
  }
  return { db, call };
}

const owner = { id: 1, role: "teacher", isAdmin: true };
const teacher = { id: 7, role: "teacher", isAdmin: false };

test("when everything is set up there is nothing to do", async () => {
  const { call } = setup();
  const r = await call(owner);
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.missing, []);
  assert.equal(r.body.fixAllSql, undefined);
});

test("a missing table is named in plain words, with what stops working", async () => {
  const { call } = setup({ missingTables: ["teacher_hub_backups"] });
  const r = await call(owner);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.blocking, false, "backups are good to have, not needed to work");
  assert.deepEqual(r.body.missing.map((m: any) => m.id), ["backups"]);
  assert.match(r.body.missing[0].effect, /backup/i);
});

test("missing columns are found too, and a missing column in polls counts as needed", async () => {
  const { call } = setup({ missingColumns: { meeting_polls: ["send_via", "send_text"], meeting_poll_invitees: ["phone"] } });
  const r = await call(owner);
  assert.deepEqual(r.body.missing.map((m: any) => m.id), ["polls-send"]);
  assert.equal(r.body.blocking, true);
});

test("the site owner gets the SQL and the link to paste it into; a teacher does not", async () => {
  const { call } = setup({ missingTables: ["teacher_hub_backups", "hub_availability"], missingColumns: { meeting_poll_invitees: ["user_id"] } });
  const mine = await call(owner);
  assert.equal(mine.body.sqlEditorUrl, "https://supabase.com/dashboard/project/swsyalnajzizfwazqwpd/sql/new");
  assert.match(mine.body.fixAllSql, /create table if not exists public\.teacher_hub_backups/);
  assert.match(mine.body.fixAllSql, /create table if not exists public\.hub_availability/);
  assert.match(mine.body.fixAllSql, /notify pgrst, 'reload schema';\s*$/);
  const theirs = await call(teacher);
  assert.equal(theirs.body.ok, false);
  assert.equal(theirs.body.fixAllSql, undefined);
  assert.equal(theirs.body.sqlEditorUrl, undefined);
  assert.deepEqual(theirs.body.missing.map((m: any) => Object.keys(m).sort()), [["effect", "id", "needed", "what"], ["effect", "id", "needed", "what"]]);
});

test("the SQL is in the order it has to run, each file once", async () => {
  const results = await checkSetup(fakeSupabase({}, { missingTables: ["meeting_polls", "meeting_poll_invitees", "hub_availability"] }));
  const sql = fixSql(results);
  const order = ["-- meeting_polls.sql", "-- meeting_polls_sender.sql", "-- meeting_polls_self_and_text.sql", "-- hub_availability.sql"].map((marker) => sql.indexOf(marker));
  assert.ok(order.every((n) => n >= 0), "all four are there");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "in order");
  assert.equal(sql.split("-- meeting_polls.sql").length, 2, "each file once");
});

test("an error that is not 'missing' is never reported as missing", async () => {
  const broken: any = { from: () => ({ select: () => ({ limit: async () => ({ data: null, error: { code: "57P03", message: "the database is starting up" } }) }) }) };
  const results = await checkSetup(broken);
  assert.ok(results.every((r) => r.state === "unknown"));
  assert.equal(fixSql(results), "");
  const thrown: any = { from: () => { throw new Error("network"); } };
  assert.ok((await checkSetup(thrown)).every((r) => r.state === "unknown"));
});

test("an answer is reused for a short while, unless a fresh look is asked for", async () => {
  const { call, db } = setup({}, { cacheMs: 60_000 });
  await call(owner);
  const first = db.log.length;
  await call(owner);
  assert.equal(db.log.length, first, "second call used the saved answer");
  await call(owner, { fresh: "1" });
  assert.ok(db.log.length > first, "'check again' looks again");
});

test("someone who can't use the Hub gets nothing", async () => {
  const { call } = setup({}, { allowed: false });
  const r = await call(teacher);
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { message: "no" });
});

test("the SQL built into the server is word for word what is in the migrations folder", () => {
  for (const [file, text] of Object.entries(SETUP_SQL)) {
    assert.equal(text, readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"), `${file} has changed: update server/hubSetupSql.ts to match`);
  }
  for (const item of SETUP_ITEMS) for (const file of item.files) assert.ok(SETUP_SQL[file], `${item.id} names ${file}, which is not built in`);
});

test("the link goes to this site's own Supabase project", () => {
  assert.equal(sqlEditorUrl("https://abcd1234.supabase.co"), "https://supabase.com/dashboard/project/abcd1234/sql/new");
  assert.equal(sqlEditorUrl(""), "https://supabase.com/dashboard/projects");
  assert.equal(sqlEditorUrl("not a url"), "https://supabase.com/dashboard/projects");
});
