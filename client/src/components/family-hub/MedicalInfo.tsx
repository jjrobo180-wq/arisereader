// Medical info (a Plugin Store add-on): a card for each person with allergies, conditions,
// medicines, blood type, doctor and insurance, ready for a doctor's visit or an emergency.
import { useState } from "react";
import { HeartPulse, Pencil, Printer, Trash2 } from "lucide-react";
import type { MedicalCard } from "@shared/familyHub";
import { Empty, Modal, PageHead, Panel, danger, inputClass, plain, primary, soft, type SectionProps } from "./ui";

const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const FIELDS: [keyof MedicalCard, string, string][] = [["allergies", "Allergies", "Penicillin, peanuts…"], ["conditions", "Conditions", "Asthma, diabetes…"], ["medications", "Medicines", "Name and dose"], ["doctor", "Doctor", "Name and phone"], ["insurance", "Insurance", "Company and member ID"], ["notes", "Notes", "Anything else"]];
const blank = (person = ""): MedicalCard => ({ id: "", person, bloodType: "", allergies: "", conditions: "", medications: "", doctor: "", insurance: "", notes: "" });

export default function MedicalInfo({ family, setFamily, makeId, say }: SectionProps) {
  const [editing, setEditing] = useState<MedicalCard | null>(null);
  const missing = family.members.filter((m) => !family.medical.some((c) => c.person === m.name));
  const save = () => {
    if (!editing || !editing.person.trim()) return;
    const row = { ...editing, id: editing.id || makeId(), person: editing.person.trim() };
    setFamily((f) => ({ ...f, medical: editing.id ? f.medical.map((c) => (c.id === row.id ? row : c)) : [...f.medical, row] }));
    setEditing(null); say(`${row.person}'s card saved.`);
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Medical info" title="Health cards" blurb="Allergies, medicines, blood type, doctor and insurance for each person, ready for a doctor's visit or an emergency. Anyone signed in to this account can see them."
      action={<div className="flex gap-2">{family.medical.length > 0 && <button type="button" onClick={() => window.print()} className={plain}><Printer size={15} />Print</button>}<button type="button" onClick={() => setEditing(blank())} className={primary}><HeartPulse size={16} />Add a person</button></div>} />
    {missing.length > 0 && <div className="flex flex-wrap gap-1.5">{missing.map((m) => <button key={m.id} type="button" onClick={() => setEditing(blank(m.name))} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100">+ Card for {m.name}</button>)}</div>}
    {family.medical.length ? <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">{family.medical.map((c) => <li key={c.id} className="overflow-hidden rounded-[1.5rem] border border-rose-100 bg-white shadow-[0_8px_28px_#17152b08]">
      <div className="flex items-center gap-3 bg-rose-500 px-5 py-3 text-white"><HeartPulse size={20} /><p className="flex-1 text-lg font-black">{c.person}</p>{c.bloodType && <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-black text-rose-600">{c.bloodType}</span>}
        <button type="button" onClick={() => setEditing(c)} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10" aria-label={`Edit ${c.person}`}><Pencil size={15} /></button>
        <button type="button" onClick={() => { if (window.confirm(`Delete ${c.person}'s card?`)) setFamily((f) => ({ ...f, medical: f.medical.filter((x) => x.id !== c.id) })); }} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10" aria-label={`Delete ${c.person}`}><Trash2 size={15} /></button></div>
      <dl className="divide-y divide-slate-100 px-5">{FIELDS.filter(([k]) => String(c[k]).trim()).map(([k, label]) => <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-2.5 text-sm"><dt className={`font-bold ${k === "allergies" ? "text-rose-600" : "text-slate-500"}`}>{label}</dt><dd className="whitespace-pre-wrap text-slate-800">{String(c[k])}</dd></div>)}</dl>
      {FIELDS.every(([k]) => !String(c[k]).trim()) && <p className="px-5 py-4 text-sm text-slate-500">Nothing filled in yet.</p>}
    </li>)}</ul> : <Panel><Empty icon={<HeartPulse />} title="No health cards yet.">Add one for each person in the family.</Empty></Panel>}
    {editing && <Modal title={editing.id ? `Edit ${editing.person}` : "New health card"} eyebrow="Medical info" onClose={() => setEditing(null)}>
      <div className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2"><input value={editing.person} onChange={(e) => setEditing({ ...editing, person: e.target.value })} maxLength={60} placeholder="Name" className={inputClass} aria-label="Name" autoFocus /><select value={editing.bloodType} onChange={(e) => setEditing({ ...editing, bloodType: e.target.value })} className={inputClass} aria-label="Blood type">{BLOOD.map((b) => <option key={b} value={b}>{b || "Blood"}</option>)}</select></div>
        {FIELDS.map(([k, label, ph]) => <label key={k} className="block text-xs font-bold text-slate-500">{label}<textarea value={String(editing[k])} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} rows={k === "notes" ? 3 : 2} maxLength={k === "notes" ? 1000 : 500} placeholder={ph} className={inputClass + " mt-1 py-2"} /></label>)}
        <div className="flex gap-2"><button type="button" onClick={save} disabled={!editing.person.trim()} className={primary}>Save</button><button type="button" onClick={() => setEditing(null)} className={soft}>Cancel</button></div>
      </div>
    </Modal>}
    <p className="text-xs text-slate-500">This is a handy record, not medical advice. In an emergency, call 911.</p>
  </div>;
}
