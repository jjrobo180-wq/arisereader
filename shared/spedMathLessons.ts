// All 13 lessons of Grade 7, Unit 1 (Scale Drawings), for the Math Lessons teacher app.
import { LESSONS_1_7 } from "./spedMathLessons1";
import { LESSONS_8_13 } from "./spedMathLessons2";
import { LESSON_U4L8 } from "./spedMathLessons3";
import type { Item, Lesson } from "./spedMathUnit";

/** Unit 1 first (lessons 1 to 13), then the extra lessons. */
export const UNIT1: readonly Lesson[] = [...LESSONS_1_7, ...LESSONS_8_13];
export const EXTRA_LESSONS: readonly Lesson[] = [LESSON_U4L8];
export const LESSONS: readonly Lesson[] = [...UNIT1, ...EXTRA_LESSONS];

export const lessonByNumber = (n: number): Lesson | undefined => LESSONS.find((l) => l.n === n);

/** Every answered item in a lesson (activity items plus the exit check). */
export const lessonItems = (l: Lesson): Item[] => [...l.activities.flatMap((a) => a.items), l.exit];

/** Counts for the page header: how many answers were recomputed and how many depend on your own copy. */
export function answerCounts() {
  const all = LESSONS.flatMap(lessonItems);
  return { total: all.length, ok: all.filter((i) => i.check === "ok").length, figure: all.filter((i) => i.check === "figure").length };
}

