// Real A.R.I.S.E. Beginners API. Reuses the existing bearer session middleware and settings DB.
// Beginner points are deliberately separate from Reader book points until prize policy is approved.
import type { Express, RequestHandler } from "express";
import { supabase } from "./supabase";
import { BEGINNER_LESSONS, BEGINNER_PUBLIC_LESSONS, beginnerLesson } from "../shared/beginners";

type RecordOfProgress = { bestScore: number; attempts: number; passedAt: string | null; lastScore: number };
const progressKey = (id: number, slug: string) => "beginners_progress_v1_" + id + "_" + slug;
const savedKey = (id: number) => "beginners_saved_v1_" + id;
const readOnly = (res: any) => res.set("Cache-Control", "private, no-store");
const permitted = (req: any, res: any): number | null => {
  if (!req.user || req.adminPreview || req.viewAsTeacher) {
    res.status(403).json({ message: "This account is in a view-only mode." }); return null;
  }
  const id = Number(req.user.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(403).json({ message: "A signed-in account is required." }); return null;
  }
  return id;
};
const cleanRecord = (raw: unknown): RecordOfProgress => {
  let item: any = {};
  try { item = typeof raw === "string" ? JSON.parse(raw) : raw || {}; } catch {}
  return {
    bestScore: Math.max(0, Math.min(100, Number(item.bestScore) || 0)),
    lastScore: Math.max(0, Math.min(100, Number(item.lastScore) || 0)),
    attempts: Math.max(0, Math.min(9999, Number(item.attempts) || 0)),
    passedAt: typeof item.passedAt === "string" ? item.passedAt : null
  };
};
async function getAllProgress(id: number) {
  const keys = BEGINNER_LESSONS.map((l) => progressKey(id, l.id));
  const { data, error } = await supabase.from("settings").select("key,value").in("key", keys);
  if (error) throw error;
  const entries = new Map((data || []).map((item: any) => [String(item.key), cleanRecord(item.value)]));
  const progress: Record<string, RecordOfProgress> = {};
  for (const l of BEGINNER_LESSONS) {
    const entry = entries.get(progressKey(id, l.id));
    if (entry) progress[l.id] = entry;
  }
  const completed = BEGINNER_LESSONS.filter((l) => progress[l.id]?.passedAt);
  return {
    progress,
    completed: completed.length,
    beginnerPoints: completed.reduce((sum, l) => sum + l.points, 0)
  };
}
async function savedFor(id: number): Promise<string[]> {
  const { data, error } = await supabase.from("settings").select("value").eq("key", savedKey(id)).maybeSingle();
  if (error) throw error;
  try {
    const parsed = JSON.parse(String(data?.value || "[]"));
    return Array.isArray(parsed) ? parsed.filter((v: unknown) => typeof v === "string" && !!beginnerLesson(v)).slice(0, 50) : [];
  } catch { return []; }
}
export function registerBeginnersRoutes(app: Express, auth: RequestHandler) {
  app.get("/api/beginners/catalog", auth, (req: any, res) => {
    readOnly(res);
    if (permitted(req,res) === null) return;
    res.json({ lessons: BEGINNER_PUBLIC_LESSONS, passingScore: 80 });
  });
  app.get("/api/beginners/state", auth, async (req: any, res) => {
    readOnly(res);
    const userId = permitted(req,res); if (userId === null) return;
    try { res.json({ ...(await getAllProgress(userId)), saved: await savedFor(userId) }); }
    catch (error) { console.error("[beginners] state read failed",error); res.status(503).json({message:"Progress is temporarily unavailable. Try again."}); }
  });
  app.post("/api/beginners/save", auth, async (req: any, res) => {
    readOnly(res);
    const userId = permitted(req,res); if (userId === null) return;
    const lessonId = String(req.body?.lessonId || "");
    if (!beginnerLesson(lessonId) || typeof req.body?.saved !== "boolean") return res.status(400).json({message:"Invalid save request."});
    try {
      const current = await savedFor(userId);
      const next = req.body.saved ? Array.from(new Set([...current,lessonId])) : current.filter(x => x !== lessonId);
      const { error } = await supabase.from("settings").upsert({key:savedKey(userId),value:JSON.stringify(next)},{onConflict:"key"});
      if (error) throw error;
      res.json({saved:next});
    } catch (error) { console.error("[beginners] save failed",error); res.status(503).json({message:"Could not save this lesson."}); }
  });
  app.post("/api/beginners/attempt", auth, async (req: any, res) => {
    readOnly(res);
    const userId = permitted(req,res); if (userId === null) return;
    if ((req.user.role || "student") !== "student" || req.user.isAdmin) return res.status(403).json({message:"Only student accounts can earn Beginners points."});
    const l = beginnerLesson(String(req.body?.lessonId || ""));
    const answers: unknown = req.body?.answers;
    if (!l || !Array.isArray(answers) || answers.length !== l.questions.length ||
        !answers.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 2))
      return res.status(400).json({message:"Complete every question before submitting."});
    const correct = l.questions.reduce((sum, q, i) => sum + (q.correct === answers[i] ? 1 : 0), 0);
    const score = Math.round((correct / l.questions.length) * 100);
    const passed = score >= 80;
    const key = progressKey(userId,l.id);
    try {
      const { data, error: readError } = await supabase.from("settings").select("value").eq("key",key).maybeSingle();
      if (readError) throw readError;
      const current = cleanRecord(data?.value);
      const firstPass = passed && !current.passedAt;
      const next: RecordOfProgress = {
        bestScore: Math.max(current.bestScore,score),
        lastScore: score,
        attempts: Math.min(9999,current.attempts + 1),
        passedAt: current.passedAt || (passed ? new Date().toISOString() : null)
      };
      const { error: writeError } = await supabase.from("settings").upsert({key,value:JSON.stringify(next)},{onConflict:"key"});
      if (writeError) throw writeError;
      const state = await getAllProgress(userId);
      res.json({ passed,score,correct,total:l.questions.length,firstPass,earned: firstPass ? l.points : 0,
        review:l.questions.map((q,i)=>({correct:q.correct,wasCorrect:q.correct===answers[i],hint:q.hint})),
        ...state });
    } catch (error) { console.error("[beginners] submission failed",error); res.status(503).json({message:"Your answers could not be saved. Please retry."}); }
  });
}
