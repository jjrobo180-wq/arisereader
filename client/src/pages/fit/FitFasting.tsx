// Arise Fit intermittent fasting: pick a protocol, start and end fasts, a live ring with the stage the
// body is in, and a history with your streak. Kept in FitData.fasting (shared/fitNutrition.ts).
import { useEffect, useState } from "react";
import { Flame, Square, Timer } from "lucide-react";
import { FASTING_PROTOCOLS, emptyFasting, fastingStage, fastingStatus, fastingStreak, type Fasting } from "@shared/fitNutrition";
import type { FitData } from "@shared/fit";
import type { Update } from "./fitStore";
import { Btn, C, Card, Ring, Sheet, Title, display, fmtDur, stagger } from "./fitUi";
import { scheduleFastEnd } from "./fitNative";

function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!on) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [on]);
  return now;
}

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export function startFast(update: Update) {
  update((d) => { const f = { ...(d.fasting ?? emptyFasting()), start: new Date().toISOString() }; scheduleFastEnd(fastingStatus(f).endsAt); return { ...d, fasting: f }; });
}
export function endFast(update: Update) {
  scheduleFastEnd(null);
  update((d) => {
    const f = d.fasting; if (!f?.start) return d;
    const goalH = fastingStatus(f).goalH;
    return { ...d, fasting: { protocol: f.protocol, log: [...f.log, { start: f.start, end: new Date().toISOString(), goalH }].slice(-400) } };
  });
}

/** The compact card for Today and Food. */
export function FastingCard({ data, update, onOpen }: { data: FitData; update: Update; onOpen: () => void }) {
  const st = fastingStatus(data.fasting, useNow(!!data.fasting?.start));
  const left = Math.max(0, st.goalMs - st.elapsedMs);
  return <Card className="!p-4" testId="fit-fasting-card">
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-4 text-left">
      <Ring value={st.active ? st.pct : 0} goal={1} size={84} stroke={9}>
        <Timer className="h-6 w-6" style={{ color: st.active ? C.lime : C.dim }} />
      </Ring>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] tracking-[.14em]" style={{ ...display, fontWeight: 700, color: C.lime }}>Fasting · {data.fasting?.protocol ?? "16:8"}</span>
        {st.active
          ? <><span className="block text-[26px] leading-tight tabular-nums" style={display}>{fmtDur(st.elapsedMs / 1000)}</span>
              <span className="block text-[13px]" style={{ color: C.dim }}>{st.done ? "Goal reached. End it when you eat." : `${fmtDur(left / 1000)} to go · ends ${time(st.endsAt)}`}</span></>
          : <><span className="block text-[22px] leading-tight" style={display}>Not fasting</span><span className="block text-[13px]" style={{ color: C.dim }}>Start when you finish your last meal.</span></>}
      </span>
    </button>
    <Btn className="mt-3 w-full" kind={st.active ? "soft" : "primary"} onClick={() => (st.active ? endFast(update) : startFast(update))} testId="fit-fast-toggle">
      {st.active ? <><Square className="h-4 w-4" />End fast</> : <><Flame className="h-5 w-5" />Start fast</>}
    </Btn>
  </Card>;
}

export function FastingSheet({ data, update, onClose, inline }: { data: FitData; update: Update; onClose: () => void; inline?: boolean }) {
  const f: Fasting = data.fasting ?? emptyFasting();
  const now = useNow(!!f.start);
  const st = fastingStatus(f, now);
  const stage = fastingStage(st.elapsedMs / 3_600_000);
  const streak = fastingStreak(f);
  const done = f.log.filter((x) => Date.parse(x.end) - Date.parse(x.start) >= x.goalH * 3_600_000).length;
  const longest = Math.max(0, ...f.log.map((x) => Date.parse(x.end) - Date.parse(x.start)));
  return <Sheet title="Fasting" onClose={onClose} testId="fit-fasting" inline={inline}>
    <div className="mt-4 grid place-items-center">
      <Ring value={st.active ? st.pct : 0} goal={1} size={260} stroke={18} glow>
        <div>
          <p className="text-[13px] tracking-[.18em]" style={{ ...display, color: st.active ? C.lime : C.dim }}>{st.active ? stage.name : "Ready"}</p>
          <p className="text-[50px] leading-none tabular-nums" style={display}>{fmtDur(st.elapsedMs / 1000)}</p>
          <p className="mt-1 text-[13px]" style={{ color: C.dim }}>of {st.goalH} hours</p>
        </div>
      </Ring>
      {st.active && <p className="mt-3 max-w-xs text-center text-[14px]" style={{ color: C.steel }}>{stage.text}</p>}
      {st.active && <p className="mt-1 text-[13px]" style={{ color: C.dim }}>Started {time(Date.parse(f.start!))} · goal at {time(st.endsAt)}</p>}
    </div>
    <Btn className="mt-6 w-full !min-h-[54px] !text-[19px]" kind={st.active ? "soft" : "primary"} onClick={() => (st.active ? endFast(update) : startFast(update))} testId="fit-fasting-toggle">{st.active ? "End fast" : "Start fast now"}</Btn>
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
      {([[streak, "streak"], [done, "completed"], [longest ? Math.floor(longest / 3_600_000) + "h" : "—", "longest"]] as const).map(([n, l], k) => <Card key={l} className="!px-1 !py-3" style={stagger(k, 0.08, 0.2)}><p className="text-[24px] leading-none" style={display}>{n}</p><p className="mt-1 text-[11px] uppercase tracking-[.1em]" style={{ color: C.dim }}>{l}</p></Card>)}
    </div>
    <Title>Protocol</Title>
    <div className="grid grid-cols-2 gap-2">{FASTING_PROTOCOLS.map((p) => <button key={p.id} type="button" onClick={() => update((d) => ({ ...d, fasting: { ...(d.fasting ?? emptyFasting()), protocol: p.id } }))} aria-pressed={f.protocol === p.id}
      className="rounded-[10px] p-3 text-left" style={f.protocol === p.id ? { background: "linear-gradient(180deg, rgba(255,90,31,.25), rgba(255,90,31,.08))", boxShadow: "inset 0 0 0 1px #ff5a1f" } : { background: C.card }} data-testid={`fit-fast-${p.id}`}>
      <span className="block text-[20px] leading-none" style={display}>{p.name}</span><span className="mt-1 block text-[12px] leading-snug" style={{ color: C.dim }}>{p.blurb}</span></button>)}</div>
    {f.log.length > 0 && <><Title>History</Title><div className="space-y-2">{f.log.slice(-14).reverse().map((x) => {
      const ms = Date.parse(x.end) - Date.parse(x.start); const hit = ms >= x.goalH * 3_600_000;
      return <Card key={x.start} className="flex items-center gap-3 !p-3">
        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: hit ? C.lime : C.card2 }} />
        <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">{new Date(x.start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p><p className="text-[12px]" style={{ color: C.dim }}>{time(Date.parse(x.start))} – {time(Date.parse(x.end))} · goal {x.goalH}h</p></div>
        <p className="text-[20px] tabular-nums" style={{ ...display, color: hit ? C.lime : C.text }}>{fmtDur(ms / 1000)}</p>
      </Card>; })}</div></>}
    <p className="mt-6 text-[11px] leading-relaxed" style={{ color: C.dim }}>Fasting isn't right for everyone. Skip it if you're pregnant, diabetic, underweight or have had an eating disorder, and check with a doctor first.</p>
  </Sheet>;
}
