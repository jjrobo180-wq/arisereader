// TTS Buddy: a teacher snaps a worksheet on their phone, links a child's laptop with a 4-digit code, and the laptop
// reads each question aloud with the words lighting up. Run with: npx tsx --test tests/tts-buddy.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerTtsBuddyRoutes, type Spoken } from "../server/ttsBuddy";
import { createMemoryKv } from "../server/fitKv";
import { alignWords, classCode, cleanWorksheet, estimateTimes, pairCode, spokenFor, tokens, wordAt } from "../shared/ttsBuddy";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function fakeApp() {
  const routes: [string, string, any][] = [];
  const add = (m: string) => (path: string, h: any) => routes.push([m, path, h]);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), patch: add("PATCH"), delete: add("DELETE") };
  const call = async (m: string, path: string, headers: Record<string, string> = {}, body: any = {}, ip = "1.2.3.4") => {
    for (const [km, kp, h] of routes) {
      if (km !== m) continue;
      const names: string[] = []; const re = new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "$");
      const hit = path.match(re); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, hit[i + 1]])), body, headers: { "x-forwarded-for": ip, ...headers }, ip };
      let status = 200, out: any;
      const res: any = { set() {}, status(s: number) { status = s; return res; }, json(b: any) { out = b; return res; } };
      await h(req, res);
      return { status, body: out };
    }
    throw new Error(`no route ${m} ${path}`);
  };
  return { app, call };
}

const PHOTO = "data:image/jpeg;base64,/9j/AAAA";
const AI_REPLY = JSON.stringify({
  title: "Fractions Practice",
  items: [
    { kind: "read", number: "", text: "Directions: Read each question. Circle the best answer.", say: "", choices: [] },
    { kind: "choice", number: "1.", text: "Which fraction is the same as one half?", say: "", choices: ["A. 2/4", "B) 1/3", "(c) 3/5"] },
    { kind: "short", number: "2", text: "3/4 + 1/4 = ____", say: "three fourths plus one fourth equals blank", choices: [] },
    { kind: "choice", number: "3", text: "A pizza cut in 8 slices has eighths.", say: "", choices: ["True"] },
    { kind: "long", number: "4", text: "Explain how you know.", say: "", choices: [] },
    { kind: "short", number: "5", text: "   ", choices: [] },
  ],
});
const setup = () => {
  let n = 0; const spoken: string[] = [];
  const { app, call } = fakeApp();
  const speak = async (text: string): Promise<Spoken> => { spoken.push(text); const ws = text.split(" "); return { audio: Buffer.from("mp3"), duration: ws.length * 0.4, words: ws.map((w, i) => ({ word: w.replace(/[.,]/g, ""), start: i * 0.4, end: i * 0.4 + 0.35 })) }; };
  const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15, 0.25, 0.35];
  registerTtsBuddyRoutes(app, { kv: createMemoryKv(), readPhotos: async () => AI_REPLY, speak, aiConfigured: () => true, rand: () => seq[n++ % seq.length] });
  return { call, spoken };
};
const T = { "x-buddy-teacher": "teacher-key-0123456789abcdefghijklmnopqrstuv" };

test("worksheets are cleaned: letters come off choices, a one-choice question becomes short, empty items go", () => {
  const ws = cleanWorksheet(JSON.parse(AI_REPLY), "w1", "2026-11-12T00:00:00Z");
  assert.equal(ws.items.length, 5);
  assert.deepEqual(ws.items[1].choices, ["2/4", "1/3", "3/5"]);
  assert.equal(ws.items[1].number, "1");
  assert.equal(ws.items[3].kind, "short");
  assert.equal(spokenFor(ws.items[2], "q"), "three fourths plus one fourth equals blank");
  assert.equal(spokenFor(ws.items[1], "c1"), "B. 1/3");
  assert.equal(spokenFor(ws.items[1], "c9"), "");
});

test("codes are easy to read: 4 digits for laptops, 4 letters with no vowels for a class", () => {
  assert.match(pairCode(() => 0), /^\d{4}$/); assert.match(pairCode(() => 0.9999), /^\d{4}$/);
  const c = classCode(() => 0.5); assert.match(c, /^[BCDFGHJKMNPQRSTVWXZ]{4}$/);
});

test("words line up with what the voice said, and gaps (symbols, blanks) take time from their neighbors", () => {
  const shown = tokens("3/4 + 1/4 = ____ is it?").map((t) => t.w);
  const said = [{ word: "three", start: 0, end: 0.4 }, { word: "fourths", start: 0.4, end: 0.8 }, { word: "is", start: 3, end: 3.2 }, { word: "it", start: 3.2, end: 3.5 }];
  const t = alignWords(shown, said, 3.6);
  assert.equal(t.length, shown.length);
  assert.deepEqual(t[5], { s: 3, e: 3.2 }); assert.deepEqual(t[6], { s: 3.2, e: 3.5 });
  for (let i = 1; i < t.length; i++) assert.ok(t[i].s >= t[i - 1].s, "times only go forward");
  assert.ok(t[4].e <= 3 + 1e-9);
  const plain = alignWords(["Which", "fraction", "is"], [{ word: "Which", start: 0.1, end: 0.3 }, { word: "fraction", start: 0.3, end: 0.8 }, { word: "is", start: 0.8, end: 0.9 }], 1);
  assert.deepEqual(plain, [{ s: 0.1, e: 0.3 }, { s: 0.3, e: 0.8 }, { s: 0.8, e: 0.9 }]);
  const est = estimateTimes(["Hi", "there,", "friend."], 3);
  assert.equal(est[0].s, 0); assert.ok(Math.abs(est[2].e - 3) < 0.01);
  assert.equal(wordAt(plain, 0), -1); assert.equal(wordAt(plain, 0.35), 1); assert.equal(wordAt(plain, 5), 2);
});

test("the whole class flow: snap, link a laptop by its code, it reads aloud, answers come back to the teacher", async () => {
  const { call, spoken } = setup();
  assert.equal((await call("GET", "/api/buddy/teacher", {})).status, 401);
  const r = await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO, "not a photo"] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const ws = r.body.worksheet; assert.equal(ws.title, "Fractions Practice"); assert.equal(ws.items.length, 5); assert.equal(ws.pages, 1);

  // A laptop opens arisetodo.com/buddy and shows its code.
  const lap = await call("POST", "/api/buddy/laptop");
  assert.match(lap.body.code, /^\d{4}$/);
  const L = { "x-buddy-laptop": lap.body.key };
  assert.equal((await call("GET", `/api/buddy/laptop/${lap.body.id}`, L)).body.state, "waiting");
  assert.equal((await call("GET", `/api/buddy/laptop/${lap.body.id}`, { "x-buddy-laptop": "x".repeat(40) })).status, 404, "another key can't read it");

  // The teacher types the code.
  assert.equal((await call("POST", "/api/buddy/teacher/link", T, { code: "0000", worksheetId: ws.id })).status, 404);
  const linked = await call("POST", "/api/buddy/teacher/link", T, { code: ` ${lap.body.code.slice(0, 2)}-${lap.body.code.slice(2)} `, worksheetId: ws.id, name: "Seat 4" });
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  const ready = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.equal(ready.body.state, "ready"); assert.equal(ready.body.name, "Seat 4"); assert.equal(ready.body.worksheet.id, ws.id);
  // The code can't be used again to grab the laptop.
  assert.equal((await call("POST", "/api/buddy/teacher/link", { "x-buddy-teacher": "someone-else-0123456789abcdefghijklmnop" }, { code: lap.body.code, worksheetId: ws.id })).status, 404);

  // Reading aloud: the laptop gets the voice and word times for the question and each choice.
  const q = await call("POST", "/api/buddy/speak", L, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[2].id, part: "q" });
  assert.equal(q.status, 200); assert.match(q.body.audio, /^data:audio\/mpeg;base64,/);
  assert.equal(q.body.words.length, tokens(ws.items[2].text).length, "one time per word on screen");
  assert.equal(spoken.at(-1), "three fourths plus one fourth equals blank", "math is read in words");
  const c = await call("POST", "/api/buddy/speak", L, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[1].id, part: "c0" });
  assert.equal(c.status, 200); assert.equal(spoken.at(-1), "A. 2/4");
  assert.equal((await call("POST", "/api/buddy/speak", {}, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[1].id, part: "q" })).status, 403, "no key, no voice");
  assert.equal((await call("POST", "/api/buddy/speak", L, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[1].id, part: "c7" })).status, 404);

  // The child answers; the teacher sees it.
  const p = await call("POST", `/api/buddy/laptop/${lap.body.id}/progress`, L, { worksheetId: ws.id, answers: { [ws.items[1].id]: "2/4", [ws.items[2].id]: "1", nope: "x" }, step: 3 });
  assert.equal(p.status, 200);
  const view = await call("GET", "/api/buddy/teacher", T);
  assert.equal(view.body.laptops.length, 1);
  assert.equal(view.body.laptops[0].answered, 2); assert.equal(view.body.laptops[0].questions, 4); assert.equal(view.body.laptops[0].step, 3);
  assert.deepEqual(Object.keys(view.body.laptops[0].answers).sort(), [ws.items[1].id, ws.items[2].id].sort());
  assert.match(view.body.classCode, /^[A-Z]{4}$/);

  // A second laptop joins with the class code instead.
  const lap2 = await call("POST", "/api/buddy/laptop");
  const L2 = { "x-buddy-laptop": lap2.body.key };
  assert.equal((await call("POST", `/api/buddy/laptop/${lap2.body.id}/join`, L2, { classCode: "ZZZZ" })).status, 404);
  const j = await call("POST", `/api/buddy/laptop/${lap2.body.id}/join`, L2, { classCode: view.body.classCode.toLowerCase(), name: "Ava" });
  assert.equal(j.status, 200, JSON.stringify(j.body));
  assert.equal((await call("GET", `/api/buddy/laptop/${lap2.body.id}`, L2)).body.worksheet.id, ws.id);

  // A new worksheet sent to the class replaces the old one on every laptop, with fresh answers.
  const r2 = await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO, PHOTO] });
  const sent = await call("POST", "/api/buddy/teacher/send", T, { worksheetId: r2.body.worksheet.id });
  assert.equal(sent.body.sent, 2);
  const after = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.equal(after.body.worksheet.id, r2.body.worksheet.id); assert.deepEqual(after.body.answers, {});
  assert.equal((await call("POST", `/api/buddy/laptop/${lap.body.id}/progress`, L, { worksheetId: ws.id, answers: {} })).status, 409, "old worksheet's answers are refused");

  // Edits, rename, unlink, delete.
  const edited = await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}`, T, { title: "Fractions", items: ws.items.slice(1, 3) });
  assert.equal(edited.body.worksheet.items.length, 2);
  assert.equal((await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}`, { "x-buddy-teacher": "someone-else-0123456789abcdefghijklmnop" }, { items: ws.items })).status, 404, "only its teacher edits it");
  await call("PATCH", `/api/buddy/teacher/laptops/${lap.body.id}`, T, { name: "Marcus" });
  assert.equal((await call("GET", `/api/buddy/laptop/${lap.body.id}`, L)).body.name, "Marcus");
  await call("PATCH", `/api/buddy/teacher/laptops/${lap.body.id}`, T, { unlink: true });
  const back = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.equal(back.body.state, "waiting"); assert.match(back.body.code, /^\d{4}$/);
  await call("DELETE", `/api/buddy/teacher/worksheets/${ws.id}`, T);
  assert.equal((await call("GET", `/api/buddy/teacher/worksheets/${ws.id}`, T)).status, 404);
});

test("a photo that isn't a worksheet gets a clear message, and reading is limited per day", async () => {
  const { app, call } = fakeApp();
  registerTtsBuddyRoutes(app, { kv: createMemoryKv(), readPhotos: async () => '{"title":"","items":[]}', speak: async () => { throw new Error("x"); }, aiConfigured: () => true });
  const r = await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] });
  assert.equal(r.status, 422); assert.match(r.body.message, /clearer photo/);
  assert.equal((await call("POST", "/api/buddy/teacher/read", T, { images: [] })).status, 400);
  for (let i = 0; i < 39; i++) await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] });
  assert.equal((await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] })).status, 429);
});

test("the site: arisetodo.com/buddy opens it, the routes and server are wired, no account needed", () => {
  assert.match(read("client/src/main.tsx"), /path === "\/buddy"/);
  assert.match(read("client/src/App.tsx"), /<Route path="\/buddy">/);
  assert.match(read("server/routes.ts"), /registerTtsBuddyRoutes\(app, \{ kv: createSupabaseKv\(\) \}\)/);
  assert.match(read("server/index.ts"), /"\/api\/buddy\/teacher\/read", express\.json\(\{ limit: "16mb" \}\)/);
});
