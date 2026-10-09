// Run with: npx tsx --test tests/arise-social.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createMemorySocialStore, registerAriseSocialRoutes, studentName, type SocialUser } from "../server/ariseSocial";
import { awardXp, bandForGrade, cleanPostText, emptyProfile, QUESTS } from "../shared/ariseSocial";

const people: Record<number, SocialUser & { grade?: string }> = {
  1: { id: 1, role: "teacher", displayName: "Ms. Rivera", teacherId: null, schoolId: 10, approvedByTeacher: true, archived: false },
  2: { id: 2, role: "teacher", displayName: "Mr. Delgado", teacherId: null, schoolId: 10, approvedByTeacher: true, archived: false },
  3: { id: 3, role: "teacher", displayName: "Mrs. Park", teacherId: null, schoolId: 20, approvedByTeacher: true, archived: false },
  11: { id: 11, role: "student", displayName: "Jaylen Williams", teacherId: 1, schoolId: 10, approvedByTeacher: true, archived: false, grade: "7" },
  12: { id: 12, role: "student", displayName: "Destiny Adams", teacherId: 1, schoolId: 10, approvedByTeacher: true, archived: false, grade: "7" },
  13: { id: 13, role: "student", displayName: "Kenji Lee", teacherId: 2, schoolId: 10, approvedByTeacher: true, archived: false, grade: "8" },
  14: { id: 14, role: "student", displayName: "Sam Park", teacherId: 3, schoolId: 20, approvedByTeacher: true, archived: false, grade: "7" },
  15: { id: 15, role: "student", displayName: "New Kid", teacherId: 1, schoolId: 10, approvedByTeacher: false, archived: false, grade: "7" },
  16: { id: 16, role: "student", displayName: "Ava Moore", teacherId: 1, schoolId: 10, approvedByTeacher: true, archived: false, grade: "1" },
  21: { id: 21, role: "parent", displayName: "Dana Moore", teacherId: null, schoolId: null, approvedByTeacher: true, archived: false },
};
const links: Record<number, number[]> = { 21: [16] };

function setup(opts: { paid?: number[] } = {}) {
  const routes: Record<string, Function> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers[handlers.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  let clock = Date.parse("2026-10-08T18:00:00Z");
  const notes: { id: number; body: string }[] = [];
  const store = createMemorySocialStore(() => clock);
  registerAriseSocialRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    store, now: () => clock, random: () => 0,
    ...(opts.paid ? { access: { self: async (req: any) => opts.paid!.includes(Number(req.user?.id)), user: async (id: number) => opts.paid!.includes(id) } } : {}),
    directory: {
      user: async (id) => people[id] ?? null,
      gradeOf: async (id) => people[id]?.grade ?? null,
      studentsOf: async (t) => Object.values(people).filter((p) => p.role === "student" && p.teacherId === t && p.approvedByTeacher),
      childrenOf: async (p) => links[p] ?? [],
      parentsOf: async (s) => Object.entries(links).filter(([, kids]) => kids.includes(s)).map(([p]) => Number(p)),
      notify: async (id, m) => { notes.push({ id, body: m.body }); },
    },
  });
  const as = (userId: number) => async (key: string, req: any = {}) => {
    let code = 200; let payload: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { payload = d; return res; } };
    const u = people[userId];
    await routes[key]({ body: {}, params: {}, headers: {}, ...req, user: { id: u.id, displayName: u.displayName, role: u.role, teacherId: u.teacherId, school_id: u.schoolId, approvedByTeacher: u.approvedByTeacher } }, res);
    return { code, body: payload };
  };
  return { as, routes, notes, tick: (ms: number) => { clock += ms; } };
}

test("a student's post stays private until their own teacher approves it, then only their class sees it", async () => {
  const t = setup();
  const jaylen = t.as(11), destiny = t.as(12), kenji = t.as(13), rivera = t.as(1), delgado = t.as(2);
  const made = await jaylen("POST /api/social/posts", { body: { text: "Fixed our wobbly table!" } });
  assert.equal(made.code, 201);
  assert.equal(made.body.post.status, "pending");
  assert.equal(made.body.post.author, "Jaylen W.");
  assert.deepEqual(t.notes.map((n) => n.id), [1]);

  assert.equal((await destiny("GET /api/social/feed")).body.posts.length, 0);
  assert.equal((await jaylen("GET /api/social/feed")).body.posts[0].status, "pending");
  assert.equal((await delgado("GET /api/social/approvals")).body.posts.length, 0);
  assert.equal((await delgado("POST /api/social/posts/:id/review", { params: { id: made.body.post.id }, body: { decision: "approve" } })).code, 404);

  const queue = await rivera("GET /api/social/approvals");
  assert.equal(queue.body.posts.length, 1);
  assert.equal((await rivera("POST /api/social/posts/:id/review", { params: { id: made.body.post.id }, body: { decision: "approve" } })).code, 200);

  assert.equal((await destiny("GET /api/social/feed")).body.posts.length, 1);
  assert.equal((await kenji("GET /api/social/feed")).body.posts.length, 0, "another class in the same school does not see class posts");
});

test("a teacher's post is live at once; school-wide posts reach the whole school only", async () => {
  const t = setup();
  const r = await t.as(1)("POST /api/social/posts", { body: { text: "Career day is Friday!", scope: "school" } });
  assert.equal(r.body.post.status, "approved");
  assert.equal((await t.as(13)("GET /api/social/feed")).body.posts.length, 1);
  assert.equal((await t.as(14)("GET /api/social/feed")).body.posts.length, 0, "a different school");
});

test("students without an approved class can explore but not post", async () => {
  const t = setup();
  const r = await t.as(15)("POST /api/social/posts", { body: { text: "hi" } });
  assert.equal(r.code, 403);
  const me = await t.as(15)("GET /api/social/me");
  assert.equal(me.body.user.canPost, false);
  assert.match(me.body.user.postBlock, /approves your account/);
  assert.equal((await t.as(21)("POST /api/social/posts", { body: { text: "hi" } })).code, 403, "parents don't post");
});

test("K–5 posts are built from the fixed choices; typed text is ignored", async () => {
  const t = setup();
  const ava = t.as(16);
  assert.equal((await ava("POST /api/social/posts", { body: { text: "my address is..." } })).code, 400);
  const r = await ava("POST /api/social/posts", { body: { text: "my address is...", starter: 0, careerId: "nurse" } });
  assert.equal(r.code, 201);
  assert.equal(r.body.post.body, "I want to be a registered nurse!");
});

test("reactions only work on posts the person can see", async () => {
  const t = setup();
  const p = (await t.as(1)("POST /api/social/posts", { body: { text: "Hello class" } })).body.post;
  assert.equal((await t.as(14)("POST /api/social/posts/:id/react", { params: { id: p.id }, body: { kind: "big" } })).code, 404);
  const r = await t.as(12)("POST /api/social/posts/:id/react", { params: { id: p.id }, body: { kind: "big" } });
  assert.equal(r.body.post.reactions.big, 1);
  assert.equal(r.body.post.myReaction, "big");
  const off = await t.as(12)("POST /api/social/posts/:id/react", { params: { id: p.id }, body: { kind: null } });
  assert.equal(off.body.post.reactions.big, 0);
});

test("quests need every step, give XP once, and must be in the student's grade band", async () => {
  const t = setup();
  const j = t.as(11);
  const q = QUESTS.g68[0];
  assert.equal((await j("POST /api/social/quests/:id/complete", { params: { id: q.id } })).code, 400);
  assert.equal((await j("POST /api/social/quests/:id/step", { params: { id: QUESTS.g912[0].id }, body: { step: 0 } })).code, 400);
  for (let i = 0; i < q.steps.length; i++) await j("POST /api/social/quests/:id/step", { params: { id: q.id }, body: { step: i } });
  const done = await j("POST /api/social/quests/:id/complete", { params: { id: q.id } });
  assert.equal(done.body.profile.xp, q.xp);
  assert.equal(done.body.profile.streak, 1);
  const again = await j("POST /api/social/quests/:id/complete", { params: { id: q.id } });
  assert.equal(again.body.profile.xp, q.xp);
  const shared = await j("POST /api/social/posts", { body: { questId: q.id } });
  assert.equal(shared.code, 201);
  assert.equal(shared.body.post.quest.title, q.title);
});

test("collecting a career and the daily spin each pay out once", async () => {
  const t = setup();
  const j = t.as(11);
  await j("POST /api/social/collect", { body: { careerId: "plumber" } });
  const twice = await j("POST /api/social/collect", { body: { careerId: "plumber" } });
  assert.equal(twice.body.profile.xp, 10);
  const s1 = await j("POST /api/social/spin");
  const s2 = await j("POST /api/social/spin");
  assert.equal(s1.body.career, s2.body.career);
  assert.equal(s2.body.already, true);
  assert.equal(s2.body.profile.xp, 20);
  t.tick(24 * 3600_000);
  const s3 = await j("POST /api/social/spin");
  assert.equal(s3.body.profile.xp, 30);
  assert.equal(s3.body.profile.streak, 2);
});

test("a K–5 RSVP waits for a parent; parents only manage their own child", async () => {
  const t = setup();
  const ev = await t.as(1)("POST /api/social/events", { body: { title: "Build-a-Birdhouse", date: "2026-10-16", cluster: "build", format: "In class", seats: 2 } });
  assert.equal(ev.code, 201);
  const id = ev.body.event.id;
  const req = await t.as(16)("POST /api/social/events/:id/rsvp", { params: { id }, body: { action: "join" } });
  assert.equal(req.body.event.myStatus, "requested");
  assert.deepEqual(t.notes.filter((n) => n.id === 21).length, 1);
  assert.equal((await t.as(21)("POST /api/social/events/:id/rsvp", { params: { id }, body: { action: "approve", studentId: 11 } })).code, 404);
  const ok = await t.as(21)("POST /api/social/events/:id/rsvp", { params: { id }, body: { action: "approve", studentId: 16 } });
  assert.equal(ok.body.event.myStatus, "going");
  const kids = await t.as(21)("GET /api/social/children");
  assert.equal(kids.body.children[0].events[0].status, "going");
  assert.equal((await t.as(21)("PUT /api/social/children/:id/settings", { params: { id: 11 }, body: { postScope: "school" } })).code, 404);
  assert.equal((await t.as(21)("PUT /api/social/children/:id/settings", { params: { id: 16 }, body: { postScope: "school" } })).code, 200);
  // Seats: Jaylen joins (2 of 2), then the event is full for Destiny.
  await t.as(11)("POST /api/social/events/:id/rsvp", { params: { id }, body: { action: "join" } });
  assert.equal((await t.as(12)("POST /api/social/events/:id/rsvp", { params: { id }, body: { action: "join" } })).code, 409);
  // Another school's student can't see or join it.
  assert.equal((await t.as(14)("POST /api/social/events/:id/rsvp", { params: { id }, body: { action: "join" } })).code, 404);
});

test("events can't be set in the past and only teachers host", async () => {
  const t = setup();
  assert.equal((await t.as(1)("POST /api/social/events", { body: { title: "Old", date: "2026-01-01" } })).code, 400);
  assert.equal((await t.as(11)("POST /api/social/events", { body: { title: "Mine", date: "2026-12-01" } })).code, 403);
});

test("the teacher's class view counts real progress", async () => {
  const t = setup();
  await t.as(11)("POST /api/social/collect", { body: { careerId: "plumber" } });
  await t.as(12)("POST /api/social/collect", { body: { careerId: "electrician" } });
  const c = await t.as(1)("GET /api/social/class");
  assert.equal(c.body.totals.students, 3);
  assert.equal(c.body.totals.activeWeek, 2);
  assert.equal(c.body.clusters.build, 2);
});

test("helpers", () => {
  assert.equal(studentName("Jaylen  Williams"), "Jaylen W.");
  assert.equal(studentName("Cher"), "Cher");
  assert.equal(bandForGrade("K"), "k2");
  assert.equal(bandForGrade("4th"), "g35");
  assert.equal(bandForGrade("11"), "g912");
  assert.equal(bandForGrade(""), "g68");
  assert.equal(cleanPostText("  hi\u0007 there  "), "hi there");
  const p = awardXp(awardXp(emptyProfile(), 10, "2026-10-07"), 5, "2026-10-08");
  assert.equal(p.streak, 2);
  assert.equal(awardXp(p, 5, "2026-10-10").streak, 1);
});

test("without the add-on, everything but the catalog and \"who am I\" is locked", async () => {
  const t = setup({ paid: [1, 11] });
  const me = await t.as(12)("GET /api/social/me");
  assert.equal(me.body.access, false);
  for (const key of ["GET /api/social/feed", "POST /api/social/collect", "GET /api/social/events", "POST /api/social/posts"]) {
    const r = await t.as(12)(key, { body: { careerId: "plumber", text: "hi" } });
    assert.equal(r.code, 402, key);
    assert.equal(r.body.code, "social_required");
  }
  assert.equal((await t.as(11)("GET /api/social/feed")).code, 200);
  assert.equal((await t.as(11)("GET /api/social/me")).body.access, true);
});

test("a student whose teacher hasn't added Arise Social can't post, since nobody could approve it", async () => {
  const t = setup({ paid: [1, 11, 13] });
  const me = await t.as(11)("GET /api/social/me");
  assert.equal(me.body.user.canPost, true);
  const kenji = await t.as(13)("GET /api/social/me");
  assert.equal(kenji.body.user.canPost, false);
  assert.match(kenji.body.user.postBlock, /teacher hasn’t added Arise Social/);
  assert.equal((await t.as(13)("POST /api/social/posts", { body: { text: "hi" } })).code, 403);
});
