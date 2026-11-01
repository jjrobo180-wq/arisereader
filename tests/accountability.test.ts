// Accountability (an Arise To Duo app): shared/accountability.ts and the nudges in server/accountability.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { builtinQuiz, builtinWorksheet, cleanQuiz, cleanTask, cleanWorksheet, dueOn, localNow, nudgeNow, personStats, scoreQuiz, streak, type AcctTask, type Checkin } from "../shared/accountability";
import { sendDueAccountabilityNudges } from "../server/accountability";

const task = (over: Partial<AcctTask> = {}): AcctTask => ({ id: "t1", spaceId: "s1", title: "Teach the ABCs", notes: "", kind: "task", assignee: 2, createdBy: 1, repeat: { every: "weekdays", days: [], date: "" }, due: "15:00", nag: 60, proof: "photo", review: true, worksheet: null, quiz: null, archived: false, createdAt: "2026-10-01T00:00:00Z", ...over });
const check = (day: string, status: Checkin["status"] = "done"): Checkin => ({ id: day, taskId: "t1", spaceId: "s1", day, by: 2, at: `${day}T20:00:00Z`, status, note: "", proof: [], answers: {}, score: null, feedback: "", reviewedBy: null, reviewedAt: null });

test("repeats: weekdays, picked days, once", () => {
  assert.equal(dueOn(task(), "2026-10-30"), true); // Friday
  assert.equal(dueOn(task(), "2026-10-31"), false); // Saturday
  assert.equal(dueOn(task({ repeat: { every: "weekly", days: [6], date: "" } }), "2026-10-31"), true);
  assert.equal(dueOn(task({ repeat: { every: "once", days: [], date: "2026-11-02" } }), "2026-11-02"), true);
  assert.equal(dueOn(task({ repeat: { every: "daily", days: [], date: "" } }), "2026-09-01"), false); // before it was made
});

test("nudged after the due time, every so often, only while awake, until done", () => {
  const t = task({ repeat: { every: "daily", days: [], date: "" } });
  const day = "2026-10-31", now = Date.parse("2026-10-31T22:00:00Z");
  assert.equal(nudgeNow(t, false, { day, minutes: 14 * 60 }, null, now), false); // before 3pm
  assert.equal(nudgeNow(t, false, { day, minutes: 15 * 60 }, null, now), true);
  assert.equal(nudgeNow(t, false, { day, minutes: 16 * 60 }, { at: now - 30 * 60_000, n: 1 }, now), false); // asked every hour
  assert.equal(nudgeNow(t, false, { day, minutes: 16 * 60 }, { at: now - 61 * 60_000, n: 1 }, now), true);
  assert.equal(nudgeNow(t, true, { day, minutes: 16 * 60 }, null, now), false); // done
  assert.equal(nudgeNow(t, false, { day, minutes: 22 * 60 }, null, now), false); // late at night
  assert.equal(nudgeNow(t, false, { day, minutes: 16 * 60 }, { at: 0, n: 10 }, now), false); // enough for one day
  assert.equal(nudgeNow({ ...t, nag: 0 }, false, { day, minutes: 16 * 60 }, null, now), false);
});

test("local day and time in the assignee's time zone", () => {
  const l = localNow(Date.parse("2026-10-31T05:30:00Z"), "America/Denver");
  assert.equal(l.day, "2026-10-30"); assert.equal(l.minutes, 23 * 60 + 30);
});

test("streaks and the dashboard numbers", () => {
  const t = task({ repeat: { every: "daily", days: [], date: "" } });
  const cs = [check("2026-10-28"), check("2026-10-29", "approved"), check("2026-10-30"), check("2026-10-27", "redo")];
  assert.equal(streak(t, cs, "2026-10-31"), 3); // today still open; the redo breaks it
  const st = personStats(2, [t], cs, "2026-10-31");
  assert.equal(st.todayDue, 1); assert.equal(st.todayDone, 0); assert.equal(st.rate, 43); assert.equal(st.week.length, 7);
});

test("a task needs a name and someone in the space; worksheets and quizzes need content", () => {
  assert.equal(cleanTask({ title: "x", assignee: 9 }, [1, 2]), null);
  assert.equal(cleanTask({ title: "Quiz", assignee: 2, kind: "quiz" }, [1, 2]), null);
  const ok = cleanTask({ title: "Dishes", assignee: 2, nag: 7, due: "25:00", proof: "video" }, [1, 2])!;
  assert.equal(ok.nag, 60); assert.equal(ok.due, "17:00"); assert.equal(ok.proof, "video"); assert.equal(ok.repeat.every, "daily");
});

test("AI answers are cleaned; the built-in makers always give something usable", () => {
  assert.equal(cleanQuiz({ questions: [{ prompt: "2+2", choices: ["4"], answer: 0 }] }), null);
  const q = cleanQuiz({ title: "Math", questions: [{ prompt: "2+2", choices: ["3", "4"], answer: 1, emoji: "➕" }] })!;
  assert.deepEqual(scoreQuiz(q, { [q.questions[0].id]: "1" }), { right: 1, total: 1 });
  assert.ok(cleanWorksheet({ items: [{ kind: "trace", prompt: "Trace: A a" }] }));
  for (const topic of ["ABCs", "counting", "colors", "shapes", "dinosaurs"]) {
    const w = builtinWorksheet({ topic, age: "4", count: 8, extra: "" }); assert.ok(cleanWorksheet(w), topic);
    const z = builtinQuiz({ topic, age: "4", count: 6, extra: "" }); const c = cleanQuiz(z)!; assert.ok(c, topic);
    for (const x of c.questions) assert.ok(x.answer >= 0 && x.answer < x.choices.length && new Set(x.choices).size === x.choices.length, `${topic}: ${x.prompt}`);
  }
});

test("the nudge pass sends once per interval and marks it", async () => {
  const t = task({ repeat: { every: "daily", days: [], date: "" }, nag: 60 });
  const rows: Record<string, any[]> = {
    acct_tasks: [{ id: t.id, space_id: "s1", data: t, assignee: 2, created_by: 1, archived: false, created_at: t.createdAt }],
    acct_members: [{ space_id: "s1", user_id: 1, name: "Dad", tz: "America/Denver" }, { space_id: "s1", user_id: 2, name: "Mom", tz: "America/Denver" }],
    acct_checkins: [], acct_nudges: [],
  };
  const q = (table: string) => { const chain: any = { select: () => chain, eq: () => chain, in: () => chain, limit: () => chain, then: (f: any) => f({ data: rows[table], error: null }), upsert: async (r: any) => { rows[table] = rows[table].filter((x) => x.task_id !== r.task_id || x.day !== r.day).concat(r); return { error: null }; } }; return chain; };
  const sent: any[] = [];
  const deps = { db: () => ({ from: q, storage: { from: () => ({}) } }) as any, push: async (u: number, m: any) => { sent.push([u, m]); return 1; } };
  const at = Date.parse("2026-10-31T22:00:00Z"); // 4pm in Denver
  await sendDueAccountabilityNudges({ ...deps, now: () => at });
  await sendDueAccountabilityNudges({ ...deps, now: () => at + 10 * 60_000 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], 2);
  assert.match(sent[0][1].title, /Teach the ABCs/);
  assert.match(sent[0][1].body, /Dad/);
  await sendDueAccountabilityNudges({ ...deps, now: () => at + 61 * 60_000 });
  assert.equal(sent.length, 2);
  assert.match(sent[1][1].title, /Still to do/);
});

test("it's in the To Duo App Gallery and opens from a notification", () => {
  assert.match(readFileSync(new URL("../shared/pluginStore.ts", import.meta.url), "utf8"), /id: "life-accountability".*target: section\("accountability"\)/);
  assert.match(readFileSync(new URL("../client/src/components/family-hub/lifeApps.tsx", import.meta.url), "utf8"), /accountability: \(p\) => <Accountability/);
  assert.match(readFileSync(new URL("../client/src/pages/AriseTodo.tsx", import.meta.url), "utf8"), /if \(go === "accountability"\) setFamily/);
  assert.match(readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8"), /"\/api\/accountability\/ai\/worksheet", "\/api\/accountability\/ai\/quiz"/);
});

test("already done: what was done, today or up to a week back, never ahead", async () => {
  const { cleanDoneAlready } = await import("../shared/accountability");
  const now = Date.parse("2026-11-01T18:00:00Z"); // Nov 1, midday in Denver
  assert.equal(cleanDoneAlready({ title: "  " }, "America/Denver", now), null);
  assert.deepEqual(cleanDoneAlready({ title: "Did the dishes", note: "Sparkling", day: "2026-10-31" }, "America/Denver", now), { title: "Did the dishes", note: "Sparkling", day: "2026-10-31" });
  assert.equal(cleanDoneAlready({ title: "Laundry", day: "2026-11-05" }, "America/Denver", now)!.day, "2026-11-01", "not in the future");
  assert.equal(cleanDoneAlready({ title: "Laundry", day: "2026-09-01" }, "America/Denver", now)!.day, "2026-11-01", "not long ago");
  assert.equal(cleanDoneAlready({ title: "Laundry" }, "America/Denver", now)!.day, "2026-11-01");
});
