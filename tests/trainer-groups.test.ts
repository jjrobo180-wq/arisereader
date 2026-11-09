// Arise Trainer groups (November 2026): group pages, group chat and challenges (like a 21-day sugar reset)
// with a leaderboard. Run with: npx tsx --test tests/trainer-groups.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit } from "../shared/fit";
import { CHALLENGE_TEMPLATES, canCheck, challengeState, cleanChallenge, standings, trainerOfGroup, newGroupId } from "../shared/coachGroups";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function fakeApp() {
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number | null, body: any = {}) => {
    const [pathOnly, qs] = path.split("?");
    for (const [k, h] of routes) {
      const [km, kp] = k.split(" "); if (km !== m) continue;
      const names: string[] = []; const re = new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "$");
      const hit = pathOnly.match(re); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(hit[i + 1])])), body, query: Object.fromEntries(new URLSearchParams(qs ?? "")), user: user ? { id: user } : null, headers: {} };
      let status = 200, out: any;
      const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; }
      return { status, body: out };
    }
    throw new Error(`no route ${m} ${path}`);
  };
  return { app, call };
}
const NOW = Date.parse("2026-11-10T15:00:00Z");
const setup = async () => {
  const store = createMemoryCoachStore(); const sent: any[] = []; const { app, call } = fakeApp();
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, kv: createMemoryKv(), now: () => NOW, fitData: async () => emptyFit(), nameOf: async (id) => ({ 7: "Mike", 101: "Vanessa", 102: "Jermaine", 103: "Ana", 104: "Sam" } as any)[id] ?? `User ${id}`, notify: async (u, m) => { sent.push([u, m.title, m.body]); }, inviteSecret: "test" });
  await call("PUT", "/api/coach/trainer/profile", 7, { profile: { name: "Coach Mike" } });
  const inv = (await call("GET", "/api/coach/trainer/invite", 7)).body;
  for (const c of [101, 102, 103]) await call("POST", `/api/coach/invite/${inv.code}/join`, c, { consent: {} });
  return { store, sent, call };
};

test("group ids carry the trainer, and challenge rules hold", () => {
  for (const t of [1, 7, 99999]) assert.equal(trainerOfGroup(newGroupId(t)), t);
  assert.equal(trainerOfGroup("g7"), null); assert.equal(trainerOfGroup("../x"), null);
  const sugar = CHALLENGE_TEMPLATES.find((t) => t.id === "sugar")!;
  const ch = cleanChallenge({ ...sugar, start: "2026-11-10" })!;
  assert.equal(ch.days, 21); assert.equal(ch.tasks.length, 4);
  assert.equal(challengeState(ch, "2026-11-09"), "upcoming"); assert.equal(challengeState(ch, "2026-11-30"), "live"); assert.equal(challengeState(ch, "2026-12-01"), "done");
  assert.ok(canCheck(ch, "2026-11-12", "2026-11-12")); assert.ok(canCheck(ch, "2026-11-11", "2026-11-12"));
  assert.ok(!canCheck(ch, "2026-11-10", "2026-11-12"), "two days back is too late");
  assert.ok(!canCheck(ch, "2026-11-13", "2026-11-12"), "no checking tomorrow");
  assert.equal(cleanChallenge({ name: "x", start: "2026-11-10", tasks: [] }), null);
  for (const t of CHALLENGE_TEMPLATES) assert.ok(cleanChallenge({ ...t, start: "2026-11-10" }), t.id);
  // Streaks: a perfect yesterday still counts while today is in progress.
  const all = ch.tasks.map((t) => t.id);
  ch.log = { "1": { "2026-11-10": all, "2026-11-11": all, "2026-11-12": [all[0]] }, "2": { "2026-11-10": [all[0]] } };
  const s = standings(ch, [1, 2, 3], "2026-11-12");
  assert.deepEqual(s.map((x) => [x.clientId, x.points, x.perfect, x.streak]), [[1, 15, 2, 2], [2, 3, 0, 0], [3, 0, 0, 0]]);
});

test("a trainer makes a group of their own clients; members post, like, comment and chat; outsiders can't see it", async () => {
  const { call, sent } = await setup();
  // Only active clients can be added (999 isn't a client).
  const g = (await call("POST", "/api/coach/trainer/groups", 7, { group: { name: "Morning crew", about: "6am club", members: [101, 102, 999] } })).body.group;
  assert.deepEqual(g.members, [101, 102]);
  assert.ok(sent.some(([u, t]) => u === 101 && t === "You're in Morning crew"));
  assert.equal((await call("POST", "/api/coach/trainer/groups", 7, { group: { name: "" } })).status, 400);

  // Members find it in Arise Fit; a client who isn't in it doesn't, and can't open it.
  assert.deepEqual((await call("GET", "/api/coach/groups", 101)).body.groups.map((x: any) => x.name), ["Morning crew"]);
  assert.equal((await call("GET", "/api/coach/groups", 103)).body.groups.length, 0);
  assert.equal((await call("GET", `/api/coach/groups/${g.id}`, 103)).status, 403);
  assert.equal((await call("GET", `/api/coach/groups/${g.id}`, 555)).status, 403);
  assert.equal((await call("GET", `/api/coach/groups/${g.id.replace(/.$/, "z")}`, 101)).status, 404);

  // Posts, likes, comments, pins.
  const p1 = (await call("POST", `/api/coach/groups/${g.id}/posts`, 7, { text: "Welcome! Introduce yourselves.", pinned: true })).body.post;
  assert.equal(p1.coach, true); assert.equal(p1.name, "Coach Mike"); assert.equal(p1.pinned, true);
  const p2 = (await call("POST", `/api/coach/groups/${g.id}/posts`, 101, { text: "Hi I'm Vanessa", pinned: true })).body.post;
  assert.equal(p2.pinned, false, "members can't pin");
  assert.equal((await call("POST", `/api/coach/groups/${g.id}/posts`, 101, { text: "", photo: "data:text/html;base64,AAAA" })).status, 400, "no fake photos");
  await call("POST", `/api/coach/groups/${g.id}/posts/${p2.id}/like`, 102);
  const liked = (await call("POST", `/api/coach/groups/${g.id}/posts/${p2.id}/like`, 7)).body;
  assert.deepEqual(liked.likes, [102, 7]);
  assert.deepEqual((await call("POST", `/api/coach/groups/${g.id}/posts/${p2.id}/like`, 7)).body.likes, [102], "a second tap un-likes");
  const cm = (await call("POST", `/api/coach/groups/${g.id}/posts/${p2.id}/comments`, 102, { text: "Welcome Vanessa!" })).body;
  assert.equal(cm.comments[0].name, "Jermaine");
  assert.deepEqual(sent.at(-1).slice(0, 2), [101, "Morning crew"], "the author hears about the comment");
  assert.equal((await call("PUT", `/api/coach/groups/${g.id}/posts/${p2.id}`, 102, { remove: true })).status, 403, "can't delete someone else's post");
  assert.equal((await call("PUT", `/api/coach/groups/${g.id}/posts/${p2.id}`, 102, { comment: cm.comments[0].id })).body.post.comments.length, 0, "own comment removed");
  const view = (await call("GET", `/api/coach/groups/${g.id}`, 102)).body;
  assert.deepEqual(view.posts.map((p: any) => p.id), [p1.id, p2.id], "pinned first");
  assert.deepEqual(view.group.members, [], "members don't get the member id list");
  assert.equal(view.memberCount, 2);

  // Coach-only posting.
  await call("PUT", `/api/coach/trainer/groups/${g.id}`, 7, { group: { memberPosts: false } });
  assert.equal((await call("POST", `/api/coach/groups/${g.id}/posts`, 101, { text: "hello" })).status, 403);
  assert.equal((await call("PUT", `/api/coach/trainer/groups/${g.id}`, 101, { group: { name: "Hacked" } })).status, 403);

  // Chat.
  await call("POST", `/api/coach/groups/${g.id}/chat`, 101, { text: "Who's in for Saturday?" });
  const m2 = (await call("POST", `/api/coach/groups/${g.id}/chat`, 7, { text: "Me!" })).body.msg;
  const chat = (await call("GET", `/api/coach/groups/${g.id}/chat`, 102)).body.chat;
  assert.deepEqual(chat.map((m: any) => m.name), ["Vanessa", "Coach Mike"]);
  assert.equal((await call("GET", `/api/coach/groups/${g.id}/chat?after=${encodeURIComponent(m2.at)}`, 102)).body.chat.length, 0);
  await call("PUT", `/api/coach/trainer/groups/${g.id}`, 7, { group: { chatOn: false } });
  assert.equal((await call("POST", `/api/coach/groups/${g.id}/chat`, 101, { text: "hi" })).status, 403);

  // Leaving, and losing access when coaching ends.
  assert.equal((await call("POST", `/api/coach/groups/${g.id}/leave`, 102)).body.ok, true);
  assert.equal((await call("GET", `/api/coach/groups/${g.id}`, 102)).status, 403);
  const home = (await call("GET", "/api/coach/trainer", 7)).body;
  const link = home.clients.find((c: any) => c.clientId === 101 || c.name === "Vanessa");
  await call("POST", `/api/coach/links/${link.id}/end`, 101);
  assert.equal((await call("GET", `/api/coach/groups/${g.id}`, 101)).status, 403, "ex-clients lose access");

  // Delete.
  assert.equal((await call("PUT", `/api/coach/trainer/groups/${g.id}`, 7, { remove: true })).body.ok, true);
  assert.equal((await call("GET", "/api/coach/trainer/groups", 7)).body.groups.length, 0);
});

test("a sugar reset challenge: members check off goals, the leaderboard ranks them, and the rules hold", async () => {
  const { call, sent } = await setup();
  const g = (await call("POST", "/api/coach/trainer/groups", 7, { group: { name: "Sugar squad", members: [101, 102, 103] } })).body.group;
  const sugar = CHALLENGE_TEMPLATES.find((t) => t.id === "sugar")!;
  assert.equal((await call("POST", `/api/coach/groups/${g.id}/challenges`, 7, { challenge: { ...sugar, start: "2026-11-01" } })).status, 400, "can't start in the past");
  assert.equal((await call("POST", `/api/coach/groups/${g.id}/challenges`, 101, { challenge: { ...sugar, start: "2026-11-10" } })).status, 403);
  const ch = (await call("POST", `/api/coach/groups/${g.id}/challenges`, 7, { challenge: { ...sugar, start: "2026-11-10", prize: "Free session" } })).body.challenge;
  assert.ok(sent.some(([u, t]) => u === 103 && t === "New challenge: 21-day sugar reset"));
  const [noSugar, water] = ch.tasks.map((t: any) => t.id);
  const check = (who: number, task: string, extra: any = {}) => call("POST", `/api/coach/groups/${g.id}/challenges/${ch.id}/check`, who, { task, ...extra });
  await check(101, noSugar); await check(101, water);
  const r = (await check(102, noSugar)).body;
  assert.deepEqual(r.board.map((b: any) => [b.name, b.points]), [["Vanessa", 4], ["Jermaine", 3], ["Ana", 0]]);
  assert.equal(r.board.find((b: any) => b.me).name, "Jermaine");
  // Un-check, bad task, wrong days, and the coach can't check for members.
  assert.equal((await check(101, water, { on: false })).body.board[0].points, 3);
  assert.equal((await check(101, "nope")).status, 400);
  assert.equal((await check(101, noSugar, { day: "2026-11-09" })).status, 400);
  assert.equal((await check(101, noSugar, { day: "2026-11-12" })).status, 400);
  assert.equal((await check(7, noSugar)).status, 403);
  // A member's own date can be a day off UTC (late evening in Hawaii).
  assert.equal((await check(103, noSugar, { today: "2026-11-11", day: "2026-11-11" })).status, 200);
  assert.equal((await check(103, noSugar, { today: "2026-11-14", day: "2026-11-14" })).status, 400, "a made-up date is ignored");
  // Members see only their own log; the coach sees everyone's.
  const mine = (await call("GET", `/api/coach/groups/${g.id}`, 101)).body.challenges[0];
  assert.deepEqual(Object.keys(mine.log), ["101"]);
  assert.equal(mine.state, "live"); assert.equal(mine.prize, "Free session");
  assert.equal(Object.keys((await call("GET", `/api/coach/groups/${g.id}`, 7)).body.challenges[0].log).length, 3);
  const list = (await call("GET", "/api/coach/trainer/groups", 7)).body.groups[0];
  assert.equal(list.live.name, "21-day sugar reset");
  assert.equal((await call("GET", "/api/coach/groups", 101)).body.groups[0].live, "21-day sugar reset");
});

test("groups are wired into Arise Trainer and Arise Fit", () => {
  assert.match(read("server/coach.ts"), /registerCoachGroupRoutes\(app, auth,/);
  assert.match(read("server/index.ts"), /"\/api\/coach\/groups", express\.json\(\{ limit: "1mb" \}\)/);
  const tr = read("client/src/pages/trainer/TrainerApp.tsx");
  assert.match(tr, /<TrainerGroups token=\{token\} clients=\{data\.clients\}/);
  assert.match(tr, /testId="tr-make-group"/, "selected clients can become a group");
  const fit = read("client/src/pages/fit/FitCoach.tsx");
  assert.match(fit, /\{ id: "groups", label: "Groups" \}/);
  assert.match(fit, /<MyGroups token=\{token\} trainerId=\{t\.id\}/);
  const ui = read("client/src/pages/coach/Groups.tsx");
  for (const t of ["group-composer", "group-like", "group-comment", "group-chat-send", "challenge-task", "challenge-board", "challenge-new", "Forgot yesterday?"]) assert.ok(ui.includes(t), t);
});
