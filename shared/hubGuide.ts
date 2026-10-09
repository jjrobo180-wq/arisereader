// Arise WorkHub: the IEP guide. A teacher starts one guide for a student's IEP or
// re-evaluation meeting. It is a copy of the checklist below that is theirs to
// work through: steps are checked off, given notes, reworded, deleted or added.
//
// No person's name lives in this file. Who the social worker, the nurse or the
// meeting leader is differs from school to school and from student to student,
// so each teacher keeps their own list of people (workspace.spedContacts) and
// picks from it for every guide.
//
// The page is client/src/components/teacher-hub/HubGuide.tsx.
import { clock12, type GuideKind, type GuideSection, type GuideStep, type HubContact, type IepGuide, type Workspace } from "./teacherHub";

export const GUIDE_KINDS: readonly GuideKind[] = ["IEP meeting", "Re-evaluation"];

/** The people a student's meeting can need. A saved contact has one of these as their role, or "other". */
export const GUIDE_ROLES = [
  { id: "genEd", label: "Gen ed teacher" },
  { id: "leader", label: "Meeting leader" },
  { id: "slp", label: "Speech (SLP)" },
  { id: "socialWorker", label: "Social worker" },
  { id: "psych", label: "Psych" },
  { id: "nurse", label: "Nurse / health" },
  { id: "ot", label: "OT" },
  { id: "spedCo", label: "Sped coordinator" },
] as const;
export type GuideRole = (typeof GUIDE_ROLES)[number]["id"];

export const roleLabel = (role: string) => GUIDE_ROLES.find((r) => r.id === role)?.label ?? "Other";

export const GUIDE_LIMITS = {
  /** Guides in one Hub, so the saved workspace stays small. */
  guides: 100,
  /** Steps in one part of a guide. */
  steps: 60,
  step: 300,
  note: 2000,
  contacts: 60,
  links: 30,
} as const;

type TemplateSection = { title: string; kinds: readonly GuideKind[]; steps: readonly string[] };

/**
 * The checklist every new guide starts as. A re-evaluation has its own first
 * part; an IEP meeting has the scheduling part in its place.
 */
export const GUIDE_TEMPLATE: readonly TemplateSection[] = [
  {
    title: "Re-evaluation checklist",
    kinds: ["Re-evaluation"],
    steps: [
      "Open the evaluation folder",
      "Fill out the Evaluation Planning Template (only the first two tabs)",
      "Check the IEP and re-evaluation deadlines list for this student's dates",
      "Send the Evaluation Request Form",
      "Wait for a response from the home office lead",
      "Check the home office meeting lead's schedule for 3 to 5 open spots for the planning meeting",
      "Create a poll for everyone attending the planning meeting (SLP, social worker, nurse, psych and anyone else)",
      "After the poll, send the confirmation in Outlook to everyone, including the home office lead, to lock in the planning meeting",
      "Add the confirmed planning meeting to my calendar",
      "Write down the date of the planning meeting",
      "Attend the planning meeting and link the notes here",
      "After the planning meeting, reach out to the parents to confirm",
      "After a parent confirms, email the thread",
      "Lock in the room with the Reserve Room link",
      "Check the response to the room reservation",
      "Send the gen ed teacher the invite to the meeting",
      "Send the feedback email to the student's teachers who are not attending",
      "Complete the re-evaluation meeting pre-work",
    ],
  },
  {
    title: "Lock in the meeting schedule",
    kinds: ["IEP meeting"],
    steps: [
      "Check the IEP and re-evaluation deadlines list for this student's dates",
      "Check my calendar for 3 dates and times",
      "Make sure school is in session on those 3 dates and times",
      "Check the dates and times against the rooms that are open to reserve",
      "Create a scheduled poll in Outlook for the gen ed teacher and any staff who apply (SLP, social worker, nurse and others) to confirm the 3 dates and times",
      "Reach out to the parents and guardians to choose 1 of the 3 dates and times",
      "Lock in the room with the Reserve Room link",
      "Send the confirmation in Outlook to everyone to lock in the IEP meeting",
      "Send the confirmation to everyone in Enrich to lock in the IEP meeting",
      "Check the response to the room reservation",
      "Check that all parents and parties have confirmed the meeting",
      "Link the student's IC schedule here",
      "Send the feedback email to the student's teachers who are not attending",
    ],
  },
  {
    title: "IEP document",
    kinds: GUIDE_KINDS,
    steps: [
      "Copy the IEP draft template from the IEP Hub folder and rename it",
      "Start working on the draft and link it here",
      "Link the Enrich profile here",
      "Link last year's IEP here",
      "Link the Determination of Eligibility here (in the Enrich files section)",
      "Link the Evaluation Report here (in the Enrich files section)",
      "Finish the draft",
      "Transfer the draft to Enrich",
    ],
  },
  {
    title: "Between meetings",
    kinds: GUIDE_KINDS,
    steps: ["Send the parents a draft of the IEP at least 3 days before the meeting"],
  },
  {
    title: "Meeting ready",
    kinds: GUIDE_KINDS,
    steps: ["Complete the IEP agenda and link it here"],
  },
];

/** A short id for a step or a part of a guide. It only has to be its own within one guide. */
function shortId(makeId: () => string, taken: Set<string>): string {
  for (let tries = 0; ; tries++) {
    const made = makeId().replace(/[^a-z0-9]/gi, "").slice(-8);
    const short = tries < 20 ? made : `${made}${taken.size + tries}`;
    if (short && !taken.has(short)) { taken.add(short); return short; }
  }
}

const idsIn = (guide: Pick<IepGuide, "sections">) => new Set(sectionsOf(guide).flatMap((s) => [s.id, ...s.steps.map((step) => step.id)]));

/** A guide's parts, even in one that was saved without them. */
export function sectionsOf(guide: Pick<IepGuide, "sections">): GuideSection[] {
  return Array.isArray(guide?.sections) ? guide.sections.filter((s) => s && Array.isArray(s.steps)) : [];
}

/** A fresh guide for one student: the whole checklist, nothing checked, nobody assigned yet. */
export function newGuide(student: string, kind: GuideKind, makeId: () => string): IepGuide {
  const taken = new Set<string>();
  kind = GUIDE_KINDS.includes(kind) ? kind : "IEP meeting";
  return {
    id: makeId(),
    student: student.replace(/\s+/g, " ").trim(),
    kind,
    planningDate: "", meetingDate: "", meetingTime: "", room: "",
    parent1: "", parent1Phone: "", parent2: "", parent2Phone: "",
    team: {},
    sections: GUIDE_TEMPLATE.filter((part) => part.kinds.includes(kind)).map((part) => ({
      id: shortId(makeId, taken),
      title: part.title,
      steps: part.steps.map((text) => ({ id: shortId(makeId, taken), text, done: false, note: "" })),
    })),
  };
}

export function guideProgress(guide: Pick<IepGuide, "sections">): { done: number; total: number } {
  const steps = sectionsOf(guide).flatMap((s) => s.steps);
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/** Changes one guide in a workspace and leaves everything else as it was. */
export function changeGuide(workspace: Workspace, guideId: string, change: (guide: IepGuide) => IepGuide): Workspace {
  if (!workspace.guides.some((g) => g.id === guideId)) return workspace;
  return { ...workspace, guides: workspace.guides.map((g) => (g.id === guideId ? change(g) : g)) };
}

const inSection = (guide: IepGuide, sectionId: string, change: (steps: GuideStep[]) => GuideStep[]): IepGuide =>
  ({ ...guide, sections: sectionsOf(guide).map((s) => (s.id === sectionId ? { ...s, steps: change(s.steps) } : s)) });

/** Checks a step off, rewords it or gives it a note. */
export function changeStep(guide: IepGuide, sectionId: string, stepId: string, change: Partial<Omit<GuideStep, "id">>): IepGuide {
  const tidy: Partial<Omit<GuideStep, "id">> = {};
  if (typeof change.done === "boolean") tidy.done = change.done;
  if (typeof change.note === "string") tidy.note = change.note.slice(0, GUIDE_LIMITS.note);
  if (typeof change.text === "string") {
    const text = change.text.replace(/\s+/g, " ").trim().slice(0, GUIDE_LIMITS.step);
    if (text) tidy.text = text; // a step can't be reworded to nothing; deleting it is its own button
  }
  return inSection(guide, sectionId, (steps) => steps.map((s) => (s.id === stepId ? { ...s, ...tidy } : s)));
}

export function removeStep(guide: IepGuide, sectionId: string, stepId: string): IepGuide {
  return inSection(guide, sectionId, (steps) => steps.filter((s) => s.id !== stepId));
}

/** Adds a step of the teacher's own to the end of a part. */
export function addStep(guide: IepGuide, sectionId: string, text: string, makeId: () => string): IepGuide {
  const tidy = text.replace(/\s+/g, " ").trim().slice(0, GUIDE_LIMITS.step);
  if (!tidy) return guide;
  const taken = idsIn(guide);
  return inSection(guide, sectionId, (steps) => (steps.length >= GUIDE_LIMITS.steps ? steps : [...steps, { id: shortId(makeId, taken), text: tidy, done: false, note: "" }]));
}

/**
 * The people to offer for a role on a student's team: those saved with that role
 * first, then everyone else, because one person can cover more than one role.
 */
export function contactsFor(role: string, contacts: HubContact[]): { first: HubContact[]; rest: HubContact[] } {
  const named = contacts.filter((c) => c && String(c.name || "").trim());
  return { first: named.filter((c) => c.role === role), rest: named.filter((c) => c.role !== role) };
}

/** Who is assigned to a role on this student's team, if anyone. */
export function teamMember(guide: Pick<IepGuide, "team">, role: string, contacts: HubContact[]): HubContact | undefined {
  const id = guide?.team?.[role];
  return id ? contacts.find((c) => c && c.id === id) : undefined;
}

/** Takes someone off the teacher's list, and off every student's team they were on. */
export function removeContact(workspace: Workspace, contactId: string): Workspace {
  return {
    ...workspace,
    spedContacts: workspace.spedContacts.filter((c) => c.id !== contactId),
    // A student's own team (shared/hubStudentTeam.ts) loses them too.
    students: workspace.students.map((s) => {
      const team = s.team || {};
      if (!Object.values(team).includes(contactId)) return s;
      return { ...s, team: Object.fromEntries(Object.entries(team).filter(([, id]) => id !== contactId)) };
    }),
    guides: workspace.guides.map((g) => {
      const team = g.team || {};
      if (!Object.values(team).includes(contactId)) return g;
      return { ...g, team: Object.fromEntries(Object.entries(team).filter(([, id]) => id !== contactId)) };
    }),
  };
}

/** An email address that can be written to, or "". */
export function cleanEmail(value: unknown): string {
  const email = String(value ?? "").trim();
  return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(email) ? email : "";
}

/**
 * A link that is safe to open: an http or https address. "docs.google.com/x"
 * gets https:// put in front of it; anything else (javascript:, data:) is "".
 */
export function cleanLink(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw || /\s/.test(raw)) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? url.toString() : "";
  } catch { return ""; }
}

/** The links typed or pasted into a note, so they can be opened with a tap. */
export function linksIn(text: string): string[] {
  const found = String(text || "").match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(found.map((link) => cleanLink(link.replace(/[.,;:!?)\]]+$/, ""))).filter(Boolean))].slice(0, 5);
}

// ─── Messages ───────────────────────────────────────────────────────────────

const owned = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/** "Tuesday, November 3" from "2026-11-03". */
export function longDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  if (!m) return "";
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export type GuideSender = { name: string; school: string };

/** The first text to a parent, asking which of three times works. */
export function parentText(guide: IepGuide, sender: GuideSender): string {
  const student = guide.student || "[Student's name]";
  const meeting = guide.kind === "Re-evaluation" ? "re-evaluation meeting" : "IEP meeting";
  const from = sender.school.trim() ? `Case Manager at ${sender.school.trim()}` : "Case Manager";
  return [
    `Hey ${guide.parent1.trim() || "[Parent's name]"}! This is ${sender.name.trim() || "[Your name]"}, ${owned(student)} ${from}. I'm currently trying to find a date and time that works well for you for ${owned(student)} upcoming ${meeting}. Would any of these options work for you?`,
    "Date - Time",
    "Date - Time",
    "Date - Time",
    "Please let me know which option works best for you, or if none of these times work!",
  ].join("\n");
}

/** The email asking the student's other teachers for their observations. */
export function feedbackEmail(guide: IepGuide, sender: GuideSender, contacts: HubContact[]): string {
  const student = guide.student || "[Student's name]";
  const genEd = (teamMember(guide, "genEd", contacts)?.name || "").trim() || "[Gen ed teacher]";
  const review = guide.kind === "Re-evaluation" ? "re-evaluation meeting" : "IEP review meeting";
  return [
    "Hi everyone,",
    `This email thread is for ${owned(student)} upcoming ${review}. Although ${genEd} will be the only one attending on this thread, everyone included on this thread is currently teaching ${student} this year.`,
    `I would appreciate it if each of you could share a brief review or observation about ${owned(student)} performance in your class. To make this easy, you can reply directly to this email using the template below.`,
    "",
    "Teacher Observation Template (Feel Free to Use)",
    "Class/Subject:",
    "Academic strengths:",
    "Areas of growth or concern:",
    "Participation and engagement:",
    "Behavior, peer interactions, and work habits:",
    "Supports or strategies that have been helpful:",
    "Additional comments or recommendations:",
    "",
    `${genEd}, I will connect with you through Teams.`,
    "",
    `Thank you all for helping support me as I prepare for ${owned(student)} ${guide.kind === "Re-evaluation" ? "re-evaluation" : "IEP"} meeting!`,
    "",
    guide.kind === "Re-evaluation" ? "Re-evaluation Meeting" : "IEP Review Meeting",
    `Date: ${longDate(guide.meetingDate)}`,
    `Time: ${guide.meetingTime ? clock12(guide.meetingTime) : ""}`,
    `Location: ${guide.room.trim()}`,
    "Thank you,",
    sender.name.trim(),
  ].join("\n").trimEnd();
}
