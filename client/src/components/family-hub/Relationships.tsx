// Relationships (a Plugin Store add-on): a tip each day, tips by topic, conversation starters and
// date ideas, with where to turn for help when things are more than everyday trouble.
import { useState } from "react";
import { Heart, LifeBuoy, MessageCircleHeart, Shuffle, Sparkles } from "lucide-react";
import { ALL_TIPS, CONVERSATION_STARTERS, DATE_IDEAS, RELATIONSHIP_TOPICS, forDay } from "@shared/lifePlugins";
import { PageHead, Panel, plain, type SectionProps } from "./ui";

const pick = <T,>(list: readonly T[], not?: T) => { let x = list[Math.floor(Math.random() * list.length)]; while (list.length > 1 && x === not) x = list[Math.floor(Math.random() * list.length)]; return x; };
const KINDS = [["all", "Any"], ["home", "At home"], ["free", "Free"], ["out", "Going out"]] as const;

export default function Relationships({ today }: SectionProps) {
  const [topic, setTopic] = useState(RELATIONSHIP_TOPICS[0].id);
  const [starter, setStarter] = useState(() => forDay(CONVERSATION_STARTERS, today));
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("all");
  const ideas = DATE_IDEAS.filter((d) => kind === "all" || d.kind === kind);
  const [idea, setIdea] = useState(() => forDay(DATE_IDEAS, today).idea);
  const current = RELATIONSHIP_TOPICS.find((t) => t.id === topic)!;

  return <div className="space-y-6">
    <PageHead eyebrow="Relationships" title="Stronger together" blurb="Small, practical ideas for talking, making up, and keeping the spark. A tip a day, plus things to talk about and do together." />
    <section className="rounded-[2rem] bg-gradient-to-br from-rose-50 to-white p-7 ring-1 ring-rose-100 sm:p-9">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.2em] text-rose-600"><Heart size={14} className="fill-current" />Today's tip</p>
      <p className="mt-3 text-xl font-black leading-snug text-[#2a2235] sm:text-2xl">{forDay(ALL_TIPS, today)}</p>
    </section>
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Something to talk about" right={<button type="button" onClick={() => setStarter(pick(CONVERSATION_STARTERS, starter))} className={plain}><Shuffle size={15} />Another</button>}>
        <p className="flex gap-3 text-lg font-bold leading-snug text-[#232139]"><MessageCircleHeart className="mt-1 shrink-0 text-rose-500" size={20} />{starter}</p>
        <p className="mt-3 text-xs text-slate-500">Ask over dinner, on a walk or in the car. Listen more than you talk.</p>
      </Panel>
      <Panel title="Date idea" right={<button type="button" onClick={() => setIdea(pick(ideas.map((d) => d.idea), idea))} className={plain}><Shuffle size={15} />Another</button>}>
        <div className="mb-3 flex flex-wrap gap-1.5">{KINDS.map(([id, label]) => <button key={id} type="button" onClick={() => { setKind(id); setIdea(pick(DATE_IDEAS.filter((d) => id === "all" || d.kind === id).map((d) => d.idea))); }} aria-pressed={kind === id} className={`min-h-9 rounded-full px-3 text-xs font-bold ${kind === id ? "bg-rose-500 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}</div>
        <p className="flex gap-3 text-lg font-bold leading-snug text-[#232139]"><Sparkles className="mt-1 shrink-0 text-amber-500" size={20} />{idea}</p>
      </Panel>
    </div>
    <Panel title="Tips by topic">
      <div className="mb-4 flex flex-wrap gap-1.5">{RELATIONSHIP_TOPICS.map((t) => <button key={t.id} type="button" onClick={() => setTopic(t.id)} aria-pressed={topic === t.id} className={`min-h-10 rounded-xl px-3.5 text-sm font-bold ${topic === t.id ? "bg-[#292446] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{t.title}</button>)}</div>
      <ul className="space-y-3">{current.tips.map((tip, i) => <li key={i} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-black text-rose-600">{i + 1}</span>{tip}</li>)}</ul>
    </Panel>
    <Panel>
      <div className="flex gap-3 text-sm leading-6 text-slate-600">
        <LifeBuoy className="mt-0.5 shrink-0 text-violet-600" size={20} />
        <p>These are everyday ideas, not a substitute for counseling. A licensed couples therapist can help with deeper problems. If you ever feel unsafe, controlled or afraid of a partner, the National Domestic Violence Hotline is free and confidential, any time: call <a className="font-bold text-violet-700" href="tel:18007997233">1-800-799-7233</a> or text START to <a className="font-bold text-violet-700" href="sms:88788">88788</a>. In an emergency, call 911.</p>
      </div>
    </Panel>
  </div>;
}
