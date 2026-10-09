// Kid behavior tracker: quick praise and redirect taps, a star balance, and rewards to spend stars on.
import { useState, type FormEvent } from "react";
import { Award, Gift, Minus, Plus, Smile, Star, Trash2, Undo2 } from "lucide-react";
import { addDays, starBalance, type BehaviorEntry, type Member } from "@shared/familyHub";
import { Avatar, Empty, Label, MemberPicker, Modal, PageHead, Panel, confirmed, inputClass, memberOf, plain, primary, shortDate, soft, type SectionProps } from "./ui";

const PRAISE = [["Kind words", 1], ["Helped out", 1], ["Listened the first time", 1], ["Homework done", 2], ["Great attitude", 1], ["Shared", 1]] as const;
const REDIRECT = [["Not listening", -1], ["Unkind words", -1], ["Didn't clean up", -1], ["Talked back", -1]] as const;

export default function Behavior({ family, setFamily, today, makeId, say }: SectionProps) {
  const kids = family.members.filter((m) => m.kind === "kid");
  const people = kids.length ? kids : family.members;
  const [focus, setFocus] = useState<string>("");
  const [custom, setCustom] = useState<{ memberId: string; note: string; points: number } | null>(null);
  const [redeem, setRedeem] = useState<string | null>(null);
  const [rewardDraft, setRewardDraft] = useState({ title: "", cost: 10 });
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const log = (memberId: string, note: string, points: number) => {
    const entry: BehaviorEntry = { id: makeId(), memberId, date: today, points, note };
    setFamily((f) => ({ ...f, behavior: [...f.behavior, entry].slice(-8000) }));
    const name = memberOf(family, memberId)?.name || "";
    say(points >= 0 ? `+${points} ⭐ for ${name}: ${note}` : `${points} for ${name}: ${note}`);
  };
  const undo = (id: string) => setFamily((f) => ({ ...f, behavior: f.behavior.filter((b) => b.id !== id) }));
  const spend = (member: Member, title: string, cost: number) => {
    if (starBalance(family, member.id).balance < cost) { say(`${member.name} needs ${cost - starBalance(family, member.id).balance} more stars for that.`); return; }
    if (!confirmed(`Spend ${cost} stars on "${title}" for ${member.name}?`)) return;
    setFamily((f) => ({ ...f, redemptions: [...f.redemptions, { id: makeId(), memberId: member.id, title, cost, date: today }] }));
    setRedeem(null);
    say(`🎁 ${member.name} got “${title}”!`);
  };
  const addReward = (e: FormEvent) => {
    e.preventDefault();
    const title = rewardDraft.title.trim();
    if (!title) return;
    setFamily((f) => ({ ...f, rewards: [...f.rewards, { id: makeId(), title: title.slice(0, 80), cost: Math.max(1, Math.round(rewardDraft.cost) || 1) }] }));
    setRewardDraft({ title: "", cost: 10 });
  };
  const recent = family.behavior.filter((b) => !focus || b.memberId === focus).slice(-30).reverse();

  if (!people.length) return <div className="space-y-6">
    <PageHead eyebrow="Behavior" title="Behavior tracker" blurb="Catch the good moments, gently note the hard ones, and turn stars into rewards." />
    <Panel><Empty icon={<Smile size={26} />} title="Add your kids first">Go to “Family & settings” and add each child. Mark them as a kid and they'll show up here.</Empty></Panel>
  </div>;

  return <div className="space-y-6">
    <PageHead eyebrow="Behavior" title="Behavior tracker" blurb="Tap to give a star when you catch something good. Stars from chores count too, and kids can spend them on rewards." />

    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {people.map((m) => {
        const stars = starBalance(family, m.id);
        const todayNet = family.behavior.filter((b) => b.memberId === m.id && b.date === today).reduce((s, b) => s + b.points, 0);
        const daily = week.map((d) => family.behavior.filter((b) => b.memberId === m.id && b.date === d).reduce((s, b) => s + b.points, 0));
        const peak = Math.max(1, ...daily.map(Math.abs));
        return <section key={m.id} className="overflow-hidden rounded-[1.5rem] border border-[#e7e8f0] bg-white shadow-[0_8px_28px_#17152b08]">
          <div className="flex items-center gap-3 p-4" style={{ background: m.color + "14" }}>
            <Avatar member={m} size="lg" />
            <div className="min-w-0 flex-1"><p className="truncate text-lg font-black">{m.name}</p><p className="text-xs font-semibold text-slate-500">Today: {todayNet > 0 ? "+" : ""}{todayNet}</p></div>
            <div className="text-right"><p className="inline-flex items-center gap-1 text-2xl font-black text-amber-600"><Star size={20} className="fill-amber-400 text-amber-400" />{stars.balance}</p><p className="text-[11px] font-semibold text-slate-500">stars to spend</p></div>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex h-12 items-end gap-1.5" aria-label="Last 7 days">
              {daily.map((v, i) => <div key={week[i]} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${shortDate(week[i])}: ${v > 0 ? "+" : ""}${v}`}>
                <div className="w-full rounded-md" style={{ height: `${Math.max(3, (Math.abs(v) / peak) * 32)}px`, background: v < 0 ? "#f3a19a" : v > 0 ? m.color : "#e2e8f0" }} />
                <span className="text-[9px] font-bold text-slate-400">{shortDate(week[i], { weekday: "narrow" })}</span>
              </div>)}
            </div>
            <div className="flex flex-wrap gap-1.5">{PRAISE.map(([note, pts]) => <button key={note} onClick={() => log(m.id, note, pts)} className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Plus size={12} />{note}</button>)}</div>
            <div className="flex flex-wrap gap-1.5">{REDIRECT.map(([note, pts]) => <button key={note} onClick={() => log(m.id, note, pts)} className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-rose-50 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100"><Minus size={12} />{note}</button>)}</div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => setCustom({ memberId: m.id, note: "", points: 1 })} className={plain}>Custom…</button>
              <button onClick={() => setRedeem(m.id)} className={soft}><Gift size={16} /> Spend stars</button>
            </div>
          </div>
        </section>;
      })}
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel eyebrow="Log" title="Recent moments" right={<select value={focus} onChange={(e) => setFocus(e.target.value)} className={inputClass + " min-h-10 w-auto"} aria-label="Show moments for"><option value="">Everyone</option>{people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}>
        {recent.length ? <ul className="divide-y divide-slate-100">{recent.map((b) => {
          const m = memberOf(family, b.memberId);
          return <li key={b.id} className="flex items-center gap-3 py-2.5">
            <Avatar member={m} size="sm" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{b.note || (b.points >= 0 ? "Star" : "Redirect")}</span><span className="text-[11px] text-slate-500">{m?.name} · {b.date === today ? "Today" : shortDate(b.date)}</span></span>
            <span className={`text-sm font-black ${b.points >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{b.points > 0 ? "+" : ""}{b.points}</span>
            <button onClick={() => undo(b.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Remove ${b.note}`}><Undo2 size={15} /></button>
          </li>;
        })}</ul> : <p className="text-sm text-slate-500">Nothing logged yet. Tap a button on a kid's card.</p>}
      </Panel>

      <Panel eyebrow="Rewards" title="Reward menu" right={<Award size={18} className="text-violet-500" />}>
        <ul className="space-y-2">{family.rewards.map((r) => <li key={r.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <Gift size={15} className="shrink-0 text-violet-500" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.title}</span>
          <span className="text-xs font-black text-amber-600">{r.cost}⭐</span>
          <button onClick={() => setFamily((f) => ({ ...f, rewards: f.rewards.filter((x) => x.id !== r.id) }))} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Remove reward ${r.title}`}><Trash2 size={14} /></button>
        </li>)}</ul>
        <form onSubmit={addReward} className="mt-3 flex gap-2">
          <input value={rewardDraft.title} onChange={(e) => setRewardDraft({ ...rewardDraft, title: e.target.value })} maxLength={80} placeholder="New reward" aria-label="New reward" className={inputClass + " min-w-0"} />
          <input type="number" min={1} value={rewardDraft.cost} onChange={(e) => setRewardDraft({ ...rewardDraft, cost: Number(e.target.value) })} aria-label="Stars it costs" className={inputClass + " w-20"} />
          <button type="submit" className={primary} aria-label="Add reward"><Plus size={17} /></button>
        </form>
        {family.redemptions.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4"><p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Recently earned</p>
          <ul className="space-y-1.5">{family.redemptions.slice(-5).reverse().map((r) => <li key={r.id} className="flex items-center gap-2 text-xs"><Avatar member={memberOf(family, r.memberId)} size="sm" /><span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span><span className="text-slate-400">{shortDate(r.date, { month: "short", day: "numeric" })}</span></li>)}</ul>
        </div>}
      </Panel>
    </div>

    {custom && <Modal title="Log a moment" onClose={() => setCustom(null)}>
      <form onSubmit={(e) => { e.preventDefault(); if (!custom.memberId) return; log(custom.memberId, custom.note.trim().slice(0, 200) || (custom.points >= 0 ? "Star" : "Redirect"), Math.max(-100, Math.min(100, Math.round(custom.points)))); setCustom(null); }} className="space-y-4">
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Who</p><MemberPicker members={people} value={custom.memberId ? [custom.memberId] : []} onChange={(ids) => setCustom({ ...custom, memberId: ids[0] || "" })} /></div>
        <Label text="What happened"><input autoFocus maxLength={200} value={custom.note} onChange={(e) => setCustom({ ...custom, note: e.target.value })} className={inputClass} placeholder="Helped grandma carry groceries" /></Label>
        <Label text="Stars (use a minus for a redirect)"><input type="number" min={-100} max={100} value={custom.points} onChange={(e) => setCustom({ ...custom, points: Number(e.target.value) })} className={inputClass + " max-w-[120px]"} /></Label>
        <button type="submit" className={primary + " w-full"} disabled={!custom.memberId}>Save</button>
      </form>
    </Modal>}

    {redeem && (() => {
      const m = memberOf(family, redeem);
      if (!m) return null;
      const balance = starBalance(family, m.id).balance;
      return <Modal title={`Spend ${m.name}'s stars`} onClose={() => setRedeem(null)}>
        <p className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-amber-700"><Star size={16} className="fill-amber-400 text-amber-400" />{balance} stars available</p>
        {family.rewards.length ? <ul className="space-y-2">{family.rewards.map((r) => <li key={r.id}>
          <button onClick={() => spend(m, r.title, r.cost)} disabled={balance < r.cost} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-left hover:border-violet-300 hover:bg-violet-50 disabled:opacity-45 disabled:hover:bg-white">
            <Gift size={17} className="text-violet-500" /><span className="flex-1 text-sm font-bold">{r.title}</span><span className="text-sm font-black text-amber-600">{r.cost}⭐</span>
          </button>
        </li>)}</ul> : <p className="text-sm text-slate-500">Add rewards to the reward menu first.</p>}
      </Modal>;
    })()}
  </div>;
}
