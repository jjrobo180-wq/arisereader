// Arise Math: practice built lesson by lesson on a published curriculum. The questions are original,
// written to the lesson's learning goals with their own numbers and checked by tests/arise-math-curriculum.test.ts.
// Adapted from IM 6–8 Math, authored by Illustrative Mathematics, originally developed by Open Up Resources
// (openupresources.org). Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
import { type Choice, cleanText, numberChoices, type Problem, type Rng, fmtV } from "./ariseMath";

export type CurriculumQuestion = {
  q: string;
  /** The answer: a number, or the exact text of the right choice. */
  answer: number | string;
  /** Multiple choice answers. Left out when the answer is typed. */
  choices?: string[];
  steps: string[];
};
export type CurriculumVideo = { id: string; title: string; by: string };
export type CurriculumLesson = { id: string; grade: number; unit: number; lesson: number; unitTitle: string; title: string; goal: string; sourceUrl: string; videos: CurriculumVideo[]; questions: CurriculumQuestion[] };

export const CURRICULUM_CREDIT = "Adapted from IM 6–8 Math by Illustrative Mathematics, originally developed by Open Up Resources. CC BY 4.0.";

export const CURRICULUM_LESSONS: CurriculumLesson[] = [{
  id: "cur-g7-u4-l1", grade: 7, unit: 4, lesson: 1, unitTitle: "Proportional Relationships and Percentages", title: "Lots of Flags",
  goal: "Keep a shape's proportions when it changes size, use fractions to find scaled lengths, and see what percent of a flag a part covers.",
  sourceUrl: "https://im.kendallhunt.com/MS/students/2/4/1/index.html",
  videos: [
    { id: "Ezr-pn_GoMc", title: "7th Grade, Unit 4, Lesson 1: Lots of Flags", by: "Illustrative Tutor" },
    { id: "Ma93IB-XZEM", title: "Grade 7, Unit 4.1: Lots of Flags", by: "Wrestle with Math" },
  ],
  questions: [
    { q: "A rectangle is 6 cm wide and 4 cm tall. Which rectangle is a scaled copy of it?", choices: ["9 cm wide, 6 cm tall", "8 cm wide, 6 cm tall", "10 cm wide, 8 cm tall", "12 cm wide, 4 cm tall"], answer: "9 cm wide, 6 cm tall",
      steps: ["A scaled copy has the same width ÷ height as the original.", "The original: 6 ÷ 4 = 1 1/2.", "Check each one: 9 ÷ 6 = 1 1/2. The others are 8 ÷ 6 = 1 1/3, 10 ÷ 8 = 1 1/4, and 12 ÷ 4 = 3.", "Only 9 cm by 6 cm matches."] },
    { q: "Are a rectangle 4 ft by 6 ft and a rectangle 6 ft by 8 ft scaled copies of each other?", choices: ["Yes, each side grew by 2 ft", "No, their side ratios are different", "Yes, both are rectangles", "No, one has longer sides"], answer: "No, their side ratios are different",
      steps: ["Adding the same amount doesn't make a scaled copy. You have to multiply both sides by the same number.", "4 ÷ 6 = 2/3.", "6 ÷ 8 = 3/4.", "2/3 and 3/4 aren't equal, so they aren't scaled copies."] },
    { q: "A photo is 8 inches wide and 6 inches tall. It is enlarged to be 20 inches wide, with the same proportions. How many inches tall is it now?", answer: 15,
      steps: ["Find the scale factor: new width ÷ old width.", "20 ÷ 8 = 2 1/2.", "Multiply the height by the same factor: 6 × 2 1/2 = 15.", "The photo is 15 inches tall."] },
    { q: "A banner is 24 ft wide and 16 ft tall. A scaled copy is 6 ft wide. How many feet tall is the copy?", answer: 4,
      steps: ["Find the scale factor: 6 ÷ 24 = 1/4.", "The copy is smaller, so the factor is less than 1.", "16 × 1/4 = 4.", "The copy is 4 ft tall."] },
    { q: "A mural is 12 ft wide and 3 ft tall. A scaled copy is 2 ft wide. How many feet tall is the copy? Answer as a fraction or a decimal.", answer: 0.5,
      steps: ["Find the scale factor: 2 ÷ 12 = 1/6.", "Multiply the height by the same factor.", "3 × 1/6 = 1/2.", "The copy is 1/2 ft tall."] },
    { q: "A school flag is 30 ft long and 20 ft tall. Its blue corner is 12 ft long and 8 ft tall. A smaller copy of the flag is 15 ft long and 10 ft tall. How many feet long is the blue corner on the copy?", answer: 6,
      steps: ["Compare the whole flags: 15 ÷ 30 = 1/2, and 10 ÷ 20 = 1/2.", "Every part of the flag changes by the same factor.", "12 × 1/2 = 6.", "The blue corner is 6 ft long."] },
    { q: "A flag is 8 ft long and 5 ft tall. Its blue corner is 3 1/2 ft long. A bigger copy of the flag is 16 ft long and 10 ft tall. How many feet long is the blue corner on the bigger copy?", answer: 7,
      steps: ["Find the scale factor: 16 ÷ 8 = 2.", "Write the mixed number as a fraction: 3 1/2 = (3 × 2 + 1)/2 = 7/2.", "Multiply: 7/2 × 2 = 14/2 = 7.", "The blue corner is 7 ft long."] },
    { q: "A flag is 8 ft long and 5 ft tall. Its blue corner is 2 1/4 ft tall. A bigger copy of the flag is 16 ft long and 10 ft tall. How many feet tall is the blue corner on the bigger copy? Answer as a fraction, a mixed number or a decimal.", answer: 4.5,
      steps: ["Find the scale factor: 10 ÷ 5 = 2.", "Write the mixed number as a fraction: 2 1/4 = (2 × 4 + 1)/4 = 9/4.", "Multiply: 9/4 × 2 = 18/4 = 4 1/2.", "The blue corner is 4 1/2 ft tall."] },
    { q: "A flag is 9 ft long and 6 ft tall. Its blue corner is 3 3/4 ft long. A small copy of the flag is 3 ft long and 2 ft tall. How many feet long is the blue corner on the small copy? Answer as a fraction, a mixed number or a decimal.", answer: 1.25,
      steps: ["Find the scale factor: 3 ÷ 9 = 1/3.", "Write the mixed number as a fraction: 3 3/4 = (3 × 4 + 3)/4 = 15/4.", "Multiply: 15/4 × 1/3 = 15/12 = 1 1/4.", "The blue corner is 1 1/4 ft long."] },
    { q: "An official flag's height and length are in the ratio 1 : 1.9. If a flag is 5 ft tall, how many feet long is it?", answer: 9.5,
      steps: ["The ratio says the length is 1.9 times the height.", "5 × 1.9 = 9.5.", "The flag is 9.5 ft long."] },
    { q: "A flag is 10 ft long and 5 ft tall. Its blue corner is 4 ft long and 2 1/2 ft tall. What percent of the flag is the blue corner?", answer: 20,
      steps: ["Find the flag's area: 10 × 5 = 50 square feet.", "Find the corner's area: 4 × 2 1/2 = 10 square feet.", "Compare the parts: 10 ÷ 50 = 1/5.", "1/5 is the same as 20 out of 100, or 20%."] },
    { q: "A flag is 8 ft long and 5 ft tall. Its corner patch is 2 ft long and 3 ft tall. What percent of the flag is NOT the corner patch?", answer: 85,
      steps: ["Find the flag's area: 8 × 5 = 40 square feet.", "Find the patch's area: 2 × 3 = 6 square feet.", "The patch is 6 ÷ 40 = 0.15, which is 15% of the flag.", "The rest is 100 − 15 = 85%."] },
    { q: "On a flag 12 ft long and 6 ft tall, the blue corner covers 25% of the flag. A scaled copy is 24 ft long and 12 ft tall. What percent of the copy does its blue corner cover?", answer: 25,
      steps: ["Both flags keep their proportions, and so does the corner.", "Doubling both sides makes each area 4 times as big, for the flag and for the corner.", "Their comparison doesn't change.", "The corner still covers 25%."] },
  ],
}];

export const curriculumLesson = (id: unknown) => CURRICULUM_LESSONS.find((l) => l.id === id) ?? null;

const htmlEsc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const shuffled = <T,>(list: T[], r: Rng): T[] => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** One curriculum question, ready for the quiz. */
export function curriculumProblem(lesson: CurriculumLesson, c: CurriculumQuestion, r: Rng = Math.random): Problem & { topic: string; videos: CurriculumVideo[] } {
  const typed = typeof c.answer === "number";
  const choices: Choice[] = typed ? numberChoices(c.answer as number, false, r) : shuffled(c.choices ?? [], r).map((label) => ({ v: label, label }));
  return {
    skill: "custom", ask: `Grade ${lesson.grade}, Unit ${lesson.unit}, Lesson ${lesson.lesson}: ${cleanText(lesson.title, 60)}`, prompt: htmlEsc(c.q), plain: c.q, viz: "", long: true,
    kind: typed ? "num" : "choice", answer: c.answer, choices, steps: c.steps.map(htmlEsc), topic: lesson.title, videos: lesson.videos,
  };
}

/** A quiz of n different questions, in a new order each time. */
export function curriculumQuiz(lesson: CurriculumLesson, n: number, r: Rng = Math.random) {
  return shuffled(lesson.questions, r).slice(0, n).map((q) => curriculumProblem(lesson, q, r));
}

/** What a teacher sees: the lesson, every question, answer and step. */
export const curriculumForStaff = () => CURRICULUM_LESSONS.map((l) => ({ ...l, credit: CURRICULUM_CREDIT, questions: l.questions.map((q) => ({ ...q, answerLabel: typeof q.answer === "number" ? fmtV(q.answer) : q.answer })) }));
