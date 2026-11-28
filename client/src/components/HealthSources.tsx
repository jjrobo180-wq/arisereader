// "Sources" under a calorie recommendation: a tap opens the list of studies and guidelines the numbers come
// from, each a link (App Review 1.4.1). Works on light and dark screens.
import { useState, type MouseEvent } from "react";
import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import { GENERAL_DISCLAIMER, HEALTH_DISCLAIMER, sourcesFor, type HealthTopic } from "@shared/healthSources";
import { isNativeApp, openOutside } from "@/lib/nativeApp";

/** `tone` sets the colors directly (CSS colors), for themed screens like Cooked Fitness. */
export default function HealthSources({ dark = false, open: startOpen = false, className = "", tone, topics, label = "Sources for these numbers" }: { dark?: boolean; open?: boolean; className?: string; topics?: HealthTopic[]; label?: string; tone?: { link: string; soft: string; ink: string } }) {
  const [open, setOpen] = useState(startOpen);
  const t = tone ? { link: { color: tone.link }, soft: { color: tone.soft }, ink: { color: tone.ink } } : { link: undefined, soft: undefined, ink: undefined };
  const soft = tone ? "" : dark ? "text-white/65" : "text-slate-500", ink = tone ? "" : dark ? "text-white" : "text-slate-800", link = tone ? "" : dark ? "text-[#bcb2ff]" : "text-violet-700";
  const go = (e: MouseEvent, url: string) => { if (isNativeApp()) { e.preventDefault(); openOutside(url); } };
  return <div className={`text-[12px] leading-5 ${className}`} data-testid="health-sources">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`inline-flex min-h-9 items-center gap-1.5 font-semibold ${link}`} style={t.link}>
      <BookOpen size={14} aria-hidden />{label}<ChevronDown size={14} className={open ? "rotate-180" : ""} aria-hidden />
    </button>
    {open && <div className="mt-1">
      <ul className="space-y-2">{sourcesFor(topics).map((s) => <li key={s.id}>
        <a href={s.url} target="_blank" rel="noreferrer" onClick={(e) => go(e, s.url)} className={`inline-flex items-start gap-1 font-semibold underline underline-offset-2 ${link}`} style={t.link}>{s.title}<ExternalLink size={12} className="mt-1 shrink-0" aria-hidden /></a>
        <span className={`block ${soft}`} style={t.soft}>{s.by}</span>
        <span className={`block ${ink}`} style={t.ink}>Used for: {s.for}</span>
      </li>)}</ul>
      <p className={`mt-2 ${soft}`} style={t.soft}>{!topics || (topics.length === 1 && topics[0] === "nutrition") ? HEALTH_DISCLAIMER : GENERAL_DISCLAIMER}</p>
    </div>}
  </div>;
}
