// Grade Plans' AI (POST /api/teacher-hub/grade-plans/ai). Two jobs:
//   read — the grades the teacher gave (files, photos, PDFs, links, pasted text) into a list of missing
//          and failed work per student.
//   plan — for one student and their missing or failed work: the steps, an email to each class teacher
//          asking for a retake (and where to find the work), one to the parents and one to the advisor,
//          and the teacher's to-dos.
// Plans only use the student's first name. Nothing is stored here; the page saves the plan to the Hub.
// The rules for plans are shared/gradePlans.ts.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { LessonAiError, askOpenAI, seePhotoAnyAi, type LessonAsk } from "./lessonPlanner";
import { PageError, fetchPageText, linksFrom, pagesText } from "./pageText";
import { UploadError, readUploads } from "./uploadText";
import { pdfToText } from "./pdfText";
import { ASSIGNMENTS_SLOT, RETAKE_SLOT, cleanConcern } from "../shared/gradePlans";
import { pronounRule } from "../shared/pronouns";

export type GradePlanDeps = { gate(req: any, res: any): Promise<unknown | null>; ask?: LessonAsk; seePhoto?: (dataUrl: string) => Promise<string> };

const s = (v: unknown, max: number) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\u0000/g, "").trim().slice(0, max) : "");
const limits = createAttemptLimiter({ max: 60, windowMs: 10 * 60_000 });

const READ_SYSTEM = `You read a K-12 teacher's grade report (a gradebook export, a progress report, a photo of grades, a missing-work list) and list each student's work that needs fixing. Return JSON only.
- "missing": not turned in (blank, M, MI, MSG, Missing, NHI, "0" marked missing, Incomplete).
- "failed": a score below 60% (or an F), on a test, quiz, worksheet, assignment or project.
- "low": a score from 60% up to 69% (a D). Leave out everything 70% and up, and anything excused (EX, X).
- Keep the student's name exactly as written in the grades. Keep each assignment's name as written.
- subject: the class (Math, ELA, Science…) when the report says it; teacher: the class teacher's name when it says it; score: as written ("45%", "12/30", "M"); due: YYYY-MM-DD when a date is given, else "".
Return {"concerns": [{"student": string, "assignment": string, "subject": string, "teacher": string, "score": string, "kind": "missing" | "failed" | "low", "due": string}]}. Return {"concerns": []} when nothing needs fixing.`;

const PLAN_SYSTEM = `You help a special education teacher (or case manager) make a plan for one student who has missing or failed work. Return JSON only. Write warm, professional, short emails a busy teacher can send as they are: no more than about 120 words each, plain text, no markdown.
- teacherEmails: ONE email for each class teacher involved. Ask, kindly, if the student may retake or redo the listed work, or turn in the missing work late; where the teacher keeps it (Google Classroom, a paper copy in the room, an online link) so the case manager can get it; whether there is a study guide; and say the case manager will pull the student to do it at ${RETAKE_SLOT}. Mention the student's accommodations only if given, in one short phrase.
- parentEmail: to the student's parents or guardians: what is missing or low, the plan (the retake or make-up time is ${RETAKE_SLOT}), how they can help at home in one or two concrete ways, and an invitation to reply. Encouraging, never blaming.
- advisorEmail: to the student's advisor: a short heads-up on the work and the plan, with the time ${RETAKE_SLOT}, and one way the advisor can help.
- In every email, put the exact text ${ASSIGNMENTS_SLOT} on its own line where the list of assignments goes (right after the sentence that introduces them); the list is filled in later, so never write the list yourself.
- Write the exact text ${RETAKE_SLOT} wherever the retake time goes; it is filled in later. Use only the student's first name. Sign every email with the sender's name given (or "Thank you," then a blank line if none).
- steps: 3 to 6 short steps in order (contact the teacher, get the work, schedule the pull-out, prepare supports, check back after).
- todos: 2 to 5 short to-dos for the case manager, each starting with a verb ("Get the Unit 3 test from Ms. Ruiz").
- retakeMinutes: about how long the retake or make-up will take (20, 30, 45, 60 or 90).
Return {"summary": string (two sentences), "steps": string[], "teacherEmails": [{"name": string (the class teacher), "subject": string, "body": string}], "parentEmail": {"subject": string, "body": string}, "advisorEmail": {"subject": string, "body": string}, "todos": string[], "retakeMinutes": number}.`;

function json(text: string): any {
  const t = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim();
  try { return JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

/** Everything the teacher gave, as words: files, PDFs, photos (read by the picture reader), links and pasted text. */
async function gradesText(body: any, see: (u: string) => Promise<string>): Promise<string> {
  const pasted = s(body?.text, 20_000);
  const up = readUploads(body?.files, 20_000);
  const parts: string[] = [];
  if (pasted) parts.push(pasted);
  if (up.text) parts.push(up.text);
  for (const u of up.attachments) {
    if (u.startsWith("data:application/pdf")) {
      const words = pdfToText(Buffer.from(u.slice(u.indexOf(",") + 1), "base64"), 20_000);
      if (words.replace(/\s+/g, "").length < 40) throw new UploadError("That PDF is a scan (pictures of pages), so there are no words to read. Take a screenshot or photo of it and upload that instead.");
      parts.push(words);
    } else parts.push(await see(u));
  }
  const photos: string[] = (Array.isArray(body?.images) ? body.images : []).filter((u: unknown) => typeof u === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(u) && u.length <= 4_000_000).slice(0, 6);
  for (const u of photos) parts.push(await see(u));
  const links = linksFrom(body?.links);
  if (links.length) { const pages = []; for (const l of links) pages.push(await fetchPageText(l)); parts.push(pagesText(pages, 14_000)); }
  return parts.join("\n\n").slice(0, 16_000);
}

export function registerGradePlanRoutes(app: Express, authMiddleware: RequestHandler, deps: GradePlanDeps) {
  const ask = deps.ask ?? askOpenAI;
  const see = deps.seePhoto ?? seePhotoAnyAi;
  app.post("/api/teacher-hub/grade-plans/ai", authMiddleware, async (req: any, res) => {
    const hub = await deps.gate(req, res);
    if (!hub) return;
    const mode = req.body?.mode === "plan" ? "plan" : req.body?.mode === "read" ? "read" : "";
    if (!mode) return res.status(400).json({ message: "Pick something for the AI to do." });
    const who = `u${req.user?.id}`;
    const wait = limits.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `That's a lot of AI help in a short time. Try again in ${waitWords(wait)}.` }); }
    limits.fail(who);
    try {
      if (mode === "read") {
        const text = await gradesText(req.body, see);
        if (text.replace(/\s+/g, "").length < 10) return res.status(400).json({ message: "Add the grades first: upload them, paste them, or link them." });
        const only = s(req.body?.student, 80);
        const oneStudent = only ? `These grades are all for ONE student. Use the name "${only.split(/\s+/)[0]}" for every row, and list only this student's work.\n\n` : "";
        const raw = json(await ask(READ_SYSTEM, `${oneStudent}The grades:\n\n${text}`, 4000));
        const concerns = (Array.isArray(raw?.concerns) ? raw.concerns : []).slice(0, 200).map((c: any, i: number) => cleanConcern(c, `c${i}`)).filter(Boolean);
        return res.json({ concerns });
      }
      // plan
      const first = s(req.body?.firstName, 40) || "the student";
      const concerns = (Array.isArray(req.body?.concerns) ? req.body.concerns : []).slice(0, 20).map((c: any, i: number) => cleanConcern({ ...c, student: first }, `c${i}`)).filter(Boolean) as any[];
      if (!concerns.length) return res.status(400).json({ message: "Pick at least one assignment for the plan." });
      const lines = concerns.map((c) => `- ${c.assignment}${c.subject ? ` (${c.subject})` : ""}${c.teacher ? `, teacher ${c.teacher}` : ""}: ${c.kind === "missing" ? "missing" : `${c.kind === "low" ? "low score" : "failed"}${c.score ? ` (${c.score})` : ""}`}${c.due ? `, due ${c.due}` : ""}`).join("\n");
      const user = [
        `Student's first name: ${first}`,
        pronounRule(s(req.body?.pronouns, 10), first),
        s(req.body?.grade, 20) && `Grade: ${s(req.body?.grade, 20)}`,
        s(req.body?.accommodations, 400) && `Accommodations: ${s(req.body?.accommodations, 400)}`,
        `Work to fix:\n${lines}`,
        `Sender (the case manager): ${s(req.body?.sender, 80) || "not given"}${s(req.body?.senderRole, 80) ? `, ${s(req.body?.senderRole, 80)}` : ""}`,
        s(req.body?.parentNames, 120) && `Parents: ${s(req.body?.parentNames, 120)}`,
        s(req.body?.advisorName, 80) && `Advisor: ${s(req.body?.advisorName, 80)}`,
        s(req.body?.notes, 600) && `The teacher's notes: ${s(req.body?.notes, 600)}`,
      ].filter(Boolean).join("\n");
      const raw = json(await ask(PLAN_SYSTEM, user, 3500));
      if (!raw || typeof raw !== "object") throw new LessonAiError("The AI didn't send a usable plan. Try again.");
      const email = (e: any) => ({ subject: s(e?.subject, 200), body: s(e?.body, 4000) });
      return res.json({
        summary: s(raw.summary, 1200),
        steps: (Array.isArray(raw.steps) ? raw.steps : []).map((x: unknown) => s(x, 400)).filter(Boolean).slice(0, 8),
        teacherEmails: (Array.isArray(raw.teacherEmails) ? raw.teacherEmails : []).slice(0, 8).map((e: any) => ({ name: s(e?.name, 80), ...email(e) })).filter((e: any) => e.body),
        parentEmail: email(raw.parentEmail), advisorEmail: email(raw.advisorEmail),
        todos: (Array.isArray(raw.todos) ? raw.todos : []).map((x: unknown) => s(x, 300)).filter(Boolean).slice(0, 6),
        retakeMinutes: [20, 30, 45, 60, 90].includes(Number(raw.retakeMinutes)) ? Number(raw.retakeMinutes) : 45,
      });
    } catch (e: any) {
      if (e instanceof UploadError || e instanceof PageError) return res.status(400).json({ message: e.message });
      if (e instanceof LessonAiError) return res.status(502).json({ message: e.message });
      console.error("[grade-plans] failed:", e?.message || e);
      return res.status(500).json({ message: "The AI helper ran into a problem. Try again." });
    }
  });
}
