// A parent's permission for book quizzes: camera quizzes need a parent's yes from an email, and a
// student without a proctor can email a parent a one-time proctor code. See shared/quizPermission.ts.
import { createHash, randomBytes } from "crypto";
import type { Express } from "express";
import { createAttemptLimiter } from "./attemptLimiter";
import {
  EMAIL_RE, ONE_TIME_CODE_DAYS, PERMISSION_EMAILS_PER_DAY, addCode, decideCamera, isPermissionToken, makeOneTimeCode,
  maskEmail, normalizeCode, parseBook, recordFor, requestCamera, useCode, type PermissionBook, type PermissionRecord,
} from "../shared/quizPermission";

const KEY = "parent_quiz_permissions";

type Deps = {
  getSetting: (key: string) => Promise<string | null | undefined>;
  upsertSetting: (key: string, value: string) => Promise<unknown>;
  sendEmail: (to: string, subject: string, html: string) => Promise<{ sent: boolean; error?: string }>;
  getUser: (id: number) => Promise<any>;
  isDemoStudent: (user: any) => boolean;
  getStudentParentIds: (studentId: number) => Promise<number[]>;
  /** The parent sign-up link that also connects the parent to this student. */
  parentSignupUrl: (studentId: number, origin: string) => Promise<string>;
};

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hashCode = (studentId: number, code: string) => createHash("sha256").update(`${studentId}:${normalizeCode(code)}`).digest("hex");
const originOf = (req: any) => `${String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim()}://${req.get("host")}`;

const shell = (title: string, body: string) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background-color:#0b0a16;color:#f8fafc;padding:32px;border-radius:20px;">
  <h1 style="margin:0 0 8px;color:#c4b5fd;font-size:26px;">A.R.I.S.E. Reader</h1>
  <h2 style="margin:24px 0 8px;color:#f8fafc;font-size:22px;">${title}</h2>
  ${body}
</div>`;
const p = (text: string) => `<p style="line-height:1.6;color:#cbd5e1;font-size:16px;">${text}</p>`;
const button = (href: string, label: string, color = "#7c3aed") =>
  `<a href="${href}" style="display:inline-block;background-color:${color};color:#ffffff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:12px;margin:0 8px 8px 0;">${label}</a>`;

export function cameraPermissionEmail(student: string, approveUrl: string, signupUrl: string): string {
  return shell(`${student} is asking to take quizzes with the camera`, [
    p(`${student} wants to take A.R.I.S.E. Reader book quizzes on their own, without a proctor. On these quizzes the camera stays on and takes pictures at random times, and whenever ${student} leaves the quiz screen. ${student}'s teacher, their parent and the site admin can see the pictures. Once the pictures have been reviewed, they can be deleted right away. Any that aren't are deleted automatically after 30 days.`),
    p(`${student} can't take camera quizzes until you say yes.`),
    p(`<strong>Rather not use the camera?</strong> You can say no. ${student} can still take quizzes with you as the proctor: you sit with ${student} and type a proctor password. ${student} can email you a one-time password from the quiz screen, or you can create a free parent account below to get your own Parent Proctor Code that works every time.`),
    `<p style="margin:24px 0;">${button(approveUrl, "Review and approve")}</p>`,
    p(`Want to see ${student}'s reading progress and the quiz pictures yourself? Create a free parent account:`),
    `<p style="margin:12px 0 24px;">${button(signupUrl, "Create a parent account", "#0e7490")}</p>`,
    `<p style="color:#94a3b8;font-size:13px;margin-top:24px;">If you don't know ${student}, you can ignore this email. Nothing changes unless you approve.</p>`,
  ].join("\n  "));
}

export function oneTimeCodeEmail(student: string, code: string, signupUrl: string): string {
  return shell(`Your one-time proctor code for ${student}`, [
    p(`${student} wants to take an A.R.I.S.E. Reader book quiz with you as the proctor. Sit with ${student}, and when the quiz asks for the proctor code, type this:`),
    `<p style="margin:20px 0;font-size:34px;font-weight:800;letter-spacing:.14em;color:#ffffff;background:#1e1b4b;border-radius:14px;padding:16px 20px;text-align:center;">${code}</p>`,
    p(`This code works <strong>once</strong>, for one quiz, and stops working after ${ONE_TIME_CODE_DAYS} days. Please don't give it to ${student}.`),
    p(`For the next quizzes, create a free parent account. You'll get your own Parent Proctor Code that works every time, and you can follow ${student}'s reading.`),
    `<p style="margin:24px 0;">${button(signupUrl, "Create a parent account")}</p>`,
    `<p style="color:#94a3b8;font-size:13px;margin-top:24px;">If you don't know ${student}, you can ignore this email.</p>`,
  ].join("\n  "));
}

export function registerParentQuizPermissionRoutes(app: Express, authMiddleware: any, deps: Deps) {
  const cameraSends = createAttemptLimiter({ max: PERMISSION_EMAILS_PER_DAY, windowMs: 24 * 60 * 60_000 });
  const codeSends = createAttemptLimiter({ max: PERMISSION_EMAILS_PER_DAY, windowMs: 24 * 60 * 60_000 });

  const readBook = async (): Promise<PermissionBook> => parseBook(await deps.getSetting(KEY));
  const save = async (studentId: number, rec: PermissionRecord) => {
    const book = await readBook();
    book[String(studentId)] = rec;
    await deps.upsertSetting(KEY, JSON.stringify(book));
  };
  const load = async (studentId: number) => recordFor(await readBook(), studentId, Date.now());

  const studentOnly = (req: any, res: any) => {
    if (req.user?.role !== "student" || req.user?.isAdmin) { res.status(403).json({ message: "Student account required." }); return false; }
    return true;
  };
  const demo = (req: any) => req.adminPreview || deps.isDemoStudent(req.user);
  const name = (u: any) => String(u?.displayName || u?.username || "Your student");

  app.get("/api/student/quiz-permission", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      res.set("Cache-Control", "no-store");
      if (demo(req)) return res.json({ camera: "approved", cameraEmail: "", codesWaiting: 0, parentLinked: true, demo: true });
      const rec = await load(req.user.id);
      const parentLinked = (await deps.getStudentParentIds(req.user.id)).length > 0;
      res.json({ camera: rec.camera.status, cameraEmail: maskEmail(rec.camera.email), codesWaiting: rec.codes.length, parentLinked });
    } catch { res.status(500).json({ message: "Could not check your parent's permission. Try again." }); }
  });

  app.post("/api/student/quiz-permission/camera", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      if (demo(req)) return res.json({ success: true, demo: true, camera: "approved" });
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Type your parent or guardian's email address." });
      const key = String(req.user.id);
      if (cameraSends.retryAfter(key) > 0) return res.status(429).json({ message: `You've sent ${PERMISSION_EMAILS_PER_DAY} permission emails today. Ask your parent to check their email (and their junk folder), or try again tomorrow.` });
      let rec = await load(req.user.id);
      if (rec.camera.status === "approved") return res.json({ success: true, camera: "approved" });
      const token = randomBytes(24).toString("hex");
      const origin = originOf(req);
      const result = await deps.sendEmail(email, `${name(req.user)} is asking to take A.R.I.S.E. Reader quizzes with the camera`,
        cameraPermissionEmail(esc(name(req.user)), esc(`${origin}/#/quiz-permission?token=${token}`), esc(await deps.parentSignupUrl(req.user.id, origin))));
      if (!result.sent) return res.status(503).json({ message: result.error || "Could not send the email right now. Try again in a few minutes." });
      cameraSends.fail(key);
      rec = requestCamera(rec, email, token, Date.now());
      await save(req.user.id, rec);
      res.json({ success: true, camera: rec.camera.status, cameraEmail: maskEmail(email) });
    } catch { res.status(500).json({ message: "Could not send the email right now. Try again in a few minutes." }); }
  });

  app.post("/api/student/quiz-permission/code", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      if (demo(req)) return res.json({ success: true, demo: true });
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Type your parent or guardian's email address." });
      const key = String(req.user.id);
      if (codeSends.retryAfter(key) > 0) return res.status(429).json({ message: `You've sent ${PERMISSION_EMAILS_PER_DAY} codes today. Ask your parent to check their email (and their junk folder), or try again tomorrow.` });
      const code = makeOneTimeCode(() => randomBytes(1)[0]);
      const result = await deps.sendEmail(email, `Your one-time proctor code for ${name(req.user)}`,
        oneTimeCodeEmail(esc(name(req.user)), code, esc(await deps.parentSignupUrl(req.user.id, originOf(req)))));
      if (!result.sent) return res.status(503).json({ message: result.error || "Could not send the email right now. Try again in a few minutes." });
      codeSends.fail(key);
      const now = Date.now();
      await save(req.user.id, addCode(await load(req.user.id), hashCode(req.user.id, code), email, now));
      res.json({ success: true, sentTo: maskEmail(email) });
    } catch { res.status(500).json({ message: "Could not send the email right now. Try again in a few minutes." }); }
  });

  // The parent's side: opened from the email link, no account needed.
  const byToken = async (token: string) => {
    if (!isPermissionToken(token)) return null;
    const book = await readBook();
    const now = Date.now();
    for (const [id, raw] of Object.entries(book)) {
      const rec = recordFor(book, Number(id), now);
      if (rec.camera.token === token) return { studentId: Number(id), rec, raw };
    }
    return null;
  };

  app.get("/api/quiz-permission/:token", async (req: any, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const found = await byToken(String(req.params.token));
      if (!found) return res.status(404).json({ message: "This link isn't valid anymore. Ask your student to send a new one from the quiz screen." });
      const student = await deps.getUser(found.studentId);
      res.json({
        studentName: name(student),
        status: found.rec.camera.status,
        signupUrl: await deps.parentSignupUrl(found.studentId, originOf(req)),
      });
    } catch { res.status(500).json({ message: "Could not open this request. Try again." }); }
  });

  app.post("/api/quiz-permission/:token", async (req: any, res) => {
    try {
      const token = String(req.params.token);
      const found = await byToken(token);
      if (!found) return res.status(404).json({ message: "This link isn't valid anymore. Ask your student to send a new one from the quiz screen." });
      const next = decideCamera(found.rec, token, req.body?.approve === true, Date.now());
      if (!next) return res.status(404).json({ message: "This link isn't valid anymore." });
      await save(found.studentId, next);
      res.json({ success: true, status: next.camera.status });
    } catch { res.status(500).json({ message: "Could not save your answer. Try again." }); }
  });

  return {
    /** Whether a parent has said yes to camera quizzes for this student. */
    cameraAllowed: async (studentId: number) => (await load(studentId)).camera.status === "approved",
    /** Uses up a one-time code if it matches one sent for this student. */
    redeemCode: async (studentId: number, code: string) => {
      const norm = normalizeCode(code);
      if (norm.length !== 8) return false;
      const next = useCode(await load(studentId), hashCode(studentId, norm), Date.now());
      if (!next) return false;
      await save(studentId, next);
      return true;
    },
  };
}
