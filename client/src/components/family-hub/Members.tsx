// Family & settings: who's in the family, and which parts of the hub are switched on.
import { useState, type FormEvent, type ReactNode } from "react";
import { Apple, CalendarDays, Check, Droplets, Newspaper, SmilePlus, Target, Pencil, Plane, Plus, Smile, Sparkles, StickyNote, Trash2, UserPlus, Vote, Wallet } from "lucide-react";
import { MEMBER_COLORS, TOGGLEABLE, type FamilySection, type Member } from "@shared/familyHub";
import { Avatar, Label, Modal, PageHead, Panel, Toggle, confirmed, danger, inputClass, plain, primary, type SectionProps } from "./ui";

const EMOJI = ["🙂", "😎", "🦄", "🦖", "🐱", "🐶", "🌟", "⚽", "🎨", "🎮", "🌸", "🚀", "👑", "🐻", "🦊", "🐢"];
export const SECTION_INFO: Record<FamilySection, { label: string; detail: string; icon: ReactNode }> = {
  home: { label: "Home", detail: "Today at a glance", icon: null },
  tasks: { label: "Tasks", detail: "Your to-do lists", icon: null },
  chores: { label: "Chores", detail: "Chore chart, rotations and stars", icon: <Sparkles size={17} /> },
  calendar: { label: "Calendar", detail: "Shared family calendars", icon: <CalendarDays size={17} /> },
  behavior: { label: "Behavior", detail: "Kid behavior tracker and rewards", icon: <Smile size={17} /> },
  goals: { label: "Goals", detail: "Personal and family goals with progress", icon: <Target size={17} /> },
  cycle: { label: "Cycle", detail: "Period and cycle tracker", icon: <Droplets size={17} /> },
  mood: { label: "Mood", detail: "Daily mood check-in and patterns", icon: <SmilePlus size={17} /> },
  news: { label: "News", detail: "Today's headlines and local news", icon: <Newspaper size={17} /> },
  health: { label: "Food & fitness", detail: "Food diary, exercise, water, steps and weight", icon: <Apple size={17} /> },
  polls: { label: "Polls", detail: "Dinner ideas, weekend plans and votes", icon: <Vote size={17} /> },
  trips: { label: "Trips", detail: "Trip planner and packing lists", icon: <Plane size={17} /> },
  money: { label: "Budget & bills", detail: "Bills, budget and spending", icon: <Wallet size={17} /> },
  notes: { label: "Notes", detail: "Codes, contacts, lists and ideas", icon: <StickyNote size={17} /> },
  family: { label: "Family & settings", detail: "People and switches", icon: null },
};
const blank = (id: string, n: number): Member => ({ id, name: "", emoji: EMOJI[n % EMOJI.length], color: MEMBER_COLORS[n % MEMBER_COLORS.length], kind: "kid" });

export default function Members({ family, setFamily, makeId, say }: SectionProps) {
  const [editing, setEditing] = useState<Member | null>(null);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    const clean = { ...editing, name: editing.name.trim().slice(0, 40) };
    if (family.members.some((m) => m.id !== clean.id && m.name.toLowerCase() === clean.name.toLowerCase())) { say("Someone already has that name."); return; }
    const isNew = !family.members.some((m) => m.id === clean.id);
    if (isNew && family.members.length >= 20) { say("A family can have up to 20 people."); return; }
    setFamily((f) => ({ ...f, members: isNew ? [...f.members, clean] : f.members.map((m) => (m.id === clean.id ? clean : m)) }));
    setEditing(null);
    say(isNew ? `${clean.name} added to the family` : "Saved");
  };
  const remove = (m: Member) => {
    if (!confirmed(`Remove ${m.name}? Their chores become "anyone", and their votes are cleared. Past stars and logs are kept.`)) return;
    setFamily((f) => ({
      ...f,
      members: f.members.filter((x) => x.id !== m.id),
      chores: f.chores.map((c) => ({ ...c, memberId: c.memberId === m.id ? "" : c.memberId, rotation: c.rotation.filter((r) => r !== m.id) })),
      events: f.events.map((e) => ({ ...e, memberIds: e.memberIds.filter((x) => x !== m.id) })),
      polls: f.polls.map((p) => { const votes = { ...p.votes }; delete votes[m.id]; return { ...p, votes }; }),
      trips: f.trips.map((t) => ({ ...t, packing: t.packing.map((p) => (p.memberId === m.id ? { ...p, memberId: "" } : p)) })),
    }));
    setEditing(null);
    say(`${m.name} removed`);
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Family & settings" title="Your family" blurb="Add everyone once, then assign tasks, chores, events and votes to them. Turn off any part of the hub you don't need." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel eyebrow="People" title={`${family.members.length} in the family`} right={<button onClick={() => setEditing(blank(makeId(), family.members.length))} className={primary}><UserPlus size={16} /> Add person</button>}>
        {family.members.length ? <ul className="grid gap-3 sm:grid-cols-2">{family.members.map((m) => <li key={m.id}>
          <button onClick={() => setEditing({ ...m })} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-violet-200" style={{ background: m.color + "10" }}>
            <Avatar member={m} size="lg" /><span className="min-w-0 flex-1"><span className="block truncate font-black">{m.name}</span><span className="text-xs font-semibold text-slate-500">{m.kind === "kid" ? "Kid" : "Adult"}</span></span><Pencil size={15} className="text-slate-400" />
          </button>
        </li>)}</ul> : <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center"><p className="font-bold">Who's in your family?</p><p className="mt-1 text-sm text-slate-500">Add each parent and kid. Kids get a behavior card and a star chart.</p><button onClick={() => setEditing(blank(makeId(), 0))} className={primary + " mt-4"}><Plus size={16} /> Add the first person</button></div>}
      </Panel>

      <Panel eyebrow="Switches" title="Turn features on or off">
        <p className="mb-3 text-sm text-slate-500">Hiding a feature keeps everything saved in it. Turn it back on any time.</p>
        <ul className="divide-y divide-slate-100">{TOGGLEABLE.map((s) => {
          const info = SECTION_INFO[s];
          const on = family.sections[s] !== false;
          return <li key={s} className="flex items-center gap-3 py-3">
            <span className={`rounded-xl p-2 ${on ? "bg-violet-50 text-violet-600" : "bg-slate-100 text-slate-400"}`}>{info.icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{info.label}</span><span className="text-xs text-slate-500">{info.detail}</span></span>
            <Toggle on={on} label={`Show ${info.label}`} onChange={(v) => setFamily((f) => ({ ...f, sections: { ...f.sections, [s]: v } }))} />
          </li>;
        })}</ul>
        <div className="mt-2 flex items-center gap-3 border-t border-slate-100 pt-4">
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Chore stars count toward rewards</span><span className="text-xs text-slate-500">Kids can spend stars from chores and behavior together</span></span>
          <Toggle on={family.chorePointsCount} label="Chore stars count toward rewards" onChange={(v) => setFamily((f) => ({ ...f, chorePointsCount: v }))} />
        </div>
      </Panel>
    </div>

    {editing && <Modal title={family.members.some((m) => m.id === editing.id) ? `Edit ${editing.name || "person"}` : "Add a person"} onClose={() => setEditing(null)}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-4"><Avatar member={{ ...editing, name: editing.name || "?" }} size="lg" />
          <Label text="Name" className="flex-1"><input autoFocus required maxLength={40} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputClass} placeholder="Maya" /></Label></div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">This is a…</p>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold">{(["kid", "adult"] as const).map((k) => <button type="button" key={k} aria-pressed={editing.kind === k} onClick={() => setEditing({ ...editing, kind: k })} className={`min-h-10 rounded-lg px-5 ${editing.kind === k ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{k === "kid" ? "Kid" : "Adult"}</button>)}</div></div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Icon</p><div className="flex flex-wrap gap-1.5">{EMOJI.map((e) => <button type="button" key={e} aria-pressed={editing.emoji === e} onClick={() => setEditing({ ...editing, emoji: e })} className={`h-10 w-10 rounded-xl text-xl ${editing.emoji === e ? "bg-violet-100 ring-2 ring-violet-500" : "bg-slate-50 hover:bg-slate-100"}`}>{e}</button>)}</div></div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Color</p><div className="flex flex-wrap gap-2">{MEMBER_COLORS.map((c) => <button type="button" key={c} aria-pressed={editing.color === c} aria-label={`Color ${c}`} onClick={() => setEditing({ ...editing, color: c })} className={`h-9 w-9 rounded-full ${editing.color === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`} style={{ background: c }} />)}</div></div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={primary + " flex-1 px-5"}><Check size={17} /> Save</button>
          <button type="button" onClick={() => setEditing(null)} className={plain}>Cancel</button>
          {family.members.some((m) => m.id === editing.id) && <button type="button" onClick={() => remove(editing)} className={danger} aria-label="Remove person"><Trash2 size={17} /></button>}
        </div>
      </form>
    </Modal>}
  </div>;
}
