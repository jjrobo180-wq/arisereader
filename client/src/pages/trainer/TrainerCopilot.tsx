// Coach Copilot in Cooked PT: who needs you this week, with a message drafted for each (shared/coachCopilot.ts),
// and the plan tools on a client's calendar: move missed workouts forward, and set next targets from their lifts.
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, Check, ChevronRight, Send, Sparkles, TrendingUp, Trophy } from "lucide-react";
import type { Assigned } from "@shared/coach";
import type { Bump, ClientFacts, Flag, Move } from "@shared/coachCopilot";
import { coachApi, post, shortDate } from "../coach/coachApi";
import { Btn, C, Card, Sheet, display, inputStyle } from "../fit/fitUi";

type Item = { linkId: string; clientId: number; name: string; facts: ClientFacts; flags: Flag[]; draft: string; score: number; summary: string };
type Copilot = { at: string; ai: boolean; totals: { urgent: number; watch: number; win: number; clients: number }; items: Item[] };
const LEVEL = { urgent: { color: C.red, label: "Needs you" }, watch: { color: C.orange, label: "Keep an eye on" }, win: { color: C.green, label: "Wins" } } as const;

/** The card on the Clients tab: this week at a glance. */
export function CopilotCard({ token, clients, onOpenClient, say }: { token: string | null; clients: number; onOpenClient: (linkId: string) => void; say: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<Copilot | null>(null);
  const load = () => coachApi<Copilot>(token, "/trainer/copilot").then(setPeek).catch(() => {});
  useEffect(() => { if (clients) void load(); }, [token, clients]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!clients) return null;
  const t = peek?.totals;
  return <>
    <Card onClick={() => setOpen(true)} className="mb-3 !p-4" testId="tr-copilot">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: "linear-gradient(150deg, var(--fit-accent), var(--fit-accent-deep))", color: "var(--fit-on-accent)" }}><Sparkles className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><p className="text-[20px] leading-none" style={display}>Your week</p>
          <p className="mt-1 text-[13px]" style={{ color: C.dim }}>{t ? <>{t.urgent ? <b style={{ color: LEVEL.urgent.color }}>{t.urgent} need you</b> : "Nobody urgent"} · {t.watch} to watch · {t.win} {t.win === 1 ? "win" : "wins"}</> : "Reading your clients…"}</p></div>
        <ChevronRight className="h-5 w-5" style={{ color: C.dim }} />
      </div>
    </Card>
    {open && <CopilotSheet token={token} initial={peek} onClose={() => { setOpen(false); void load(); }} onOpenClient={(id) => { setOpen(false); onOpenClient(id); }} say={say} />}
  </>;
}

function CopilotSheet({ token, initial, onClose, onOpenClient, say }: { token: string | null; initial: Copilot | null; onClose: () => void; onOpenClient: (linkId: string) => void; say: (m: string) => void }) {
  const [cp, setCp] = useState<Copilot | null>(initial);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => { if (!initial) { setBusy(true); coachApi<Copilot>(token, "/trainer/copilot").then(setCp).catch((e) => say(e.message)).finally(() => setBusy(false)); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ai = async () => { setBusy(true); try { const r = await coachApi<Copilot>(token, "/trainer/copilot?ai=1"); setCp(r); setDrafts({}); if (!r.ai) say("AI wasn't available. These are the plain drafts."); } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  const send = async (it: Item) => {
    const body = (drafts[it.linkId] ?? it.draft).trim(); if (!body) return;
    try { await post(token, `/links/${it.linkId}/messages`, { body }); setSent((s) => [...s, it.linkId]); say(`Sent to ${it.name.split(" ")[0]}.`); } catch (e: any) { say(e.message); }
  };
  const groups = (["urgent", "watch", "win"] as const).map((lv) => ({ lv, items: (cp?.items ?? []).filter((x) => x.flags[0]?.level === lv) }));
  const fine = (cp?.items ?? []).filter((x) => !x.flags.length);
  return <Sheet title="Your week" onClose={onClose} testId="tr-copilot-sheet" right={<Btn kind="soft" className="!min-h-10 !px-3 !text-[14px]" disabled={busy} onClick={ai} testId="tr-cp-ai"><Sparkles className="h-4 w-4" />{busy ? "…" : cp?.ai ? "Rewrite" : "AI drafts"}</Btn>}>
    <p className="mb-3 text-[14px]" style={{ color: C.steel }}>Every active client, read from their plan and what they share in Cooked. Each one has a message ready: edit it or send it as is.</p>
    {!cp ? <p className="py-10 text-center" style={{ color: C.dim }}>Reading your clients…</p> : <>
      {groups.map(({ lv, items }) => items.length > 0 && <div key={lv} className="mb-5">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: LEVEL[lv].color }}>{lv === "urgent" ? <AlertTriangle className="h-4 w-4" /> : lv === "win" ? <Trophy className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}{LEVEL[lv].label} · {items.length}</p>
        <div className="space-y-2.5">{items.map((it) => { const done = sent.includes(it.linkId); return <Card key={it.linkId} className="!p-3.5" testId="tr-cp-item">
          <button type="button" onClick={() => onOpenClient(it.linkId)} className="flex w-full items-center gap-2 text-left"><span className="flex-1 text-[17px] font-bold">{it.name}</span><span className="text-[13px] font-semibold" style={{ color: C.lime }}>Open</span></button>
          {it.summary && <p className="mt-1 text-[14px]" style={{ color: C.steel }}>{it.summary}</p>}
          <ul className="mt-1.5 space-y-0.5">{it.flags.slice(0, 3).map((f) => <li key={f.kind} className="flex items-start gap-2 text-[13px]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LEVEL[f.level].color }} />{f.text}</li>)}</ul>
          {done ? <p className="mt-3 flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: C.lime }}><Check className="h-4 w-4" />Sent</p> : <>
            <textarea value={drafts[it.linkId] ?? it.draft} onChange={(e) => setDrafts({ ...drafts, [it.linkId]: e.target.value.slice(0, 1000) })} rows={4} className="mt-2.5 w-full rounded-[12px] p-3 text-[15px] leading-snug outline-none" style={inputStyle} aria-label={`Message to ${it.name}`} />
            <Btn className="mt-2 w-full !min-h-11 !text-[15px]" onClick={() => send(it)} testId="tr-cp-send"><Send className="h-4 w-4" />Send to {it.name.split(" ")[0]}</Btn></>}
        </Card>; })}</div>
      </div>)}
      {fine.length > 0 && <p className="text-[13px]" style={{ color: C.dim }}>On track, nothing to flag: {fine.map((x) => x.name.split(" ")[0]).join(", ")}.</p>}
      {!cp.items.length && <p className="py-8 text-center" style={{ color: C.dim }}>No active clients yet.</p>}
    </>}
  </Sheet>;
}

/** On a client's calendar: fix the plan in one tap, with a preview first. */
export function PlanTools({ token, linkId, name, onApplied, say }: { token: string | null; linkId: string; name: string; onApplied: (a: Assigned[]) => void; say: (m: string) => void }) {
  const [open, setOpen] = useState<"reflow" | "progress" | null>(null);
  const [changes, setChanges] = useState<(Move | Bump)[] | null>(null);
  const [busy, setBusy] = useState(false);
  const first = name.split(" ")[0];
  const preview = async (k: "reflow" | "progress") => { setOpen(k); setChanges(null); try { setChanges((await post<{ changes: (Move | Bump)[] }>(token, `/links/${linkId}/${k}`, {})).changes); } catch (e: any) { say(e.message); setOpen(null); } };
  const apply = async () => { if (!open) return; setBusy(true); try { const r = await post<{ assigned: Assigned[]; changes: unknown[] }>(token, `/links/${linkId}/${open}`, { apply: true }); onApplied(r.assigned); say(open === "reflow" ? `Moved. ${first} was told.` : `Targets set. ${first} was told.`); setOpen(null); } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  return <>
    <div className="mb-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => preview("reflow")} className="flex min-h-14 items-center gap-2 rounded-[12px] px-3 text-left" style={{ background: C.card }} data-testid="tr-reflow"><CalendarClock className="h-5 w-5 shrink-0" style={{ color: C.lime }} /><span className="text-[14px] font-semibold leading-tight">Move missed workouts</span></button>
      <button type="button" onClick={() => preview("progress")} className="flex min-h-14 items-center gap-2 rounded-[12px] px-3 text-left" style={{ background: C.card }} data-testid="tr-progress"><TrendingUp className="h-5 w-5 shrink-0" style={{ color: C.lime }} /><span className="text-[14px] font-semibold leading-tight">Set next targets</span></button>
    </div>
    {open && <Sheet title={open === "reflow" ? "Move missed workouts" : "Next targets"} onClose={() => setOpen(null)} testId="tr-plan-tool">
      <p className="text-[14px]" style={{ color: C.steel }}>{open === "reflow" ? `Workouts ${first} missed in the last week go to the next free days, one a day, in order.` : `From the last time ${first} did each lift: every rep at the top of the range adds weight, short of the bottom repeats it, otherwise one more rep. Covers the next two weeks.`}</p>
      {changes === null ? <p className="py-8 text-center" style={{ color: C.dim }}>Checking…</p>
        : !changes.length ? <p className="mt-4 rounded-[12px] p-4 text-center text-[15px]" style={{ background: C.card }}>{open === "reflow" ? "Nothing missed. The plan is on track." : `No targets to set: nothing on the plan for the next two weeks that ${first} has done before, or they don't share workouts.`}</p>
        : <div className="mt-4 space-y-2">{changes.map((c, i) => "to" in c
          ? <div key={i} className="flex items-center gap-2 rounded-[12px] p-3" style={{ background: C.card }}><span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span><span className="text-[13px]" style={{ color: C.dim }}>{shortDate(c.from)}</span><ArrowRight className="h-4 w-4" style={{ color: C.lime }} /><span className="text-[13px] font-semibold">{shortDate(c.to)}</span></div>
          : <div key={i} className="rounded-[12px] p-3" style={{ background: C.card }}><p className="font-semibold">{c.name} <span className="text-[12px] font-normal" style={{ color: C.dim }}>{shortDate(c.date)}</span></p><p className="text-[13px]" style={{ color: C.dim }}>Last: {c.last}</p><p className="text-[15px] font-bold" style={{ color: C.lime }}>Next: {c.next}</p></div>)}</div>}
      {!!changes?.length && <Btn className="mt-5 w-full" disabled={busy} onClick={apply} testId="tr-plan-apply">{busy ? "Saving…" : open === "reflow" ? `Move ${changes.length} and tell ${first}` : `Set ${changes.length} targets and tell ${first}`}</Btn>}
    </Sheet>}
  </>;
}
