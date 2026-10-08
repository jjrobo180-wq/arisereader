// A teacher or the admin types a parent's email for a student, and the site sends that parent an
// email about the program, what a parent account does, and how to sign up with the student's code.
// The parent does not need an account first. Who was invited, and when, is kept with the site's settings.
import type { Express } from "express";
import {
  INVITES_PER_ADDRESS_PER_DAY, NEW_FAMILY_KEY, PARENT_INVITE_LOG_KEY, STAFF_INVITES_PER_DAY,
  cleanChildName, cleanInviteNote, cleanParentEmail, inviteSummary, invitesFor, readInviteLog, recordInvite, sentInLastDay,
} from "../shared/parentInvites";
import { DEFAULT_INVITE_PRIZES, INVITE_PRIZES_KEY, cleanPrizeLines, competitionLines, invitePrizeLines, readInvitePrizes } from "../shared/invitePrizes";
import { PLANS } from "../shared/plans";
import { familyInviteEmail, familyInviteText, parentProgramEmail, parentProgramText } from "./emailFormat";

export type InviteSender = { id: number; displayName?: string | null; username?: string | null; isAdmin?: boolean; role?: string; email?: string | null; accountApproved?: boolean; school_id?: number | null };
export type InviteStudent = { id: number; displayName?: string | null; role?: string; teacherId?: number | null; isAdmin?: boolean };

export type ParentInviteDeps = {
  getStudent(id: number): Promise<InviteStudent | null | undefined>;
  getSetting(key: string): Promise<string | null | undefined>;
  saveSetting(key: string, value: string): Promise<unknown>;
  /** The student's parent code, made if there is none yet ("ABCD-EF01-..."). */
  parentCode(studentId: number): Promise<{ formattedCode: string }>;
  /** Email addresses of the parent accounts already connected to this student. */
  linkedParentEmails(studentId: number): Promise<string[]>;
  /** Email addresses that already have a parent account (for an invitation to a family that is new to the site). */
  parentAccountEmails?(): Promise<string[]>;
  /** The prize lines the admin set for invitations. Left out, the built-in ones are used. */
  invitePrizes?(): Promise<string[]>;
  /** The name of a school on the site, for a teacher's invitation. */
  schoolName?(schoolId: number): Promise<string | null | undefined>;
  emailConfigured(): boolean;
  sendEmail(to: string, subject: string, html: string, options: { replyTo?: string; fromName?: string }): Promise<{ sent: boolean; error?: string }>;
  siteUrl: string;
  now(): number;
};

type Reply = { status: number; body: Record<string, unknown> };
/** The "Prizes and competitions" lines for an invitation written right now: the admin's prizes, then the competitions that are on. */
async function prizesNow(deps: ParentInviteDeps, site: string): Promise<string[]> {
  let saved = DEFAULT_INVITE_PRIZES;
  try { saved = (await deps.invitePrizes?.()) ?? DEFAULT_INVITE_PRIZES; } catch { /* the built-in ones will do */ }
  return invitePrizeLines(saved, deps.now(), site);
}
const no = (status: number, message: string): Reply => ({ status, body: { message } });

/** The student, if this person may write to their parents: the admin for anyone, a teacher for their own roster. */
async function reachable(deps: ParentInviteDeps, sender: InviteSender, studentId: unknown): Promise<InviteStudent | Reply> {
  if (!sender.isAdmin && sender.role !== "teacher") return no(403, "Teacher or admin access required.");
  if (!sender.isAdmin && sender.accountApproved === false) return no(403, "Teacher account approval required.");
  const id = Number(studentId);
  if (!Number.isSafeInteger(id) || id < 1) return no(400, "Choose a student first.");
  const student = await deps.getStudent(id);
  if (!student || student.role !== "student" || student.isAdmin || (!sender.isAdmin && student.teacherId !== sender.id)) return no(404, "That student is not on your roster.");
  return student;
}

/** Who has been invited for this student. */
export async function listParentInvites(deps: ParentInviteDeps, sender: InviteSender, studentId: unknown): Promise<Reply> {
  const student = await reachable(deps, sender, studentId);
  if ("status" in student) return student;
  const log = readInviteLog(await deps.getSetting(PARENT_INVITE_LOG_KEY));
  return { status: 200, body: { invites: inviteSummary(invitesFor(log, student.id)), emailReady: deps.emailConfigured() } };
}

/** Sends the invitation and remembers it. `origin` is the site's address as the sender sees it ("https://www.arisereader.com"). */
export async function sendParentInvite(deps: ParentInviteDeps, sender: InviteSender, input: { studentId?: unknown; email?: unknown; note?: unknown }, origin: string): Promise<Reply> {
  const student = await reachable(deps, sender, input?.studentId);
  if ("status" in student) return student;
  const email = cleanParentEmail(input?.email);
  if (!email) return no(400, "Enter the parent's or guardian's email address, like name@example.com.");
  const studentName = String(student.displayName || "your child").trim();
  if (!deps.emailConfigured()) return no(503, "Email isn't set up on the site yet, so the invitation could not be sent. You can print the parent letter instead.");

  const linked = (await deps.linkedParentEmails(student.id)).map((e) => cleanParentEmail(e)).filter(Boolean);
  if (linked.includes(email)) return no(409, `${email} already has a parent account connected to ${studentName}. Nothing was sent.`);

  const log = readInviteLog(await deps.getSetting(PARENT_INVITE_LOG_KEY));
  const now = deps.now();
  // Limits keep a typo or a stuck button from filling someone's inbox, which would get all the site's mail marked as junk.
  if (sentInLastDay(log, { email }, now) >= INVITES_PER_ADDRESS_PER_DAY) return no(429, `${email} has already been sent ${INVITES_PER_ADDRESS_PER_DAY} invitations today. Try again tomorrow, or print the parent letter.`);
  if (sentInLastDay(log, { by: sender.id }, now) >= STAFF_INVITES_PER_DAY) return no(429, `You have sent ${STAFF_INVITES_PER_DAY} invitations today, which is the most for one day. You can send more tomorrow.`);

  const senderName = String(sender.displayName || sender.username || "Your child's teacher").trim();
  const { formattedCode } = await deps.parentCode(student.id);
  const signupUrl = `${origin.replace(/\/+$/, "")}/#/parent-signup?code=${encodeURIComponent(formattedCode)}`;
  const replyTo = cleanParentEmail(sender.email) || undefined;
  const result = await deps.sendEmail(
    email,
    `${senderName} invited you to follow ${studentName}'s reading on A.R.I.S.E. Reader`,
    parentProgramEmail({ studentName, senderName, signupUrl, code: formattedCode, siteUrl: deps.siteUrl, maxChildren: PLANS.parentMaxChildren, prizes: await prizesNow(deps, origin.replace(/\/+$/, "")), note: cleanInviteNote(input?.note) }),
    { fromName: senderName, ...(replyTo ? { replyTo } : {}) },
  );
  if (!result.sent) return no(503, "The invitation could not be sent just now. Nothing was sent. Please try again in a minute.");

  // Read again before saving, so two invitations sent at the same moment are both kept.
  const fresh = readInviteLog(await deps.getSetting(PARENT_INVITE_LOG_KEY));
  const next = recordInvite(fresh, student.id, { email, sentAt: new Date(now).toISOString(), by: sender.id, byName: senderName.slice(0, 80) });
  let remembered = true;
  try { await deps.saveSetting(PARENT_INVITE_LOG_KEY, JSON.stringify(next)); } catch { remembered = false; }
  return {
    status: 200,
    body: {
      success: true,
      message: `Invitation sent to ${email}.${remembered ? "" : " It was sent, but could not be added to the list below."}`,
      invites: inviteSummary(invitesFor(remembered ? next : fresh, student.id)),
    },
  };
}

/** May this person send invitations at all? */
function staff(sender: InviteSender): Reply | null {
  if (!sender.isAdmin && sender.role !== "teacher") return no(403, "Teacher or admin access required.");
  if (!sender.isAdmin && sender.accountApproved === false) return no(403, "Teacher account approval required.");
  return null;
}

/** The new families this person has invited (the admin sees everyone's). */
export async function listFamilyInvites(deps: ParentInviteDeps, sender: InviteSender): Promise<Reply> {
  const denied = staff(sender);
  if (denied) return denied;
  const all = invitesFor(readInviteLog(await deps.getSetting(PARENT_INVITE_LOG_KEY)), NEW_FAMILY_KEY);
  return { status: 200, body: { invites: inviteSummary(sender.isAdmin ? all : all.filter((x) => x.by === sender.id)), emailReady: deps.emailConfigured() } };
}

/**
 * Invites a family whose child has no account yet: one email about the program and how the child, then
 * the parent, signs up. From a teacher it names the teacher and school to pick on the student sign-up page.
 */
export async function sendFamilyInvite(deps: ParentInviteDeps, sender: InviteSender, input: { email?: unknown; childName?: unknown; note?: unknown }, origin: string): Promise<Reply> {
  const denied = staff(sender);
  if (denied) return denied;
  const email = cleanParentEmail(input?.email);
  if (!email) return no(400, "Enter the parent's or guardian's email address, like name@example.com.");
  if (!deps.emailConfigured()) return no(503, "Email isn't set up on the site yet, so the invitation could not be sent.");
  const have = ((await deps.parentAccountEmails?.()) || []).map((e) => cleanParentEmail(e));
  if (have.includes(email)) return no(409, `${email} already has a parent account. To add a child, they log in and enter that child's parent code. Nothing was sent.`);

  const log = readInviteLog(await deps.getSetting(PARENT_INVITE_LOG_KEY));
  const now = deps.now();
  if (sentInLastDay(log, { email }, now) >= INVITES_PER_ADDRESS_PER_DAY) return no(429, `${email} has already been sent ${INVITES_PER_ADDRESS_PER_DAY} invitations today. Try again tomorrow.`);
  if (sentInLastDay(log, { by: sender.id }, now) >= STAFF_INVITES_PER_DAY) return no(429, `You have sent ${STAFF_INVITES_PER_DAY} invitations today, which is the most for one day. You can send more tomorrow.`);

  const senderName = String(sender.displayName || sender.username || "A teacher").trim();
  const child = cleanChildName(input?.childName);
  const site = origin.replace(/\/+$/, "");
  const teacher = sender.role === "teacher";
  const schoolName = teacher && sender.school_id ? String((await deps.schoolName?.(Number(sender.school_id))) || "").trim() : "";
  const replyTo = cleanParentEmail(sender.email) || undefined;
  const result = await deps.sendEmail(
    email,
    `${senderName} invited your family to A.R.I.S.E. Reader`,
    familyInviteEmail({
      senderName, childName: child, registerUrl: `${site}/#/register`, independentUrl: `${site}/#/register-independent`, parentSignupUrl: `${site}/#/parent-signup`,
      ...(teacher ? { teacherName: senderName } : {}), ...(schoolName ? { schoolName } : {}), maxChildren: PLANS.parentMaxChildren, siteUrl: deps.siteUrl, prizes: await prizesNow(deps, site), note: cleanInviteNote(input?.note),
    }),
    { fromName: senderName, ...(replyTo ? { replyTo } : {}) },
  );
  if (!result.sent) return no(503, "The invitation could not be sent just now. Nothing was sent. Please try again in a minute.");

  const fresh = readInviteLog(await deps.getSetting(PARENT_INVITE_LOG_KEY));
  const next = recordInvite(fresh, NEW_FAMILY_KEY, { email, sentAt: new Date(now).toISOString(), by: sender.id, byName: senderName.slice(0, 80), ...(child ? { child } : {}) });
  let remembered = true;
  try { await deps.saveSetting(PARENT_INVITE_LOG_KEY, JSON.stringify(next)); } catch { remembered = false; }
  const mine = invitesFor(remembered ? next : fresh, NEW_FAMILY_KEY).filter((x) => sender.isAdmin || x.by === sender.id);
  return { status: 200, body: { success: true, message: `Invitation sent to ${email}.${remembered ? "" : " It was sent, but could not be added to the list below."}`, invites: inviteSummary(mine) } };
}

/**
 * The invitation as words to paste into the sender's own email (a personal or school address).
 * With a student it is that student's invitation, code and link included. Without one it is the new-family invitation.
 * Nothing is sent and nothing is added to the list of who was invited: the site can't know whether it was sent.
 */
export async function inviteTemplate(deps: ParentInviteDeps, sender: InviteSender, input: { studentId?: unknown; childName?: unknown; note?: unknown }, origin: string): Promise<Reply> {
  const site = origin.replace(/\/+$/, "");
  const note = cleanInviteNote(input?.note);
  if (input?.studentId !== undefined && input?.studentId !== null && input?.studentId !== "") {
    const student = await reachable(deps, sender, input.studentId);
    if ("status" in student) return student;
    const { formattedCode } = await deps.parentCode(student.id);
    const made = parentProgramText({
      studentName: String(student.displayName || "your child").trim(), senderName: String(sender.displayName || sender.username || "Your child's teacher").trim(),
      signupUrl: `${site}/#/parent-signup?code=${encodeURIComponent(formattedCode)}`, code: formattedCode, siteUrl: deps.siteUrl, maxChildren: PLANS.parentMaxChildren, prizes: await prizesNow(deps, site), note,
    });
    return { status: 200, body: { ...made } };
  }
  const denied = staff(sender);
  if (denied) return denied;
  const senderName = String(sender.displayName || sender.username || "A teacher").trim();
  const teacher = sender.role === "teacher";
  const schoolName = teacher && sender.school_id ? String((await deps.schoolName?.(Number(sender.school_id))) || "").trim() : "";
  const made = familyInviteText({
    senderName, childName: cleanChildName(input?.childName), registerUrl: `${site}/#/register`, independentUrl: `${site}/#/register-independent`, parentSignupUrl: `${site}/#/parent-signup`,
    ...(teacher ? { teacherName: senderName } : {}), ...(schoolName ? { schoolName } : {}), maxChildren: PLANS.parentMaxChildren, prizes: await prizesNow(deps, site), note,
  });
  return { status: 200, body: { ...made } };
}

/** The prize lines invitations mention, for the admin to see and change. `automatic` are the competitions on right now, which add themselves. */
export async function getInvitePrizes(deps: ParentInviteDeps, sender: InviteSender, origin: string): Promise<Reply> {
  if (!sender.isAdmin) return no(403, "Admin access required.");
  const lines = (await deps.invitePrizes?.()) ?? [...DEFAULT_INVITE_PRIZES];
  return { status: 200, body: { lines, defaults: DEFAULT_INVITE_PRIZES, automatic: competitionLines(deps.now(), origin.replace(/\/+$/, "")) } };
}

/** Saves the prize lines (one per line of text, or a list). An empty list means invitations mention no prizes of the admin's. */
export async function saveInvitePrizes(deps: ParentInviteDeps, sender: InviteSender, input: { lines?: unknown }, origin: string): Promise<Reply> {
  if (!sender.isAdmin) return no(403, "Admin access required.");
  const lines = cleanPrizeLines(input?.lines);
  await deps.saveSetting(INVITE_PRIZES_KEY, JSON.stringify({ lines }));
  return { status: 200, body: { success: true, message: "Saved. New invitations will use these.", lines: readInvitePrizes(JSON.stringify({ lines })), defaults: DEFAULT_INVITE_PRIZES, automatic: competitionLines(deps.now(), origin.replace(/\/+$/, "")) } };
}

/** The routes: who was invited (for a student, or as a new family), and send an invitation. All need a signed-in teacher or the admin. */
export function registerParentInviteEmailRoutes(app: Express, auth: any, deps: ParentInviteDeps): void {
  const origin = (req: any) => `${String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim()}://${req.get("host")}`;
  app.get("/api/parent-invites/emails/:studentId", auth, async (req: any, res) => {
    try {
      const reply = await listParentInvites(deps, req.user, req.params.studentId);
      res.set("Cache-Control", "no-store").status(reply.status).json(reply.body);
    } catch (error: any) {
      console.error("[parent-invite-email] list failed:", error?.message);
      res.status(500).json({ message: "Could not load who was invited." });
    }
  });
  app.get("/api/parent-invites/family-emails", auth, async (req: any, res) => {
    try {
      const reply = await listFamilyInvites(deps, req.user);
      res.set("Cache-Control", "no-store").status(reply.status).json(reply.body);
    } catch (error: any) {
      console.error("[parent-invite-email] family list failed:", error?.message);
      res.status(500).json({ message: "Could not load who was invited." });
    }
  });
  app.post("/api/parent-invites/family-email", auth, async (req: any, res) => {
    try {
      const reply = await sendFamilyInvite(deps, req.user, req.body || {}, origin(req));
      res.set("Cache-Control", "no-store").status(reply.status).json(reply.body);
    } catch (error: any) {
      console.error("[parent-invite-email] family send failed:", error?.message);
      res.status(500).json({ message: "The invitation could not be sent. Please try again." });
    }
  });
  app.get("/api/parent-invites/prizes", auth, async (req: any, res) => {
    try {
      const reply = await getInvitePrizes(deps, req.user, origin(req));
      res.set("Cache-Control", "no-store").status(reply.status).json(reply.body);
    } catch (error: any) {
      console.error("[parent-invite-email] prizes failed:", error?.message);
      res.status(500).json({ message: "Could not load the prizes." });
    }
  });
  app.put("/api/parent-invites/prizes", auth, async (req: any, res) => {
    try {
      const reply = await saveInvitePrizes(deps, req.user, req.body || {}, origin(req));
      res.set("Cache-Control", "no-store").status(reply.status).json(reply.body);
    } catch (error: any) {
      console.error("[parent-invite-email] save prizes failed:", error?.message);
      res.status(500).json({ message: "The prizes could not be saved. Please try again." });
    }
  });
  app.post("/api/parent-invites/template", auth, async (req: any, res) => {
    try {
      const reply = await inviteTemplate(deps, req.user, req.body || {}, origin(req));
      res.set("Cache-Control", "no-store").status(reply.status).json(reply.body);
    } catch (error: any) {
      console.error("[parent-invite-email] template failed:", error?.message);
      res.status(500).json({ message: "The message could not be written. Please try again." });
    }
  });
  app.post("/api/parent-invites/email", auth, async (req: any, res) => {
    try {
      const reply = await sendParentInvite(deps, req.user, req.body || {}, origin(req));
      res.set("Cache-Control", "no-store").status(reply.status).json(reply.body);
    } catch (error: any) {
      console.error("[parent-invite-email] send failed:", error?.message);
      res.status(500).json({ message: "The invitation could not be sent. Please try again." });
    }
  });
}
