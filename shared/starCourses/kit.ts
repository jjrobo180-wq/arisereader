// A.R.I.S.E. Connect "Learn with a Star" courses: each course is built around ONE celebrity.
// The star is the headline: the Stars page opens on these, grouped by who teaches them.
// Every lesson's "Watch" video is a real YouTube video of that star (first id), with backups from
// the same star after it. The server checks every id with YouTube and the page skips any that are gone.

import type { Course, CourseField, CourseLesson, CoursePath, CourseQuestion } from "../connectCourses";
import type { ConnectVideo } from "../connectVideos";

/** A quick-check question. Choices are reshuffled in a fixed order (based on the question text), so
 *  the right answer isn't always in the same spot but never moves between the server and the page. */
export const Q = (q: string, o: string[], a: number, why: string): CourseQuestion => {
  let h = 2166136261;
  for (const ch of q) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const order = o.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { q, o: order.map((i) => o[i]), a: order.indexOf(a), why };
};

type LessonSpec = {
  t: string; m: number;
  /** Video ids for this lesson: the Watch video first, then backups. All must be in the course's `videos`. */
  v: string[];
  b: string[]; k: [string, string][]; q: CourseQuestion[]; try?: string;
};

export type StarSpec = {
  id: string; code: string; field: CourseField; icon: string; title: string;
  star: string; role: string;
  paths: CoursePath[]; interests: string[]; blurb: string; learn: string[]; careers: string[]; subjects: string[];
  skills: [string, string];
  /** id → [video title, YouTube channel or show]. */
  videos: Record<string, [string, string]>;
  /** Ids for the course page's spotlight (2 or more). */
  spotlight: string[];
  lessons: LessonSpec[];
};

export type BuiltStarCourse = { course: Course; lessonVideos: ConnectVideo[][]; spotlight: ConnectVideo[]; skills: string[] };

export function starCourse(s: StarSpec): BuiltStarCourse {
  const vid = (id: string): ConnectVideo => {
    const meta = s.videos[id];
    if (!meta) throw new Error(`${s.id}: video ${id} is not in its videos list`);
    return { id, title: meta[0], by: meta[1], star: s.star, role: s.role };
  };
  const lessons: CourseLesson[] = s.lessons.map((l) => ({
    title: l.t, minutes: l.m, body: l.b, terms: l.k, quiz: l.q, ...(l.try ? { tryIt: l.try } : {}),
  }));
  const course: Course = {
    id: s.id, code: s.code, field: s.field, icon: s.icon, title: s.title,
    minutes: lessons.reduce((n, l) => n + l.minutes, 0), points: 20,
    paths: s.paths, interests: s.interests, blurb: s.blurb, learn: s.learn, careers: s.careers, subjects: s.subjects,
    lessons, star: { name: s.star, role: s.role },
  };
  return { course, lessonVideos: s.lessons.map((l) => l.v.map(vid)), spotlight: s.spotlight.map(vid), skills: s.skills };
}
