// Family polls: dinner ideas, weekend plans, or anything else. Everyone gets one vote.
import { useState, type FormEvent } from "react";
import { CalendarPlus, Check, Crown, Lock, LockOpen, Plus, Trash2, UtensilsCrossed, Vote, Mountain, X } from "lucide-react";
import { POLL_TEMPLATES, addDays, fromDay, tally, type Poll, type PollKind } from "@shared/familyHub";
import { Avatar, Empty, Label, Modal, PageHead, Panel, confirmed, danger, inputClass, memberOf, plain, primary, shortDate, soft, type SectionProps } from "./ui";

const KIND_META: Record<PollKind, { label: string; icon: typeof Vote; tint: string }> = {
  dinner: { label: "Dinner", icon: UtensilsCrossed, tint: "#f59e72" },
  weekend: { label: "Weekend", icon: Mountain, tint: "#36b6a5" },
  other: { label: "Family vote", icon: Vote, tint: "#7566e8" },
};
type Draft = { kind: PollKind; question: string; options: string[]; closesOn: string };

export const pollIsOpen = (p: Poll, today: string) => !p.closed && (!p.closesOn || p.closesOn >= today);

export default function Polls({ family, setFamily, today, makeId, say }: SectionProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [voter, setVoter] = useState<Record<string, string>>({});
  const [suggest, setSuggest] = useState<Record<string, string>>({});
  const [showClosed, setShowClosed] = useState(false);
  const open = family.polls.filter((p) => pollIsOpen(p, today)).reverse();
  const closed = family.polls.filter((p) => !pollIsOpen(p, today)).reverse();
  const saturday = (() => { const d = fromDay(today).getDay(); return addDays(today, d === 6 ? 0 : 6 - d); })();

  const start = (kind: PollKind) => {
    const t = POLL_TEMPLATES[kind];
    setDraft({ kind, question: t.question, options: [...t.options], closesOn: kind === "dinner" ? today : kind === "weekend" ? addDays(saturday, -1) : "" });
  };
  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const options = draft.options.map((o) => o.trim()).filter(Boolean).slice(0, 20);
    if (!draft.question.trim() || options.length < 2) { say("Add a question and at least two choices."); return; }
    const poll: Poll = { id: makeId(), question: draft.question.trim().slice(0, 160), kind: draft.kind, options: [...new Set(options)].map((label) => ({ id: makeId(), label: label.slice(0, 100) })), votes: {}, closed: false, createdAt: new Date().toISOString(), closesOn: draft.closesOn };
    setFamily((f) => ({ ...f, polls: [...f.polls, poll].slice(-300) }));
    setDraft(null);
    say("Poll started. Pass the phone around!");
  };
  const update = (id: string, fn: (p: Poll) => Poll) => setFamily((f) => ({ ...f, polls: f.polls.map((p) => (p.id === id ? fn(p) : p)) }));
  const vote = (p: Poll, optionId: string) => {
    const who = voter[p.id] || family.members.find((m) => !p.votes[m.id])?.id || "";
    if (!who) { say("Pick who is voting first."); return; }
    update(p.id, (x) => ({ ...x, votes: { ...x.votes, [who]: optionId } }));
    const next = family.members.find((m) => m.id !== who && !p.votes[m.id]);
    setVoter((v) => ({ ...v, [p.id]: next?.id || who }));
    say(`${memberOf(family, who)?.name || "Vote"} picked ${p.options.find((o) => o.id === optionId)?.label}`);
  };
  const addOption = (p: Poll) => {
    const label = (suggest[p.id] || "").trim();
    if (!label || p.options.length >= 20) return;
    if (p.options.some((o) => o.label.toLowerCase() === label.toLowerCase())) { say("That's already a choice."); return; }
    update(p.id, (x) => ({ ...x, options: [...x.options, { id: makeId(), label: label.slice(0, 100) }] }));
    setSuggest((s) => ({ ...s, [p.id]: "" }));
  };
  const toCalendar = (p: Poll) => {
    const winner = tally(p).leaders[0];
    if (!winner) return;
    const date = p.kind === "weekend" ? saturday : today;
    setFamily((f) => ({ ...f, events: [...f.events, { id: makeId(), title: p.kind === "dinner" ? `Dinner: ${winner.label}` : winner.label, date, time: p.kind === "dinner" ? "18:00" : "10:00", endTime: "", calendarId: f.calendars[0]?.id || "", memberIds: f.members.map((m) => m.id), location: "", notes: `Picked in the poll “${p.question}”`, repeat: "none" }] }));
    say(`Added “${winner.label}” to the calendar on ${shortDate(date)}`);
  };

  const card = (p: Poll) => {
    const meta = KIND_META[p.kind];
    const Icon = meta.icon;
    const isOpen = pollIsOpen(p, today);
    const { ranked, total, leaders } = tally(p);
    const current = voter[p.id] || family.members.find((m) => !p.votes[m.id])?.id || "";
    const waiting = family.members.filter((m) => !p.votes[m.id]);
    return <section key={p.id} className="flex flex-col overflow-hidden rounded-[1.5rem] border border-[#e7e8f0] bg-white shadow-[0_8px_28px_#17152b08]">
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="rounded-xl p-2.5 text-white" style={{ background: meta.tint }}><Icon size={18} /></span>
        <div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-wider" style={{ color: meta.tint }}>{meta.label}{p.closesOn ? ` · ${isOpen ? "closes" : "closed"} ${p.closesOn === today ? "today" : shortDate(p.closesOn, { weekday: "short", month: "short", day: "numeric" })}` : ""}</p><h3 className="mt-0.5 text-base font-black leading-snug">{p.question}</h3></div>
        {!isOpen && <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500"><Lock size={11} /> Closed</span>}
      </div>
      {isOpen && family.members.length > 0 && <div className="px-4 pb-2">
        <p className="mb-1.5 text-[11px] font-bold text-slate-500">Who's voting?</p>
        <div className="flex flex-wrap gap-1.5">{family.members.map((m) => <button key={m.id} onClick={() => setVoter((v) => ({ ...v, [p.id]: m.id }))} aria-pressed={current === m.id} className="relative inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 pr-2.5 text-xs font-bold ring-1 bg-white text-slate-600 ring-slate-200" style={current === m.id ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}>
          <span>{m.emoji || "🙂"}</span>{m.name}{p.votes[m.id] && <Check size={12} />}
        </button>)}</div>
      </div>}
      <ul className="space-y-1.5 px-4 py-2">{ranked.map((o) => {
        const voters = Object.entries(p.votes).filter(([, c]) => c === o.id).map(([m]) => m);
        const win = !isOpen && leaders.some((l) => l.id === o.id);
        const mine = current && p.votes[current] === o.id;
        return <li key={o.id}>
          <button disabled={!isOpen || !family.members.length} onClick={() => vote(p, o.id)} className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition ${mine ? "border-violet-400" : win ? "border-amber-300" : "border-slate-200"} ${isOpen ? "hover:border-violet-300" : ""}`}>
            <span className="absolute inset-y-0 left-0 transition-all" style={{ width: `${total ? (o.votes / total) * 100 : 0}%`, background: (win ? "#f59e0b" : meta.tint) + "22" }} />
            <span className="relative flex items-center gap-2">
              {win && <Crown size={15} className="text-amber-500" />}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{o.label}</span>
              <span className="flex -space-x-1">{voters.slice(0, 6).map((m) => <Avatar key={m} member={memberOf(family, m)} size="sm" />)}</span>
              <span className="w-6 text-right text-xs font-black text-slate-500">{o.votes}</span>
            </span>
          </button>
        </li>;
      })}</ul>
      {isOpen && <form onSubmit={(e) => { e.preventDefault(); addOption(p); }} className="flex gap-2 px-4 pb-3">
        <input value={suggest[p.id] || ""} onChange={(e) => setSuggest((s) => ({ ...s, [p.id]: e.target.value }))} maxLength={100} placeholder="Suggest another idea" aria-label="Suggest another choice" className={inputClass + " min-h-10 min-w-0"} />
        <button type="submit" className={soft} aria-label="Add choice"><Plus size={16} /></button>
      </form>}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs">
        <span className="mr-auto font-semibold text-slate-500">{total} vote{total === 1 ? "" : "s"}{isOpen && waiting.length ? ` · waiting on ${waiting.map((m) => m.name).join(", ")}` : ""}</span>
        {!isOpen && leaders.length > 0 && <button onClick={() => toCalendar(p)} className={soft + " min-h-9"}><CalendarPlus size={15} /> Add to calendar</button>}
        <button onClick={() => update(p.id, (x) => ({ ...x, closed: isOpen, closesOn: isOpen ? x.closesOn : "" }))} className={plain + " min-h-9"}>{isOpen ? <><Lock size={14} /> Close poll</> : <><LockOpen size={14} /> Reopen</>}</button>
        <button onClick={() => { if (confirmed(`Delete the poll "${p.question}"?`)) setFamily((f) => ({ ...f, polls: f.polls.filter((x) => x.id !== p.id) })); }} className={danger + " min-h-9"} aria-label="Delete poll"><Trash2 size={14} /></button>
      </div>
    </section>;
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Polls" title="Family polls" blurb="Settle “what's for dinner?” and “what are we doing Saturday?” with a quick vote. Hand the phone around and everyone taps their pick." />
    <div className="grid gap-3 sm:grid-cols-3">
      {(Object.keys(KIND_META) as PollKind[]).map((k) => { const m = KIND_META[k]; const Icon = m.icon; return <button key={k} onClick={() => start(k)} className="flex items-center gap-3 rounded-2xl border border-[#e7e8f0] bg-white p-4 text-left shadow-[0_3px_16px_#17152b08] transition hover:border-violet-200 hover:bg-[#fcfbff]">
        <span className="rounded-xl p-2.5 text-white" style={{ background: m.tint }}><Icon size={20} /></span>
        <span><span className="block text-sm font-black">{k === "dinner" ? "Dinner ideas poll" : k === "weekend" ? "Weekend activities poll" : "Custom poll"}</span><span className="text-xs text-slate-500">{k === "dinner" ? "Vote on tonight's meal" : k === "weekend" ? "Pick Saturday's plan" : "Ask the family anything"}</span></span>
      </button>; })}
    </div>
    {!family.members.length && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Add your family in “Family & settings” so everyone can vote.</p>}
    {open.length ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{open.map(card)}</div>
      : <Panel><Empty icon={<Vote size={26} />} title="No open polls" action={<button onClick={() => start("dinner")} className={soft}><UtensilsCrossed size={16} /> Start a dinner poll</button>}>Start one above. Results show live as people vote.</Empty></Panel>}
    {closed.length > 0 && <div>
      <button onClick={() => setShowClosed(!showClosed)} className={plain}>{showClosed ? "Hide" : "Show"} past polls ({closed.length})</button>
      {showClosed && <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{closed.slice(0, 30).map(card)}</div>}
    </div>}

    {draft && <Modal title="Start a poll" onClose={() => setDraft(null)}>
      <form onSubmit={create} className="space-y-4">
        <Label text="Question"><input autoFocus required maxLength={160} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} className={inputClass} placeholder="Where should we go for the long weekend?" /></Label>
        <div>
          <p className="mb-1.5 text-xs font-bold text-slate-600">Choices</p>
          <div className="space-y-2">{draft.options.map((o, i) => <div key={i} className="flex gap-2">
            <input value={o} maxLength={100} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Choice ${i + 1}`} aria-label={`Choice ${i + 1}`} className={inputClass} />
            {draft.options.length > 2 && <button type="button" onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })} className={plain} aria-label={`Remove choice ${i + 1}`}><X size={16} /></button>}
          </div>)}</div>
          {draft.options.length < 20 && <button type="button" onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })} className={soft + " mt-2"}><Plus size={15} /> Add a choice</button>}
        </div>
        <Label text="Voting closes (optional)"><input type="date" min={today} value={draft.closesOn} onChange={(e) => setDraft({ ...draft, closesOn: e.target.value })} className={inputClass + " max-w-[220px]"} /></Label>
        <button type="submit" className={primary + " w-full"}><Vote size={17} /> Start poll</button>
      </form>
    </Modal>}
  </div>;
}
