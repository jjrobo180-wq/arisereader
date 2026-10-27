// Run with: npx tsx --test tests/connect-career-paths.test.ts
// Lawyer, Auto Mechanic, Doctor and Fast Food career paths, and 100 more star lessons across Connect.
import test from "node:test";
import assert from "node:assert/strict";
import { CAREER_STAR_COURSES, STAR_COURSES } from "../shared/starCourses";
import { COURSES, COURSE_FIELDS, COURSE_SKILLS, LEARNING_PATHS, answersCorrect, courseById } from "../shared/connectCourses";
import { LESSON_VIDEOS, COURSE_STARS } from "../shared/connectVideos";
import { careerById } from "../shared/ariseSocial";
import { videosForCareer } from "../shared/ariseConnectVideos";

test("100 new lessons in 20 more star courses, each a full lesson with a video of its own star", () => {
  assert.equal(CAREER_STAR_COURSES.length, 20);
  assert.equal(CAREER_STAR_COURSES.reduce((n, c) => n + c.lessons.length, 0), 100);
  const before = new Set(STAR_COURSES.map((c) => c.star!.name));
  const ids = new Set<string>();
  for (const c of CAREER_STAR_COURSES) {
    assert.ok(!ids.has(c.id), `${c.id} is unique`); ids.add(c.id);
    assert.ok(COURSES.includes(c), `${c.id} is in the catalog`);
    assert.ok(!before.has(c.star!.name), `${c.star!.name} is a new star`);
    assert.ok(COURSE_FIELDS[c.field], `${c.id} field ${c.field}`);
    assert.ok(COURSE_SKILLS[c.id]?.length === 2, `${c.id} adds skills for the certificate`);
    assert.equal(LESSON_VIDEOS[c.id].length, 5);
    assert.ok(COURSE_STARS[c.id].length >= 3);
    for (const l of c.lessons) {
      assert.equal(l.video?.star, c.star!.name, `${c.id}: ${l.title}`);
      assert.ok(l.body.length === 3 && l.terms.length >= 2 && l.quiz.length >= 2, `${c.id}: ${l.title} is a full lesson`);
      assert.ok(answersCorrect(l, l.quiz.map((q) => q.a)));
      for (const q of l.quiz) assert.ok(q.o.length === 4 && q.a >= 0 && q.a < 4 && q.why, `${c.id}: ${q.q}`);
    }
  }
  assert.equal(new Set(CAREER_STAR_COURSES.map((c) => c.star!.name)).size, 20, "one star per course");
  const spots = [0, 0, 0, 0];
  for (const c of CAREER_STAR_COURSES) for (const l of c.lessons) for (const q of l.quiz) spots[q.a]++;
  assert.ok(spots.every((n) => n > 25), `right answers spread out: ${spots}`);
});

test("the four requested career paths exist with their courses, careers and videos", () => {
  const want: Record<string, string[]> = {
    lawyer: ["s-rbg", "s-sotomayor", "s-stevenson"],
    mechanic: ["s-leno", "s-foose", "s-chrisfix"],
    doctor: ["s-doctormike", "s-gawande", "s-jemison"],
    fastfood: ["s-shaq", "s-fieri", "s-meyer"],
  };
  for (const [id, courses] of Object.entries(want)) {
    const p = LEARNING_PATHS.find((x) => x.id === id);
    assert.ok(p, `${id} path`);
    for (const c of courses) assert.ok(p!.courses.includes(c), `${id} includes ${c}`);
    for (const c of p!.courses) assert.ok(courseById(c), `${id}: ${c} is a real course`);
  }
  for (const c of ["lawyer", "fastfood", "doctor", "autotech"]) {
    assert.ok(careerById(c), c);
    assert.ok(videosForCareer(c).length >= 1, `${c} has an Explore video`);
  }
  assert.equal(LEARNING_PATHS[0].id, "music-stars");
});

test("the extra stars were added to the existing paths too, and every path points at real courses", () => {
  const extra = ["s-savage", "s-rober", "s-gates", "s-tyson", "s-biles", "s-ninja", "s-duvernay", "s-daymond"];
  for (const id of extra) assert.ok(LEARNING_PATHS.some((p) => !["lawyer", "mechanic", "doctor", "fastfood"].includes(p.id) && p.courses.includes(id)), `${id} is on an existing path`);
  for (const p of LEARNING_PATHS) for (const c of p.courses) assert.ok(courseById(c), `${p.id}: ${c}`);
});
