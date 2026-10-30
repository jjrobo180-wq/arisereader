import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { audioKey, cleanLines, cleanMeeting, cleanNotes, cleanStudy, meetingPrompt, registerStudioRoutes, soundSeconds, speakLines, speakPatiently, studyPrompt } from "../server/podcastStudio";

test("lines: two speakers at most, markdown stripped, solo puts everything on one voice", () => {
  const raw = [{ speaker: "A", text: "**Hi** there" }, { speaker: "Leo", text: "Hello" }, { speaker: "B", text: "" }, { host: "B", line: "Bye" }];
  assert.deepEqual(cleanLines(raw), [{ speaker: "A", text: "Hi there" }, { speaker: "B", text: "Hello" }, { speaker: "B", text: "Bye" }]);
  assert.ok(cleanLines(raw, true).every((l) => l.speaker === "A"));
  // Never more than about 9,000 characters of speech.
  const long = Array.from({ length: 40 }, () => ({ speaker: "A", text: "x".repeat(600) }));
  assert.ok(cleanLines(long).reduce((n, l) => n + l.text.length, 0) <= 9000);
});

test("study and meeting results are cleaned, and a bad answer is refused", () => {
  const s = cleanStudy({ title: "Cells", summary: "About cells.", keyPoints: ["Nucleus", ""], lines: [{ speaker: "A", text: "One" }, { speaker: "B", text: "Two" }], quiz: [{ q: "What?", a: "That" }, { q: "", a: "x" }] }, false);
  assert.ok(s);
  assert.deepEqual(s!.keyPoints, ["Nucleus"]);
  assert.equal(s!.quiz.length, 1);
  assert.equal(cleanStudy({ lines: [{ text: "only one" }] }, false), null);
  const m = cleanMeeting({ summary: "Budget.", decisions: ["Launch May 12"], actions: [{ task: "Send numbers", owner: "Sam", due: "Fri" }, { owner: "x" }], lines: [{ speaker: "B", text: "Recap" }] });
  assert.equal(m!.actions.length, 1);
  assert.equal(m!.lines[0].speaker, "A");
  assert.equal(cleanMeeting({ title: "x" }), null);
});

test("prompts keep the AI to the notes and ask for JSON", () => {
  assert.match(studyPrompt("quick", "duo"), /Never invent names, numbers, dates or facts/);
  assert.match(studyPrompt("full", "solo"), /750 words/);
  assert.match(meetingPrompt(), /never invent people, dates, numbers or decisions/);
  assert.equal(cleanNotes("a\r\n\n\n\nb   c"), "a\n\nb c");
});

test("speech: each line in its host's voice, one MP3", async () => {
  const said: string[] = [];
  const out = await speakLines([{ speaker: "A", text: "hi" }, { speaker: "B", text: "yo" }], async (t, v) => { said.push(`${v}:${t}`); return { audio: Buffer.from(t), type: "audio/mpeg" }; });
  assert.deepEqual(said.sort(), ["austin:yo", "hannah:hi"]);
  assert.equal(out.audio.toString(), "hiyo");
  assert.equal(audioKey([{ speaker: "A", text: "hi" }]).length, 64);
});

test("routes: write, voice, then fetch the audio (with ranges)", async () => {
  const app = express();
  app.use(express.json());
  const gate = (req: any, _res: any, next: any) => { req.user = { id: "device-1" }; next(); };
  let asked = 0;
  registerStudioRoutes(app, gate, {
    ask: async () => { asked++; return JSON.stringify({ title: "T", summary: "S", keyPoints: ["k"], lines: [{ speaker: "A", text: "Hello" }, { speaker: "B", text: "World" }], quiz: [] }); },
    speak: async (t) => ({ audio: Buffer.from(t), type: "audio/mpeg" }),
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const short = await fetch(`${base}/api/podscroll/studio/study`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: "too short" }) });
    assert.equal(short.status, 400);
    const made = await (await fetch(`${base}/api/podscroll/studio/study`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: "Photosynthesis happens in chloroplasts and makes sugar from light.", title: "Bio" }) })).json();
    assert.equal(made.title, "Bio");
    assert.equal(made.lines.length, 2);
    assert.equal(asked, 1);
    const ask = async () => (await fetch(`${base}/api/podscroll/studio/voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: made.lines, progress: true }) })).json();
    let voice = await ask();
    assert.equal(voice.id, made.audio);
    assert.equal(voice.parts, 2);
    for (let i = 0; i < 50 && !voice.done; i++) { await new Promise((r) => setTimeout(r, 20)); voice = await ask(); }
    assert.equal(voice.done, true);
    assert.equal(await (await fetch(`${base}/api/podscroll/studio/audio/${voice.id}/1`)).text(), "World");
    const audio = await fetch(`${base}/api/podscroll/studio/audio/${voice.id}`);
    assert.equal(audio.headers.get("content-type"), "audio/mpeg");
    assert.equal(await audio.text(), "HelloWorld");
    const part = await fetch(`${base}/api/podscroll/studio/audio/${voice.id}`, { headers: { Range: "bytes=5-" } });
    assert.equal(part.status, 206);
    assert.equal(await part.text(), "World");
    assert.equal((await fetch(`${base}/api/podscroll/studio/audio/${"0".repeat(64)}`)).status, 404);
  } finally { server.close(); }
});

test("a busy voice is waited for, never an error", async () => {
  let calls = 0;
  const waits: number[] = [];
  const out = await speakPatiently("hi", "hannah", async (t) => { if (++calls < 4) throw new Error("speech 429 busy"); return { audio: Buffer.from(t), type: "audio/mpeg" }; }, 60_000, async (ms) => { waits.push(ms); });
  assert.equal(out.audio.toString(), "hi");
  assert.equal(waits.length, 3);
  await assert.rejects(speakPatiently("hi", "hannah", async () => { throw new Error("no key"); }, -1, async () => {}));
});

test("lines in different kinds of sound (a backup voice) still play, one after another", async () => {
  const app = express();
  app.use(express.json());
  const gate = (req: any, _res: any, next: any) => { req.user = { id: "device-2" }; next(); };
  let n = 0;
  registerStudioRoutes(app, gate, { ask: async () => "{}", speak: async (t) => (n++ % 2 ? { audio: Buffer.from(t), type: "audio/mpeg" } : { audio: Buffer.from(t), type: "audio/wav" }) });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const lines = [{ speaker: "A", text: "One" }, { speaker: "B", text: "Two" }];
    const ask = async () => (await fetch(`${base}/api/podscroll/studio/voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, progress: true }) })).json();
    let v = await ask();
    for (let i = 0; i < 50 && !v.done; i++) { await new Promise((r) => setTimeout(r, 20)); v = await ask(); }
    assert.equal(v.done, true);
    assert.equal(v.failed, false);
    assert.equal((await fetch(`${base}/api/podscroll/studio/audio/${v.id}/0`)).headers.get("content-type"), "audio/wav");
    assert.equal((await fetch(`${base}/api/podscroll/studio/audio/${v.id}/1`)).headers.get("content-type"), "audio/mpeg");
    assert.equal((await fetch(`${base}/api/podscroll/studio/audio/${v.id}`)).status, 404); // no single file: played piece by piece
  } finally { server.close(); }
});

test("how long a piece of sound lasts", () => {
  const frame = Buffer.alloc(6000); frame[0] = 0xff; frame[1] = 0xfb; frame[2] = 0x30; // MPEG-1 layer 3, 48 kbps
  assert.equal(Math.round(soundSeconds({ audio: frame, type: "audio/mpeg" })), 1);
});

test("notes from a PDF, a photo, or a recording", async () => {
  const zlib = await import("node:zlib");
  const { pdfText, looksReadable } = await import("../server/studioReading");
  const ops = Buffer.from("BT 72 720 Td (Photosynthesis happens in the chloroplasts.) Tj 0 -14 Td [(Plants make sug) 20 (ar from light) -300 (and water.)] TJ T* (Chlorophyll is green \\(mostly\\).) Tj ET");
  const comp = zlib.deflateSync(ops);
  const pdf = Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj << /Length ${comp.length} /Filter /FlateDecode >>\nstream\n`), comp, Buffer.from("\nendstream\nendobj\n%%EOF")]);
  const text = pdfText(pdf);
  assert.equal(text, "Photosynthesis happens in the chloroplasts.\nPlants make sugar from light and water.\nChlorophyll is green (mostly).");
  assert.ok(looksReadable(text));
  assert.ok(!looksReadable("\u0001\u0002 12 34 #$%"));

  const app = express();
  app.use(express.json({ limit: "14mb" }));
  const gate = (req: any, _res: any, next: any) => { req.user = { id: "device-3" }; next(); };
  registerStudioRoutes(app, gate, { ask: async () => "{}", see: async () => "Mitochondria: powerhouse", transcribe: async () => ({ segments: [{ text: " Hello class. " }, { text: "Today: cells." }] }) });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const post = (path: string, body: unknown) => fetch(`${base}/api/podscroll/studio/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await (await post("read", { kind: "pdf", data: pdf.toString("base64") })).json()).text, text);
    const scan = await post("read", { kind: "pdf", data: Buffer.from("%PDF-1.4\n" + "x".repeat(100)).toString("base64") });
    assert.equal(scan.status, 422);
    assert.equal((await (await post("read", { kind: "image", image: "data:image/jpeg;base64,AAAA" })).json()).text, "Mitochondria: powerhouse");
    const heard = await fetch(`${base}/api/podscroll/studio/transcribe`, { method: "POST", headers: { "Content-Type": "audio/mp4" }, body: Buffer.alloc(2000, 1) });
    assert.equal((await heard.json()).text, "Hello class. Today: cells.");
  } finally { server.close(); }
});
