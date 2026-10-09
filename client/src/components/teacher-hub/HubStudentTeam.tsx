// Arise WorkHub: a student's disabilities and the people on their IEP team.
//
// StudentTeamFields is the part of the student form where they are typed. It has no
// save button of its own: it is saved with the student, by "Add student" or "Save changes".
// StudentTeamSummary shows them once they are saved. The rules are in shared/hubStudentTeam.ts.
import { useId, useState } from "react";
import { contactsFor, cleanEmail, roleLabel } from "@shared/hubGuide";
import {
  DISABILITY_MAX, DISABILITY_SUGGESTIONS, STUDENT_TEAM_LIMITS, STUDENT_TEAM_ROLES, teamMembers,
  type StudentDetails, type StudentTeamRole, type TeamDraft, type TeamPick,
} from "@shared/hubStudentTeam";
import type { HubContact, Workspace } from "@shared/teacherHub";
import { Field, Labeled, Select } from "./ui";

const NEW_PERSON = "__new";
const linkButton = "inline-flex min-h-11 items-center text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4 sm:min-h-9";

/** One role: pick a saved person, or type someone new. Leaving it alone means the student has nobody in that role. */
function RoleField({ role, pick, contacts, onPick }: {
  role: (typeof STUDENT_TEAM_ROLES)[number]; pick: TeamPick; contacts: HubContact[]; onPick: (pick: TeamPick) => void;
}) {
  const { first, rest } = contactsFor(role.id, contacts);
  const saved = pick.id ? contacts.find((c) => c.id === pick.id) : undefined;
  // With nobody saved yet there is nothing to pick from, so the name is typed straight away.
  const nobodySaved = first.length + rest.length === 0;
  const [typing, setTyping] = useState(false);
  const typingNew = !saved && (nobodySaved || typing || !!pick.name);
  const savedEmail = cleanEmail(saved?.email);

  function choose(value: string) {
    if (value === NEW_PERSON) { setTyping(true); onPick({ id: "", name: "", email: "" }); return; }
    setTyping(false);
    const person = contacts.find((c) => c.id === value);
    onPick(person ? { id: person.id, name: person.name, email: person.email || "" } : { id: "", name: "", email: "" });
  }

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3" data-testid={`student-team-${role.id}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{role.label}</div>
      {typingNew ? (
        <div className="space-y-2">
          <Field aria-label={`${role.label} name`} placeholder="Name" value={pick.name} onChange={(e) => onPick({ id: "", name: e.target.value, email: pick.email })} maxLength={STUDENT_TEAM_LIMITS.name} autoComplete="off" autoFocus={typing} />
          {/* The email is only asked for once there is someone to have it. */}
          {(!!pick.name.trim() || !!pick.email) && <Field type="email" inputMode="email" aria-label={`${role.label} email`} placeholder="Email (optional)" value={pick.email} onChange={(e) => onPick({ id: "", name: pick.name, email: e.target.value })} maxLength={STUDENT_TEAM_LIMITS.email} autoComplete="off" />}
          {!nobodySaved && <button type="button" className={linkButton} onClick={() => choose("")}>Choose a saved person</button>}
        </div>
      ) : (
        <>
          <Select aria-label={role.label} value={saved ? saved.id : ""} onChange={(e) => choose(e.target.value)}>
            <option value="">None</option>
            {first.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {rest.length > 0 && <optgroup label="Other people">{rest.map((c) => <option key={c.id} value={c.id}>{c.name} ({roleLabel(c.role)})</option>)}</optgroup>}
            <option value={NEW_PERSON}>+ Add someone new…</option>
          </Select>
          {saved && (savedEmail
            ? <div className="mt-1 truncate text-xs text-slate-500">{savedEmail}</div>
            : <div className="mt-2"><Field type="email" inputMode="email" aria-label={`${role.label} email`} placeholder="Email (optional)" value={pick.email} onChange={(e) => onPick({ ...pick, email: e.target.value })} maxLength={STUDENT_TEAM_LIMITS.email} autoComplete="off" /></div>)}
        </>
      )}
    </div>
  );
}

/**
 * The part of the student form for disabilities and the IEP team. Everything in it is optional,
 * and it is saved together with the rest of the student.
 */
export function StudentTeamFields({ details, onDetails, draft, onDraft, contacts, autoFocus = false }: {
  details: StudentDetails;
  onDetails: (change: Partial<StudentDetails>) => void;
  draft: TeamDraft;
  onDraft: (draft: TeamDraft) => void;
  contacts: HubContact[];
  autoFocus?: boolean;
}) {
  const listId = useId();
  const pickFor = (role: StudentTeamRole, pick: TeamPick) => onDraft({ ...draft, [role]: pick });
  return (
    <div className="space-y-4" data-testid="student-team-fields">
      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Disability 1"><Field list={listId} value={details.disability1 || ""} onChange={(e) => onDetails({ disability1: e.target.value })} placeholder="As it is on the IEP" maxLength={DISABILITY_MAX} autoComplete="off" autoFocus={autoFocus} /></Labeled>
          <Labeled label="Disability 2"><Field list={listId} value={details.disability2 || ""} onChange={(e) => onDetails({ disability2: e.target.value })} placeholder="Only if there is a second one" maxLength={DISABILITY_MAX} autoComplete="off" /></Labeled>
        </div>
        <datalist id={listId}>{DISABILITY_SUGGESTIONS.map((name) => <option key={name} value={name} />)}</datalist>
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-800">IEP team for meetings</div>
        <p className="mb-3 mt-1 text-xs text-slate-500">Fill in only the people this student has, and leave the rest. They are picked for you when you start this student's IEP guide or ask for meeting times.</p>
        <div className="grid items-start gap-3 sm:grid-cols-2">
          {STUDENT_TEAM_ROLES.map((role) => <RoleField key={role.id} role={role} pick={draft[role.id]} contacts={contacts} onPick={(pick) => pickFor(role.id, pick)} />)}
        </div>
      </div>
    </div>
  );
}

/** A student's saved IEP team: who holds each role, with their email to tap. Shows nothing when there is no team yet. */
export function StudentTeamSummary({ workspace, student, emails = false }: { workspace: Workspace; student: string; emails?: boolean }) {
  const members = teamMembers(workspace, student);
  if (!members.length) return null;
  return (
    <section className="mt-3 rounded-xl bg-slate-50 p-3" aria-label="IEP team" data-testid="student-team-summary">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">IEP team</h3>
      <ul className="mt-2 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {members.map(({ role, person }) => {
          const email = emails ? cleanEmail(person.email) : "";
          return (
            <li key={role.id} className="min-w-0">
              <div className="text-xs text-slate-500">{role.label}</div>
              <div className="break-words font-medium text-slate-900">{person.name}</div>
              {email && <a href={`mailto:${email}`} className="block truncate text-xs font-medium text-teal-800 underline decoration-teal-200 underline-offset-2">{email}</a>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
