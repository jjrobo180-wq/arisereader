// Creators: Open Mic ranking, Pod+ Rise, sign-in emails, and a LivePod run end to end over a real
// websocket (host, two listeners: the audio handshake, chat, Cheers and their budget, likes, ending).
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import {
  CHEER_BUDGET, cleanEmail, isMicSlot, isNewVoice, micScore, postIdOfEpisode, riseProgress, spreadCreators, trend, liveClock,
} from "../shared/earshotCreators";
import { ownEpisodeId } from "../server/podcastSocial";
import { attachLivePods, liveNow, liveTicket, startLive, _rooms } from "../server/podcastLive";

const base = { plays: 0, likes: 0, comments: 0, reposts: 0, followers: 0, episodes: 1, ageHours: 1, playsRecent: 0 };

test("Open Mic puts new and small creators forward, and rising favors momentum", () => {
  assert.equal(postIdOfEpisode(ownEpisodeId(42)), 42);
  assert.equal(postIdOfEpisode("1000797583370"), null, "Apple episodes aren't creators' episodes");
  // Same engagement and age: the small first-time creator ranks above an established one.
  assert.ok(micScore("fresh", { ...base, plays: 20 }) > micScore("fresh", { ...base, plays: 20, followers: 5000, episodes: 40 }));
  // A brand-new upload with nothing yet still beats a week-old one with a little.
  assert.ok(micScore("fresh", { ...base, ageHours: 1 }) > micScore("fresh", { ...base, plays: 3, ageHours: 168 }));
  // Rising: recent plays matter most.
  assert.ok(micScore("rising", { ...base, playsRecent: 40, ageHours: 30 }) > micScore("rising", { ...base, plays: 40, ageHours: 30 }));
  assert.equal(isNewVoice({ followers: 20, episodes: 9 }), true);
  assert.equal(isNewVoice({ followers: 400, episodes: 12 }), false);
  const spread = spreadCreators([{ c: "a", score: 9 }, { c: "a", score: 8 }, { c: "a", score: 7 }, { c: "b", score: 1 }], (x) => x.c, 2);
  assert.deepEqual(spread.map((x) => x.c), ["a", "a", "b", "a"], "a third episode from one creator waits behind others");
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(isMicSlot), [false, false, false, false, true, true]);
});

test("Pod+ Rise progress, trends and sign-in emails", () => {
  const r = riseProgress({ episodes: 3, followers: 50, plays30: 1500, daysSinceFirst: 31.5, livePods: 0 });
  assert.equal(r.eligible, false);
  assert.deepEqual(r.steps.map((s) => s.done), [true, false, true, true]);
  assert.equal(r.percent, 88);
  assert.equal(riseProgress({ episodes: 5, followers: 120, plays30: 1000, daysSinceFirst: 40, livePods: 2 }).eligible, true);
  assert.equal(trend(150, 100), 50); assert.equal(trend(5, 0), null); assert.equal(trend(0, 0), 0);
  assert.equal(cleanEmail("  Maya@Example.COM "), "maya@example.com");
  assert.equal(cleanEmail("nope"), ""); assert.equal(cleanEmail("a@b"), "");
  assert.equal(liveClock(65_000), "1:05"); assert.equal(liveClock(3_725_000), "1:02:05");
});

test("a LivePod: audio handshake, chat, Cheers, likes and ending", async () => {
  const server = createServer();
  attachLivePods(server);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  const profile = (handle: string) => ({ handle, name: handle.toUpperCase(), bio: "", avatar: "🎧" });
  const room = startLive({ voter: "dhost", profile: profile("host") }, "  Late night  talk ", "Talk");
  assert.equal(startLive({ voter: "dhost", profile: profile("host") }, "again", "Talk").id, room.id, "one LivePod per host");

  type Client = { ws: WebSocket; got: any[]; next: (t: string) => Promise<any> };
  const open = (ticket: string): Promise<Client> => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/live/ws?ticket=${ticket}`);
    const got: any[] = []; const waiters: { t: string; f: (m: any) => void }[] = [];
    ws.on("message", (d) => { const m = JSON.parse(String(d)); const w = waiters.findIndex((x) => x.t === m.t); if (w >= 0) waiters.splice(w, 1)[0].f(m); else got.push(m); });
    const next = (t: string) => new Promise<any>((res, rej) => { const i = got.findIndex((m) => m.t === t); if (i >= 0) return res(got.splice(i, 1)[0]); waiters.push({ t, f: res }); setTimeout(() => rej(new Error(`no ${t}`)), 3000); });
    ws.on("open", () => resolve({ ws, got, next })); ws.on("error", reject);
  });
  const say = (c: Client, m: unknown) => c.ws.send(JSON.stringify(m));

  try {
    assert.equal(liveTicket({ voter: "dsomeone", profile: profile("x") }, room.id, "host"), null, "only the host can open it as host");
    const host = await open(liveTicket({ voter: "dhost", profile: profile("host") }, room.id, "host")!);
    const hello = await host.next("hello");
    assert.equal(hello.room.title, "Late night talk");
    assert.equal(liveNow().length, 1);

    const maya = await open(liveTicket({ voter: "dmaya", profile: profile("maya") }, room.id, "listener")!);
    const mHello = await maya.next("hello");
    assert.equal(mHello.you.audio, true); assert.equal(mHello.you.canChat, true);
    const peer = await host.next("peer");
    assert.equal(peer.id, mHello.you.id, "the host is told to call the new listener");
    say(host, { t: "signal", to: peer.id, data: { sdp: "offer" } });
    assert.deepEqual((await maya.next("signal")).data, { sdp: "offer" });
    say(maya, { t: "signal", data: { sdp: "answer" } });
    const back = await host.next("signal");
    assert.equal(back.from, peer.id); assert.deepEqual(back.data, { sdp: "answer" });

    // A listener without a profile can listen but not chat.
    const lurker = await open(liveTicket({ voter: "dlurk", profile: null }, room.id, "listener")!);
    assert.equal((await lurker.next("hello")).you.canChat, false);

    say(maya, { t: "chat", text: "  hello   from maya " });
    let msg = await lurker.next("msg");
    while (msg.msg.kind !== "chat") msg = await lurker.next("msg");
    assert.equal(msg.msg.text, "hello from maya");

    // Cheers come out of a free budget per LivePod.
    say(maya, { t: "cheer", id: "headliner" });
    assert.equal((await maya.next("spent")).spent, 100);
    for (const _ of [1, 2, 3]) { await new Promise((r) => setTimeout(r, 750)); say(maya, { t: "cheer", id: "headliner" }); }
    const err = await maya.next("error");
    assert.match(err.text, /used your Cheers/);
    assert.ok(_rooms.get(room.id)!.stats.cheerPoints <= CHEER_BUDGET);

    say(lurker, { t: "like", n: 99 });
    const stats = await maya.next("room");
    assert.ok(stats.listeners >= 2);

    // The host can pin and mute.
    say(host, { t: "pin", id: msg.msg.id });
    assert.equal((await lurker.next("pinned")).msg.text, "hello from maya");
    say(host, { t: "mute", handle: "maya" });
    await lurker.next("muted");
    say(maya, { t: "chat", text: "still here?" });
    assert.match((await maya.next("error")).text, /turned off your comments/);

    say(host, { t: "end" });
    const ended = await lurker.next("ended");
    assert.equal(ended.summary.title, "Late night talk");
    assert.equal(ended.summary.listeners, 2);
    assert.ok(ended.summary.likes >= 15 && ended.summary.likes <= 16, "likes are capped per message");
    assert.equal(liveNow().length, 0);
    for (const c of [host, maya, lurker]) c.ws.close();
  } finally {
    server.close();
  }
});
