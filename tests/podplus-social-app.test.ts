import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanMedia, cleanPoll, hashtags, mentions, pairOf, pollView } from "../shared/socialKit";

test("hashtags and mentions are found in posts", () => {
  assert.deepEqual(hashtags("Loved this #TrueCrime ep #truecrime #pod"), ["truecrime", "pod"]);
  assert.deepEqual(mentions("thanks @Tes_22 and @jo!"), ["tes_22"]);
});

test("only your own uploads can be attached", () => {
  const pre = "https://x.supabase.co/storage/v1/object/public/podcast-uploads/";
  assert.equal(cleanMedia([{ type: "image", url: `${pre}d1/m/a.jpg` }], pre, "d1").length, 1);
  assert.equal(cleanMedia([{ type: "image", url: `${pre}d2/m/a.jpg` }], pre, "d1").length, 0);
  assert.equal(cleanMedia([{ type: "image", url: "https://evil.example/a.jpg" }], pre, "d1").length, 0);
});

test("polls need 2-4 different choices and count votes", () => {
  assert.equal(cleanPoll({ options: ["a"], days: 1 }, Date.now()), null);
  const poll = cleanPoll({ options: ["Yes", "No"], days: 1 }, Date.now())!;
  assert.ok(poll);
  const v = pollView(poll, [{ voter: "u1", choice: 0 }, { voter: "u2", choice: 1 }, { voter: "u3", choice: 0 }], "u1", Date.now());
  assert.equal(v.total, 3);
  assert.equal(v.options[0].votes, 2);
  assert.equal(v.mine, 0);
  assert.deepEqual(pairOf("b", "a"), ["a", "b"]);
});

test("the new social app is wired in", () => {
  const plus = readFileSync(new URL("../server/podcastSocialPlus.ts", import.meta.url), "utf8");
  for (const r of ["/search", "/explore", "/profile/:handle", "/dm/with", "/dm/:id/messages", "/stories", "/block", "/posts/:id/vote"]) assert.ok(plus.includes(`\${P}${r}\``), r);
  const app = readFileSync(new URL("../client/src/components/family-hub/earshot/social/SocialApp.tsx", import.meta.url), "utf8");
  for (const s of ["<ExploreScreen", "<ProfileScreen", "<InboxScreen", "<ChatScreen", "<ActivityScreen", "<StoryTray", "<Composer"]) assert.ok(app.includes(s), s);
});
