// Arise WorkHub: emails forwarded in. Each teacher gets a private address (hub-xxxx@...). Forward a work
// email to it and it lands in the Hub's Emails, flagged, and on the to-do list.
//
// The server keeps what arrives in a small "waiting" list. The open Hub picks those up and adds them
// to the teacher's own workspace, so an email arriving never fights with changes being made in the Hub.
import { addEmailToTasks } from "./hubEmails";
import type { EmailItem, Workspace } from "./teacherHub";

export const INBOX_LOCAL_PREFIX = "hub-";
export const INBOX_BODY_MAX = 4000;
export const INBOX_KEEP = 200;

/** A forwarded email waiting to go into the Hub. */
export type InboxItem = {
  /** "fwd-" and the email service's id, so the same email is never added twice. */
  id: string;
  /** Who it was from: the original sender when the forward shows it, otherwise who forwarded it. */
  from: string;
  subject: string;
  body: string;
  /** ISO time it arrived. */
  receivedAt: string;
  /** When it was first sent, as the email shows it ("Thursday, October 8, 2026 9:57 AM"). */
  sent?: string;
  /** The message itself: the forwarded email's words, without the forwarding notes or older replies under it. */
  message?: string;
  /** Picked up by the Hub. */
  taken?: boolean;
};

/** A new random address token: 10 letters and digits that are easy to read (no 0/o, 1/l). */
export function newInboxToken(random: (n: number) => Uint8Array): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(random(10), (b) => alphabet[b % alphabet.length]).join("");
}

export const inboxAddress = (token: string, domain: string) => `${INBOX_LOCAL_PREFIX}${token}@${domain}`;

/** "Jane Doe <Jane@School.org>" or "jane@school.org" to "jane@school.org". "" when there is no address. */
export function addressOf(value: unknown): string {
  const text = String(value ?? "");
  const m = /<([^<>\s]+@[^<>\s]+)>/.exec(text) || /([^\s<>"',;:]+@[^\s<>"',;:]+\.[a-z]{2,})/i.exec(text);
  return m ? m[1].trim().toLowerCase().replace(/^mailto:/, "") : "";
}

/** How to show a sender: "Ana Rivera" for "Ana Rivera <rivera@school.org>", the address when there is no name. */
export function senderLabel(value: unknown): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const name = text.replace(/<[^>]*>/g, "").replace(/\[mailto:[^\]]*\]/gi, "").trim().replace(/^["']+|["']+$/g, "").trim();
  return (name && !/^[^\s@]+@[^\s@]+$/.test(name) ? name : addressOf(text) || name).slice(0, 120);
}

/** The address token from a recipient on our domain ("hub-abc123@x.resend.app" to "abc123"), or null. */
export function tokenFor(recipient: unknown, domain: string): string | null {
  const address = addressOf(recipient);
  const at = address.lastIndexOf("@");
  if (at < 0 || !domain || address.slice(at + 1) !== domain.trim().toLowerCase()) return null;
  const local = address.slice(0, at);
  return local.startsWith(INBOX_LOCAL_PREFIX) && /^[a-z0-9]{6,32}$/.test(local.slice(INBOX_LOCAL_PREFIX.length)) ? local.slice(INBOX_LOCAL_PREFIX.length) : null;
}

/** "Fwd: FW: Re: IEP meeting" to "Re: IEP meeting": the forwarding marks come off, the rest stays. */
export function cleanSubject(subject: unknown): string {
  let s = String(subject ?? "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 5; i++) { const next = s.replace(/^(fwd?|fw)\s*:\s*/i, ""); if (next === s) break; s = next; }
  return s.slice(0, 200) || "(no subject)";
}

/** An HTML email as plain words: breaks kept, tags and styles taken out, common characters put back. */
export function htmlToText(html: unknown): string {
  return String(html ?? "")
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The email's words, tidied and cut to a sensible length. */
export function cleanBody(text: unknown, html: unknown): string {
  const words = String(text ?? "").trim() || htmlToText(html);
  const clean = words.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > INBOX_BODY_MAX ? `${clean.slice(0, INBOX_BODY_MAX).trim()}\n\n(The rest of the email was cut off.)` : clean;
}

/**
 * Who first sent a forwarded email, from the block the forward adds ("---------- Forwarded message ---------
 * From: Ms. Rivera <rivera@school.org>" in Gmail, "From: Rivera, Ana <...>" in Outlook). null when there is none.
 */
export function originalSender(body: string): string | null {
  const block = /(?:-{2,}\s*Forwarded message\s*-{2,}|Begin forwarded message:|-{2,}\s*Original Message\s*-{2,}|_{8,})([\s\S]{0,600})/i.exec(body);
  const where = block ? block[1] : body.slice(0, 400);
  const m = /^\s*\*?From:\*?\s*(.+)$/im.exec(where);
  if (!m) return null;
  const line = m[1].trim().replace(/\s*\[mailto:[^\]]*\]/i, "").replace(/\s+/g, " ");
  return line.slice(0, 120) || null;
}

/** One "From: … Sent: … Subject: …" block that mail apps put above a forwarded or quoted email. */
type HeaderBlock = { from: string; sent: string; start: number; end: number };

function headerBlocks(lines: string[]): HeaderBlock[] {
  const blocks: HeaderBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\*?From:\*?\s*(.*)$/i.exec(lines[i]);
    if (!m) continue;
    let from = m[1].trim();
    let j = i;
    // Gmail breaks a long "From:" line: "Name <" and the address on the next line.
    while (from.includes("<") && !from.includes(">") && j + 1 < lines.length && j < i + 2) from = `${from}${lines[++j].trim()}`;
    let sent = "", end = j, subject = false;
    for (let k = j + 1; k < Math.min(lines.length, j + 9); k++) {
      const h = /^\s*\*?(Sent|Date|To|Cc|Bcc|Subject|Reply-To|Importance):\*?\s*(.*)$/i.exec(lines[k]);
      if (!h) {
        // A long "To:" or "Cc:" line broken onto the next line still belongs to the block.
        if (/^\s*<?[\w.+-]+@[\w.-]+/.test(lines[k])) { end = k; continue; }
        break;
      }
      end = k;
      if (/^(sent|date)$/i.test(h[1])) sent = h[2].trim();
      if (/^subject$/i.test(h[1])) subject = true;
    }
    if (!sent && !subject) continue;
    blocks.push({ from: from.replace(/\s*\[mailto:[^\]]*\]/i, "").replace(/\s+/g, " ").trim(), sent, start: i, end });
    i = end;
  }
  return blocks;
}

const tidyMessage = (lines: string[]) => lines.join("\n")
  .replace(/^\s*(-{2,}\s*Forwarded message\s*-{2,}|Begin forwarded message:|-{2,}\s*Original Message\s*-{2,}|_{8,})\s*$/gim, "")
  .replace(/^\s*\[image:[^\]]*\]\s*$/gim, "")
  .replace(/\n{3,}/g, "\n\n").trim();

/**
 * Reads a forwarded email: who first sent it, when, and the message itself. `forwarders` are the
 * teacher's own addresses, so a forward of a forward still finds the person who wrote it.
 * When nothing in it was forwarded, `sender` and `sent` are null and the message is the words above any older replies.
 */
export function readForward(body: string, forwarders: string[] = []): { sender: string | null; sent: string | null; message: string } {
  const lines = String(body ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = headerBlocks(lines);
  const own = new Set(forwarders.map((x) => addressOf(x)).filter(Boolean));
  const isOwn = (from: string) => { const a = addressOf(from); return !!a && (own.has(a) || a.startsWith(INBOX_LOCAL_PREFIX)); };
  const pick = blocks.findIndex((b) => !isOwn(b.from));
  if (pick < 0) {
    const above = tidyMessage(lines.slice(0, blocks.length ? blocks[0].start : lines.length));
    return { sender: null, sent: null, message: above || tidyMessage(lines) };
  }
  const b = blocks[pick];
  const after = tidyMessage(lines.slice(b.end + 1, blocks[pick + 1]?.start ?? lines.length));
  return { sender: b.from.slice(0, 120) || null, sent: b.sent.slice(0, 80) || null, message: after || tidyMessage(lines) };
}

/** A moment shown in the school's time zone: "Thu, Oct 8, 9:57 AM". */
export function schoolTime(iso: string, timeZone = "America/Denver"): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(t));
}

/** The note a forwarded email's to-do carries: who and when, then the start of the message. */
export function inboxTaskNotes(from: string, sent: string, message: string): string {
  const head = [from && `From ${from}`, sent && `Sent ${sent}`].filter(Boolean).join(" · ");
  const words = message.replace(/\n{2,}/g, "\n").trim();
  const start = words.length > 600 ? `${words.slice(0, 600).trim()}…` : words;
  return [head, start].filter(Boolean).join("\n\n");
}

/** A waiting email saved before emails carried their sent time and message: those filled in from its words. */
export function fillInboxItem(item: InboxItem, forwarders: string[]): InboxItem {
  if (item.sent && item.message) return item;
  const fwd = readForward(item.body, forwarders);
  return { ...item, from: fwd.sender ? senderLabel(fwd.sender) : item.from, sent: item.sent || fwd.sent || schoolTime(item.receivedAt), message: item.message || fwd.message };
}

/** Saved waiting items made safe to use, newest first. */
export function readInbox(raw: unknown): InboxItem[] {
  let data: any = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { data = null; } }
  if (!Array.isArray(data)) return [];
  return data
    .filter((x: any) => x && typeof x.id === "string" && /^fwd-[\w-]{1,80}$/.test(x.id) && Number.isFinite(Date.parse(String(x.receivedAt))))
    .map((x: any): InboxItem => ({ id: x.id, from: String(x.from || "").slice(0, 160), subject: String(x.subject || "").slice(0, 200), body: String(x.body || "").slice(0, INBOX_BODY_MAX + 60), receivedAt: new Date(Date.parse(x.receivedAt)).toISOString(),
      ...(typeof x.sent === "string" && x.sent.trim() ? { sent: x.sent.trim().slice(0, 80) } : {}),
      ...(typeof x.message === "string" && x.message.trim() ? { message: x.message.slice(0, INBOX_BODY_MAX + 60) } : {}),
      ...(x.taken ? { taken: true } : {}) }))
    .sort((a: InboxItem, b: InboxItem) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, INBOX_KEEP);
}

/** A list of the sender addresses a teacher accepts mail from, tidied. */
export function cleanSenders(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,;]+/);
  return Array.from(new Set(list.map((x) => addressOf(x)).filter(Boolean))).slice(0, 10);
}

/**
 * Puts forwarded emails into the workspace: each into Emails, flagged and marked new, and onto the to-do list
 * (due `today`), with who sent it, when, and the start of the message on the to-do.
 * One already there (same id) is skipped, so two open Hubs never add it twice. One added before emails
 * carried their sent time gets the sender, the time and the message filled in.
 */
export function addInboxItems(workspace: Workspace, items: InboxItem[], makeId: () => string, today: string): { workspace: Workspace; added: number } {
  let next = workspace;
  let added = 0;
  for (const item of [...items].reverse()) {
    const message = item.message || item.body;
    const sent = item.sent || schoolTime(item.receivedAt);
    const notes = inboxTaskNotes(item.from, sent, message);
    const old = next.emails.find((e) => e.id === item.id);
    if (old) {
      if (old.sent) continue;
      next = { ...next, emails: next.emails.map((e) => (e.id === item.id ? { ...e, from: item.from || e.from, sent, message } : e)), tasks: next.tasks.map((t) => (t.emailId === item.id && !t.done ? { ...t, notes } : t)) };
      continue;
    }
    const email: EmailItem = { id: item.id, from: item.from, subject: item.subject, body: item.body, action: "", draft: "", date: item.receivedAt.slice(0, 10), flagged: true, sent, message, unread: true };
    next = { ...next, emails: [email, ...next.emails] };
    const result = addEmailToTasks(next, item.id, makeId, today);
    next = result.taskId ? { ...result.workspace, tasks: result.workspace.tasks.map((t) => (t.id === result.taskId ? { ...t, notes } : t)) } : result.workspace;
    added++;
  }
  return { workspace: next, added };
}

/** The email has been looked at: it is no longer new. */
export function markEmailRead(workspace: Workspace, emailId: string): Workspace {
  if (!workspace.emails.some((e) => e.id === emailId && e.unread)) return workspace;
  return { ...workspace, emails: workspace.emails.map((e) => { if (e.id !== emailId) return e; const { unread, ...rest } = e; return rest; }) };
}
