// Important contacts (a Plugin Store add-on): the doctor, the school, the plumber, the sitter.
// Tap to call or email, and mark emergency contacts so they're always on top.
import { useState, type FormEvent } from "react";
import { Mail, Phone, Search, Siren, Star, Trash2, UserRound } from "lucide-react";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const ROLES = ["Doctor", "Dentist", "School", "Babysitter", "Plumber", "Electrician", "Vet", "Pharmacy", "Neighbor", "Work", "Insurance"];

export default function Contacts({ family, setFamily, makeId }: SectionProps) {
  const [form, setForm] = useState({ name: "", role: "", phone: "", email: "", note: "" });
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = [...family.contacts].filter((c) => !q || `${c.name} ${c.role} ${c.note}`.toLowerCase().includes(q)).sort((a, b) => Number(b.emergency) - Number(a.emergency) || a.name.localeCompare(b.name));
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setFamily((f) => ({ ...f, contacts: [...f.contacts, { id: makeId(), name: form.name.trim(), role: form.role.trim(), phone: form.phone.trim(), email: form.email.trim(), note: form.note.trim(), emergency: false }] }));
    setForm({ name: "", role: "", phone: "", email: "", note: "" });
  };
  const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

  return <div className="space-y-6">
    <PageHead eyebrow="Important contacts" title="Who to call" blurb="Doctors, school, sitters and the plumber, one tap away. Star emergency contacts to keep them on top." />
    <Panel title="Add a contact">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="Name" className={inputClass} aria-label="Name" />
        <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} list="contact-roles" maxLength={60} placeholder="Who they are (Doctor, School…)" className={inputClass} aria-label="Role" />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} placeholder="Phone" inputMode="tel" className={inputClass} aria-label="Phone" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={120} placeholder="Email" inputMode="email" className={inputClass} aria-label="Email" />
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} placeholder="Note (hours, account number, address…)" className={inputClass + " sm:col-span-2"} aria-label="Note" />
        <button type="submit" className={primary + " sm:col-span-2"} disabled={!form.name.trim()}>Add contact</button>
        <datalist id="contact-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
      </form>
    </Panel>
    {family.contacts.length > 3 && <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" className={inputClass + " pl-9"} aria-label="Search contacts" /></label>}
    {list.length ? <ul className="grid gap-3 md:grid-cols-2">{list.map((c) => <li key={c.id} className={`rounded-[1.5rem] border bg-white p-4 shadow-[0_8px_28px_#17152b08] ${c.emergency ? "border-rose-200" : "border-[#e7e8f0]"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${c.emergency ? "bg-rose-50 text-rose-600" : "bg-violet-50 text-violet-600"}`}>{c.emergency ? <Siren size={20} /> : <UserRound size={20} />}</span>
        <span className="min-w-0 flex-1"><span className="block font-extrabold">{c.name}</span>{c.role && <span className="block text-xs font-bold text-slate-500">{c.role}{c.emergency ? " · Emergency" : ""}</span>}{c.note && <span className="mt-1 block text-xs text-slate-500">{c.note}</span>}</span>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, contacts: f.contacts.map((x) => (x.id === c.id ? { ...x, emergency: !x.emergency } : x)) }))} aria-pressed={c.emergency} className="rounded-lg p-1.5 hover:bg-slate-50" aria-label={c.emergency ? "Not an emergency contact" : "Mark as emergency contact"}><Star size={17} className={c.emergency ? "fill-rose-500 text-rose-500" : "text-slate-300"} /></button>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, contacts: f.contacts.filter((x) => x.id !== c.id) }))} className={danger + " px-2"} aria-label={`Delete ${c.name}`}><Trash2 size={14} /></button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {c.phone && <a href={tel(c.phone)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100"><Phone size={15} />{c.phone}</a>}
        {c.email && <a href={`mailto:${c.email}`} className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-xl bg-sky-50 px-3 text-sm font-bold text-sky-700 hover:bg-sky-100"><Mail size={15} /><span className="truncate">{c.email}</span></a>}
      </div>
    </li>)}</ul> : <Panel><Empty icon={<UserRound />} title={q ? "No contacts match." : "No contacts yet."}>{q ? "Try another word." : "Add the numbers you'd hate to hunt for in a hurry."}</Empty></Panel>}
  </div>;
}
