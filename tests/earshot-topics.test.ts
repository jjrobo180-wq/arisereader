// Browse by subject: the subject list, how a topic's playlist is built, and the /topic route
// (with a fake Apple directory).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUBJECTS, TOPICS, subjectsFor, topicPlaylist } from "../shared/earshotTopics";

const ep = (id: string, showId: string, secs = 1800) => ({ id, showId, secs, title: `Episode ${id}` });

test("every topic has a unique, safe id, search terms, and fits a saved playlist id", () => {
  const ids = SUBJECTS.flatMap((s) => s.topics.map((t) => t.id));
  assert.equal(new Set(ids).size, ids.length, "topic ids must be unique");
  for (const s of SUBJECTS) {
    assert.ok(s.topics.length >= 4, `${s.id} has too few topics`);
    for (const t of s.topics) {
      assert.match(t.id, /^[a-z0-9-]+$/);
      assert.ok(`t-${t.id}`.length <= 24, `${t.id} is too long for a playlist id`);
      assert.ok(t.terms.length >= 1 && t.terms.every((x) => x.trim().length >= 2));
      assert.ok(t.name.length <= 30, `${t.name} is too long for a playlist name`);
      assert.equal(TOPICS[t.id].subject.id, s.id);
    }
  }
  assert.equal(TOPICS.ww2.name, "World War II");
  assert.equal(TOPICS.ww2.subject.name, "History");
});

test("students only see kid-safe subjects", () => {
  assert.ok(subjectsFor(true).every((s) => s.kidSafe));
  assert.ok(subjectsFor(true).some((s) => s.id === "history"));
  assert.ok(!subjectsFor(true).some((s) => s.id === "mystery"));
  assert.equal(subjectsFor(false).length, SUBJECTS.length);
});

test("a playlist has no repeats, skips trailers, and caps episodes per show", () => {
  const list = topicPlaylist([
    [ep("1", "a"), ep("2", "a"), ep("3", "a"), ep("4", "a"), ep("5", "b"), ep("1", "a"), ep("6", "c", 60)],
    [ep("7", "d"), ep("5", "b")],
  ], 40, 3);
  assert.deepEqual(list.map((e) => e.id), ["1", "2", "3", "5", "7"]);
  assert.equal(topicPlaylist([[ep("1", "a"), ep("2", "b"), ep("3", "c")]], 2).length, 2);
});

test("the topic route is wired in and Explore shows subjects", () => {
  const server = readFileSync("server/earshot.ts", "utf8");
  assert.match(server, /app\.get\(`\$\{P\}\/topic\/:id`/);
  assert.match(server, /topic\.subject\.kidSafe/);
  const player = readFileSync("client/src/components/family-hub/earshot/EarshotPlayer.tsx", "utf8");
  assert.match(player, /<SubjectGrid /);
  assert.match(player, /onSaveTopic=\{saveTopic\}/);
});
