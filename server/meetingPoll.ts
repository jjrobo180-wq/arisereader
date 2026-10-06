// Teacher Hub meeting polls: emailing the people who need to be at an IEP or re-evaluation
// meeting, collecting which times work, and booking the time the teacher picks.
//
// Everyone invited gets their own private link (no account needed). The page behind it
// shows only the meeting's name, place, message and times, and that person's own answers.
import { randomBytes, randomUUID } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";
import {
  POLL_LIMITS, cleanAnswers, cleanComment, cleanPollInput, describeOption, tallyPoll,
  type PollAnswer, type PollOption,
} from "../shared/meetingPoll";

export type PollRow = { id: string; teacher_id: number; title: string; location: string; message: string; hub_meeting_id: string; sender_name: string; reply_to: string; options: PollOption[]; status: "open" | "booked"; chosen_option: string | null; created_at: string };
export type InviteeRow = { id: string; poll_id: string; name: string; email: string; role: string; token: string; answers: Record<string, PollAnswer>; comment: string; email_sent: boolean; invited_at: string; responded_at: string | null };
export type PollWithPeople = { poll: PollRow; invitees: InviteeRow[] };

export interface PollStore {
  create(poll: Omit<PollRow, "id" | "created_at" | "status" | "chosen_option">, invitees: { name: string; email: string; role: string; token: string }[]): Promise<PollWithPeople>;
  list(teacherId: number): Promise<PollWithPeople[]>;
  get(teacherId: number, pollId: string): Promise<PollWithPeople | null>;
  book(pollId: string, optionId: string): Promise<void>;
  remove(teacherId: number, pollId: string): Promise<void>;
  byToken(token: string): Promise<{ poll: PollRow; invitee: InviteeRow } | null>;
  saveAnswers(inviteeId: string, answers: Record<string, PollAnswer>, comment: string, at: string): Promise<void>;
  markEmailed(inviteeId: string, sent: boolean): Promise<void>;
}

/** The real store: Supabase tables from migrations/meeting_polls.sql. (Loaded on first use, so tests need no database settings.) */
const db = async () => (await import("./supabase")).supabase;

export function createSupabasePollStore(): PollStore {
  const fail = (error: any) => { if (error) throw error; };
  return {
    async create(poll, invitees) {
      let made = await (await db()).from("meeting_polls").insert(poll).select("*").single();
      // Before migrations/meeting_polls_sender.sql has been run, the two sender columns don't exist yet: send anyway, with the account's own name and email.
      if (made.error && /sender_name|reply_to/.test(`${made.error.message} ${made.error.details ?? ""}`)) {
        const { sender_name: _a, reply_to: _b, ...plain } = poll as any;
        made = await (await db()).from("meeting_polls").insert(plain).select("*").single();
      }
      fail(made.error);
      const rows = await (await db()).from("meeting_poll_invitees").insert(invitees.map((i) => ({ ...i, poll_id: made.data.id }))).select("*");
      if (rows.error) { await (await db()).from("meeting_polls").delete().eq("id", made.data.id); throw rows.error; }
      return { poll: { sender_name: "", reply_to: "", ...made.data } as PollRow, invitees: rows.data as InviteeRow[] };
    },
    async list(teacherId) {
      const polls = await (await db()).from("meeting_polls").select("*").eq("teacher_id", teacherId).order("created_at", { ascending: false }).limit(40);
      fail(polls.error);
      if (!polls.data?.length) return [];
      const people = await (await db()).from("meeting_poll_invitees").select("*").in("poll_id", polls.data.map((p: any) => p.id)).order("invited_at", { ascending: true });
      fail(people.error);
      return (polls.data as PollRow[]).map((poll) => ({ poll, invitees: (people.data as InviteeRow[]).filter((i) => i.poll_id === poll.id) }));
    },
    async get(teacherId, pollId) {
      const poll = await (await db()).from("meeting_polls").select("*").eq("id", pollId).eq("teacher_id", teacherId).maybeSingle();
      fail(poll.error);
      if (!poll.data) return null;
      const people = await (await db()).from("meeting_poll_invitees").select("*").eq("poll_id", pollId).order("invited_at", { ascending: true });
      fail(people.error);
      return { poll: poll.data as PollRow, invitees: people.data as InviteeRow[] };
    },
    async book(pollId, optionId) { fail((await (await db()).from("meeting_polls").update({ status: "booked", chosen_option: optionId }).eq("id", pollId)).error); },
    async remove(teacherId, pollId) { fail((await (await db()).from("meeting_polls").delete().eq("id", pollId).eq("teacher_id", teacherId)).error); },
    async byToken(token) {
      const invitee = await (await db()).from("meeting_poll_invitees").select("*").eq("token", token).maybeSingle();
      fail(invitee.error);
      if (!invitee.data) return null;
      const poll = await (await db()).from("meeting_polls").select("*").eq("id", invitee.data.poll_id).maybeSingle();
      fail(poll.error);
      return poll.data ? { poll: poll.data as PollRow, invitee: invitee.data as InviteeRow } : null;
    },
    async saveAnswers(inviteeId, answers, comment, at) { fail((await (await db()).from("meeting_poll_invitees").update({ answers, comment, responded_at: at }).eq("id", inviteeId)).error); },
    async markEmailed(inviteeId, sent) { fail((await (await db()).from("meeting_poll_invitees").update({ email_sent: sent }).eq("id", inviteeId)).error); },
  };
}

/** A store that lives in memory, for tests and the preview harness. */
export function createMemoryPollStore(): PollStore {
  const polls: PollRow[] = [];
  const people: InviteeRow[] = [];
  const view = (poll: PollRow): PollWithPeople => ({ poll: structuredClone(poll), invitees: structuredClone(people.filter((p) => p.poll_id === poll.id)) });
  return {
    async create(poll, invitees) {
      const row: PollRow = { ...structuredClone(poll), id: randomUUID(), created_at: new Date().toISOString(), status: "open", chosen_option: null };
      polls.unshift(row);
      for (const i of invitees) people.push({ ...i, id: randomUUID(), poll_id: row.id, answers: {}, comment: "", email_sent: false, invited_at: new Date().toISOString(), responded_at: null });
      return view(row);
    },
    async list(teacherId) { return polls.filter((p) => p.teacher_id === teacherId).map(view); },
    async get(teacherId, pollId) { const p = polls.find((x) => x.id === pollId && x.teacher_id === teacherId); return p ? view(p) : null; },
    async book(pollId, optionId) { const p = polls.find((x) => x.id === pollId); if (p) { p.status = "booked"; p.chosen_option = optionId; } },
    async remove(teacherId, pollId) {
      const at = polls.findIndex((x) => x.id === pollId && x.teacher_id === teacherId);
      if (at >= 0) { polls.splice(at, 1); for (let i = people.length - 1; i >= 0; i--) if (people[i].poll_id === pollId) people.splice(i, 1); }
    },
    async byToken(token) { const i = people.find((x) => x.token === token); const p = i && polls.find((x) => x.id === i.poll_id); return i && p ? { poll: structuredClone(p), invitee: structuredClone(i) } : null; },
    async saveAnswers(id, answers, comment, at) { const i = people.find((x) => x.id === id); if (i) { i.answers = answers; i.comment = comment; i.responded_at = at; } },
    async markEmailed(id, sent) { const i = people.find((x) => x.id === id); if (i) i.email_sent = sent; },
  };
}

// ---- Emails -------------------------------------------------------------

const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const CARD = "font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background-color:#0b0a16;color:#f8fafc;padding:32px;border-radius:20px;";
const BUTTON = "display:inline-block;background-color:#7c3aed;color:#ffffff;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:12px;";

const optionList = (options: PollOption[]) =>
  `<ul style="margin:12px 0;padding-left:20px;color:#e2e8f0;font-size:15px;line-height:1.8;">${options.map((o) => `<li>${esc(describeOption(o))}</li>`).join("")}</ul>`;

export function pollInviteEmail(p: { guest: string; teacher: string; title: string; location: string; message: string; options: PollOption[]; link: string; reminder?: boolean }): string {
  return `<div style="${CARD}">
  <h1 style="margin:0 0 8px;color:#c4b5fd;font-size:22px;">A.R.I.S.E. Reader</h1>
  <h2 style="margin:20px 0 8px;color:#f8fafc;font-size:21px;">${p.reminder ? "Reminder: " : ""}Which times work for ${esc(p.title)}?</h2>
  <p style="line-height:1.6;color:#cbd5e1;font-size:16px;">Hi ${esc(p.guest)}, ${esc(p.teacher)} is trying to find a time that works for everyone${p.location ? ` (${esc(p.location)})` : ""}. These times are possible:</p>
  ${optionList(p.options)}
  ${p.message ? `<p style="line-height:1.6;color:#cbd5e1;font-size:15px;border-left:3px solid #7c3aed;padding-left:12px;">${esc(p.message)}</p>` : ""}
  <p style="margin:24px 0;"><a href="${esc(p.link)}" style="${BUTTON}">Tell us which times work</a></p>
  <p style="color:#94a3b8;font-size:13px;">It takes about a minute and you do not need an account. This link is just for you, so please don't forward it. You can reply to this email to reach ${esc(p.teacher)}.</p>
</div>`;
}

export function pollBookedEmail(p: { guest: string; teacher: string; title: string; location: string; when: string }): string {
  return `<div style="${CARD}">
  <h1 style="margin:0 0 8px;color:#c4b5fd;font-size:22px;">A.R.I.S.E. Reader</h1>
  <h2 style="margin:20px 0 8px;color:#f8fafc;font-size:21px;">The time is set: ${esc(p.title)}</h2>
  <p style="line-height:1.6;color:#cbd5e1;font-size:16px;">Hi ${esc(p.guest)}, thank you for answering. ${esc(p.teacher)} chose:</p>
  <p style="margin:16px 0;padding:14px 16px;background:#1e1b3a;border-radius:12px;color:#ffffff;font-size:18px;font-weight:700;">${esc(p.when)}${p.location ? `<br><span style="font-weight:400;font-size:15px;color:#cbd5e1;">${esc(p.location)}</span>` : ""}</p>
  <p style="color:#94a3b8;font-size:13px;">If this time doesn't work, reply to this email to reach ${esc(p.teacher)}.</p>
</div>`;
}

// ---- Routes -------------------------------------------------------------

export type MeetingPollDeps = {
  gate(req: any, res: any): Promise<unknown | null>;
  sendEmail(to: string, subject: string, html: string, options?: { replyTo?: string; fromName?: string }): Promise<{ sent: boolean; error?: string }>;
  appUrl: string;
  store?: PollStore;
  now?: () => number;
};

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function registerMeetingPollRoutes(app: Express, authMiddleware: RequestHandler, deps: MeetingPollDeps) {
  const store = deps.store ?? createSupabasePollStore();
  const now = deps.now ?? Date.now;
  const pollsMade = createAttemptLimiter({ max: POLL_LIMITS.pollsPerDay, windowMs: 24 * 3600_000, now });
  const emailsSent = createAttemptLimiter({ max: POLL_LIMITS.emailsPerDay, windowMs: 24 * 3600_000, now });
  const reminders = createAttemptLimiter({ max: 3, windowMs: 24 * 3600_000, now });
  const badLinks = createAttemptLimiter({ max: 30, windowMs: 3600_000, now });
  const replies = createAttemptLimiter({ max: 40, windowMs: 3600_000, now });

  const base = deps.appUrl.replace(/\/+$/, "");
  const linkFor = (token: string) => `${base}/#/meet/${token}`;
  const teacherName = (req: any) => String(req.user?.displayName || req.user?.display_name || req.user?.username || "Your teacher");
  const teacherEmail = (req: any) => String(req.user?.email || "").trim() || undefined;
  /** The name on the emails: what the teacher chose for this poll, else their account name. */
  const senderFor = (req: any, poll: Pick<PollRow, "sender_name">) => String(poll.sender_name || "").trim() || teacherName(req);
  /** Where replies go: what the teacher chose for this poll, else their account email. */
  const mailOptions = (req: any, poll: Pick<PollRow, "sender_name" | "reply_to">) => ({ replyTo: String(poll.reply_to || "").trim() || teacherEmail(req), fromName: senderFor(req, poll) });

  /** The poll as the teacher sees it. */
  function teacherView({ poll, invitees }: PollWithPeople) {
    const people = invitees.map((i) => ({ name: i.name, answers: i.answers || {}, respondedAt: i.responded_at }));
    const tally = tallyPoll(poll.options, people);
    return {
      id: poll.id, title: poll.title, location: poll.location, message: poll.message, hubMeetingId: poll.hub_meeting_id,
      senderName: poll.sender_name || "", replyTo: poll.reply_to || "",
      status: poll.status, chosenOption: poll.chosen_option, createdAt: poll.created_at,
      options: poll.options.map((o) => ({ ...o, label: describeOption(o) })),
      invitees: invitees.map((i) => ({ id: i.id, name: i.name, email: i.email, role: i.role, answers: i.answers || {}, comment: i.comment || "", respondedAt: i.responded_at, emailSent: i.email_sent })),
      tally: tally.options, best: tally.best,
    };
  }

  async function emailInvitee(req: any, poll: PollRow, invitee: InviteeRow, reminder = false) {
    emailsSent.fail(String(poll.teacher_id));
    const result = await deps.sendEmail(
      invitee.email,
      `${reminder ? "Reminder: " : ""}Which times work for ${poll.title}?`,
      pollInviteEmail({ guest: invitee.name, teacher: senderFor(req, poll), title: poll.title, location: poll.location, message: poll.message, options: poll.options, link: linkFor(invitee.token), reminder }),
      mailOptions(req, poll),
    ).catch((error: any) => ({ sent: false, error: String(error?.message || error) }));
    await store.markEmailed(invitee.id, result.sent).catch(() => {});
    invitee.email_sent = result.sent;
    return result.sent;
  }

  app.post("/api/teacher-hub/polls", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    res.set("Cache-Control", "no-store");
    const teacher = String(req.user.id);
    const made = cleanPollInput(req.body, dayKey(now() - 24 * 3600_000));
    if (!made.ok) return res.status(400).json({ message: made.error });
    const wait = Math.max(pollsMade.retryAfter(teacher), emailsSent.retryAfter(teacher));
    if (wait) return res.status(429).json({ message: `That is a lot of meeting emails for one day. Try again in ${waitWords(wait)}.` });
    try {
      pollsMade.fail(teacher);
      const row = await store.create(
        { teacher_id: Number(req.user.id), title: made.poll.title, location: made.poll.location, message: made.poll.message, hub_meeting_id: made.poll.hubMeetingId, sender_name: made.poll.senderName, reply_to: made.poll.replyTo, options: made.poll.options },
        made.poll.invitees.map((i) => ({ ...i, token: randomBytes(24).toString("base64url") })),
      );
      await Promise.all(row.invitees.map((invitee) => emailInvitee(req, row.poll, invitee)));
      const view = teacherView(row);
      const missed = view.invitees.filter((i) => !i.emailSent).length;
      res.status(201).json({ poll: view, notSent: missed });
    } catch (error: any) {
      console.error("[meeting-poll] create failed", error?.message);
      res.status(500).json({ message: "Could not send the poll. Try again in a moment." });
    }
  });

  app.get("/api/teacher-hub/polls", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    res.set("Cache-Control", "no-store");
    try {
      res.json({ polls: (await store.list(Number(req.user.id))).map(teacherView) });
    } catch (error: any) {
      console.error("[meeting-poll] list failed", error?.message);
      res.status(500).json({ message: "Could not load your polls." });
    }
  });

  app.post("/api/teacher-hub/polls/:id/remind", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const row = await store.get(Number(req.user.id), String(req.params.id));
      if (!row) return res.status(404).json({ message: "That poll was not found." });
      if (row.poll.status === "booked") return res.status(409).json({ message: "A time is already chosen." });
      const key = `${req.user.id}:${row.poll.id}`;
      const wait = Math.max(reminders.retryAfter(key), emailsSent.retryAfter(String(req.user.id)));
      if (wait) return res.status(429).json({ message: `You already sent reminders for this poll. Try again in ${waitWords(wait)}.` });
      const waiting = row.invitees.filter((i) => !i.responded_at);
      if (!waiting.length) return res.status(409).json({ message: "Everyone has answered." });
      reminders.fail(key);
      const results = await Promise.all(waiting.map((i) => emailInvitee(req, row.poll, i, true)));
      res.json({ sent: results.filter(Boolean).length, failed: results.filter((r) => !r).length });
    } catch (error: any) {
      console.error("[meeting-poll] remind failed", error?.message);
      res.status(500).json({ message: "Could not send reminders. Try again in a moment." });
    }
  });

  app.post("/api/teacher-hub/polls/:id/choose", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const row = await store.get(Number(req.user.id), String(req.params.id));
      if (!row) return res.status(404).json({ message: "That poll was not found." });
      const option = row.poll.options.find((o) => o.id === req.body?.optionId);
      if (!option) return res.status(400).json({ message: "Pick one of the times from the poll." });
      await store.book(row.poll.id, option.id);
      let told = 0;
      if (req.body?.notify !== false && emailsSent.retryAfter(String(req.user.id)) === 0) {
        const results = await Promise.all(row.invitees.map(async (i) => {
          emailsSent.fail(String(req.user.id));
          const r = await deps.sendEmail(i.email, `The time is set: ${row.poll.title}`,
            pollBookedEmail({ guest: i.name, teacher: senderFor(req, row.poll), title: row.poll.title, location: row.poll.location, when: describeOption(option) }),
            mailOptions(req, row.poll)).catch(() => ({ sent: false }));
          return r.sent;
        }));
        told = results.filter(Boolean).length;
      }
      res.json({ ok: true, option: { ...option, label: describeOption(option) }, told, invited: row.invitees.length, title: row.poll.title, location: row.poll.location, hubMeetingId: row.poll.hub_meeting_id });
    } catch (error: any) {
      console.error("[meeting-poll] choose failed", error?.message);
      res.status(500).json({ message: "Could not save that time. Try again in a moment." });
    }
  });

  app.delete("/api/teacher-hub/polls/:id", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      await store.remove(Number(req.user.id), String(req.params.id));
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[meeting-poll] delete failed", error?.message);
      res.status(500).json({ message: "Could not delete that poll." });
    }
  });

  // ---- The page each invited person opens (no account) ----
  async function findByLink(req: any, res: any) {
    res.set("Cache-Control", "no-store");
    const address = clientAddress(req);
    const token = String(req.params.token || "");
    if (badLinks.retryAfter(address)) { res.status(429).json({ message: "Too many tries. Please wait a while and open the link from your email again." }); return null; }
    const found = TOKEN.test(token) ? await store.byToken(token).catch(() => null) : null;
    if (!found) { badLinks.fail(address); res.status(404).json({ message: "This link is not working. Open the newest email about the meeting, or ask the teacher to send it again." }); return null; }
    return found;
  }

  const guestView = ({ poll, invitee }: { poll: PollRow; invitee: InviteeRow }) => ({
    title: poll.title, location: poll.location, message: poll.message, guest: invitee.name,
    status: poll.status,
    options: poll.options.map((o) => ({ id: o.id, label: describeOption(o) })),
    chosen: poll.status === "booked" ? poll.options.filter((o) => o.id === poll.chosen_option).map((o) => describeOption(o))[0] ?? null : null,
    answers: invitee.answers || {}, comment: invitee.comment || "", answered: !!invitee.responded_at,
  });

  app.get("/api/meeting-poll/:token", async (req, res) => {
    const found = await findByLink(req, res);
    if (found) res.json(guestView(found));
  });

  app.post("/api/meeting-poll/:token", async (req, res) => {
    const found = await findByLink(req, res);
    if (!found) return;
    if (replies.retryAfter(found.invitee.id)) return res.status(429).json({ message: "Too many changes. Please try again later." });
    if (found.poll.status === "booked") return res.status(409).json({ message: "A time has already been chosen, so this poll is closed." });
    const answers = cleanAnswers(req.body?.answers, found.poll.options);
    if (!Object.keys(answers).length) return res.status(400).json({ message: "Pick an answer for at least one time." });
    try {
      replies.fail(found.invitee.id);
      await store.saveAnswers(found.invitee.id, answers, cleanComment(req.body?.comment), new Date(now()).toISOString());
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[meeting-poll] reply failed", error?.message);
      res.status(500).json({ message: "Could not save your answers. Please try again." });
    }
  });
}
