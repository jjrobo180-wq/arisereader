// Mood tracker: a daily check-in for anyone in the family, a 30-day picture, and what tends to go with good and hard days.
import { useState } from "react";
import { HeartHandshake, Phone } from "lucide-react";
import { addDays, type MoodEntry } from "@shared/familyHub";
import { trackerPeople } from "@shared/familyHealth";
import { useAuth } from "@/context/AuthContext";
import { PageHead, Panel, inputClass, shortDate, type SectionProps } from "./ui";

export const MOODS = [
  { value: 1, face: "😢", label: "Awful", color: "#e0645a" },
  { value: 2, face: "🙁", label: "Bad", color: "#ef9a4a" },
  { value: 3, face: "😐", label: "Okay", color: "#e5c04f" },
  { value: 4, face: "🙂", label: "Good", color: "#7cc46b" },
  { value: 5, face: "😄", label: "Great", color: "#36b6a5" },
];
const TAGS = ["Work", "School", "Family", "Friends", "Sleep", "Exercise", "Outdoors", "Food", "Health", "Stress", "Money", "Weather", "Kids", "Relaxed", "Productive", "Lonely"];
export const moodOf = (n: number) => MOODS.find((m) => m.value === Math.round(n)) || MOODS[2];

export function moodInsights(entries: MoodEntry[]) {
  const byTag = new Map<string, number[]>();
  for (const e of entries) for (const t of e.tags) byTag.set(t, [...(byTag.get(t) || []), e.mood]);
  const avg = entries.length ? entries.reduce((s, e) => s + e.mood, 0) / entries.length : 0;
  const scored = [...byTag.entries()].filter(([, v]) => v.length >= 3).map(([tag, v]) => ({ tag, avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }));
  return {
    avg,
    lifts: scored.filter((x) => x.avg >= avg + 0.4).sort((a, b) => b.avg - a.avg).slice(0, 3),
    drags: scored.filter((x) => x.avg <= avg - 0.4).sort((a, b) => a.avg - b.avg).slice(0, 3),
  };
}

export default function Mood({ family, setFamily, today, say }: SectionProps) {
  const { user } = useAuth();
  const people = trackerPeople(family, (user?.displayName || "").split(" ")[0]);
  const [who, setWho] = useState(people[0]?.id || "me");
  const [date, setDate] = useState(today);
  const member = people.find((m) => m.id === who) || people[0];
  const memberId = member?.id || "me";
  const mine = family.moods.filter((m) => m.memberId === memberId);
  const entry = mine.find((m) => m.date === date);
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const last30 = mine.filter((m) => m.date >= days[0]);
  const week = mine.filter((m) => m.date > addDays(today, -7));
  const prevWeek = mine.filter((m) => m.date > addDays(today, -14) && m.date <= addDays(today, -7));
  const avg = (xs: MoodEntry[]) => (xs.length ? xs.reduce((s, x) => s + x.mood, 0) / xs.length : 0);
  const insights = moodInsights(last30);
  let streak = 0;
  for (let d = today; mine.some((m) => m.date === d); d = addDays(d, -1)) streak++;
  const kid = member?.kind === "kid";

  const save = (patch: Partial<MoodEntry>) => setFamily((f) => {
    const id = `${memberId}:${date}`;
    const old = f.moods.find((m) => m.id === id);
    const next: MoodEntry = { id, memberId, date, mood: 3, tags: [], note: "", ...old, ...patch };
    return { ...f, moods: [...f.moods.filter((m) => m.id !== id), next].slice(-6000) };
  });

  return <div className="space-y-6">
    <PageHead eyebrow="Mood" title="Mood tracker" blurb="A 10-second check-in each day. Over time you'll see what lifts your mood and what weighs on it." />
    {people.length > 1 && <div className="flex flex-wrap gap-2">{people.map((m) => <button key={m.id} onClick={() => setWho(m.id)} aria-pressed={m.id === memberId}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-2.5 pr-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
      style={m.id === memberId ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}</button>)}</div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Panel eyebrow={date === today ? "Today" : shortDate(date)} title={kid ? `How is ${member?.name} feeling?` : member?.id === "me" ? "How are you feeling?" : `How is ${member?.name} feeling?`}
          right={<input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Day" className={inputClass + " min-h-10 w-auto"} />}>
          <div className="grid grid-cols-5 gap-2">{MOODS.map((m) => { const on = entry?.mood === m.value; return <button key={m.value} onClick={() => { save({ mood: m.value }); if (!entry) say(`Mood logged: ${m.label}`); }} aria-pressed={on}
            className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-bold ring-2 transition ${on ? "" : "ring-transparent hover:bg-slate-50"}`} style={on ? { background: m.color + "22", boxShadow: `inset 0 0 0 2px ${m.color}` } : undefined}>
            <span className="text-3xl sm:text-4xl" aria-hidden="true">{m.face}</span>{m.label}</button>; })}</div>
          {entry && <>
            <p className="mb-2 mt-5 text-xs font-bold text-slate-600">What's going on? <span className="font-normal text-slate-400">(optional)</span></p>
            <div className="flex flex-wrap gap-1.5">{TAGS.map((t) => { const on = entry.tags.includes(t); return <button key={t} onClick={() => save({ tags: on ? entry.tags.filter((x) => x !== t) : [...entry.tags, t] })} aria-pressed={on}
              className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${on ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>{t}</button>; })}</div>
            <label className="mt-4 block text-xs font-bold text-slate-600">Note<textarea key={date + memberId} defaultValue={entry.note} onBlur={(e) => { if (e.target.value !== entry.note) save({ note: e.target.value.slice(0, 500) }); }} rows={2} maxLength={500} placeholder="A word about today" className={inputClass + " mt-1.5 py-3"} /></label>
          </>}
          {entry && entry.mood <= 2 && <div className="mt-4 flex gap-3 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900">
            <HeartHandshake size={20} className="mt-0.5 shrink-0 text-violet-600" />
            <p>Sorry today is hard. Talking to someone you trust can help. If you're struggling or thinking about hurting yourself, you can call or text <b>988</b> (Suicide &amp; Crisis Lifeline) any time, day or night, in the U.S. <a href="tel:988" className="ml-1 inline-flex items-center gap-1 font-bold underline"><Phone size={13} />Call 988</a></p>
          </div>}
        </Panel>

        <Panel eyebrow="Last 30 days" title={last30.length ? `${moodOf(avg(last30)).face} Mostly ${moodOf(avg(last30)).label.toLowerCase()}` : "Your month"}>
          <div className="flex h-32 items-end gap-1">{days.map((d) => { const m = mine.find((x) => x.date === d); return <button key={d} onClick={() => setDate(d)} title={`${shortDate(d)}${m ? `: ${moodOf(m.mood).label}` : ""}`} aria-label={shortDate(d)} className="flex h-full flex-1 flex-col justify-end">
            <span className={`block w-full rounded-t-md ${d === date ? "ring-2 ring-violet-500" : ""}`} style={{ height: m ? `${m.mood * 20}%` : "4px", background: m ? moodOf(m.mood).color : "#e2e8f0" }} />
          </button>; })}</div>
          <div className="mt-1.5 flex justify-between text-[10px] font-bold text-slate-400"><span>{shortDate(days[0], { month: "short", day: "numeric" })}</span><span>Today</span></div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{streak}</p><p className="text-[11px] font-bold text-slate-500">day streak</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{week.length ? moodOf(avg(week)).face : "–"}</p><p className="text-[11px] font-bold text-slate-500">this week</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{week.length && prevWeek.length ? (avg(week) > avg(prevWeek) + 0.2 ? "↑" : avg(week) < avg(prevWeek) - 0.2 ? "↓" : "→") : "–"}</p><p className="text-[11px] font-bold text-slate-500">vs last week</p></div>
          </div>
        </Panel>
      </div>

      <aside className="space-y-5">
        <Panel eyebrow="Patterns" title="What goes with your days">
          {insights.lifts.length || insights.drags.length ? <div className="space-y-4 text-sm">
            {insights.lifts.length > 0 && <div><p className="mb-1.5 text-xs font-black text-emerald-700">Better days often include</p><div className="flex flex-wrap gap-1.5">{insights.lifts.map((x) => <span key={x.tag} className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{x.tag} · {moodOf(x.avg).face}</span>)}</div></div>}
            {insights.drags.length > 0 && <div><p className="mb-1.5 text-xs font-black text-rose-600">Harder days often include</p><div className="flex flex-wrap gap-1.5">{insights.drags.map((x) => <span key={x.tag} className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">{x.tag} · {moodOf(x.avg).face}</span>)}</div></div>}
          </div> : <p className="text-sm text-slate-500">After a couple of weeks of check-ins with tags, you'll see which ones go with your better and harder days.</p>}
        </Panel>
        {last30.filter((m) => m.note.trim()).length > 0 && <Panel eyebrow="Journal" title="Recent notes">
          <ul className="space-y-3">{last30.filter((m) => m.note.trim()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((m) => <li key={m.id} className="text-sm"><p className="text-[11px] font-bold text-slate-500">{moodOf(m.mood).face} {shortDate(m.date)}</p><p className="mt-0.5 whitespace-pre-wrap text-slate-700">{m.note}</p></li>)}</ul>
        </Panel>}
      </aside>
    </div>
  </div>;
}
