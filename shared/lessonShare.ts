// A no-login link a teacher gives their school (or anyone who asks) to see their lesson plans: what each lesson
// is and how it's taught, with the files and links, never anything about a student (names, marks, scores,
// reteach groups) and never the teacher's private reflection.
import { cleanClasses, cleanLessons, type LessonClass, type LessonMaterial, type LessonPlan, MATERIAL_LABEL } from "./lessonPlanner";

export type ShareMaterial = { id: string; kind: LessonMaterial["kind"]; kindLabel: string; name: string; url?: string; file?: boolean; text?: string };
export type ShareLesson = {
  id: string; date: string; title: string; classId?: string; subject: string; unit?: string; status: string; minutes?: number;
  standards: string[];
  /** Each written part, in teaching order, only the ones filled in. */
  parts: { label: string; text: string }[];
  materials: ShareMaterial[];
};
export type ShareClass = Pick<LessonClass, "id" | "name" | "subject" | "grade" | "color" | "days" | "room" | "teacher">;
export type SharePlans = { teacher: string; classes: ShareClass[]; lessons: ShareLesson[]; from: string; to: string };

export const SHARE_PARTS: [keyof LessonPlan, string][] = [
  ["summary", "Plan"], ["objective", "Objective"], ["hook", "Warm-up"], ["iDo", "I do (model)"], ["weDo", "We do (guided practice)"],
  ["youDo", "You do (independent practice)"], ["closure", "Closure / exit ticket"], ["vocabulary", "Vocabulary"],
  ["differentiation", "Supports & differentiation"], ["assessment", "Assessment"], ["homework", "Homework"], ["materials", "Materials to prep"],
];

const isLink = (u?: string) => !!u && /^https?:\/\//i.test(u);

/** Only what the school should see, for lessons between from and to (YYYY-MM-DD). Ideas (not yet a plan) are left out. */
export function sharePlans(workspace: any, teacher: string, from: string, to: string): SharePlans {
  const lessons = cleanLessons(workspace?.lessons).filter((l) => l.date && l.date >= from && l.date <= to && l.status !== "idea");
  const classes = cleanClasses(workspace?.lessonClasses).map(({ id, name, subject, grade, color, days, room, teacher: t }) => ({ id, name, subject, grade, color, days, room, ...(t ? { teacher: t } : {}) }));
  const used = new Set(lessons.map((l) => l.classId).filter(Boolean));
  return {
    teacher, from, to,
    classes: classes.filter((c) => used.has(c.id)),
    lessons: lessons.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)).map((l): ShareLesson => ({
      id: l.id, date: l.date, title: l.title, subject: l.subject, status: l.status === "taught" ? "Taught" : l.status === "ready" ? "Ready" : "Planned",
      ...(l.classId ? { classId: l.classId } : {}), ...(l.unit ? { unit: l.unit } : {}), ...(l.minutes ? { minutes: l.minutes } : {}),
      standards: l.standards ?? [],
      parts: SHARE_PARTS.map(([k, label]) => ({ label, text: String((l as any)[k] ?? "").trim() })).filter((p) => p.text),
      materials: (l.files ?? []).filter((f) => f.kind !== "answerKey").map((f) => ({
        id: f.id, kind: f.kind, kindLabel: MATERIAL_LABEL[f.kind] ?? "File", name: f.name,
        ...(isLink(f.url) ? { url: f.url } : {}), ...(f.path ? { file: true } : {}), ...(f.text ? { text: f.text } : {}),
        ...(f.worksheet || f.slides ? { text: f.worksheet ? `${f.worksheet.title}${f.worksheet.instructions ? `\n${f.worksheet.instructions}` : ""}` : (f.slides ?? []).map((s) => s.title).join("\n") } : {}),
      })),
    })),
  };
}

/** The stored file a shared lesson's material points at, if the link is allowed to open it. */
export function sharedFilePath(workspace: any, userId: number, lessonId: string, materialId: string): { path: string; name: string } | null {
  const l = cleanLessons(workspace?.lessons).find((x) => x.id === lessonId && x.status !== "idea");
  const f = l?.files?.find((x) => x.id === materialId && x.kind !== "answerKey");
  return f?.path && f.path.startsWith(`${userId}/`) ? { path: f.path, name: f.name } : null;
}
