// Arise Notes: the checks the build spec asks for.
//   Minutes:  charged per recording and rounded up, blocked at 0 with the spec's message, rollover,
//             warnings at 80% and 100%, and the 3,000-minute monthly safety cap.
//   Privacy:  nobody can open, change, delete or add to someone else's note (it's "not found").
//   Billing:  Stripe's messages for the four Notes plans turn the right plan on and off, and
//             checkout asks Stripe for the right price.
//   Splitter: uploads are cut on the device into pieces with the right times.
// Run with: npx tsx --test tests/arise-notes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import express from "express";
import {
  DEFAULT_SETTINGS, NOTES_HARD_CAP, NOTES_PLANS, allows, chargeFor, minutesFor, newAccount, outOfMinutesText, rollAccount, transcribeCheck, usageView, warningDue,
  type NotesPlanId,
} from "../shared/ariseNotes";
import { registerAriseNotesRoutes } from "../server/ariseNotes";
import { createMemoryNotesStore, type AccountRow } from "../server/ariseNotesStore";
import type { Hearer } from "../server/ariseNotesAi";
import { registerPlanRoutes } from "../server/plans";
import { planUpload, readWav, wavBytes } from "../client/src/components/arise-notes/audioSplit";

const NOW = Date.parse("2026-11-15T18:00:00Z");
const DAY = 86_400_000;

// ─── Minutes: the rules ───────────────────────────────────────────────────────

test("the plans have the spec's minutes", () => {
  assert.deepEqual(
    Object.values(NOTES_PLANS).map((p) => [p.id, p.minutes, p.rollover, p.speakers]),
    [["free", 60, false, false], ["basic", 600, false, false], ["plus", 1500, true, true], ["family", 2000, true, true]],
  );
  assert.equal(NOTES_HARD_CAP, 3000);
  assert.equal(allows("free", "export"), false, "Free is summaries only");
  assert.equal(allows("basic", "export"), true);
  assert.equal(allows("basic", "speakers"), false, "speaker labels are Plus");
  assert.equal(allows("family", "iep"), true);
});

test("a recording's minutes are rounded up, once per recording", () => {
  assert.deepEqual([0, 1, 59, 60, 61, 119, 120, 3600].map(minutesFor), [0, 1, 1, 1, 2, 2, 2, 60]);
  // Three 30-second pieces are 90 seconds: 2 minutes, not 3.
  let secs = 0, minutes = 0, paid = 0;
  for (const piece of [30, 30, 30]) {
    const c = chargeFor(secs, minutes, piece);
    secs = c.secs; minutes = c.minutes; paid += c.delta;
  }
  assert.deepEqual([secs, minutes, paid], [90, 2, 2]);
});

test("at 0 minutes left, writing down stops with the spec's message", () => {
  const acct = { ...newAccount(2, NOW), used: 600, own: 600 };
  const u = usageView(acct, acct, "basic");
  assert.equal(u.left, 0);
  assert.equal(u.resetOn, "2026-12-01");
  const check = transcribeCheck(u, 60, NOW);
  assert.deepEqual(check, { ok: false, reason: "minutes", message: "Out of minutes: upgrade or wait until Dec 1." });
  assert.equal(outOfMinutesText("2027-01-01", NOW), "Out of minutes: upgrade or wait until Jan 1, 2027.");
  assert.equal(transcribeCheck({ ...u, used: 599, left: 1 }, 60, NOW).ok, true, "one minute left is enough for a piece");
});

test("rollover: Plus carries up to a month's minutes; Basic carries none", () => {
  const oct = Date.parse("2026-10-20T12:00:00Z");
  const plusOct = { ...newAccount(3, oct), used: 1000, own: 1000 };
  const plusNov = rollAccount(plusOct, NOTES_PLANS.plus, NOW);
  assert.deepEqual([plusNov.period, plusNov.used, plusNov.own, plusNov.rollover], ["2026-11-01", 0, 0, 500]);
  assert.equal(usageView(plusNov, plusNov, "plus").allowance, 2000);

  const unused = rollAccount({ ...newAccount(3, oct), rollover: 1500 }, NOTES_PLANS.plus, NOW);
  assert.equal(unused.rollover, 1500, "never more than one month's worth");
  const gap = rollAccount({ ...newAccount(3, Date.parse("2026-08-10T12:00:00Z")), used: 1500 }, NOTES_PLANS.plus, NOW);
  assert.equal(gap.rollover, 1500, "a month that went by unused counts as fully left over");

  assert.equal(rollAccount({ ...newAccount(4, oct), used: 100 }, NOTES_PLANS.basic, NOW).rollover, 0);
  const same = newAccount(5, NOW);
  assert.equal(rollAccount(same, NOTES_PLANS.plus, NOW), same, "the same month is left alone");
  assert.equal(usageView({ ...same, rollover: 900 }, same, "basic").rollover, 0, "rollover only counts on a plan that has it");
});

test("warnings go out once at 80% and once at 100%", () => {
  assert.equal(warningDue(479, 600, 0), 0);
  assert.equal(warningDue(480, 600, 0), 80);
  assert.equal(warningDue(500, 600, 80), 0, "80% is not sent twice");
  assert.equal(warningDue(600, 600, 80), 100);
  assert.equal(warningDue(650, 600, 100), 0);
});

test("the 3,000-minute safety cap stops one person even when minutes are left", () => {
  const pool = { ...newAccount(5, NOW), used: 100 };
  const me = { ...newAccount(6, NOW), own: 2995 };
  const u = usageView(pool, me, "family", true);
  assert.deepEqual([u.allowance - u.used, u.capLeft, u.left], [1900, 5, 5]);
  const check = transcribeCheck(u, 6 * 60, NOW);
  assert.equal(check.ok, false);
  assert.equal(!check.ok && check.reason, "cap");
  assert.match(!check.ok ? check.message : "", /safety limit of 3,000 minutes\. It starts again on Dec 1\./);
});

// ─── Minutes and privacy over HTTP ────────────────────────────────────────────

const USERS: Record<number, any> = {
  2: { id: 2, displayName: "Basic Bea", role: "parent", email: null },
  3: { id: 3, displayName: "Other Otto", role: "parent", email: null },
  4: { id: 4, displayName: "Plus Pat", role: "teacher", email: null },
  5: { id: 5, displayName: "Family Owner", role: "parent", email: null },
  6: { id: 6, displayName: "Family Member", role: "parent", email: null },
};
const PLAN: Record<number, NotesPlanId> = { 2: "basic", 3: "basic", 4: "plus", 5: "family", 6: "free" };

async function notesServer(t: any) {
  const store = createMemoryNotesStore(() => NOW);
  const heard = { duration: 0, calls: 0 };
  const hear: Hearer = {
    async hear() { heard.calls++; return { lines: [{ start: 0, end: heard.duration, text: "We agreed to meet again on Friday.", speaker: null }], duration: heard.duration, provider: "test", diarized: false }; },
    available: () => true,
    speakersAvailable: () => false,
  };
  const app = express();
  app.use(/^\/api\/notes\/[^/]+\/pieces$/, express.raw({ type: "*/*", limit: "26mb" }));
  app.use(express.json());
  const auth = (req: any, _res: any, next: any) => { const u = USERS[Number(req.headers["x-user"])]; if (u) req.user = u; next(); };
  registerAriseNotesRoutes(app, auth, {
    store, hear,
    ask: async () => ({ json: {}, chars: 0 }),
    aiReady: () => true,
    planOf: async (id) => PLAN[id] ?? "free",
    getUser: async (id) => USERS[id] ?? null,
    now: () => NOW,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = async (user: number | null, method: string, path: string, body?: any) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(user ? { "x-user": String(user) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  const piece = async (user: number, noteId: string, idx: number, start: number, secs: number) => {
    heard.duration = secs;
    const res = await fetch(`${base}/api/notes/${noteId}/pieces?idx=${idx}&start=${start}&secs=${secs}&ext=webm`, { method: "POST", headers: { "Content-Type": "audio/webm", "x-user": String(user) }, body: Buffer.from("fake audio bytes") });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  const seed = (a: Partial<AccountRow> & { userId: number }) => store.saveAccount({ period: "2026-11-01", used: 0, own: 0, rollover: 0, warned: 0, settings: { ...DEFAULT_SETTINGS }, familyCode: null, ...a });
  return { store, heard, call, piece, seed };
}

test("minutes are charged per recording, rounded up, and never twice for the same piece", async (t) => {
  const { call, piece, store } = await notesServer(t);
  const made = await call(2, "POST", "/api/notes", { title: "Team meeting" });
  assert.equal(made.status, 201);
  const id = made.body.note.id;

  const first = await piece(2, id, 0, 0, 90);
  assert.equal(first.status, 200);
  assert.deepEqual([first.body.minutes, first.body.usage.used, first.body.usage.left], [2, 2, 598], "90 seconds is 2 minutes");
  const second = await piece(2, id, 1, 90, 20);
  assert.deepEqual([second.body.minutes, second.body.usage.used], [0, 2], "110 seconds is still 2 minutes: rounded per recording, not per piece");
  const again = await piece(2, id, 0, 0, 90);
  assert.deepEqual([again.status, again.body.repeat, again.body.minutes], [200, true, 0], "a piece sent twice is charged once");

  const note = (await call(2, "GET", `/api/notes/${id}`)).body.note;
  assert.deepEqual([note.chargedMinutes, note.chargedSecs], [2, 110]);
  assert.equal((await call(2, "GET", "/api/notes/me")).body.usage.used, 2);
  assert.equal(store._usage.reduce((s, u) => s + u.minutes, 0), 2, "the usage log adds up to what was charged");
  assert.equal(store._audio.size, 0, "audio is deleted once it's written down (the default)");
});

test("out of minutes: a new recording is refused with the spec's message, and audio sent anyway is kept for later", async (t) => {
  const { call, piece, seed, store, heard } = await notesServer(t);
  await seed({ userId: 2, used: 600, own: 600, warned: 100 });
  const refused = await call(2, "POST", "/api/notes", { title: "Too late" });
  assert.equal(refused.status, 402);
  assert.equal(refused.body.message, "Out of minutes: upgrade or wait until Dec 1.");
  assert.equal(refused.body.canSave, true);

  const saved = await call(2, "POST", "/api/notes", { title: "Save it", saveOnly: true });
  assert.equal(saved.status, 201);
  const id = saved.body.note.id;
  const p = await piece(2, id, 0, 0, 60);
  assert.equal(p.status, 402);
  assert.deepEqual([p.body.code, p.body.message], ["minutes", "Out of minutes: upgrade or wait until Dec 1."]);
  assert.equal(heard.calls, 0, "nothing is sent to speech-to-text");
  assert.equal(store._audio.size, 1, "the audio is saved so it can be written down later");
  const note = (await call(2, "GET", `/api/notes/${id}`)).body.note;
  assert.deepEqual([note.status, note.chargedMinutes], ["no_minutes", 0]);
  assert.equal((await call(2, "GET", "/api/notes/me")).body.usage.used, 600, "nothing more was charged");
});

test("the 3,000-minute cap applies to each person on a Family plan, over HTTP", async (t) => {
  const { call, piece, seed, store, heard } = await notesServer(t);
  await store.addFamilyMember(6, 5);
  await seed({ userId: 5, used: 100 });
  await seed({ userId: 6, own: 2995 });
  const me = (await call(6, "GET", "/api/notes/me")).body;
  assert.deepEqual([me.plan, me.usage.pooled, me.usage.left, me.usage.capLeft], ["family", true, 5, 5]);
  const id = (await call(6, "POST", "/api/notes", { title: "Long one" })).body.note.id;
  const p = await piece(6, id, 0, 0, 6 * 60);
  assert.equal(p.status, 402);
  assert.equal(p.body.code, "cap");
  assert.match(p.body.message, /3,000 minutes/);
  assert.equal(heard.calls, 0);

  // The family's owner, with their own minutes well under the cap, still records from the same pool.
  const ownerNote = (await call(5, "POST", "/api/notes", { title: "Owner" })).body.note.id;
  const ok = await piece(5, ownerNote, 0, 0, 60);
  assert.deepEqual([ok.status, ok.body.usage.used], [200, 101]);
});

test("one person can't read, change, delete or add to another person's note", async (t) => {
  const { call, piece, heard } = await notesServer(t);
  const id = (await call(2, "POST", "/api/notes", { title: "Private IEP meeting" })).body.note.id;
  await piece(2, id, 0, 0, 30);
  heard.calls = 0;

  const notFound = "That note isn't here. It may have been deleted.";
  const tries = [
    await call(3, "GET", `/api/notes/${id}`),
    await call(3, "PATCH", `/api/notes/${id}`, { title: "Mine now" }),
    await call(3, "DELETE", `/api/notes/${id}`),
    await call(3, "POST", `/api/notes/${id}/summary`, {}),
    await call(3, "POST", `/api/notes/${id}/share`, { on: true }),
    await piece(3, id, 1, 30, 30),
  ];
  for (const r of tries) assert.deepEqual([r.status, r.body.message], [404, notFound]);
  assert.equal(heard.calls, 0, "another person's audio is never written down into it");
  assert.equal((await call(3, "GET", "/api/notes")).body.notes?.length ?? 0, 0, "it isn't in their list");
  assert.equal((await call(3, "GET", "/api/notes/me")).body.usage.used, 0, "and they weren't charged");

  const mine = (await call(2, "GET", `/api/notes/${id}`)).body.note;
  assert.deepEqual([mine.title, mine.mine], ["Private IEP meeting", true], "the owner's note is untouched");
  assert.equal((await call(null, "GET", `/api/notes/${id}`)).status, 403, "signed out: nothing");
});

// ─── Billing ──────────────────────────────────────────────────────────────────

const WHSEC = "whsec_notestestsecret12345";
const BUYERS: Record<number, any> = {
  1: { id: 1, displayName: "Admin", role: "student", isAdmin: true },
  80: { id: 80, displayName: "Parent", role: "parent", email: "parent@example.com" },
  81: { id: 81, displayName: "Teacher", role: "teacher", email: "t@example.org" },
  11: { id: 11, displayName: "Kid", role: "student" },
};

async function billingServer(t: any, stripeKey = "") {
  const settings = new Map<string, string>([["plans_enforced", "1"]]);
  const calls: { method: string; url: string; form: URLSearchParams }[] = [];
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); } }));
  const auth = (req: any, res: any, next: any) => {
    const u = BUYERS[Number(String(req.headers.authorization || "").replace("Bearer ", ""))];
    if (!u) return res.status(401).json({ message: "Not authenticated" });
    req.user = u; next();
  };
  const admin = (req: any, res: any, next: any) => (req.user?.isAdmin ? next() : res.status(403).json({ message: "Admin access required" }));
  const plans = registerPlanRoutes(app, auth, admin, {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    readSetting: async (k) => settings.get(k) ?? "",
    userForToken: async (tok) => BUYERS[Number(tok)] ?? null,
    getUser: async (id) => BUYERS[id] ?? null,
    countTeacherStudents: async () => 0,
    countSchoolStudents: async () => 0,
    schoolName: async () => "",
    envStripeKey: () => stripeKey,
    envWebhookSecret: () => WHSEC,
    now: () => NOW,
    fetch: (async (url: any, init: any) => {
      const c = { method: init?.method || "GET", url: String(url), form: new URLSearchParams(init?.body || "") };
      calls.push(c);
      const out = c.url.includes("/checkout/sessions") && c.method === "POST" ? { id: "cs_test_notes12345", url: "https://checkout.stripe.com/c/pay/cs_test_notes12345" } : {};
      return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = async (user: number | null, method: string, path: string, body?: any, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", ...(user ? { Authorization: `Bearer ${user}` } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  const hook = (type: string, object: any) => {
    const payload = JSON.stringify({ id: `evt_${type}`, type, created: Math.floor(NOW / 1000), data: { object } });
    const time = Math.floor(NOW / 1000);
    const sig = createHmac("sha256", WHSEC).update(`${time}.${payload}`).digest("hex");
    return call(null, "POST", "/api/billing/webhook", payload, { "Stripe-Signature": `t=${time},v1=${sig}` });
  };
  return { call, hook, plans, calls };
}

const notesSub = (kind: string, ownerId: number, over: any = {}) => ({
  id: `sub_${kind}_${ownerId}`, customer: `cus_${ownerId}`, status: "active", current_period_end: Math.floor((NOW + 30 * DAY) / 1000),
  metadata: { kind, ownerId: String(ownerId), buyerId: String(ownerId) },
  items: { data: [{ id: `si_${ownerId}`, quantity: 1 }] }, ...over,
});

test("Stripe's messages turn each Notes plan on and off", async (t) => {
  const { call, hook, plans } = await billingServer(t);
  assert.equal((await call(80, "GET", "/api/notes/billing")).body.plan, "free");

  const cases: [string, NotesPlanId, string][] = [["notes_basic", "basic", "basic"], ["notes_plus", "plus", "plus"], ["notes_plus_year", "plus", "plus_year"], ["notes_family", "family", "family"]];
  for (const [kind, plan, product] of cases) {
    const owner = 80;
    assert.equal((await hook("customer.subscription.created", notesSub(kind, owner))).status, 200, kind);
    const b = (await call(owner, "GET", "/api/notes/billing")).body;
    assert.deepEqual([b.plan, b.product, b.paidOnline], [plan, product, true], kind);
    assert.equal((await plans.notesPlan(owner)).plan, plan, `${kind}: the plan the Notes routes see`);
    assert.equal((await hook("customer.subscription.deleted", notesSub(kind, owner, { status: "canceled", current_period_end: Math.floor((NOW - DAY) / 1000) }))).status, 200);
    assert.equal((await call(owner, "GET", "/api/notes/billing")).body.plan, "free", `${kind} ended`);
  }
  assert.equal((await plans.notesPlan(1, BUYERS[1])).plan, "plus", "the admin always has Plus");
});

test("Notes checkout asks Stripe for the right price, and only for an account that may buy", async (t) => {
  const { call, calls } = await billingServer(t, "sk_test_notes");
  const out = await call(81, "POST", "/api/notes/billing/checkout", { product: "plus_year" });
  assert.equal(out.status, 200);
  assert.match(out.body.url, /^https:\/\/checkout\.stripe\.com\//);
  const made = calls.find((c) => c.method === "POST" && c.url.includes("/checkout/sessions"));
  assert.ok(made, "a checkout page was made");
  assert.equal(made!.form.get("mode"), "subscription");
  assert.equal(made!.form.get("line_items[0][price_data][unit_amount]"), "7999");
  assert.equal(made!.form.get("line_items[0][price_data][recurring][interval]"), "year");
  assert.equal(made!.form.get("metadata[kind]"), "notes_plus_year");
  assert.equal(made!.form.get("subscription_data[metadata][ownerId]"), "81");

  assert.equal((await call(81, "POST", "/api/notes/billing/checkout", { product: "gold" })).status, 400);
  assert.equal((await call(11, "POST", "/api/notes/billing/checkout", { product: "basic" })).status, 403, "a student asks a parent or teacher");
  assert.equal((await call(1, "POST", "/api/notes/billing/checkout", { product: "basic" })).status, 409, "the admin already has Plus");
});

// ─── Splitting an upload on the device ────────────────────────────────────────

const PIECE = { pieceSecs: 300, maxBytes: 24 * 1024 * 1024 };

test("an MP3 is cut between frames into pieces with the right start times", async () => {
  // MPEG-1 Layer III, 128 kbps, 44.1 kHz: 417-byte frames of 1152 samples.
  const frameLen = 417, frameSecs = 1152 / 44100;
  const frames = Math.ceil(720 / frameSecs); // 12 minutes
  const bytes = new Uint8Array(frames * frameLen);
  for (let f = 0; f < frames; f++) bytes.set([0xff, 0xfb, 0x90, 0x00], f * frameLen);
  const plan = await planUpload(new Blob([bytes], { type: "audio/mpeg" }), { ...PIECE, name: "class.mp3" });
  assert.equal(plan.kind, "mp3");
  assert.equal(plan.count, 3, "12 minutes in 5-minute pieces");
  assert.ok(Math.abs(plan.total - frames * frameSecs) < 0.01, `total ${plan.total}`);
  let next = 0, sum = 0, count = 0;
  for await (const p of plan.pieces()) {
    assert.equal(p.ext, "mp3");
    assert.ok(Math.abs(p.start - next) < 0.01, `piece ${count} starts where the last ended`);
    assert.ok(p.secs <= PIECE.pieceSecs + frameSecs + 0.01, "no piece runs more than a frame past 5 minutes");
    assert.equal(p.blob.size % frameLen, 0, "cut between whole frames");
    const head = new Uint8Array(await p.blob.slice(0, 2).arrayBuffer());
    assert.deepEqual([...head], [0xff, 0xfb], "each piece starts on a frame");
    next = p.start + p.secs; sum += p.secs; count++;
  }
  assert.equal(count, 3);
  assert.ok(Math.abs(sum - plan.total) < 0.05);
});

test("a WAV is cut into 16 kHz mono WAV pieces with the right times; a short one is sent whole", async () => {
  const rate = 8000, secs = 700;
  const long = wavBytes(new Int16Array(rate * secs), rate);
  const plan = await planUpload(new Blob([long as BlobPart], { type: "audio/wav" }), { ...PIECE, name: "meeting.wav" });
  assert.deepEqual([plan.kind, plan.count, plan.total], ["wav", 3, 700]);
  const got: [number, number, number][] = [];
  for await (const p of plan.pieces()) {
    const w = await readWav(p.blob);
    assert.ok(w, "each piece is a WAV file");
    assert.deepEqual([w!.rate, w!.channels, w!.bits], [16000, 1, 16]);
    got.push([p.start, p.secs, Math.round(w!.dataLen / 32000)]);
  }
  assert.deepEqual(got, [[0, 300, 300], [300, 300, 300], [600, 100, 100]]);

  const short = wavBytes(new Int16Array(rate * 20), rate);
  const one = await planUpload(new Blob([short as BlobPart], { type: "audio/wav" }), { ...PIECE, name: "memo.wav" });
  assert.deepEqual([one.kind, one.count, one.total], ["whole", 1, 20]);
});
