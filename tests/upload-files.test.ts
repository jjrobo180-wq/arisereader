// File uploads for the two Exemplar Makers: PDF, Word, Excel, PowerPoint, CSV, text, web pages, photos.
// Files are real (tiny ZIPs built here); the AI and the web are stand-ins.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { UploadError, pptxToText, readUploads } from "../server/uploadText";
import { UPLOAD_LIMITS, UPLOAD_ACCEPT } from "../shared/uploads";
import { registerSpedExemplarRoutes } from "../server/spedExemplar";
import { registerKhaElaRoutes } from "../server/khaEla";
import { memoryKV } from "../server/podcastDirectory";
import type { SpedAsk } from "../server/spedExemplar";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64");

function zip(parts: Record<string, string>): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(parts)) {
    const raw = Buffer.from(content, "utf8"), data = deflateRawSync(raw), nameBytes = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data); centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(parts).length, 8); end.writeUInt16LE(Object.keys(parts).length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const PPTX = zip({
  "ppt/slides/slide2.xml": `<p:sld><a:p><a:r><a:t>Slide two: 15% tip</a:t></a:r></a:p></p:sld>`,
  "ppt/slides/slide1.xml": `<p:sld><a:p><a:r><a:t>Tax &amp; Tip</a:t></a:r><a:r><a:t> Lesson 10</a:t></a:r></a:p><a:p><a:r><a:t>Warm-up: sunglasses</a:t></a:r></a:p></p:sld>`,
});
const DOCX = zip({ "word/document.xml": `<w:document><w:body><w:p><w:r><w:t>Find 6% of 25</w:t></w:r></w:p></w:body></w:document>` });
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF");

test("a PowerPoint file becomes its slides' words, in slide order", () => {
  assert.equal(pptxToText(PPTX), "Slide 1:\nTax & Tip Lesson 10\nWarm-up: sunglasses\n\nSlide 2:\nSlide two: 15% tip");
  assert.throws(() => pptxToText(DOCX), UploadError);
});

test("every kind of file is read the right way", () => {
  const r = readUploads([
    { name: "lesson.pdf", data: b64(PDF) },
    { name: "page.png", data: b64("png-bytes") },
    { name: "slides.pptx", data: b64(PPTX) },
    { name: "notes.txt", data: b64("Warm-up: 3x = 12") },
  ].slice(0, 3), 10_000);
  assert.equal(r.attachments.length, 2);
  assert.ok(r.attachments[0].startsWith("data:application/pdf;base64,"));
  assert.ok(r.attachments[1].startsWith("data:image/png;base64,"));
  assert.match(r.text, /^The file "slides\.pptx":\nSlide 1:/);

  const t = readUploads([{ name: "w.docx", data: b64(DOCX) }, { name: "t.csv", data: b64("item,price\npillow,8.00\n") }, { name: "p.html", data: b64("<html><body><h1>Lesson 10</h1><p>Tax and tip practice problems.</p></body></html>") }], 10_000);
  assert.match(t.text, /The file "w\.docx":\nFind 6% of 25/);
  assert.match(t.text, /The file "t\.csv":[\s\S]*pillow/);
  assert.match(t.text, /The file "p\.html":[\s\S]*Tax and tip practice problems/);
  assert.deepEqual(t.attachments, []);
});

test("bad files get a message a teacher can act on", () => {
  const err = (files: unknown, re: RegExp) => assert.throws(() => readUploads(files, 10_000), (e: any) => e instanceof UploadError && re.test(e.message));
  err([{ name: "fake.pdf", data: b64("not a pdf") }], /doesn’t look like a PDF/);
  err([{ name: "old.ppt", data: b64("x") }], /older PowerPoint.*\.pptx/);
  err([{ name: "old.doc", data: b64("x") }], /older Word file.*\.docx/);
  err([{ name: "cal.ics", data: b64("BEGIN:VCALENDAR") }], /calendar file/);
  err([{ name: "song.mp3", data: b64("x") }], /can’t be read here.*PDF, Word, Excel, PowerPoint/);
  err([{ name: "empty.txt", data: "" }], /couldn’t be read/);
  err([{ name: "x.pdf", data: "!!!not base64!!!" }], /couldn’t be read/);
  err([{ name: "bad.docx", data: b64("this is not a zip") }], /could not be opened|damaged/i);
  err(Array.from({ length: UPLOAD_LIMITS.files + 1 }, (_, i) => ({ name: `a${i}.txt`, data: b64("x") })), /up to 3 files/);
  err([{ name: "big.pdf", data: Buffer.concat([PDF, Buffer.alloc(UPLOAD_LIMITS.fileBytes)]).toString("base64") }], /too big/);
  assert.deepEqual(readUploads(undefined, 100), { text: "", attachments: [] });
});

test("the picker offers the same kinds of file the server reads", () => {
  for (const e of ["pdf", "docx", "xlsx", "pptx", "csv", "txt", "png", "jpg"]) assert.ok(UPLOAD_ACCEPT.split(",").includes(`.${e}`), e);
});

function appFor(register: (app: any, auth: any, deps: any) => void, deps: Record<string, unknown>) {
  type Route = { method: string; re: RegExp; keys: string[]; handlers: ((req: any, res: any, next: any) => unknown)[] };
  const routes: Route[] = [];
  const add = (method: string) => (path: string, ...handlers: any[]) => { const keys: string[] = []; routes.push({ method, keys, handlers, re: new RegExp("^" + path.replace(/:([a-z]+)/gi, (_m, k) => { keys.push(k); return "([^/]+)"; }) + "$") }); };
  const auth: any = (req: any, _res: any, next: any) => { const [id, role] = String(req.headers["x-user"] || "").split(":"); if (id) req.user = { id: Number(id), role, isAdmin: role === "admin" }; return next(); };
  register({ get: add("GET"), post: add("POST"), delete: add("DELETE") }, auth, { kv: memoryKV(), aiConfigured: () => true, ...deps });
  return async (path: string, method = "GET", body?: unknown) => {
    const route = routes.find((r) => r.method === method && r.re.test(path))!;
    assert.ok(route, `no route for ${method} ${path}`);
    const m = route.re.exec(path)!;
    const req: any = { headers: { "x-user": "1:teacher" }, body: body ?? {}, params: Object.fromEntries(route.keys.map((k, i) => [k, m[i + 1]])) };
    let status = 200, payload: any;
    const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(b: unknown) { payload = b; return res; } };
    let i = 0;
    const next = async (): Promise<void> => { const h = route.handlers[i++]; if (h) await h(req, res, next); };
    await next();
    return { status, body: payload };
  };
}
const until = async (fn: () => Promise<any>, ok: (v: any) => boolean) => { for (let i = 0; i < 200; i++) { const v = await fn(); if (ok(v)) return v; await new Promise((r) => setTimeout(r, 20)); } throw new Error("timed out"); };

for (const [name, route, register] of [["SPED Exemplar Maker", "/api/sped-exemplar", registerSpedExemplarRoutes], ["Kha ELA", "/api/kha-ela", registerKhaElaRoutes]] as const) {
  test(`${name}: a PDF plus a PowerPoint plus typed words all reach the AI`, async () => {
    const asked: SpedAsk[] = [];
    const call = appFor(register as any, { askAI: async (a: SpedAsk) => { asked.push(a); return "{}"; } });
    const started = await call(route, "POST", { settings: { source: "asis" }, text: "Typed: please keep it short.", files: [{ name: "Lesson10.pdf", data: b64(PDF) }, { name: "slides.pptx", data: b64(PPTX) }] });
    assert.equal(started.status, 202, JSON.stringify(started.body));
    await until(() => call(`${route}/${started.body.id}`), (r) => r.body.status !== "working");
    assert.ok(asked.length > 0);
    assert.ok(asked[0].images.some((i) => i.startsWith("data:application/pdf;base64,")), "the PDF goes to the AI as a file");
    assert.match(asked[0].text, /Typed: please keep it short\./);
    assert.match(asked[0].text, /The file "slides\.pptx":[\s\S]*Warm-up: sunglasses/);
  });

  test(`${name}: a file that can't be read is refused before anything is built`, async () => {
    const call = appFor(register as any, { askAI: async () => "{}" });
    const bad = await call(route, "POST", { settings: { source: "asis" }, files: [{ name: "fake.pdf", data: b64("nope") }] });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /doesn’t look like a PDF/);
  });
}

test("the server accepts big uploads on both routes, the buttons are wired, and the AI call sends PDFs as files", () => {
  const index = read("server/index.ts");
  assert.match(index, /sped-exemplar\|kha-ela[\s\S]{0,200}express\.json\(\{ limit: "50mb" \}\)/);
  assert.ok(index.indexOf("sped-exemplar|kha-ela") < index.indexOf("  express.json({"), "the big limit is registered before the 100 kb default");
  assert.match(read("client/src/pages/SpedExemplarMaker.tsx"), /testId="sped-files"/);
  assert.match(read("client/src/pages/KhaElaMaker.tsx"), /testId="kha-files"/);
  assert.match(read("client/src/pages/SpedExemplarMaker.tsx"), /\{ title, grade, text, links, files, images:/);
  assert.match(read("server/spedExemplar.ts"), /type: "file"[\s\S]{0,120}data:application\/pdf|application\/pdf[\s\S]{0,200}type: "file"/);
});
