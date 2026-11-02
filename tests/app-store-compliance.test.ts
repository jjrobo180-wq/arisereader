// App Store readiness: deleting a Pod+ account removes what it made (Guideline 5.1.1(v)), and the
// Support form (Guideline 1.5) checks what it sends.
import test from "node:test";
import assert from "node:assert/strict";
import { deletePodData } from "../server/podcastAccounts";
import { cleanSupport } from "../server/supportContact";

/** Just enough of Supabase's client to record deletes and storage removals. */
function fakeDb(missing: string[] = []) {
  const deleted: string[] = [], removed: string[] = [];
  const db = {
    from(table: string) {
      return {
        delete() {
          return {
            eq(column: string, value: string) {
              deleted.push(`${table}.${column}=${value}`);
              return Promise.resolve({ error: missing.includes(table) ? { code: "42P01", message: `relation "${table}" does not exist` } : null });
            },
          };
        },
      };
    },
    storage: {
      from: () => ({
        list: async (dir: string) => ({ data: dir.startsWith("clips/") ? [{ name: "9.mp3" }] : [{ name: "a.jpg" }, { name: "b.mp4" }] }),
        remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; },
      }),
    },
  };
  return { db, deleted, removed };
}

test("deleting Pod+ data clears every table and the uploaded files for that person", async () => {
  const { db, deleted, removed } = fakeDb(["podscroll_comment_reports"]);
  await deletePodData(db, ["dABCDEFGHIJKLMNOP1234"]);
  for (const want of [
    "podcast_profiles.voter=dABCDEFGHIJKLMNOP1234", "podcast_posts.voter=dABCDEFGHIJKLMNOP1234", "podcast_dm_threads.a=dABCDEFGHIJKLMNOP1234",
    "podcast_dm_threads.b=dABCDEFGHIJKLMNOP1234", "podcast_people_follows.follower=dABCDEFGHIJKLMNOP1234", "podcast_blocks.blocked=dABCDEFGHIJKLMNOP1234",
    "podcast_stories.voter=dABCDEFGHIJKLMNOP1234", "podscroll_comments.user_id=ABCDEFGHIJKLMNOP1234",
  ]) assert.ok(deleted.includes(want), `missing delete: ${want}`);
  // The profile goes last, after everything that points at it.
  assert.equal(deleted.filter((d) => d.startsWith("podcast_")).at(-1), "podcast_profiles.voter=dABCDEFGHIJKLMNOP1234");
  assert.deepEqual(removed, ["dABCDEFGHIJKLMNOP1234/a.jpg", "dABCDEFGHIJKLMNOP1234/b.mp4", "clips/dABCDEFGHIJKLMNOP1234/9.mp3"]);
});

test("a real database error stops the deletion so it can be tried again", async () => {
  const db = { from: () => ({ delete: () => ({ eq: () => Promise.resolve({ error: { code: "XX000", message: "boom" } }) }) }) };
  await assert.rejects(deletePodData(db, ["dABCDEFGHIJKLMNOP1234"]));
});

test("support messages need an email and a message, and bots filling the hidden field are refused", () => {
  assert.equal(typeof cleanSupport({ email: "nope", message: "Help me please" }, "Pod+"), "string");
  assert.equal(typeof cleanSupport({ email: "a@b.co", message: "hi" }, "Pod+"), "string");
  assert.equal(typeof cleanSupport({ email: "a@b.co", message: "Help me please", website: "spam.example" }, "Pod+"), "string");
  const ok = cleanSupport({ name: " Sam ", email: "Sam@Example.com", topic: "Privacy", message: "Please delete my data." }, "Arise To Duo");
  assert.deepEqual(ok, { app: "Arise To Duo", name: "Sam", email: "sam@example.com", topic: "Privacy", message: "Please delete my data." });
  assert.equal((cleanSupport({ email: "a@b.co", topic: "Made up", message: "Hello there" }, "Pod+") as any).topic, "Other");
});
