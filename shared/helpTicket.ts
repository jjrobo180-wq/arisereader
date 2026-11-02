// A help ticket: a message to the admin from someone who can't get into their account, sent from
// the sign-in screen without signing in. The form and the server both use these rules and words.
import { isEmailAddress } from "./adminAlerts";

export type HelpTicketFields = {
  firstName: string;
  lastName: string;
  school: string;
  grade: string;
  advisory: string;
  issue: string;
  /** Empty when they don't want a reply outside school hours. */
  email: string;
};

export const HELP_TICKET_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export const HELP_ISSUE_MAX = 1500;
export const HELP_EMAIL_HINT = "Add an email if you want an answer after school hours or over the weekend. If you leave it blank, I'll respond by the following school day in your advisory.";

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max) : "");
const oneLine = (value: unknown, max: number) => clean(value, max).replace(/\s+/g, " ");

/** Checks what was typed. Returns the cleaned ticket, or a message saying what to fix. */
export function readHelpTicket(input: any): { ticket: HelpTicketFields } | { message: string } {
  const ticket: HelpTicketFields = {
    firstName: oneLine(input?.firstName, 60),
    lastName: oneLine(input?.lastName, 60),
    school: oneLine(input?.school, 160),
    grade: oneLine(input?.grade, 4),
    advisory: oneLine(input?.advisory, 120),
    issue: clean(input?.issue, HELP_ISSUE_MAX),
    email: oneLine(input?.email, 254).toLowerCase(),
  };
  if (!ticket.firstName || !ticket.lastName) return { message: "Type your first and last name." };
  if (!ticket.school) return { message: "Pick your school." };
  if (!(HELP_TICKET_GRADES as readonly string[]).includes(ticket.grade)) return { message: "Pick your grade." };
  if (!ticket.advisory) return { message: "Tell me your advisory. If you aren't sure, choose or type \"Not sure\"." };
  if (ticket.issue.length < 3) return { message: "Tell me what's going wrong." };
  if (ticket.email && !isEmailAddress(ticket.email)) return { message: "That email doesn't look right. Fix it, or leave it blank." };
  return { ticket };
}

/** What the sender sees once the ticket is saved. */
export function helpTicketSentMessage(ticket: Pick<HelpTicketFields, "firstName" | "email">): string {
  return ticket.email
    ? `Thanks, ${ticket.firstName}. Your message was sent. I'll reply to ${ticket.email}.`
    : `Thanks, ${ticket.firstName}. Your message was sent. I'll respond by the following school day in your advisory.`;
}
