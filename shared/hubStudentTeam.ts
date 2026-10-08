// Teacher Hub: the people on one student's IEP team, and the student's disabilities.
//
// A student can have a social worker, an OT, a nurse, a speech pathologist and a
// gen ed teacher. Not every student has every one, so each is optional. They are
// kept with the student (student.team) and they are people from the teacher's own
// list (workspace.spedContacts), so a person is typed once and picked after that.
//
// The same five people show on the student's IEP guide and are already picked when
// the teacher asks for meeting times. Everything that changes them goes through
// this file, so the caseload, the guide and the poll always agree.
//
// The screen is client/src/components/teacher-hub/HubStudentTeam.tsx.
import { GUIDE_LIMITS, cleanEmail, newGuide } from "./hubGuide";
import {
  addStudent, cleanDisabilities, updateStudent,
  type GuideKind, type HubContact, type IepGuide, type Student, type StudentAdd, type StudentChange, type Workspace,
} from "./teacherHub";

/** The people a student can have, in the order the caseload shows them. Every id is also a role on the IEP guide. */
export const STUDENT_TEAM_ROLES = [
  { id: "socialWorker", label: "Social worker" },
  { id: "ot", label: "Occupational therapist (OT)" },
  { id: "nurse", label: "Nurse" },
  { id: "slp", label: "Speech pathologist (SLP)" },
  { id: "genEd", label: "Gen ed teacher" },
] as const;
export type StudentTeamRole = (typeof STUDENT_TEAM_ROLES)[number]["id"];
export type StudentTeam = Partial<Record<StudentTeamRole, string>>;

const ROLE_IDS = STUDENT_TEAM_ROLES.map((role) => role.id);
export const isStudentTeamRole = (role: string): role is StudentTeamRole => (ROLE_IDS as readonly string[]).includes(role);

/**
 * Offered while typing a disability. They are the categories an IEP names; a school that
 * words one differently can type its own.
 */
export const DISABILITY_SUGGESTIONS = [
  "Autism Spectrum Disorder (ASD)",
  "Deaf-Blindness",
  "Developmental Delay",
  "Emotional Disturbance",
  "Hearing Impairment, including Deafness",
  "Intellectual Disability",
  "Multiple Disabilities",
  "Orthopedic Impairment",
  "Other Health Impairment (OHI)",
  "Serious Emotional Disability (SED)",
  "Specific Learning Disability (SLD)",
  "Speech or Language Impairment (SLI)",
  "Traumatic Brain Injury (TBI)",
  "Visual Impairment, including Blindness",
] as const;

export const STUDENT_TEAM_LIMITS = { name: 80, email: 120 } as const;
export { DISABILITY_MAX, cleanDisabilities } from "./teacherHub";

const fold = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const oneLine = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The student on the caseload with this name, however it was typed. */
export function studentNamed(workspace: Workspace, name: string): Student | undefined {
  const wanted = fold(name);
  return wanted ? workspace.students.find((s) => fold(s.name) === wanted) : undefined;
}

const guidesOf = (workspace: Workspace, name: string) => { const wanted = fold(name); return wanted ? workspace.guides.filter((g) => fold(g.student) === wanted) : []; };

/**
 * Who is on a student's team: a role to the id of one of the teacher's saved people.
 * A person chosen on the student's IEP guide before teams were kept on the caseload
 * still counts, so nothing a teacher already set up goes missing.
 */
export function teamOf(workspace: Workspace, studentName: string): StudentTeam {
  const known = new Set(workspace.spedContacts.map((c) => c.id));
  const student = studentNamed(workspace, studentName);
  const guides = guidesOf(workspace, studentName);
  const team: StudentTeam = {};
  for (const role of ROLE_IDS) {
    const picked = [student?.team?.[role], ...guides.map((g) => g.team?.[role])].find((id) => !!id && known.has(id));
    if (picked) team[role] = picked;
  }
  return team;
}

export type TeamMember = { role: (typeof STUDENT_TEAM_ROLES)[number]; person: HubContact };

/** The people on a student's team, in the caseload's order. A role nobody holds is left out. */
export function teamMembers(workspace: Workspace, studentName: string): TeamMember[] {
  const team = teamOf(workspace, studentName);
  return STUDENT_TEAM_ROLES.flatMap((role) => {
    const person = workspace.spedContacts.find((c) => c.id === team[role.id]);
    return person ? [{ role, person }] : [];
  });
}

// ─── The student form ───────────────────────────────────────────────────────

/**
 * What the form holds for one role: a saved person (`id`), or the name of someone new.
 * `email` is that person's, and is only needed to invite them to a meeting.
 */
export type TeamPick = { id: string; name: string; email: string };
export type TeamDraft = Record<StudentTeamRole, TeamPick>;

export const emptyTeamDraft = (): TeamDraft => Object.fromEntries(ROLE_IDS.map((role) => [role, { id: "", name: "", email: "" }])) as TeamDraft;

/** The form filled in with the team a student has now. */
export function teamDraft(workspace: Workspace, studentName: string): TeamDraft {
  const draft = emptyTeamDraft();
  for (const { role, person } of teamMembers(workspace, studentName)) draft[role.id] = { id: person.id, name: person.name, email: person.email || "" };
  return draft;
}

/** True when the form names anybody at all. */
export const draftHasAnyone = (draft: TeamDraft) => ROLE_IDS.some((role) => !!draft[role]?.id || !!oneLine(draft[role]?.name, STUDENT_TEAM_LIMITS.name));

type Resolved = { ok: true; workspace: Workspace; team: StudentTeam } | { ok: false; message: string };

/**
 * Turns what was typed into saved people. Someone new is added to the teacher's list once:
 * a name that is already on the list is that same person, not a second copy.
 */
function resolveDraft(workspace: Workspace, draft: TeamDraft, makeId: () => string): Resolved {
  let contacts = workspace.spedContacts;
  const team: StudentTeam = {};
  for (const role of STUDENT_TEAM_ROLES) {
    const pick = draft?.[role.id];
    if (!pick) continue;
    const typedEmail = String(pick.email ?? "").trim();
    const email = cleanEmail(typedEmail);
    const saved = pick.id ? contacts.find((c) => c.id === pick.id) : undefined;
    if (pick.id && !saved) continue; // a person who was deleted while the form was open
    const name = saved ? saved.name : oneLine(pick.name, STUDENT_TEAM_LIMITS.name);
    if (!name) continue; // nobody in this role
    if (typedEmail && !email) return { ok: false, message: `The email for ${name} does not look right. Fix it, or leave it empty for now.` };
    let person = saved ?? contacts.find((c) => fold(c.name) === fold(name));
    if (!person) {
      if (contacts.length >= GUIDE_LIMITS.contacts) return { ok: false, message: `You can save up to ${GUIDE_LIMITS.contacts} people. Delete one you no longer need under IEP Guide, then add ${name}.` };
      person = { id: makeId(), name, role: role.id, email };
      contacts = [...contacts, person];
    } else if (email && email !== (person.email || "").trim()) {
      // A new email typed here is theirs everywhere. An empty box never wipes one that is saved.
      const id = person.id;
      contacts = contacts.map((c) => (c.id === id ? { ...c, email } : c));
    }
    team[role.id] = person.id;
  }
  return { ok: true, workspace: contacts === workspace.spedContacts ? workspace : { ...workspace, spedContacts: contacts }, team };
}

const sameTeam = (a: Record<string, string> | undefined, b: StudentTeam) => {
  const keys = Object.keys(a || {});
  return keys.length === Object.keys(b).length && keys.every((key) => a![key] === (b as Record<string, string>)[key]);
};

/**
 * Puts a team on a student, and on that student's IEP guides. On the guides only the roles
 * that are different now are touched, so a guide keeps everything else it had.
 */
function writeTeam(workspace: Workspace, studentId: string, team: StudentTeam): Workspace {
  const student = workspace.students.find((s) => s.id === studentId);
  if (!student) return workspace;
  const before = teamOf(workspace, student.name);
  const changed = ROLE_IDS.filter((role) => (before[role] || "") !== (team[role] || ""));
  const name = fold(student.name);
  const students = sameTeam(student.team, team) ? workspace.students : workspace.students.map((s) => (s.id === studentId ? { ...s, team: { ...team } } : s));
  const guides = changed.length && workspace.guides.some((g) => fold(g.student) === name)
    ? workspace.guides.map((g) => {
        if (fold(g.student) !== name) return g;
        const next: Record<string, string> = { ...(g.team || {}) };
        for (const role of changed) { if (team[role]) next[role] = team[role]!; else delete next[role]; }
        return { ...g, team: next };
      })
    : workspace.guides;
  return students === workspace.students && guides === workspace.guides ? workspace : { ...workspace, students, guides };
}

/** A student's details as the form holds them. The team is typed beside them, as a TeamDraft. */
export type StudentDetails = Omit<Student, "id" | "team">;

function tidyDetails(details: StudentDetails): StudentDetails {
  const { team: _team, ...rest } = details as StudentDetails & { team?: unknown };
  return { ...rest, ...cleanDisabilities(details.disability1, details.disability2) };
}

/** Adds a student with their disabilities and team in one go. Anyone new on the team is saved to the teacher's list. */
export function addStudentWithTeam(workspace: Workspace, details: StudentDetails, draft: TeamDraft, makeId: () => string, seats: number | null): StudentAdd {
  const resolved = resolveDraft(workspace, draft, makeId);
  if (!resolved.ok) return resolved;
  const studentId = makeId();
  const added = addStudent(resolved.workspace, tidyDetails(details), () => studentId, seats);
  if (!added.ok) return added;
  return { ok: true, workspace: writeTeam(added.workspace, studentId, resolved.team) };
}

/** Saves a student's details, disabilities and team in one go. */
export function updateStudentWithTeam(workspace: Workspace, studentId: string, details: StudentDetails, draft: TeamDraft, makeId: () => string): StudentChange {
  const resolved = resolveDraft(workspace, draft, makeId);
  if (!resolved.ok) return resolved;
  const changed = updateStudent(resolved.workspace, studentId, tidyDetails(details));
  if (!changed.ok) return changed;
  return { ...changed, workspace: writeTeam(changed.workspace, studentId, resolved.team) };
}

// ─── The IEP guide and the meeting poll ─────────────────────────────────────

/**
 * Chooses who has a role on an IEP guide ("" for nobody). The five people who belong to the
 * student go on the student too, and on the student's other guides. A meeting leader, a psych
 * or a coordinator is only for that one guide.
 */
export function assignGuideRole(workspace: Workspace, guideId: string, role: string, contactId: string): Workspace {
  const guide = workspace.guides.find((g) => g.id === guideId);
  if (!guide) return workspace;
  const put = (team: Record<string, string> | undefined) => {
    const next: Record<string, string> = { ...(team || {}) };
    if (contactId) next[role] = contactId; else delete next[role];
    return next;
  };
  if (!isStudentTeamRole(role)) return { ...workspace, guides: workspace.guides.map((g) => (g.id === guideId ? { ...g, team: put(g.team) } : g)) };
  const name = fold(guide.student);
  return {
    ...workspace,
    guides: workspace.guides.map((g) => (g.id === guideId || fold(g.student) === name ? { ...g, team: put(g.team) } : g)),
    students: workspace.students.map((s) => {
      if (fold(s.name) !== name) return s;
      // The rest of the student's team is written down with it, so it no longer depends on a guide.
      const team: StudentTeam = { ...teamOf(workspace, s.name) };
      if (contactId) team[role] = contactId; else delete team[role];
      return { ...s, team };
    }),
  };
}

/** A fresh IEP guide that already knows the student's team. */
export function newGuideFor(workspace: Workspace, student: string, kind: GuideKind, makeId: () => string): IepGuide {
  return { ...newGuide(student, kind, makeId), team: { ...teamOf(workspace, student) } };
}

/**
 * The saved people to ask about a student's meeting: the student's team first, then anyone else
 * picked on the student's guide (a meeting leader, a psych). `role` is the role they hold for this student.
 */
export function meetingPeople(workspace: Workspace, studentName: string): { person: HubContact; role: string }[] {
  const out: { person: HubContact; role: string }[] = [];
  const seen = new Set<string>();
  const add = (role: string, id: string | undefined) => {
    const person = id ? workspace.spedContacts.find((c) => c.id === id) : undefined;
    if (!person || seen.has(person.id)) return;
    seen.add(person.id);
    out.push({ person, role });
  };
  const team = teamOf(workspace, studentName);
  for (const role of ROLE_IDS) add(role, team[role]);
  for (const guide of guidesOf(workspace, studentName)) for (const [role, id] of Object.entries(guide.team || {})) if (!isStudentTeamRole(role)) add(role, id);
  return out;
}
