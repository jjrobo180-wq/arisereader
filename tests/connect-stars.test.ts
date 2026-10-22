import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAR_VIDEOS, VALID_VIDEO_ID, videosForCareer } from "../shared/ariseConnectVideos";
import { CAREERS, CLUSTERS, QUESTS, careerById } from "../shared/ariseSocial";
import { createVideoChecker } from "../server/connectVideos";
import { COURSE_STARS, LESSON_VIDEOS, CAREER_VIDEOS, allConnectVideoIds } from "../shared/connectVideos";
import { COURSES } from "../shared/connectCourses";

test("every star video is a real-looking YouTube id, tied to real careers, with a famous person and something to try", () => {
  const ids = new Set<string>();
  for (const v of STAR_VIDEOS) {
    assert.match(v.id, VALID_VIDEO_ID, v.id);
    assert.ok(!ids.has(v.id), `duplicate ${v.id}`); ids.add(v.id);
    assert.ok(v.star && v.known && v.title && v.try.length > 10, v.id);
    assert.ok(v.careers.length > 0 && v.careers.every((c) => careerById(c)), `${v.id} careers`);
    assert.ok(v.ages === "all" || v.ages === "teen");
  }
  assert.ok(STAR_VIDEOS.length >= 40);
});

test("the careers kids asked for are courses with star videos: chef (Gordon Ramsay), gamers, athletes, game design…", () => {
  for (const id of ["chef", "progamer", "gamedesigner", "athlete", "creator", "musician", "actor", "astronaut", "entrepreneur", "scientist"]) {
    assert.ok(careerById(id), id);
    assert.ok(videosForCareer(id).length >= 1, `${id} has videos`);
  }
  assert.ok(videosForCareer("chef").every((v) => v.star === "Gordon Ramsay"));
  assert.ok(videosForCareer("progamer").some((v) => v.star === "Ninja"));
  assert.ok(CLUSTERS.perform && CAREERS.filter((c) => c.c === "perform").length >= 4);
  // Most careers have star videos, and K–5 always has some to watch.
  assert.ok(CAREERS.filter((c) => videosForCareer(c.id).length).length >= CAREERS.length * 0.75);
  assert.ok(STAR_VIDEOS.filter((v) => v.ages === "all").length >= 30);
  for (const band of ["k2", "g35", "g68", "g912"] as const) assert.ok(QUESTS[band].some((q) => /star/i.test(q.title)), band);
});

test("every course lesson's Watch video, and every spotlight, is a famous person — no generic channels", () => {
  for (const c of COURSES) {
    assert.equal(LESSON_VIDEOS[c.id]?.length, c.lessons.length, `${c.id} has a video list for every lesson`);
    c.lessons.forEach((l, i) => {
      assert.ok(l.video?.star, `${c.id} lesson ${i + 1} has a star video`);
      assert.ok((l.backups || []).every((v) => v.star), `${c.id} lesson ${i + 1} backups are stars`);
    });
    assert.ok((c.stars || []).length >= 2 && c.stars!.every((v) => v.star && v.role), `${c.id} spotlight`);
  }
  const every = [...Object.values(LESSON_VIDEOS).flat(2), ...Object.values(COURSE_STARS).flat(), ...Object.values(CAREER_VIDEOS)];
  for (const v of every) {
    assert.match(v.id, VALID_VIDEO_ID, v.id);
    assert.ok(v.star && v.role, `${v.id} names its star`);
    assert.doesNotMatch(v.by, /CareerOneStop|Twinkl|StudioBinder|Engineering Mindset|Safelyio/i, `${v.id} is not a generic channel`);
  }
  assert.ok(COURSES.some((c) => c.id === "game" && c.lessons[0].video!.star === "Shigeru Miyamoto"));
  assert.ok(COURSES.find((c) => c.id === "culn")!.lessons.every((l) => l.video!.star === "Gordon Ramsay"));
});

test("the server hides videos YouTube says are gone or can't be embedded, and shows YouTube's real title and channel", async () => {
  const [a, b, c, d] = STAR_VIDEOS.map((v) => v.id);
  const fake = (async (url: string) => {
    const id = decodeURIComponent(String(url)).match(/v=([\w-]{11})/)![1];
    if (id === a) return new Response(JSON.stringify({ title: "Real title", author_name: "Gordon Ramsay" }), { status: 200 });
    if (id === b) return new Response("Not Found", { status: 404 });
    if (id === c) return new Response("Unauthorized", { status: 401 }); // embedding turned off
    if (id === d) throw new Error("offline");
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const checker = createVideoChecker(fake);
  const out = await checker.videos(2000);
  assert.deepEqual([...out.hidden].sort(), [b, c].sort());
  const first = out.videos.find((v) => v.id === a)!;
  assert.equal(first.ytTitle, "Real title");
  assert.equal(first.channel, "Gordon Ramsay");
  assert.ok(out.videos.some((v) => v.id === d), "an unreachable YouTube never hides a video");
  assert.equal(out.videos.length, STAR_VIDEOS.length - 2);
  assert.ok(out.checked >= allConnectVideoIds().length - 1, "lesson and spotlight videos are checked too");
});

test("main course cards and individual lesson choices show the actual star video thumbnail", () => {
  const page = readFileSync(new URL("../client/public/social/index.html", import.meta.url), "utf8");
  assert.match(page, /const courseFeaturedVideo = c =>/);
  assert.match(page, /class="course-celeb-hero"/);
  assert.match(page, /class="course-celeb-chip"/);
  assert.match(page, /class="lesson-star-thumb"/);
  assert.match(page, /https:\/\/i\.ytimg\.com\/vi\//);
  for (const c of COURSES) {
    assert.ok(c.stars?.some((v) => v.star && v.id), `${c.id} has a featured celebrity with a video still`);
    for (const l of c.lessons) assert.ok(l.video?.id && l.video?.star, `${c.id}: ${l.title} has a celebrity with a video still`);
  }
});

test("the Connect page opens on Stars, skips videos YouTube removed, and only shows K–5 the all-ages videos", () => {
  const page = readFileSync(new URL("../client/public/social/index.html", import.meta.url), "utf8");
  assert.match(page, /S\.tab = 'stars';/);
  assert.match(page, /\['stars','Stars','tv'\]/);
  assert.match(page, /youtube-nocookie\.com\/embed\//);
  assert.match(page, /const okVid = v => v && \/\^\[A-Za-z0-9_-\]\{11\}\$\/\.test\(v\.id\|\|''\) && !HIDDEN\.has\(v\.id\);/);
  assert.match(page, /const lessonVid = l => \[l\.video, \.\.\.\(l\.backups\|\|\[\]\)\]\.find\(okVid\)/);
  assert.match(page, /const starOk = v => okVid\(v\) && \(v\.ages==='all' \|\| \(ME && !young\(bandNow\(\)\)\)\);/);
  assert.match(page, /<h3 class="rail-h">Watch the pros<\/h3>/);
  assert.doesNotMatch(page, /See the job/);
});
