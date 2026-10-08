// Teacher Hub: the IEP Guide tab. One guide per student's IEP or re-evaluation
// meeting: a checklist to work through, the meeting's details, who is on the
// student's team, and the messages that go out. The checklist and its rules are
// in shared/hubGuide.ts.
//
// No one's name is built in. A teacher saves the people they work with once
// (Sped team contacts) and picks who is assigned for each student.
import { WeeklyEditor } from "./HubAvailability";
import { useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { ArrowLeft, Check, ChevronRight, Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { clock12, type GuideKind, type GuideStep, type HubContact, type IepGuide, type Workspace } from "@shared/teacherHub";
import {
  GUIDE_KINDS, GUIDE_LIMITS, GUIDE_ROLES, addStep, changeGuide, changeStep, cleanEmail, cleanLink, contactsFor, feedbackEmail, guideProgress,
  linksIn, longDate, parentText, removeContact, removeStep, roleLabel, sectionsOf, teamMember, type GuideSender,
} from "@shared/hubGuide";
import { assignGuideRole, newGuideFor } from "@shared/hubStudentTeam";
import { Card, Empty, Field, GhostButton, Labeled, PrimaryButton, Select } from "./ui";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;
type Shared = { workspace: Workspace; setWorkspace: SetWorkspace; makeId: () => string };

const iconButton = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600";
const textButton = "inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-950";
const typingBox = "block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:text-sm";

/** One saved detail, shown when its card is not being edited. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 break-words text-sm text-slate-800">{children || "—"}</div></div>;
}

/** A phone number that can be tapped to call, or just the text when it is not a number. */
function Phone({ number }: { number: string }) {
  const digits = number.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? <a href={`tel:${digits}`} className="font-medium text-teal-800 underline decoration-teal-200 underline-offset-2">{number}</a> : <>{number}</>;
}

function Progress({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`${done} of ${total} steps done`}>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal-600 transition-[width]" style={{ width: `${percent}%` }} /></div>
      <span className="shrink-0 text-xs font-medium text-slate-500">{done} of {total}</span>
    </div>
  );
}

/** Copies text for pasting into Messages or an email, and says that it did. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers, and pages that are not allowed the clipboard: copy by selecting.
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      try { document.execCommand("copy"); } catch { /* nothing more to try */ }
      box.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <GhostButton onClick={() => void copy()}>
      {copied ? <><Check className="h-4 w-4 text-teal-700" /> Copied</> : <><Copy className="h-4 w-4" /> {label}</>}
    </GhostButton>
  );
}

// ─── The people and links a teacher saves once ──────────────────────────────

function Contacts({ workspace, setWorkspace, makeId }: Shared) {
  const [form, setForm] = useState({ name: "", role: "socialWorker", email: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const contacts = workspace.spedContacts;
  const full = contacts.length >= GUIDE_LIMITS.contacts;

  function add(e: FormEvent) {
    e.preventDefault();
    const name = form.name.replace(/\s+/g, " ").trim();
    if (!name || full) return;
    setWorkspace((p) => ({ ...p, spedContacts: [...p.spedContacts, { id: makeId(), name, role: form.role, email: form.email.trim() }] }));
    setForm({ name: "", role: form.role, email: "" });
  }
  function change(contactId: string, changed: Partial<Omit<HubContact, "id">>) {
    setWorkspace((p) => ({ ...p, spedContacts: p.spedContacts.map((c) => (c.id === contactId ? { ...c, ...changed } : c)) }));
  }
  const roles = <>{GUIDE_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}<option value="other">Other</option></>;

  return (
    <Card title="Sped team contacts" right={<span className="shrink-0 text-xs font-medium text-slate-500">{contacts.length} saved</span>}>
      <p className="mb-4 text-sm text-slate-600">Save the people you work with once. On each student's guide you pick who is assigned, because not every student has the same team.</p>
      <form onSubmit={add} className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]" data-testid="hub-contact-form">
        <Field placeholder="Name" aria-label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
        <Select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles}</Select>
        <Field type="email" inputMode="email" placeholder="Email (optional)" aria-label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={120} />
        <PrimaryButton type="submit" disabled={full}><Plus className="h-4 w-4" /> Add person</PrimaryButton>
      </form>
      {full && <p className="mt-2 text-sm text-slate-600">You can save up to {GUIDE_LIMITS.contacts} people. Delete one to add another.</p>}
      {contacts.length > 0 && (
        <ul className="mt-4 space-y-2">
          {contacts.map((c) => editing === c.id ? (
            <li key={c.id} className="grid gap-3 rounded-2xl border border-slate-300 p-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
              <Field aria-label="Name" value={c.name} onChange={(e) => change(c.id, { name: e.target.value })} maxLength={80} autoFocus />
              <Select aria-label="Role" value={GUIDE_ROLES.some((r) => r.id === c.role) ? c.role : "other"} onChange={(e) => change(c.id, { role: e.target.value })}>{roles}</Select>
              <Field type="email" inputMode="email" placeholder="Email (optional)" aria-label="Email" value={c.email || ""} onChange={(e) => change(c.id, { email: e.target.value })} maxLength={120} />
              <PrimaryButton onClick={() => setEditing(null)}><Check className="h-4 w-4" /> Done</PrimaryButton>
              <div className="md:col-span-full">
                <div className="mb-2 text-sm font-medium text-slate-700">Availability (used to suggest meeting times)</div>
                <WeeklyEditor value={c.free || []} onChange={(free) => change(c.id, { free })} label={c.name || "this person"} />
              </div>
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
              <div className="min-w-0 flex-1">
                <div className="break-words font-medium text-slate-900">{c.name || "No name"}</div>
                <div className="break-words text-xs text-slate-500">{roleLabel(c.role)}{c.email ? ` · ${c.email}` : ""}</div>
              </div>
              <div className="-m-2 flex shrink-0 items-center">
                <button type="button" aria-label={`Edit ${c.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={() => setEditing(c.id)}><Pencil className="h-4 w-4" /></button>
                <button type="button" aria-label={`Delete ${c.name}`} className={iconButton} onClick={() => setWorkspace((p) => removeContact(p, c.id))}><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Links({ workspace, setWorkspace, makeId }: Shared) {
  const [form, setForm] = useState({ label: "", url: "" });
  const [error, setError] = useState("");
  const links = workspace.guideLinks;
  const full = links.length >= GUIDE_LIMITS.links;

  function add(e: FormEvent) {
    e.preventDefault();
    if (full) return;
    const url = cleanLink(form.url);
    if (!url) { setError("That doesn't look like a link. Paste the whole address, like https://forms.office.com/…"); return; }
    const label = form.label.replace(/\s+/g, " ").trim() || new URL(url).hostname;
    setWorkspace((p) => ({ ...p, guideLinks: [...p.guideLinks, { id: makeId(), label, url }] }));
    setForm({ label: "", url: "" });
    setError("");
  }

  return (
    <Card title="Links I use for every IEP">
      <p className="mb-4 text-sm text-slate-600">Save a link once (your room reservation form, IEP folder, deadlines list) and it shows at the top of every student's guide.</p>
      <form onSubmit={add} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto]" data-testid="hub-link-form">
        <Field placeholder="Name, like Reserve Room" aria-label="Link name" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={60} />
        <Field inputMode="url" placeholder="Paste the link" aria-label="Link" value={form.url} onChange={(e) => { setForm({ ...form, url: e.target.value }); setError(""); }} maxLength={600} required />
        <PrimaryButton type="submit" disabled={full}><Plus className="h-4 w-4" /> Save link</PrimaryButton>
      </form>
      {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
      {links.length > 0 && (
        <ul className="mt-4 space-y-2">
          {links.map((link) => (
            <li key={link.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
              <a href={cleanLink(link.url) || undefined} target="_blank" rel="noopener noreferrer" className="flex min-h-9 min-w-0 flex-1 items-center gap-2 font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">
                <ExternalLink className="h-4 w-4 shrink-0" /><span className="break-words">{link.label}</span>
              </a>
              <button type="button" aria-label={`Delete ${link.label}`} className={`-m-2 ${iconButton}`} onClick={() => setWorkspace((p) => ({ ...p, guideLinks: p.guideLinks.filter((x) => x.id !== link.id) }))}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── One step ───────────────────────────────────────────────────────────────

function StepRow({ step, onChange, onRemove }: { step: GuideStep; onChange: (change: Partial<Omit<GuideStep, "id">>) => void; onRemove: () => void }) {
  // The note box shows once there is a note, or after "Add note".
  const [noteOpen, setNoteOpen] = useState(false);
  // The new wording while it is being typed; null when the step is not being reworded.
  const [draft, setDraft] = useState<string | null>(null);
  const note = step.note || "";
  const links = linksIn(note);
  const rows = Math.max(1, Math.min(8, note.split("\n").reduce((n, line) => n + 1 + Math.floor(line.length / 34), 0)));

  function saveText(e: { preventDefault(): void }) {
    e.preventDefault();
    if (draft === null || !draft.trim()) return;
    onChange({ text: draft });
    setDraft(null);
  }

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0" data-testid="hub-guide-step">
      <label className="-m-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
        <input type="checkbox" className="h-5 w-5" checked={!!step.done} onChange={() => onChange({ done: !step.done })} aria-label={`Done: ${step.text}`} />
      </label>
      <div className="min-w-0 flex-1">
        {draft === null ? (
          <div className={`break-words pt-px ${step.done ? "text-slate-400 line-through" : "font-medium text-slate-900"}`}>{step.text}</div>
        ) : (
            <form onSubmit={saveText} className="space-y-2">
              <textarea
                className={`${typingBox} bg-white`} rows={Math.max(2, Math.min(6, Math.ceil(draft.length / 34)))} value={draft} maxLength={GUIDE_LIMITS.step} aria-label="Step" autoFocus required
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setDraft(null); else if (e.key === "Enter" && !e.shiftKey) saveText(e); }}
              />
              <div className="flex gap-2">
                <PrimaryButton type="submit">Save</PrimaryButton>
                <GhostButton onClick={() => setDraft(null)}>Cancel</GhostButton>
              </div>
            </form>
        )}
        {(noteOpen || note) && (
          <textarea
            className={`${typingBox} mt-2 bg-slate-50 focus:bg-white`}
            rows={rows} value={note} maxLength={GUIDE_LIMITS.note} placeholder="Add a note or paste a link" aria-label={`Note for: ${step.text}`}
            autoFocus={noteOpen && !note}
            onChange={(e) => onChange({ note: e.target.value })}
            onFocus={() => setNoteOpen(true)}
            onBlur={() => setNoteOpen(false)}
          />
        )}
        {links.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-4">
            {links.map((link) => (
              <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 max-w-full items-center gap-1.5 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">
                <ExternalLink className="h-4 w-4 shrink-0" /><span className="truncate">Open {new URL(link).hostname.replace(/^www\./, "")}</span>
              </a>
            ))}
          </div>
        )}
        {draft === null && (
          <div className="flex flex-wrap gap-x-5">
            {!noteOpen && !note && <button type="button" className="min-h-9 text-sm font-medium text-teal-800" onClick={() => setNoteOpen(true)}>Add note</button>}
            <button type="button" className="min-h-9 text-sm font-medium text-slate-500 hover:text-slate-950" onClick={() => setDraft(step.text)}>Edit step</button>
          </div>
        )}
      </div>
      <button type="button" aria-label={`Delete step: ${step.text}`} className={`-m-2 ${iconButton}`} onClick={onRemove}><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}

function AddStep({ onAdd, full }: { onAdd: (text: string) => void; full: boolean }) {
  const [text, setText] = useState("");
  function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || full) return;
    onAdd(text);
    setText("");
  }
  if (full) return <p className="mt-3 text-sm text-slate-600">This part is full. Delete a step to add another.</p>;
  return (
    <form onSubmit={add} className="mt-3 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Field placeholder="Add a step of your own" aria-label="Add a step" value={text} onChange={(e) => setText(e.target.value)} maxLength={GUIDE_LIMITS.step} />
      <GhostButton onClick={() => { if (text.trim()) { onAdd(text); setText(""); } }}><Plus className="h-4 w-4" /> Add step</GhostButton>
    </form>
  );
}

// ─── One student's guide ────────────────────────────────────────────────────

const DETAILS = ["planningDate", "meetingDate", "meetingTime", "room", "parent1", "parent1Phone", "parent2", "parent2Phone"] as const;

function GuideView({ guide, workspace, setWorkspace, makeId, sender, onBack }: Shared & { guide: IepGuide; sender: GuideSender; onBack: () => void }) {
  const contacts = workspace.spedContacts;
  // With nobody saved yet, the list of people is the first thing to fill in.
  const [showContacts, setShowContacts] = useState(contacts.length === 0);
  const [showLinks, setShowLinks] = useState(false);
  // Details and team open to be filled in on a new guide. Once they are set they fold
  // down to a summary, so the checklist is near the top of the screen.
  const [editDetails, setEditDetails] = useState(() => !DETAILS.some((field) => guide[field]));
  const assigned = GUIDE_ROLES.map((role) => ({ role, person: teamMember(guide, role.id, contacts) })).filter((slot) => slot.person);
  const [editTeam, setEditTeam] = useState(assigned.length === 0);
  const meetingLabel = guide.kind === "Re-evaluation" ? "Re-evaluation date" : "IEP meeting date";
  const progress = guideProgress(guide);
  const sections = sectionsOf(guide);
  const links = workspace.guideLinks.filter((link) => cleanLink(link.url));

  const change = (make: (g: IepGuide) => IepGuide) => setWorkspace((p) => changeGuide(p, guide.id, make));
  const set = (changed: Partial<IepGuide>) => change((g) => ({ ...g, ...changed }));

  function remove() {
    if (!window.confirm(`Delete the guide for ${guide.student}? Its checkmarks and notes will be gone.`)) return;
    setWorkspace((p) => ({ ...p, guides: p.guides.filter((g) => g.id !== guide.id) }));
    onBack();
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className={textButton} onClick={onBack}><ArrowLeft className="h-4 w-4" /> All guides</button>
          <button type="button" className={`${textButton} hover:text-red-700`} onClick={remove} data-testid="hub-guide-delete"><Trash2 className="h-4 w-4" /> Delete guide</button>
        </div>
        <h2 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950">{guide.student}</h2>
        <p className="mb-3 text-sm text-slate-600">{guide.kind}{guide.meetingDate ? ` · ${longDate(guide.meetingDate)}` : ""}</p>
        <Progress done={progress.done} total={progress.total} />
      </Card>

      <Card title="Meeting details" right={<button type="button" className={textButton} onClick={() => setEditDetails((v) => !v)}>{editDetails ? "Done" : "Edit"}</button>}>
        {!editDetails ? (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="hub-guide-details">
            <Fact label="Planning meeting">{longDate(guide.planningDate)}</Fact>
            <Fact label={meetingLabel}>{[longDate(guide.meetingDate), guide.meetingTime ? clock12(guide.meetingTime) : ""].filter(Boolean).join(" · ")}</Fact>
            <Fact label="Meeting room">{guide.room}</Fact>
            <Fact label="Parents">
              {guide.parent1 || guide.parent1Phone || guide.parent2 || guide.parent2Phone ? (
                <>
                  {(guide.parent1 || guide.parent1Phone) && <div>{guide.parent1} {guide.parent1Phone && <Phone number={guide.parent1Phone} />}</div>}
                  {(guide.parent2 || guide.parent2Phone) && <div>{guide.parent2} {guide.parent2Phone && <Phone number={guide.parent2Phone} />}</div>}
                </>
              ) : null}
            </Fact>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Labeled label="Planning meeting date"><Field type="date" value={guide.planningDate || ""} onChange={(e) => set({ planningDate: e.target.value })} /></Labeled>
            <Labeled label={meetingLabel}><Field type="date" value={guide.meetingDate || ""} onChange={(e) => set({ meetingDate: e.target.value })} /></Labeled>
            <Labeled label="Time"><Field type="time" value={guide.meetingTime || ""} onChange={(e) => set({ meetingTime: e.target.value })} /></Labeled>
            <Labeled label="Meeting room"><Field value={guide.room || ""} onChange={(e) => set({ room: e.target.value })} maxLength={80} /></Labeled>
            <Labeled label="Parent 1"><Field value={guide.parent1 || ""} onChange={(e) => set({ parent1: e.target.value })} maxLength={80} autoComplete="off" /></Labeled>
            <Labeled label="Parent 1 phone"><Field type="tel" inputMode="tel" value={guide.parent1Phone || ""} onChange={(e) => set({ parent1Phone: e.target.value })} maxLength={30} autoComplete="off" /></Labeled>
            <Labeled label="Parent 2"><Field value={guide.parent2 || ""} onChange={(e) => set({ parent2: e.target.value })} maxLength={80} autoComplete="off" /></Labeled>
            <Labeled label="Parent 2 phone"><Field type="tel" inputMode="tel" value={guide.parent2Phone || ""} onChange={(e) => set({ parent2Phone: e.target.value })} maxLength={30} autoComplete="off" /></Labeled>
          </div>
        )}
      </Card>

      <Card title="Team for this student" right={<button type="button" className={textButton} onClick={() => setEditTeam((v) => !v)}>{editTeam ? "Done" : "Edit"}</button>}>
        {!editTeam ? (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="hub-guide-team-summary">
            {assigned.length === 0 && <p className="col-span-full text-sm text-slate-600">Nobody is assigned yet. Press Edit to choose who is on {guide.student}'s team.</p>}
            {assigned.map(({ role, person }) => {
              const email = cleanEmail(person!.email);
              return (
                <Fact key={role.id} label={role.label}>
                  {person!.name}
                  {email && <a href={`mailto:${email}`} className="block truncate text-xs font-medium text-teal-800 underline decoration-teal-200 underline-offset-2">{email}</a>}
                </Fact>
              );
            })}
          </div>
        ) : (
        <>
        {contacts.length === 0 && <p className="mb-4 text-sm text-slate-600">No one is saved yet. Add the people you work with under Sped team contacts, then choose who is assigned to {guide.student}.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="hub-guide-team">
          {GUIDE_ROLES.map((role) => {
            const { first, rest } = contactsFor(role.id, contacts);
            const chosen = teamMember(guide, role.id, contacts);
            const email = cleanEmail(chosen?.email);
            return (
              <div key={role.id} className="min-w-0">
                <Labeled label={role.label}>
                  <Select value={chosen ? chosen.id : ""} onChange={(e) => { const contactId = e.target.value; setWorkspace((p) => assignGuideRole(p, guide.id, role.id, contactId)); }}>
                    <option value="">Not assigned</option>
                    {first.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    {rest.length > 0 && <optgroup label="Other people">{rest.map((c) => <option key={c.id} value={c.id}>{c.name} ({roleLabel(c.role)})</option>)}</optgroup>}
                  </Select>
                </Labeled>
                {email && <a href={`mailto:${email}`} className="mt-1 block truncate text-xs font-medium text-teal-800 underline decoration-teal-200 underline-offset-2">{email}</a>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">The gen ed teacher, speech, social worker, nurse and OT are {guide.student}'s own team: they are the same here and on the Caseload.</p>
        <button type="button" className={`${textButton} mt-1`} onClick={() => setShowContacts((v) => !v)}>{showContacts ? "Hide my contacts" : "Add or change the people in these lists"}</button>
        </>
        )}
      </Card>
      {editTeam && showContacts && <Contacts workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} />}

      <Card title="Links" right={<button type="button" className={textButton} onClick={() => setShowLinks((v) => !v)}>{showLinks ? "Hide" : "Edit links"}</button>}>
        {links.length ? (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <a key={link.id} href={cleanLink(link.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-800 hover:border-teal-300 hover:bg-teal-50">
                <ExternalLink className="h-4 w-4 shrink-0 text-teal-700" /><span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
        ) : <p className="text-sm text-slate-600">The links you use for every IEP show here once you save them. A link for only this student goes in a step's note.</p>}
      </Card>
      {showLinks && <Links workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} />}

      {sections.map((section) => {
        const done = section.steps.filter((s) => s.done).length;
        return (
          <Card key={section.id} title={section.title} right={<span className="shrink-0 text-xs font-medium text-slate-500">{done} of {section.steps.length}</span>}>
            {section.steps.length ? (
              <ul className="divide-y divide-slate-100">
                {section.steps.map((step) => (
                  <StepRow
                    key={step.id} step={step}
                    onChange={(changed) => change((g) => changeStep(g, section.id, step.id, changed))}
                    onRemove={() => change((g) => removeStep(g, section.id, step.id))}
                  />
                ))}
              </ul>
            ) : <Empty>No steps here. Add one below.</Empty>}
            <AddStep full={section.steps.length >= GUIDE_LIMITS.steps} onAdd={(text) => change((g) => addStep(g, section.id, text, makeId))} />
          </Card>
        );
      })}

      <Card title="Messages to send">
        <p className="mb-4 text-sm text-slate-600">These fill in from this guide. Copy one, paste it where you send it, and finish it there.</p>
        <div className="grid gap-4 xl:grid-cols-2">
          <Message title="First text to a parent" text={parentText(guide, sender)} />
          <Message title="Feedback email to the student's teachers" text={feedbackEmail(guide, sender, contacts)} />
        </div>
      </Card>
    </>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <CopyButton text={text} label="Copy" />
      </div>
      <p className="max-h-72 flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}

// ─── The tab ────────────────────────────────────────────────────────────────

type Props = Shared & {
  /** The teacher, for the messages a guide writes. */
  sender: GuideSender;
  /** The guide that is open, kept by the page so it survives a look at another tab. */
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

export default function HubGuideTab({ workspace, setWorkspace, makeId, sender, openId, setOpenId }: Props) {
  const [form, setForm] = useState<{ student: string; kind: GuideKind }>({ student: "", kind: "IEP meeting" });
  const open = openId ? workspace.guides.find((g) => g.id === openId) : undefined;
  if (open) return <GuideView guide={open} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} sender={sender} onBack={() => setOpenId(null)} />;

  const full = workspace.guides.length >= GUIDE_LIMITS.guides;
  // The soonest meeting first; guides without a date yet come last.
  const guides = [...workspace.guides].sort((a, b) => (a.meetingDate || "9999").localeCompare(b.meetingDate || "9999") || a.student.localeCompare(b.student));

  function start(e: FormEvent) {
    e.preventDefault();
    if (!form.student || full) return;
    // The student's own team (from the Caseload) is already on the guide.
    const guide = newGuideFor(workspace, form.student, form.kind, makeId);
    setWorkspace((p) => ({ ...p, guides: [...p.guides, guide] }));
    setForm({ student: "", kind: form.kind });
    setOpenId(guide.id);
  }
  function remove(guide: IepGuide) {
    if (!window.confirm(`Delete the guide for ${guide.student}? Its checkmarks and notes will be gone.`)) return;
    setWorkspace((p) => ({ ...p, guides: p.guides.filter((g) => g.id !== guide.id) }));
  }

  return (
    <>
      <Card title="IEP guide">
        <p className="mb-4 text-sm text-slate-600">Start a guide for a student's IEP or re-evaluation meeting. Each guide is that student's own checklist: check steps off, add notes and links, reword or delete a step, and add your own.</p>
        {workspace.students.length ? (
          <form onSubmit={start} className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]" data-testid="hub-guide-start">
            <Select aria-label="Student" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>
              <option value="">Choose student</option>
              {workspace.students.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
            <Select aria-label="Kind of meeting" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as GuideKind })}>
              {GUIDE_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </Select>
            <PrimaryButton type="submit" disabled={full}><Plus className="h-4 w-4" /> Start guide</PrimaryButton>
          </form>
        ) : <Empty>Add your students on the Caseload tab first. Then start a guide for each one here.</Empty>}
        {full && <p className="mt-2 text-sm text-slate-600">You have {GUIDE_LIMITS.guides} guides. Delete one that is finished to start another.</p>}
      </Card>

      <Card title="Your guides" right={<span className="shrink-0 text-xs font-medium text-slate-500">{guides.length}</span>}>
        {guides.length ? (
          <ul className="space-y-2">
            {guides.map((guide) => {
              const progress = guideProgress(guide);
              return (
                <li key={guide.id} className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left" onClick={() => setOpenId(guide.id)} data-testid="hub-guide-open">
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-semibold text-slate-900">{guide.student}</div>
                      <div className="mb-2 text-xs text-slate-500">{guide.kind} · {guide.meetingDate ? longDate(guide.meetingDate) : "No date yet"}</div>
                      <Progress done={progress.done} total={progress.total} />
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                  </button>
                  <button type="button" aria-label={`Delete the guide for ${guide.student}`} className={iconButton} onClick={() => remove(guide)}><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        ) : <Empty>No guides yet. Choose a student above to start one.</Empty>}
      </Card>

      <Contacts workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} />
      <Links workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} />
    </>
  );
}
