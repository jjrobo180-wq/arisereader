// Smart matching in Arise Fit: six quick answers, then the three best trainers with the reasons and the price that
// fits. Scoring: shared/coachMatch.ts. Server: server/coach.ts (/api/coach/match).
import { useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { MODES, MODE_BLURB, MODE_LABEL, US_STATES, type Mode, type PublicTrainer } from "@shared/coach";
import { GOALS, emptyNeed, introMessage, type Match, type Need } from "@shared/coachMatch";
import { post } from "./coachApi";
import { Avatar, Stars } from "./CoachUi";
import { Btn, C, Card, Field, Sheet, Title, display, inputCls, inputStyle } from "../fit/fitUi";

const BUDGETS = [[0, "No limit"], [10000, "$100"], [20000, "$200"], [30000, "$300"], [50000, "$500"], [80000, "$800"]] as const;
const LEVELS = [["new", "New to this"], ["some", "Some experience"], ["experienced", "Experienced"]] as const;
const usd = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export function MatchCard({ onOpen }: { onOpen: () => void }) {
  return <Card onClick={onOpen} className="!p-4" style={{ background: "linear-gradient(150deg, var(--fit-accent), var(--fit-accent-deep))", color: "var(--fit-on-accent)" }} testId="match-start">
    <div className="flex items-center gap-3"><Sparkles className="h-7 w-7 shrink-0" />
      <span className="flex-1"><b className="block text-[18px]">Find my best match</b><span className="text-[13px] opacity-90">Six quick questions. We pick the three trainers who fit your goal, schedule and budget, and tell you why.</span></span></div>
  </Card>;
}

export function MatchSheet({ token, onClose, onProfile, onAsk }: { token: string | null; onClose: () => void; onProfile: (t: PublicTrainer) => void; onAsk: (t: PublicTrainer, message: string) => void }) {
  const [n, setN] = useState<Need>(() => { try { return { ...emptyNeed(), ...JSON.parse(localStorage.getItem("arise-fit-need") || "{}") }; } catch { return emptyNeed(); } });
  const [res, setRes] = useState<(Match & { why: string })[] | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, [res]);
  const set = (p: Partial<Need>) => setN((x) => ({ ...x, ...p }));
  const toggleMode = (m: Mode) => set({ modes: n.modes.includes(m) ? n.modes.filter((x) => x !== m) : [...n.modes, m] });
  const live = n.modes.some((m) => m !== "remote");
  const go = async () => {
    setBusy(true); setErr("");
    try { try { localStorage.setItem("arise-fit-need", JSON.stringify(n)); } catch { /* fine */ }
      const r = await post<{ matches: (Match & { why: string })[] }>(token, "/match", { need: n, ai: true }); setRes(r.matches); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const pill = (on: boolean) => (on ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2, color: C.text });
  return <Sheet title={res ? "Your matches" : "Find my match"} onClose={onClose} testId="match-sheet">
    <div ref={top} />
    {!res ? <div className="space-y-5">
      <Field label="1. Your main goal"><div className="flex flex-wrap gap-1.5">{GOALS.map((g) => <button key={g} type="button" onClick={() => set({ goal: n.goal === g ? "" : g })} className="h-10 rounded-full px-3.5 text-[14px] font-semibold" style={pill(n.goal === g)} data-testid={`match-goal-${g}`}>{g}</button>)}</div></Field>
      <Field label="2. How you'd like to train (pick any)"><div className="space-y-2">{MODES.map((m) => <button key={m} type="button" onClick={() => toggleMode(m)} className="flex w-full items-center gap-3 rounded-[12px] p-3 text-left" style={{ background: C.card }} data-testid={`match-mode-${m}`}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px]" style={n.modes.includes(m) ? { background: C.lime, color: "var(--fit-on-accent)" } : { border: `2px solid ${C.line}` }}>{n.modes.includes(m) && <Check className="h-4 w-4" />}</span>
        <span><b className="block text-[15px]">{MODE_LABEL[m]}</b><span className="text-[13px]" style={{ color: C.dim }}>{MODE_BLURB[m]}</span></span></button>)}</div></Field>
      {live && <Field label="3. Sessions a week"><div className="grid grid-cols-5 gap-1.5">{[1, 2, 3, 4, 5].map((k) => <button key={k} type="button" onClick={() => set({ perWeek: k })} className="h-11 rounded-[10px] text-[16px] font-bold" style={pill(n.perWeek === k)}>{k}</button>)}</div></Field>}
      <Field label={`${live ? 4 : 3}. Monthly budget`}><div className="grid grid-cols-3 gap-1.5">{BUDGETS.map(([c, l]) => <button key={c} type="button" onClick={() => set({ budgetCents: c })} className="h-11 rounded-[10px] text-[15px] font-semibold" style={pill(n.budgetCents === c)} data-testid={`match-budget-${c}`}>{l}</button>)}</div></Field>
      <div className="grid grid-cols-[1fr_7rem] gap-2"><Field label={`${live ? 5 : 4}. Where you are`}><select value={n.state} onChange={(e) => set({ state: e.target.value })} className={inputCls} style={inputStyle} data-testid="match-state"><option value="">State</option>{US_STATES.map(([c, nm]) => <option key={c} value={c}>{nm}</option>)}</select></Field>
        <Field label="ZIP"><input inputMode="numeric" value={n.zip} onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} className={inputCls} style={inputStyle} /></Field></div>
      <Field label={`${live ? 6 : 5}. Experience`}><div className="grid grid-cols-3 gap-1.5">{LEVELS.map(([id, l]) => <button key={id} type="button" onClick={() => set({ level: id })} className="h-11 rounded-[10px] text-[13px] font-semibold" style={pill(n.level === id)}>{l}</button>)}</div></Field>
      <Field label="Anything a trainer should know? (optional)"><textarea value={n.notes} onChange={(e) => set({ notes: e.target.value.slice(0, 400) })} rows={2} placeholder="Bad knee, early mornings only, wedding in June…" className="w-full rounded-[12px] p-3 text-[16px] outline-none" style={inputStyle} /></Field>
      {err && <p className="text-[14px]" style={{ color: C.red }}>{err}</p>}
      <Btn className="w-full" disabled={busy} onClick={go} testId="match-go">{busy ? "Finding your matches…" : "Show my matches"}</Btn>
    </div> : <div>
      {res.length ? <div className="space-y-3">{res.map((m, i) => { const t = m.trainer; return <Card key={t.id} className="!p-4" testId="match-result">
        <div className="flex items-center gap-3"><Avatar t={t} size={60} />
          <div className="min-w-0 flex-1"><p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.lime }}>{i === 0 ? "Best match" : `Match ${i + 1}`}</p><p className="truncate text-[22px] leading-none" style={display}>{t.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px]" style={{ color: C.dim }}>{t.reviews ? <><Stars value={t.rating} />{t.rating.toFixed(1)} ({t.reviews})</> : "New on Arise"}</p></div></div>
        {m.why && <p className="mt-3 text-[15px] leading-relaxed">{m.why}</p>}
        <ul className="mt-2 space-y-1">{m.reasons.map((r) => <li key={r} className="flex items-start gap-2 text-[14px]"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.lime }} />{r}</li>)}</ul>
        {m.price && <p className="mt-2 text-[14px]" style={{ color: C.steel }}>{m.price.price.label || MODE_LABEL[m.price.price.mode]}: <b style={{ color: C.text }}>{usd(m.price.price.cents)}</b> / {m.price.price.per === "package" && m.price.price.sessions ? `${m.price.price.sessions} sessions` : m.price.price.per}{m.price.price.per !== "month" ? ` · about ${usd(m.price.monthly)} a month for you` : ""}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2"><Btn kind="soft" className="!text-[15px]" onClick={() => onProfile(t)}>Profile</Btn><Btn className="!text-[15px]" onClick={() => onAsk(t, introMessage(n, t.name.split(" ")[0]))} testId="match-ask">Ask to coach</Btn></div>
      </Card>; })}</div>
        : <Card className="text-center !p-5"><p className="text-[18px] font-bold">No trainer fits all of that yet</p><p className="mt-1 text-[14px]" style={{ color: C.dim }}>Try adding Online coaching (works from anywhere) or a higher budget. New trainers join every week.</p></Card>}
      <Title>Not quite right?</Title>
      <Btn kind="soft" className="w-full" onClick={() => setRes(null)}>Change my answers</Btn>
    </div>}
  </Sheet>;
}
