// Teacher Hub: emails forwarded in. Each teacher gets a private address (hub-xxxx@...). Forward a work
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

/** Saved waiting items made safe to use, newest first. */
export function readInbox(raw: unknown): InboxItem[] {
  let data: any = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { data = null; } }
  if (!Array.isArray(data)) return [];
  return data
    .filter((x: any) => x && typeof x.id === "string" && /^fwd-[\w-]{1,80}$/.test(x.id) && Number.isFinite(Date.parse(String(x.receivedAt))))
    .map((x: any): InboxItem => ({ id: x.id, from: String(x.from || "").slice(0, 160), subject: String(x.subject || "").slice(0, 200), body: String(x.body || "").slice(0, INBOX_BODY_MAX + 60), receivedAt: new Date(Date.parse(x.receivedAt)).toISOString(), ...(x.taken ? { taken: true } : {}) }))
    .sort((a: InboxItem, b: InboxItem) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, INBOX_KEEP);
}

/** A list of the sender addresses a teacher accepts mail from, tidied. */
export function cleanSenders(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,;]+/);
  return Array.from(new Set(list.map((x) => addressOf(x)).filter(Boolean))).slice(0, 10);
}

/**
 * Puts forwarded emails into the workspace: each into Emails, flagged, and onto the to-do list (due `today`).
 * One already there (same id) is skipped, so two open Hubs never add it twice.
 */
export function addInboxItems(workspace: Workspace, items: InboxItem[], makeId: () => string, today: string): { workspace: Workspace; added: number } {
  let next = workspace;
  let added = 0;
  for (const item of [...items].reverse()) {
    if (next.emails.some((e) => e.id === item.id)) continue;
    const email: EmailItem = { id: item.id, from: item.from, subject: item.subject, body: item.body, action: "", draft: "", date: item.receivedAt.slice(0, 10), flagged: true };
    next = { ...next, emails: [email, ...next.emails] };
    next = addEmailToTasks(next, item.id, makeId, today).workspace;
    added++;
  }
  return { workspace: next, added };
}
