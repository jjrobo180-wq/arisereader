// Teacher Hub meeting polls: emailing the people who need to be at an IEP or re-evaluation
// meeting, collecting which times work, and booking the time the teacher picks.
//
// Everyone invited gets their own private link (no account needed). The page behind it
// shows only the meeting's name, place, message and times, and that person's own answers.
import { cleanWeekly, fitOption, type FreeWindow } from "../shared/availability";
import { randomBytes, randomUUID } from "node:crypto";
import type { Express, RequestHandler } from "express";
import type { MailboxSendResult } from "./teacherMailbox";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";
import {
  POLL_LIMITS, bookedSmsText, cleanAnswers, cleanComment, cleanPollInput, describeOption, inviteSmsText, tallyPoll,
  type PollAnswer, type PollOption, type SendVia,
} from "../shared/meetingPoll";

export type PollRow = { id: string; teacher_id: number; title: string; location: string; message: string; hub_meeting_id: string; sender_name: string; reply_to: string; send_via: SendVia; send_text: boolean; options: PollOption[]; status: "open" | "booked"; chosen_option: string | null; created_at: string };
export type InviteeRow = { id: string; poll_id: string; name: string; email: string; phone: string; role: string; token: string; answers: Record<string, PollAnswer>; comment: string; email_sent: boolean; /** The A.R.I.S.E. account this person linked from their private link, if any. */ user_id?: number | null; invited_at: string; responded_at: string | null };
export type PollWithPeople = { poll: PollRow; invitees: InviteeRow[] };

export interface PollStore {
  create(poll: Omit<PollRow, "id" | "created_at" | "status" | "chosen_option">, invitees: { name: string; email: string; phone: string; role: string; token: string }[]): Promise<PollWithPeople>;
  list(teacherId: number): Promise<PollWithPeople[]>;
  get(teacherId: number, pollId: string): Promise<PollWithPeople | null>;
  book(pollId: string, optionId: string): Promise<void>;
  remove(teacherId: number, pollId: string): Promise<void>;
  byToken(token: string): Promise<{ poll: PollRow; invitee: InviteeRow } | null>;
  saveAnswers(inviteeId: string, answers: Record<string, PollAnswer>, comment: string, at: string): Promise<void>;
  markEmailed(inviteeId: string, sent: boolean): Promise<void>;
  /** Ties an invitee to the account of the person who opened their private link while signed in. */
  claim(inviteeId: string, userId: number | null): Promise<void>;
  /** Polls this account has linked to itself. */
  invitedTo(userId: number): Promise<{ poll: PollRow; invitee: InviteeRow }[]>;
  inviteeById(inviteeId: string): Promise<{ poll: PollRow; invitee: InviteeRow } | null>;
}

/** Each person's saved weekly free times (migrations/hub_availability.sql). */
export interface AvailabilityStore {
  get(userId: number): Promise<FreeWindow[]>;
  getMany(userIds: number[]): Promise<Map<number, FreeWindow[]>>;
  set(userId: number, weekly: FreeWindow[]): Promise<void>;
}

export function createSupabaseAvailabilityStore(): AvailabilityStore {
  return {
    async get(userId) {
      const r = await (await db()).from("hub_availability").select("weekly").eq("user_id", userId).maybeSingle();
      if (r.error) throw r.error;
      return cleanWeekly(r.data?.weekly);
    },
    async getMany(userIds) {
      const out = new Map<number, FreeWindow[]>();
      if (!userIds.length) return out;
      const r = await (await db()).from("hub_availability").select("user_id, weekly").in("user_id", userIds);
      if (r.error) throw r.error;
      for (const row of r.data || []) out.set(Number(row.user_id), cleanWeekly(row.weekly));
      return out;
    },
    async set(userId, weekly) {
      const r = await (await db()).from("hub_availability").upsert({ user_id: userId, weekly, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (r.error) throw r.error;
    },
  };
}

export function createMemoryAvailabilityStore(): AvailabilityStore {
  const all = new Map<number, FreeWindow[]>();
  return {
    async get(userId) { return structuredClone(all.get(userId) ?? []); },
    async getMany(ids) { return new Map(ids.filter((i) => all.has(i)).map((i) => [i, structuredClone(all.get(i)!)])); },
    async set(userId, weekly) { all.set(userId, structuredClone(weekly)); },
  };
}

/** The real store: Supabase tables from migrations/meeting_polls.sql. (Loaded on first use, so tests need no database settings.) */
const loadDb = async () => (await import("./supabase")).supabase;
const db = loadDb;

export function createSupabasePollStore(client?: any): PollStore {
  const db = async () => client ?? (await loadDb());
  const fail = (error: any) => { if (error) throw error; };
  return {
    async create(poll, invitees) {
      let made = await (await db()).from("meeting_polls").insert(poll).select("*").single();
      // Before migrations/meeting_polls_sender.sql has been run, the two sender columns don't exist yet: send anyway, with the account's own name and email.
      if (made.error && /sender_name|reply_to|send_via|send_text/.test(`${made.error.message} ${made.error.details ?? ""}`)) {
        const { sender_name: _a, reply_to: _b, send_via: _c, send_text: _d, ...plain } = poll as any;
        made = await (await db()).from("meeting_polls").insert(plain).select("*").single();
      }
      fail(made.error);
      let rows = await (await db()).from("meeting_poll_invitees").insert(invitees.map((i) => ({ ...i, poll_id: made.data.id }))).select("*");
      // Before migrations/meeting_polls_self_and_text.sql has been run there is no phone column: carry on without phone numbers.
      if (rows.error && /phone/.test(`${rows.error.message} ${rows.error.details ?? ""}`)) {
        rows = await (await db()).from("meeting_poll_invitees").insert(invitees.map(({ phone: _p, ...i }) => ({ ...i, poll_id: made.data.id }))).select("*");
      }
      if (rows.error) { await (await db()).from("meeting_polls").delete().eq("id", made.data.id); throw rows.error; }
      // If the newer columns are missing (their SQL has not been run yet), still hand back what the teacher chose, so this poll's send buttons work now.
      const phones = new Map(invitees.map((i) => [i.token, i.phone]));
      return {
        poll: { sender_name: poll.sender_name, reply_to: poll.reply_to, send_via: poll.send_via, send_text: poll.send_text, ...made.data } as PollRow,
        invitees: (rows.data as InviteeRow[]).map((i) => ({ ...i, phone: i.phone || phones.get(i.token) || "" })),
      };
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
    async claim(inviteeId, userId) { fail((await (await db()).from("meeting_poll_invitees").update({ user_id: userId }).eq("id", inviteeId)).error); },
    async invitedTo(userId) {
      const people = await (await db()).from("meeting_poll_invitees").select("*").eq("user_id", userId).order("invited_at", { ascending: false }).limit(60);
      fail(people.error);
      if (!people.data?.length) return [];
      const polls = await (await db()).from("meeting_polls").select("*").in("id", people.data.map((p: any) => p.poll_id));
      fail(polls.error);
      return (people.data as InviteeRow[]).flatMap((invitee) => { const poll = (polls.data as PollRow[]).find((x) => x.id === invitee.poll_id); return poll ? [{ poll, invitee }] : []; });
    },
    async inviteeById(inviteeId) {
      const invitee = await (await db()).from("meeting_poll_invitees").select("*").eq("id", inviteeId).maybeSingle();
      fail(invitee.error);
      if (!invitee.data) return null;
      const poll = await (await db()).from("meeting_polls").select("*").eq("id", invitee.data.poll_id).maybeSingle();
      fail(poll.error);
      return poll.data ? { poll: poll.data as PollRow, invitee: invitee.data as InviteeRow } : null;
    },
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
    async claim(id, userId) { const i = people.find((x) => x.id === id); if (i) i.user_id = userId; },
    async invitedTo(userId) { return people.filter((i) => i.user_id === userId).flatMap((i) => { const p = polls.find((x) => x.id === i.poll_id); return p ? [{ poll: structuredClone(p), invitee: structuredClone(i) }] : []; }); },
    async inviteeById(id) { const i = people.find((x) => x.id === id); const p = i && polls.find((x) => x.id === i.poll_id); return i && p ? { poll: structuredClone(p), invitee: structuredClone(i) } : null; },
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
  /** The teacher's own connected mailbox, if the site has that set up. */
  mailbox?: {
    status(teacherId: number): Promise<{ email: string; needsReconnect: boolean } | null>;
    send(teacherId: number, message: { to: string; subject: string; html: string; fromName?: string }): Promise<MailboxSendResult>;
  };
  /** Text messages (Twilio), if the site has that set up. */
  text?: { send(to: string, body: string): Promise<{ sent: boolean; error?: string }> };
  appUrl: string;
  store?: PollStore;
  availability?: AvailabilityStore;
  now?: () => number;
};

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function registerMeetingPollRoutes(app: Express, authMiddleware: RequestHandler, deps: MeetingPollDeps) {
  const store = deps.store ?? createSupabasePollStore();
  const availability = deps.availability ?? createSupabaseAvailabilityStore();
  const now = deps.now ?? Date.now;
  const pollsMade = createAttemptLimiter({ max: POLL_LIMITS.pollsPerDay, windowMs: 24 * 3600_000, now });
  const emailsSent = createAttemptLimiter({ max: POLL_LIMITS.emailsPerDay, windowMs: 24 * 3600_000, now });
  const textsSent = createAttemptLimiter({ max: POLL_LIMITS.textsPerDay, windowMs: 24 * 3600_000, now });
  const reminders = createAttemptLimiter({ max: 3, windowMs: 24 * 3600_000, now });
  const badLinks = createAttemptLimiter({ max: 30, windowMs: 3600_000, now });
  const replies = createAttemptLimiter({ max: 40, windowMs: 3600_000, now });

  const base = deps.appUrl.replace(/\/+$/, "");
  const linkFor = (token: string) => `${base}/meet/${token}`;
  const teacherName = (req: any) => String(req.user?.displayName || req.user?.display_name || req.user?.username || "Your teacher");
  const teacherEmail = (req: any) => String(req.user?.email || "").trim() || undefined;
  /** The name on the emails: what the teacher chose for this poll, else their account name. */
  const senderFor = (req: any, poll: Pick<PollRow, "sender_name">) => String(poll.sender_name || "").trim() || teacherName(req);
  /** Where replies go: what the teacher chose for this poll, else their account email. */
  const mailOptions = (req: any, poll: Pick<PollRow, "sender_name" | "reply_to">) => ({ replyTo: String(poll.reply_to || "").trim() || teacherEmail(req), fromName: senderFor(req, poll) });

  /** The poll as the teacher sees it. */
  function teacherView({ poll, invitees }: PollWithPeople, weekly: Map<number, FreeWindow[]> = new Map()) {
    const people = invitees.map((i) => ({ name: i.name, answers: i.answers || {}, respondedAt: i.responded_at }));
    const tally = tallyPoll(poll.options, people);
    return {
      id: poll.id, title: poll.title, location: poll.location, message: poll.message, hubMeetingId: poll.hub_meeting_id,
      senderName: poll.sender_name || "", replyTo: poll.reply_to || "", sendVia: poll.send_via || "site", sendText: !!poll.send_text,
      status: poll.status, chosenOption: poll.chosen_option, createdAt: poll.created_at,
      options: poll.options.map((o) => ({ ...o, label: describeOption(o) })),
      invitees: invitees.map((i) => ({ id: i.id, name: i.name, email: i.email, phone: i.phone || "", link: linkFor(i.token), role: i.role, answers: i.answers || {}, comment: i.comment || "", respondedAt: i.responded_at, emailSent: i.email_sent, linked: !!i.user_id, fit: i.user_id && weekly.get(i.user_id)?.length ? Object.fromEntries(poll.options.map((o) => [o.id, fitOption(weekly.get(i.user_id!)!, o)])) : {} })),
      tally: tally.options, best: tally.best,
    };
  }

  type Note = { fellBack: boolean; reason?: string };

  /** One email: from the teacher's own mailbox when the poll asks for that, else from the site (or if the mailbox fails). */
  async function sendOneEmail(req: any, poll: PollRow, to: string, subject: string, html: string, note: Note): Promise<boolean> {
    emailsSent.fail(String(poll.teacher_id));
    if (poll.send_via === "mailbox" && deps.mailbox) {
      const r = await deps.mailbox.send(poll.teacher_id, { to, subject, html, fromName: senderFor(req, poll) });
      if (r.sent) return true;
      note.fellBack = true;
      note.reason = r.reconnect ? "reconnect" : "error";
    }
    const result = await deps.sendEmail(to, subject, html, mailOptions(req, poll)).catch((error: any) => ({ sent: false, error: String(error?.message || error) }));
    return result.sent;
  }

  /** Reaches one person by email and/or text, depending on what the poll asks for and what they have. True if either got through. */
  async function reach(req: any, poll: PollRow, person: InviteeRow, content: { subject: string; html: string; sms: string }, note: Note): Promise<boolean> {
    if (poll.send_via === "self") return false; // the teacher sends these from their own email or phone
    let reached = false;
    if (person.email) reached = await sendOneEmail(req, poll, person.email, content.subject, content.html, note);
    if (poll.send_text && deps.text && person.phone && textsSent.retryAfter(String(poll.teacher_id)) === 0) {
      textsSent.fail(String(poll.teacher_id));
      const r = await deps.text.send(person.phone, content.sms).catch((error: any) => { console.error("[meeting-poll] text failed", error?.message); return { sent: false }; });
      reached = r.sent || reached;
    }
    return reached;
  }

  async function emailInvitee(req: any, poll: PollRow, invitee: InviteeRow, note: Note, reminder = false) {
    const guest = invitee.name;
    const link = linkFor(invitee.token);
    const sent = await reach(req, poll, invitee, {
      subject: `${reminder ? "Reminder: " : ""}Which times work for ${poll.title}?`,
      html: pollInviteEmail({ guest, teacher: senderFor(req, poll), title: poll.title, location: poll.location, message: poll.message, options: poll.options, link, reminder }),
      sms: inviteSmsText({ guest, sender: senderFor(req, poll), title: poll.title, link, reminder }),
    }, note);
    await store.markEmailed(invitee.id, sent).catch((error: any) => console.error("[meeting-poll] could not record who was reached", error?.message));
    invitee.email_sent = sent;
    return sent;
  }

  app.post("/api/teacher-hub/polls", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    res.set("Cache-Control", "no-store");
    const teacher = String(req.user.id);
    const made = cleanPollInput(req.body, dayKey(now() - 24 * 3600_000));
    if (!made.ok) return res.status(400).json({ message: made.error });
    if (made.poll.sendVia === "mailbox") {
      const box = deps.mailbox ? await deps.mailbox.status(Number(req.user.id)).catch(() => null) : null;
      if (!box || box.needsReconnect) return res.status(400).json({ message: box ? "Your mailbox needs to be connected again before it can send." : "Connect your Gmail or Outlook first, or choose to send from A.R.I.S.E. Reader." });
    }
    if (made.poll.sendText && !deps.text) return res.status(400).json({ message: "Texting isn't set up on the site yet. Uncheck the text option, or send the links yourself." });
    const wait = Math.max(pollsMade.retryAfter(teacher), made.poll.sendVia === "self" ? 0 : emailsSent.retryAfter(teacher), made.poll.sendText ? textsSent.retryAfter(teacher) : 0);
    if (wait) return res.status(429).json({ message: `That is a lot of meeting messages for one day. Try again in ${waitWords(wait)}.` });
    try {
      pollsMade.fail(teacher);
      const row = await store.create(
        { teacher_id: Number(req.user.id), title: made.poll.title, location: made.poll.location, message: made.poll.message, hub_meeting_id: made.poll.hubMeetingId, sender_name: made.poll.senderName, reply_to: made.poll.replyTo, send_via: made.poll.sendVia, send_text: made.poll.sendText, options: made.poll.options },
        made.poll.invitees.map((i) => ({ ...i, token: randomBytes(24).toString("base64url") })),
      );
      const note: Note = { fellBack: false };
      if (made.poll.sendVia !== "self") await Promise.all(row.invitees.map((invitee) => emailInvitee(req, row.poll, invitee, note)));
      const view = teacherView(row);
      const missed = made.poll.sendVia === "self" ? 0 : view.invitees.filter((i) => !i.emailSent).length;
      res.status(201).json({ poll: view, notSent: missed, mailboxProblem: note.fellBack ? note.reason : null });
    } catch (error: any) {
      console.error("[meeting-poll] create failed", error?.message);
      res.status(500).json({ message: "Could not send the poll. Try again in a moment." });
    }
  });

  app.get("/api/teacher-hub/polls", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    res.set("Cache-Control", "no-store");
    try {
      const rows = await store.list(Number(req.user.id));
      const linked = [...new Set(rows.flatMap((r) => r.invitees.map((i) => i.user_id)).filter((x): x is number => !!x))];
      const weekly = await availability.getMany(linked).catch(() => new Map<number, FreeWindow[]>());
      res.json({ polls: rows.map((r) => teacherView(r, weekly)), textAvailable: !!deps.text });
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
      if (row.poll.send_via === "self") return res.status(409).json({ message: "You are sending this poll yourself. Use the buttons under “Send the links yourself”." });
      const key = `${req.user.id}:${row.poll.id}`;
      const wait = Math.max(reminders.retryAfter(key), emailsSent.retryAfter(String(req.user.id)));
      if (wait) return res.status(429).json({ message: `You already sent reminders for this poll. Try again in ${waitWords(wait)}.` });
      const waiting = row.invitees.filter((i) => !i.responded_at);
      if (!waiting.length) return res.status(409).json({ message: "Everyone has answered." });
      reminders.fail(key);
      const note: Note = { fellBack: false };
      const results = await Promise.all(waiting.map((i) => emailInvitee(req, row.poll, i, note, true)));
      res.json({ sent: results.filter(Boolean).length, failed: results.filter((r) => !r).length, mailboxProblem: note.fellBack ? note.reason : null });
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
      let mailboxProblem: string | null = null;
      if (row.poll.send_via !== "self" && req.body?.notify !== false && emailsSent.retryAfter(String(req.user.id)) === 0) {
        const note: Note = { fellBack: false };
        const results = await Promise.all(row.invitees.map((i) => {
          const when = describeOption(option);
          const sender = senderFor(req, row.poll);
          return reach(req, row.poll, i, {
            subject: `The time is set: ${row.poll.title}`,
            html: pollBookedEmail({ guest: i.name, teacher: sender, title: row.poll.title, location: row.poll.location, when }),
            sms: bookedSmsText({ guest: i.name, sender, title: row.poll.title, location: row.poll.location, when }),
          }, note);
        }));
        mailboxProblem = note.fellBack ? note.reason ?? "error" : null;
        told = results.filter(Boolean).length;
      }
      res.json({ ok: true, mailboxProblem, selfSend: row.poll.send_via === "self", option: { ...option, label: describeOption(option) }, told, invited: row.invitees.length, title: row.poll.title, location: row.poll.location, hubMeetingId: row.poll.hub_meeting_id });
    } catch (error: any) {
      console.error("[meeting-poll] choose failed", error?.message);
      res.status(500).json({ message: "Could not save that time. Try again in a moment." });
    }
  });

  // The teacher marks who they have already sent a link to (when they send the links themselves).
  app.post("/api/teacher-hub/polls/:id/sent", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const row = await store.get(Number(req.user.id), String(req.params.id));
      const person = row?.invitees.find((i) => i.id === String(req.body?.inviteeId || ""));
      if (!row || !person) return res.status(404).json({ message: "That person was not found in this poll." });
      await store.markEmailed(person.id, req.body?.sent !== false);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[meeting-poll] mark sent failed", error?.message);
      res.status(500).json({ message: "Could not save that." });
    }
  });

  /** The teacher fills in someone's answers for them (a phone call, a hallway chat). */
  app.post("/api/teacher-hub/polls/:id/answer", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const row = await store.get(Number(req.user.id), String(req.params.id));
      const person = row?.invitees.find((i) => i.id === String(req.body?.inviteeId || ""));
      if (!row || !person) return res.status(404).json({ message: "That person was not found in this poll." });
      if (row.poll.status === "booked") return res.status(409).json({ message: "A time has already been chosen, so this poll is closed." });
      const answers = cleanAnswers(req.body?.answers, row.poll.options);
      if (!Object.keys(answers).length) return res.status(400).json({ message: "Pick an answer for at least one time." });
      await store.saveAnswers(person.id, answers, cleanComment(req.body?.comment), new Date(now()).toISOString());
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[meeting-poll] teacher answer failed", error?.message);
      res.status(500).json({ message: "Could not save those answers." });
    }
  });

  // ---- A signed-in staff member: weekly free times, and polls linked to their account ----

  app.get("/api/teacher-hub/availability", authMiddleware, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    try { res.json({ weekly: await availability.get(Number(req.user.id)) }); }
    catch (error: any) { console.error("[availability] read failed", error?.message); res.status(500).json({ message: "Could not load your availability." }); }
  });

  app.put("/api/teacher-hub/availability", authMiddleware, async (req: any, res) => {
    try {
      const weekly = cleanWeekly(req.body?.weekly);
      await availability.set(Number(req.user.id), weekly);
      res.json({ weekly });
    } catch (error: any) { console.error("[availability] save failed", error?.message); res.status(500).json({ message: "Could not save your availability." }); }
  });

  const invitedView = ({ poll, invitee }: { poll: PollRow; invitee: InviteeRow }) => ({
    inviteeId: invitee.id, ...guestView({ poll, invitee }), from: poll.sender_name || "", options: poll.options.map((o) => ({ id: o.id, date: o.date, start: o.start, end: o.end, label: describeOption(o) })),
  });

  app.get("/api/teacher-hub/polls-invited", authMiddleware, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    try { res.json({ polls: (await store.invitedTo(Number(req.user.id))).map(invitedView) }); }
    catch (error: any) { console.error("[meeting-poll] invited list failed", error?.message); res.status(500).json({ message: "Could not load your invitations." }); }
  });

  app.post("/api/teacher-hub/polls-invited/:inviteeId/answer", authMiddleware, async (req: any, res) => {
    try {
      const found = await store.inviteeById(String(req.params.inviteeId));
      if (!found || found.invitee.user_id !== Number(req.user.id)) return res.status(404).json({ message: "That invitation was not found." });
      if (found.poll.status === "booked") return res.status(409).json({ message: "A time has already been chosen, so this poll is closed." });
      const answers = cleanAnswers(req.body?.answers, found.poll.options);
      if (!Object.keys(answers).length) return res.status(400).json({ message: "Pick an answer for at least one time." });
      await store.saveAnswers(found.invitee.id, answers, cleanComment(req.body?.comment), new Date(now()).toISOString());
      res.json({ ok: true });
    } catch (error: any) { console.error("[meeting-poll] invited answer failed", error?.message); res.status(500).json({ message: "Could not save your answers." }); }
  });

  app.delete("/api/teacher-hub/polls-invited/:inviteeId", authMiddleware, async (req: any, res) => {
    try {
      const found = await store.inviteeById(String(req.params.inviteeId));
      if (!found || found.invitee.user_id !== Number(req.user.id)) return res.status(404).json({ message: "That invitation was not found." });
      await store.claim(found.invitee.id, null);
      res.json({ ok: true });
    } catch (error: any) { console.error("[meeting-poll] unlink failed", error?.message); res.status(500).json({ message: "Could not remove that." }); }
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
    let found: Awaited<ReturnType<PollStore["byToken"]>> = null;
    if (TOKEN.test(token)) {
      try {
        found = await store.byToken(token);
      } catch (error: any) {
        // A database that can't answer is not a wrong link: say so, and don't count it against this address.
        console.error("[meeting-poll] link lookup failed", error?.message);
        res.status(503).json({ message: "This page can't open right now. Please try the same link again in a few minutes." });
        return null;
      }
    }
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

  /**
   * The address in the emails and texts. Phones and chat apps read this page to make a link preview, so it is
   * a bare page (no logo, no site description) that sends the person on to the reply page.
   * Older links, which had a # in them, still work.
   */
  app.get("/meet/:token", (req, res) => {
    const token = String(req.params.token || "");
    const to = TOKEN.test(token) ? `/#/meet/${token}` : "/";
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Meeting times</title></head><body><script>location.replace(${JSON.stringify(to)});</script><noscript><a href="${to}">Open the meeting times</a></noscript></body></html>`);
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

  /** A signed-in person who opened their private link adds the poll to their own account. */
  app.post("/api/meeting-poll/:token/claim", authMiddleware, async (req: any, res) => {
    const found = await findByLink(req, res);
    if (!found) return;
    try {
      if (found.poll.teacher_id === Number(req.user.id)) return res.status(400).json({ message: "This is your own poll." });
      if (found.invitee.user_id && found.invitee.user_id !== Number(req.user.id)) return res.status(409).json({ message: "This invitation is already on another account." });
      await store.claim(found.invitee.id, Number(req.user.id));
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[meeting-poll] claim failed", error?.message);
      res.status(500).json({ message: "Could not add this to your account yet. Ask the site owner to finish the setup." });
    }
  });
}
