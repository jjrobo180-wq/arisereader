// Social for Earshot + Podscroll: usernames, what a post keeps about its episode, made-episode ids, Pod Modes.
import test from "node:test";
import assert from "node:assert/strict";
import { cleanHandle, cleanPostEpisode, ownEpisodeId } from "../server/podcastSocial";
import { cleanEarshot, emptyEarshot, hiRes } from "../shared/earshot";

test("usernames, post episodes and made-episode ids", () => {
  assert.equal(cleanHandle("@Pod_Fan22"), "pod_fan22");
  assert.equal(cleanHandle("ab"), ""); assert.equal(cleanHandle("no spaces"), ""); assert.equal(cleanHandle("x".repeat(21)), "");
  const ep = cleanPostEpisode({ id: "1000797583370", showId: "1489808026", show: "Spanish", title: " A Funeral ", art: "https://a/x.jpg", audio: "https://cdn/x.mp3", secs: 652.4, date: "2026-10-22" });
  assert.deepEqual(ep && [ep.id, ep.title, ep.secs], ["1000797583370", "A Funeral", 652]);
  assert.equal(cleanPostEpisode({ id: "1", title: "x", audio: "javascript:alert(1)" }), null, "no audio, no post");
  assert.equal(ownEpisodeId(42), "77000000000042");
  assert.match(ownEpisodeId(42), /^[0-9]{1,20}$/, "fits every episode id check");
});

test("Pod Modes are kept, built-in ones always there, and covers come big", () => {
  assert.deepEqual(emptyEarshot().modes.map((m) => m.id), ["briefing", "sleep", "commute", "workout", "focus", "learn", "chores"]);
  assert.equal(emptyEarshot().modes[0].fresh, true, "the Morning Briefing starts out Fresh");
  const e = cleanEarshot({ modes: [{ id: "sleep", episodes: [{ id: "5", title: "Calm", showId: "9", audio: "https://c/a.mp3" }] }, { id: "road-trip-ab12", name: " Road  trip ", icon: "🚗", episodes: [] }, { id: "bad", name: "", episodes: [] }] });
  assert.equal(e.modes.find((m) => m.id === "sleep")!.episodes[0].audio, "https://c/a.mp3", "saved episodes keep their audio");
  assert.deepEqual(e.modes.slice(7).map((m) => [m.id, m.name, m.icon]), [["road-trip-ab12", "Road trip", "🚗"]]);
  // The order people put their modes in is kept (built-in ones they never moved stay where they were).
  const moved = cleanEarshot({ modes: [{ id: "road-trip-ab12", name: "Road trip", episodes: [] }, { id: "focus", episodes: [], fresh: true, freshDay: "2026-10-26" }] });
  const ids = moved.modes.map((m) => m.id);
  assert.ok(ids.indexOf("road-trip-ab12") < ids.indexOf("focus"), "their order is kept");
  const focus = moved.modes.find((m) => m.id === "focus")!;
  assert.equal(focus.fresh, true); assert.equal(focus.freshDay, "2026-10-26");
  assert.equal(moved.modes.length, 8);
  assert.equal(hiRes("https://is1.mzstatic.com/x/600x600bb.jpg"), "https://is1.mzstatic.com/x/1200x1200bb.jpg");
});
