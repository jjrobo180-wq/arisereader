// "Help & FAQ" in Arise Reader for teachers (pages/TeacherReader.tsx): a search box and every
// how-to, grouped by part of the Reader. Each answer can open the screen it talks about.
// The answers live in shared/readerHelp.ts, where a test checks every button name against the app.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ArrowRight, Search, X } from "lucide-react";
import { HELP, HELP_SECTIONS, boldParts, searchHelp, type HelpEntry, type HelpOpen, type HelpSection } from "@shared/readerHelp";

const C = { card: "#151326", raised: "#1d1a33", line: "rgba(255,255,255,0.08)", text: "#ece9f7", soft: "#a29fb8", accent: "#7c3aed", chip: "#c4b5fd" };

/** Text with its **bold** button names shown in bold. */
function Rich({ text }: { text: string }) {
  return <>{boldParts(text).map((p, i) => (p.bold ? <b key={i} className="font-extrabold text-white">{p.text}</b> : <Fragment key={i}>{p.text}</Fragment>))}</>;
}

function Answer({ e, open, onToggle, onGo, label }: { e: HelpEntry; open: boolean; onToggle: () => void; onGo?: (to: HelpOpen) => void; label?: string }) {
  const id = `help-${e.id}`;
  return (
    <li className="rounded-2xl border" style={{ background: C.card, borderColor: open ? "rgba(196,181,253,0.35)" : C.line }} data-testid={`help-item-${e.id}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left">
        <span className="text-[15px] font-bold leading-snug" style={{ color: C.text }}>{e.q}</span>
        <ChevronDown className="h-5 w-5 shrink-0 transition-transform" style={{ color: C.soft, transform: open ? "rotate(180deg)" : undefined }} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="space-y-3 px-4 pb-4 text-[15px] leading-relaxed" style={{ color: "#ddd8ee" }}>
          <p><Rich text={e.a} /></p>
          {e.steps && <ol className="space-y-2">{e.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: C.accent }}>{i + 1}</span>
              <span className="min-w-0"><Rich text={s} /></span>
            </li>
          ))}</ol>}
          {e.notes && <ul className="space-y-1.5 rounded-xl px-3.5 py-3 text-[14px]" style={{ background: "rgba(255,255,255,0.04)" }}>
            {e.notes.map((n, i) => <li key={i}><Rich text={n} /></li>)}
          </ul>}
          {e.open && onGo && label && (
            <button type="button" onClick={() => onGo(e.open!)} data-testid={`help-go-${e.id}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-extrabold text-white" style={{ background: C.accent }}>
              Take me to {label} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function ReaderHelp({ onGo, labels }: { onGo: (to: HelpOpen) => void; labels: Partial<Record<HelpOpen, string>> }) {
  const [q, setQ] = useState("");
  const [section, setSection] = useState<HelpSection | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { box.current?.focus({ preventScroll: true }); }, []);

  const searching = q.trim().length > 0;
  const found = useMemo(() => (searching ? searchHelp(q) : HELP), [q, searching]);
  // While searching, one ranked list across every section; otherwise grouped by section.
  const shown = searching ? found : section === "all" ? HELP : HELP.filter((e) => e.section === section);
  // A search with just one answer opens it.
  const only = searching && found.length === 1 ? found[0].id : null;
  useEffect(() => { if (only) setOpenId(only); }, [only]);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const item = (e: HelpEntry) => <Answer key={e.id} e={e} open={openId === e.id} onToggle={() => toggle(e.id)} onGo={onGo} label={e.open ? labels[e.open] : undefined} />;

  return (
    <div className="flex flex-col gap-4" data-testid="reader-help">
      <div>
        <h1 className="text-[30px] font-black tracking-[-0.02em]">Help & FAQ</h1>
        <p className="mt-1 text-[15px]" style={{ color: "#c9c5dc" }}>How to do things in Arise Reader. Search, or browse by topic. Button names are in <b className="text-white">bold</b>.</p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.soft }} aria-hidden="true" />
        <input ref={box} type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpenId(null); }} aria-label="Search help"
          placeholder="Search: reset a password, parent codes, grade writing…" data-testid="help-search"
          className="min-h-[52px] w-full rounded-2xl border pl-11 pr-11 text-[16px] outline-none focus:border-violet-400"
          style={{ background: C.raised, borderColor: "rgba(255,255,255,0.14)", color: C.text }} />
        {searching && <button type="button" onClick={() => { setQ(""); box.current?.focus(); }} aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl" style={{ color: C.soft }}><X className="h-5 w-5" /></button>}
      </label>

      {!searching && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topics">
          {(["all", ...HELP_SECTIONS] as const).map((s) => {
            const on = section === s;
            return <button key={s} type="button" aria-pressed={on} onClick={() => { setSection(s); setOpenId(null); }}
              className="min-h-9 rounded-full border px-3 text-[13px] font-bold"
              style={on ? { background: C.chip, borderColor: C.chip, color: "#0d0b1a" } : { borderColor: "rgba(255,255,255,0.14)", color: "#ddd6fe" }}>
              {s === "all" ? "All topics" : s}
            </button>;
          })}
        </div>
      )}

      {searching && <p className="text-sm" role="status" style={{ color: C.soft }}>{found.length ? `${found.length} ${found.length === 1 ? "answer" : "answers"}` : ""}</p>}

      {searching && !found.length ? (
        <div className="rounded-2xl border border-dashed px-5 py-6 text-center" style={{ borderColor: "rgba(255,255,255,0.18)" }} data-testid="help-none">
          <p className="text-[16px] font-bold">No answers for “{q.trim()}”.</p>
          <p className="mt-1 text-sm" style={{ color: C.soft }}>Try fewer or different words, like “password”, “parents” or “quiz”.</p>
          <button type="button" onClick={() => setQ("")} className="mt-3 min-h-10 rounded-[10px] border px-3.5 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.14)", color: "#ddd6fe" }}>See every topic</button>
        </div>
      ) : searching || section !== "all" ? (
        <ul className="flex flex-col gap-2">{shown.map(item)}</ul>
      ) : (
        HELP_SECTIONS.map((s) => (
          <section key={s} aria-label={s} className="flex flex-col gap-2">
            <h2 className="mt-1 text-[13px] font-extrabold uppercase tracking-wider" style={{ color: C.soft }}>{s}</h2>
            <ul className="flex flex-col gap-2">{HELP.filter((e) => e.section === s).map(item)}</ul>
          </section>
        ))
      )}
    </div>
  );
}
