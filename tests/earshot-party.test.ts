// Pod+ Listen together: the group's shared playback, the six-mic limit, and which episodes get through.
import test from "node:test";
import assert from "node:assert/strict";
import { PARTY_LIMITS, cleanEp, control, newParty, posNow, setMic } from "../server/podcastParty";

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
