import test from "node:test";
import assert from "node:assert/strict";
import { createShowVoice, registerStudentShowVoice } from "../server/studentShowVoice";
import { FLAT } from "../shared/presentShow";

// a fake Storage bucket and a fake OpenAI, so nothing real is called
function fakes() {
  const files = new Map<string, Buffer>();
  const calls: any[] = [];
  const storage = () => ({
    createBucket: async () => ({}),
    from: () => ({
      download: async (path: string) => (files.has(path) ? { data: { arrayBuffer: async () => files.get(path)!.buffer.slice(files.get(path)!.byteOffset, files.get(path)!.byteOffset + files.get(path)!.length) } } : { data: null }),
      upload: async (path: string, body: Buffer) => { files.set(path, Buffer.from(body)); return {}; },
    }),
  });
  const fetchImpl = (async (url: string, init: any) => {
    const body = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.Authorization, body });
    return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(`mp3:${body.input}`), text: async () => "" } as any;
  }) as any;
  return { files, calls, storage, fetchImpl };
}

test("each line is made once with the AI voice, then saved and reused", async () => {
  const f = fakes();
  const voice = createShowVoice({ apiKey: "k", storage: f.storage, fetchImpl: f.fetchImpl });
  const a = await voice.line(0);
  assert.equal(a!.toString(), `mp3:${FLAT[0].say}`);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, "https://api.openai.com/v1/audio/speech");
  assert.equal(f.calls[0].auth, "Bearer k");
  assert.equal(f.calls[0].body.model, "gpt-4o-mini-tts");
  assert.equal(f.calls[0].body.voice, "marin");
  assert.match(f.calls[0].body.instructions, /big room of students/);
  assert.equal(f.calls[0].body.input, FLAT[0].say);
  await voice.line(0);
  assert.equal(f.calls.length, 1, "the second ask comes from memory");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(f.files.size, 1, "the clip was saved for later showings");
  // a fresh server (empty memory) finds the saved clip instead of paying for it again
  const again = createShowVoice({ apiKey: "k", storage: f.storage, fetchImpl: f.fetchImpl });
  assert.equal((await again.line(0))!.toString(), `mp3:${FLAT[0].say}`);
  assert.equal(f.calls.length, 1);
});

test("two people asking for the same new line at once make it once", async () => {
  const f = fakes();
  const voice = createShowVoice({ apiKey: "k", storage: f.storage, fetchImpl: f.fetchImpl });
  await Promise.all([voice.line(3), voice.line(3), voice.line(3)]);
  assert.equal(f.calls.length, 1);
});

test("only the show's own lines can be asked for", async () => {
  const f = fakes();
  const voice = createShowVoice({ apiKey: "k", storage: f.storage, fetchImpl: f.fetchImpl });
  for (const bad of [-1, FLAT.length, 1.5, NaN, 9999]) assert.equal(await voice.line(bad), null);
  assert.equal(f.calls.length, 0);
  assert.notEqual(await voice.line(FLAT.length - 1), null);
});

test("without an OpenAI key it says so, and a failing voice is reported, not crashed", async () => {
  const f = fakes();
  const noKey = createShowVoice({ apiKey: "", storage: f.storage, fetchImpl: f.fetchImpl });
  const prev = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try { assert.equal(noKey.available(), false); await assert.rejects(noKey.line(0), /OPENAI_API_KEY/); } finally { if (prev) process.env.OPENAI_API_KEY = prev; }
  const broken = createShowVoice({ apiKey: "k", storage: f.storage, fetchImpl: (async () => ({ ok: false, status: 500, text: async () => "boom" })) as any });
  await assert.rejects(broken.line(0), /speech failed: 500/);
});

function routes(voice: any) {
  const handlers: Record<string, any> = {};
  registerStudentShowVoice({ get: (path: string, h: any) => { handlers[path] = h; } } as any, voice);
  const call = async (path: string, params: any = {}) => {
    const out: any = { headers: {} as any, status: 200, body: undefined };
    const res: any = {
      set(h: any, v?: any) { if (typeof h === "string") out.headers[h] = v; else Object.assign(out.headers, h); return res; },
      status(c: number) { out.status = c; return res; },
      json(b: any) { out.body = b; return res; },
      send(b: any) { out.body = b; return res; },
    };
    await handlers[path]({ params }, res);
    return out;
  };
  return { call, handlers };
}

test("the routes serve status and lines, and refuse anything else", async () => {
  const f = fakes();
  const voice = createShowVoice({ apiKey: "k", storage: f.storage, fetchImpl: f.fetchImpl });
  const { call, handlers } = routes(voice);
  assert.deepEqual(Object.keys(handlers).sort(), ["/api/student-show/voice/:index", "/api/student-show/voice/status"]);
  const status = await call("/api/student-show/voice/status");
  assert.deepEqual(status.body, { ai: true, lines: FLAT.length });
  const ok = await call("/api/student-show/voice/:index", { index: "2" });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers["Content-Type"], "audio/mpeg");
  assert.equal(ok.body.toString(), `mp3:${FLAT[2].say}`);
  for (const bad of ["abc", "-1", "1e3", "0x1", "1000", String(FLAT.length), ""]) assert.equal((await call("/api/student-show/voice/:index", { index: bad })).status, 404, `index "${bad}"`);
  const off = routes({ available: () => false, line: async () => null });
  assert.equal((await off.call("/api/student-show/voice/status")).body.ai, false);
  assert.equal((await off.call("/api/student-show/voice/:index", { index: "0" })).status, 503);
  const failing = routes({ available: () => true, line: async () => { throw new Error("down"); } });
  const origErr = console.error; console.error = () => {};
  try { assert.equal((await failing.call("/api/student-show/voice/:index", { index: "0" })).status, 502); } finally { console.error = origErr; }
});

test("the show asks for the AI voice, and the server registers it", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.ok(read("server/routes.ts").includes("registerStudentShowVoice(app)"));
  const player = read("client/src/pages/present/StudentShow.tsx");
  assert.ok(player.includes("clipFor(pos)") && player.includes("computerVoice"), "AI voice first, the computer's voice as the fallback");
  const client = read("client/src/pages/present/voice.ts");
  assert.ok(client.includes("/api/student-show/voice/") && !client.includes("Authorization"), "no sign-in needed");
});
