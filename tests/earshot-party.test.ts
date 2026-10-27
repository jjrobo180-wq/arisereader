// Pod+ Listen together: the group's shared playback, the six-mic limit, chat, and a real two-person
// session over the websocket (joining by link, staying in sync, passing WebRTC introductions).
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { PARTY_LIMITS, attachListenParties, cleanEp, control, newParty, posNow, setMic } from "../server/podcastParty";

const ep = { id: "1000123", showId: "555", title: "  Episode one ", show: "A show", art: "https://img.example/a.jpg", audio: "https://cdn.example/ep1.mp3", secs: 1800 };

test("episodes: only https audio and real ids get through", () => {
  assert.equal(cleanEp(ep)?.title, "Episode one");
  assert.equal(cleanEp({ ...ep, audio: "http://cdn.example/ep1.mp3" }), null, "plain http can't play on a secure page");
  assert.equal(cleanEp({ ...ep, audio: "javascript:alert(1)" }), null);
  assert.equal(cleanEp({ ...ep, id: "abc" }), null);
  assert.equal(cleanEp({ ...ep, art: "http://x/a.jpg" })?.art, "");
});

test("playback: anyone can pick, pause, play and seek; position runs while playing", () => {
  const p = newParty("room", 0);
  assert.equal(control(p, "a", { t: "play" }, 0), null, "nothing to play yet");
  control(p, "a", { t: "pick", ep }, 1000);
  assert.equal(p.state.playing, true);
  assert.equal(posNow(p.state, 11_000), 10);
  control(p, "b", { t: "pause" }, 21_000);
  assert.equal(p.state.playing, false); assert.equal(p.state.pos, 20); assert.equal(p.state.by, "b");
  assert.equal(posNow(p.state, 99_000), 20, "paused stays put");
  control(p, "c", { t: "seek", pos: 99_999 }, 22_000);
  assert.equal(p.state.pos, 1800, "can't seek past the end");
  control(p, "a", { t: "seek", pos: -5 }, 23_000);
  assert.equal(p.state.pos, 0);
  control(p, "a", { t: "play" }, 24_000);
  assert.equal(posNow(p.state, 30_000), 6);
});

test("mics: up to six at once", () => {
  const p = newParty("room", 0);
  for (let i = 0; i < 8; i++) p.members.set(`m${i}`, { id: `m${i}`, ws: null, name: `M${i}`, device: `d${i}`, mic: false, alive: true, lastChat: 0, lastControl: 0 });
  for (let i = 0; i < PARTY_LIMITS.speakers; i++) assert.equal(setMic(p, `m${i}`, true).ok, true);
  const seventh = setMic(p, "m6", true);
  assert.equal(seventh.ok, false); assert.match(seventh.reason!, /6 people/);
  setMic(p, "m0", false);
  assert.equal(setMic(p, "m6", true).ok, true, "a spot opens when someone hops off");
});

test("a group session over the websocket", { timeout: 20_000 }, async () => {
  const server = createServer();
  attachListenParties(server, (origin) => origin === "http://localhost:5173");
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  type Client = { ws: WebSocket; next: (t: string) => Promise<any> };
  const open = (room: string, name: string, device: string, origin = "http://localhost:5173"): Promise<Client> => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/party/ws?room=${room}&name=${encodeURIComponent(name)}&device=${device}`, { origin });
    const got: any[] = []; const waiters: { t: string; f: (m: any) => void }[] = [];
    ws.on("message", (d) => { const m = JSON.parse(String(d)); const w = waiters.findIndex((x) => x.t === m.t); if (w >= 0) waiters.splice(w, 1)[0].f(m); else got.push(m); });
    const next = (t: string) => new Promise<any>((res, rej) => { const i = got.findIndex((m) => m.t === t); if (i >= 0) return res(got.splice(i, 1)[0]); waiters.push({ t, f: res }); setTimeout(() => rej(new Error(`no ${t}`)), 3000); });
    ws.on("open", () => resolve({ ws, next })); ws.on("error", reject);
  });
  const say = (c: Client, m: unknown) => c.ws.send(JSON.stringify(m));

  try {
    await assert.rejects(open("new", "Eve", "deviceeeeeeeeeeeeeeeeee", "https://evil.example"), "other sites can't open groups");
    await assert.rejects(open("nosuchroom", "Eve", "deviceeeeeeeeeeeeeeeeee"), "a made-up group doesn't exist");

    const ana = await open("new", "Ana", "deviceaaaaaaaaaaaaaaaaa");
    const hello = await ana.next("hello");
    assert.ok(hello.room && hello.you);
    assert.equal(hello.state.ep, null);

    const ben = await open(hello.room, "Ben", "devicebbbbbbbbbbbbbbbbb");
    const benHello = await ben.next("hello");
    assert.deepEqual(benHello.members.map((m: any) => m.name).sort(), ["Ana", "Ben"]);
    assert.equal((await ana.next("members")).members.length, 2);

    say(ben, { t: "pick", ep });
    const a1 = await ana.next("state"); const b1 = await ben.next("state");
    assert.equal(a1.state.ep.id, ep.id); assert.equal(a1.state.playing, true); assert.equal(b1.state.by, benHello.you);

    await new Promise((r) => setTimeout(r, 300));
    say(ana, { t: "pause" });
    const paused = await ben.next("state");
    assert.equal(paused.state.playing, false);

    say(ana, { t: "chat", text: "  this part is so good  " });
    let msg = await ben.next("chat");
    while (msg.msg.kind !== "chat") msg = await ben.next("chat");
    assert.equal(msg.msg.text, "this part is so good"); assert.equal(msg.msg.name, "Ana");

    say(ana, { t: "mic", on: true });
    assert.equal((await ana.next("mic")).ok, true);
    let mem = await ben.next("members");
    while (!mem.members.some((m: any) => m.mic)) mem = await ben.next("members");
    assert.equal(mem.members.find((m: any) => m.name === "Ana").mic, true);

    say(ana, { t: "signal", to: benHello.you, key: "x>y", data: { sdp: "offer" } });
    const sig = await ben.next("signal");
    assert.equal(sig.from, hello.you); assert.deepEqual(sig.data, { sdp: "offer" });

    ana.ws.close(); ben.ws.close();
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
