// Arise Fit's trainers: "Find a trainer" (real people, never AI) and "My trainer" once one coaches you.
// Asking a trainer, you choose what Arise Fit shares with them; from then on they see it as it happens,
// with nothing to type twice. Their plan for you (workouts on your calendar, habits, nutrition targets,
// goals, check-ins, sessions) shows here, and their workouts start in the live workout logger.
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CalendarDays, Camera, Check, ChevronRight, ClipboardCheck, Dumbbell, Flag, Lock, MessageCircle, Play, ShieldCheck, Target, UserRound, Utensils } from "lucide-react";
import { ALL_CONSENT, CONSENT_LABEL, MODE_LABEL, checkinDue, type Assigned, type CheckinAnswer, type ClientSide, type Consent, type Mode, type Photo, type PublicTrainer } from "@shared/coach";
import { dayKey, type FitData } from "@shared/fit";
import { Avatar, Chat, Directory, Stars, TrainerPage } from "../coach/CoachUi";
import { coachApi, dayKeyOf, post, put, shortDate, shrinkImage, usePoll, when, type MyLink } from "../coach/coachApi";
import { useHealth } from "./FitHealth";
import { startApplePush } from "@/lib/applePush";
import { isNativeApp } from "@/lib/nativeApp";
import type { LibraryExercise, Update } from "./fitStore";
import { planned, startWorkout } from "./FitTrain";
import { Btn, C, Card, Chips, Field, Sheet, Title, display, inputCls, inputStyle, stagger } from "./fitUi";

type StartFn = (a: ReturnType<typeof startWorkout>) => void;

/** This person's trainers, checked every 20 seconds while Arise Fit is open. */
export function useCoach(token: string | null) {
  return usePoll(() => coachApi<{ links: MyLink[] }>(token, "/me").then((r) => r.links), [token], 20_000);
}

/** Marks a trainer's workout done once the matching workout is saved in Arise Fit. */
function useMarkDone(token: string | null, links: MyLink[] | null, data: FitData, reload: () => void) {
  const sent = useRef(new Set<string>());
  useEffect(() => {
    for (const l of links ?? []) {
      if (l.status !== "active") continue;
      for (const a of l.coaching.assigned) {
        if (a.done || sent.current.has(a.id) || !data.workouts.some((w) => w.programId === "coach" && w.dayId === a.id)) continue;
        sent.current.add(a.id);
        void post(token, `/links/${l.id}/done/${encodeURIComponent(a.id)}`).then(reload).catch(() => sent.current.delete(a.id));
      }
    }
  }, [links, data.workouts, token, reload]);
}

export const startAssigned = (a: Assigned, data: FitData, list: LibraryExercise[]) => startWorkout({ name: a.name, programId: "coach", dayId: a.id, exercises: planned(data, a.items, list) });
const todayOf = (l: MyLink) => l.coaching.assigned.filter((a) => a.date === dayKeyOf() && !a.done);

/** The card on Today: your trainer (and today's workout from them), or the way to find one. */
export function CoachCard({ token, data, list, onStart, onOpen }: { token: string | null; data: FitData; list: LibraryExercise[]; onStart: StartFn; onOpen: () => void }) {
  const { data: links, reload } = useCoach(token);
  useMarkDone(token, links, data, reload);
  const active = (links ?? []).find((l) => l.status === "active" && l.trainer);
  const pending = (links ?? []).find((l) => l.status === "requested" && l.trainer);
  if (active) {
    const t = active.trainer!; const today = todayOf(active);
    return <Card className="!p-3.5" testId="fit-coach-card">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <Avatar t={t} size={48} />
        <span className="min-w-0 flex-1"><span className="block text-[11px] tracking-[.14em]" style={{ ...display, color: C.lime }}>Your trainer</span><span className="block truncate text-[22px] leading-none" style={display}>{t.name}</span>
          <span className="block truncate text-[12px]" style={{ color: C.dim }}>{active.unread ? `${active.unread} new ${active.unread === 1 ? "message" : "messages"}` : active.last ? active.last.body || "Photo" : "Say hi"}</span></span>
        {active.unread > 0 && <span className="fit-pop grid h-7 min-w-7 place-items-center rounded-full px-2 text-[13px] font-bold" style={{ background: C.lime, color: "#0b0b0c" }}>{active.unread}</span>}
        <ChevronRight className="h-5 w-5" style={{ color: C.dim }} />
      </button>
      {today.map((a) => <div key={a.id} className="mt-3 flex items-center gap-3 rounded-[12px] p-3" style={{ background: C.card2 }}>
        <Dumbbell className="h-5 w-5 shrink-0" style={{ color: C.lime }} /><span className="min-w-0 flex-1"><span className="block text-[12px]" style={{ color: C.dim }}>Today from {t.name.split(" ")[0]}</span><span className="block truncate font-semibold">{a.name}</span></span>
        <Btn className="!min-h-10 !px-3 !text-[15px]" onClick={() => onStart(startAssigned(a, data, list))} testId="fit-coach-start"><Play className="h-4 w-4" fill="currentColor" />Start</Btn></div>)}
    </Card>;
  }
  return <Card onClick={onOpen} className="fit-shine !p-4" style={{ background: "linear-gradient(150deg, #1e1410, #141518)" }} testId="fit-find-trainer">
    <div className="flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px]" style={{ background: C.lime, color: "#0b0b0c" }}><UserRound className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[22px] leading-none" style={display}>{pending ? "Request sent" : "Find a trainer"}</span>
        <span className="mt-0.5 block text-[13px]" style={{ color: C.steel }}>{pending ? `Waiting for ${pending.trainer!.name} to accept.` : "Real coaches, not AI. In person, live video or online."}</span></span>
      <ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div>
  </Card>;
}

/** Choosing what Arise Fit shares, then asking the trainer. */
function RequestSheet({ token, t, onClose, onSent }: { token: string | null; t: PublicTrainer; onClose: () => void; onSent: () => void }) {
  const [consent, setConsent] = useState<Consent>(ALL_CONSENT);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return <Sheet title={`Ask ${t.name.split(" ")[0]}`} onClose={onClose} testId="fit-coach-request">
    <Card className="mt-1 flex items-center gap-3 !p-3"><Avatar t={t} size={52} /><div className="min-w-0"><p className="truncate text-[20px] leading-none" style={display}>{t.name}</p><p className="truncate text-[13px]" style={{ color: C.dim }}>{t.headline}</p></div></Card>
    <Title><ShieldCheck className="h-4 w-4" />What Arise Fit shares</Title>
    <p className="-mt-1 mb-2 px-1 text-[13px]" style={{ color: C.dim }}>Once {t.name.split(" ")[0]} accepts, these go to them automatically, so you never type anything twice. Change it or stop sharing any time.</p>
    <div className="space-y-2">{(Object.keys(CONSENT_LABEL) as (keyof Consent)[]).map((k) => <label key={k} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: C.card }}>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{CONSENT_LABEL[k][0]}</span><span className="block text-[12px]" style={{ color: C.dim }}>{CONSENT_LABEL[k][1]}</span></span>
      <input type="checkbox" checked={consent[k]} onChange={(e) => setConsent({ ...consent, [k]: e.target.checked })} className="h-6 w-6 shrink-0 accent-[#ff5a1f]" data-testid={`fit-consent-${k}`} /></label>)}</div>
    <Field label="Message (optional)"><textarea value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 1000))} rows={4} placeholder="Your goal, your schedule, any injuries…" className="mt-3 w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} /></Field>
    {err && <p className="mt-2 text-[14px]" style={{ color: C.red }}>{err}</p>}
    <Btn className="mt-5 w-full" disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await post(token, "/request", { trainerId: t.id, consent, message: msg }); onSent(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }} testId="fit-coach-send">Send request</Btn>
    <p className="mt-3 text-center text-[12px]" style={{ color: C.dim }}>You pay {t.name.split(" ")[0]} directly for training. Arise doesn't take a cut.</p>
  </Sheet>;
}

/** "Trainer" in Arise Fit: your trainer's hub, or the directory. */
export function CoachScreen({ token, me, data, update, list, onStart, onClose }: { token: string | null; me: number; data: FitData; update: Update; list: LibraryExercise[]; onStart: StartFn; onClose: () => void }) {
  const { data: links, reload } = useCoach(token);
  useMarkDone(token, links, data, reload);
  const [open, setOpen] = useState<number | null>(null);
  const [asking, setAsking] = useState<PublicTrainer | null>(null);
  const [browse, setBrowse] = useState(false);
  const mine = (links ?? []).filter((l) => l.trainer && (l.status === "active" || l.status === "requested"));
  const [pick, setPick] = useState<string>("");
  const current = mine.find((l) => l.id === pick) ?? mine.find((l) => l.status === "active") ?? null;
  const hasActive = mine.some((l) => l.status === "active");
  // Once there's a trainer (or a request), notifications bring their messages and new workouts.
  useEffect(() => { if (mine.length && isNativeApp()) void startApplePush(true); }, [mine.length]);
  const findNew = <Directory onOpen={(t) => setOpen(t.id)} intro={<Card className="!p-4" style={{ background: "linear-gradient(150deg, #1e1410, #141518)" }}>
    <p className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.lime }}>Real people. No AI.</p>
    <p className="text-[28px] leading-none" style={display}>Find your trainer</p>
    <p className="mt-1 text-[14px]" style={{ color: C.steel }}>Certified coaches set their own prices for in-person, live-video or online training. Read reviews from their real clients, then ask one to coach you.</p>
  </Card>} />;
  return <Sheet title={current && !browse ? "My trainer" : "Find a trainer"} onClose={onClose} testId="fit-coach" right={hasActive && <button type="button" onClick={() => setBrowse((b) => !b)} className="h-10 rounded-full px-3 text-[13px] font-semibold" style={{ background: C.card }}>{browse ? "My trainer" : "Browse"}</button>}>
    {mine.filter((l) => l.status === "requested").map((l) => <Card key={l.id} className="mb-3 flex items-center gap-3 !p-3"><Avatar t={l.trainer!} size={44} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">Request sent to {l.trainer!.name}</p><p className="text-[12px]" style={{ color: C.dim }}>You'll get a notification when they accept.</p></div>
      <button type="button" onClick={async () => { if (window.confirm("Cancel this request?")) { await post(token, `/links/${l.id}/end`); reload(); } }} className="text-[13px] font-semibold" style={{ color: C.dim }}>Cancel</button></Card>)}
    {mine.filter((l) => l.status === "active").length > 1 && !browse && <div className="mb-3"><Chips label="Trainer" value={current?.id ?? ""} onChange={setPick} items={mine.filter((l) => l.status === "active").map((l) => ({ id: l.id, label: l.trainer!.name }))} /></div>}
    {current?.status === "active" && !browse ? <Hub key={current.id} token={token} me={me} link={current} data={data} update={update} list={list} onStart={onStart} reload={reload} onListing={() => setOpen(current.trainer!.id)} /> : findNew}
    {open !== null && <TrainerPage id={open} onClose={() => setOpen(null)} action={(t) => {
      const l = (links ?? []).find((x) => x.trainer?.id === t.id && (x.status === "active" || x.status === "requested"));
      return l ? <Btn kind="soft" className="w-full" onClick={() => { setOpen(null); setBrowse(false); setPick(l.id); }}>{l.status === "active" ? "Go to my trainer" : "Request sent"}</Btn>
        : <Btn className="w-full !min-h-[52px] !text-[19px]" disabled={!t.accepting} onClick={() => setAsking(t)} testId="fit-coach-ask">{t.accepting ? "Ask to coach me" : "Not taking clients"}</Btn>;
    }} />}
    {asking && <RequestSheet token={token} t={asking} onClose={() => setAsking(null)} onSent={() => { setAsking(null); setOpen(null); setBrowse(false); reload(); if (isNativeApp()) void startApplePush(true); }} />}
  </Sheet>;
}

type HubTab = "plan" | "chat" | "sessions" | "progress" | "sharing";

function Hub({ token, me, link, data, update, list, onStart, reload, onListing }: { token: string | null; me: number; link: MyLink; data: FitData; update: Update; list: LibraryExercise[]; onStart: StartFn; reload: () => void; onListing: () => void }) {
  const t = link.trainer!;
  const [tab, setTab] = useState<HubTab>("plan");
  const [side, setSide] = useState<ClientSide>(link.clientSide);
  useEffect(() => setSide(link.clientSide), [link.clientSide]);
  const saveSide = async (next: ClientSide) => { setSide(next); try { await put(token, `/links/${link.id}/client`, next); } catch { /* the next save sends it */ } };
  // Steps and active calories from Apple Health, when shared.
  const health = useHealth(update);
  useEffect(() => {
    if (!link.consent.health || !health) return;
    const pick = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort().slice(-14));
    void put(token, `/links/${link.id}/client`, { health: { steps: pick(health.steps), active: pick(health.active) } }).catch(() => {});
  }, [health, link.id, link.consent.health, token]);
  const tabs: { id: HubTab; label: string }[] = [{ id: "plan", label: "Plan" }, { id: "chat", label: link.unread ? `Chat · ${link.unread}` : "Chat" }, { id: "sessions", label: "Sessions" }, { id: "progress", label: "Photos" }, { id: "sharing", label: "Sharing" }];
  return <div>
    <button type="button" onClick={onListing} className="fit-in flex w-full items-center gap-3 text-left"><Avatar t={t} size={60} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[28px] leading-none" style={display}>{t.name}</span><span className="block truncate text-[13px]" style={{ color: C.dim }}>{link.coaching.phase || t.headline}</span></span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></button>
    <div className="mt-4"><Chips label="Section" value={tab} onChange={setTab} items={tabs} /></div>
    <div key={tab} className="fit-in mt-4">
      {tab === "plan" && <PlanTab token={token} link={link} side={side} saveSide={saveSide} data={data} update={update} list={list} onStart={onStart} />}
      {tab === "chat" && <Chat token={token} linkId={link.id} me={me} other={t.name.split(" ")[0]} />}
      {tab === "sessions" && <Sessions token={token} link={link} reload={reload} />}
      {tab === "progress" && <Photos link={link} side={side} saveSide={saveSide} />}
      {tab === "sharing" && <Sharing token={token} link={link} reload={reload} />}
    </div>
  </div>;
}

function PlanTab({ token, link, side, saveSide, data, update, list, onStart }: { token: string | null; link: MyLink; side: ClientSide; saveSide: (s: ClientSide) => void; data: FitData; update: Update; list: LibraryExercise[]; onStart: StartFn }) {
  const c = link.coaching; const t = link.trainer!;
  const today = dayKeyOf();
  const doneIds = new Set(data.workouts.filter((w) => w.programId === "coach").map((w) => w.dayId));
  const isDone = (a: Assigned) => !!a.done || doneIds.has(a.id);
  const upcoming = c.assigned.filter((a) => a.date >= today).slice(0, 14);
  const missed = c.assigned.filter((a) => a.date < today && !isDone(a) && a.date >= dayKeyOf(new Date(Date.now() - 7 * 864e5)));
  const dow = new Date().getDay();
  const habitsToday = c.habits.filter((h) => !h.days.length || h.days.includes(dow));
  const checked = side.habitLog[today] ?? [];
  const toggle = (id: string) => saveSide({ ...side, habitLog: { ...side.habitLog, [today]: checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id] } });
  const [checkin, setCheckin] = useState(false);
  const due = checkinDue(c as any, side);
  const n = c.nutrition;
  const row = (a: Assigned, k: number) => <Card key={a.id} className="!p-3" style={stagger(k, 0.05)}>
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-center" style={{ background: isDone(a) ? C.lime : C.card2, color: isDone(a) ? "#0b0b0c" : C.text }}>{isDone(a) ? <Check className="h-5 w-5" strokeWidth={3} /> : <span className="text-[11px] font-bold leading-tight">{a.date === today ? "TODAY" : new Date(`${a.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</span>}</span>
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{a.name}</p><p className="truncate text-[12px]" style={{ color: C.dim }}>{shortDate(a.date)} · {a.items.length} exercises{a.mins ? ` · ${a.mins} min` : ""}</p></div>
      {!isDone(a) && <Btn className="!min-h-10 !px-3 !text-[15px]" onClick={() => onStart(startAssigned(a, data, list))} testId={`fit-coach-go-${a.id}`}><Play className="h-4 w-4" fill="currentColor" /></Btn>}
    </div>
    {a.note && <p className="mt-2 rounded-[8px] p-2 text-[13px]" style={{ background: C.card2, color: C.steel }}>“{a.note}”</p>}
  </Card>;
  return <div>
    {due && <Card onClick={() => setCheckin(true)} className="fit-shine mb-3 !p-4" style={{ background: "linear-gradient(150deg, #ff5a1f, #b8360a)", color: "#0b0b0c" }} testId="fit-checkin-due">
      <div className="flex items-center gap-3"><ClipboardCheck className="h-7 w-7" /><span><span className="block text-[22px] leading-none" style={display}>Check-in due</span><span className="text-[13px] font-semibold">{c.checkin!.title} · {c.checkin!.questions.length} questions</span></span></div></Card>}
    {missed.length > 0 && <><Title>Catch up</Title><div className="space-y-2">{missed.map(row)}</div></>}
    <Title>Workouts</Title>
    {upcoming.length ? <div className="space-y-2">{upcoming.map(row)}</div> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>{t.name.split(" ")[0]} hasn't put workouts on your plan yet.</p>}
    {habitsToday.length > 0 && <><Title right={<span className="text-[13px] font-semibold" style={{ color: C.dim }}>{checked.filter((x) => habitsToday.some((h) => h.id === x)).length}/{habitsToday.length}</span>}>Today's habits</Title>
      <div className="space-y-2">{habitsToday.map((h) => { const on = checked.includes(h.id); return <button key={h.id} type="button" onClick={() => toggle(h.id)} aria-pressed={on} className="flex w-full items-center gap-3 rounded-[12px] p-3 text-left transition-colors" style={{ background: on ? "rgba(255,90,31,.14)" : C.card }} data-testid={`fit-habit-${h.id}`}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={on ? { background: C.lime, color: "#0b0b0c" } : { boxShadow: `inset 0 0 0 2px ${C.dim}` }}>{on && <Check key="on" className="fit-tick h-5 w-5" strokeWidth={3} />}</span><span className="font-semibold">{h.name}</span></button>; })}</div></>}
    {n && <><Title><Utensils className="h-4 w-4" />Nutrition targets</Title><Card>
      <div className="grid grid-cols-4 gap-2 text-center">{([["kcal", n.kcal, "cal"], ["Protein", n.p, "g"], ["Carbs", n.c, "g"], ["Fat", n.f, "g"]] as const).map(([l, v, u]) => <div key={l}><p className="text-[22px] leading-none" style={display}>{v ?? "—"}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>{l === "kcal" ? "calories" : `${l} ${u}`}</p></div>)}</div>
      {n.waterL ? <p className="mt-3 text-[13px]" style={{ color: C.dim }}>Water: {n.waterL} L a day</p> : null}
      {n.note && <p className="mt-2 whitespace-pre-line text-[14px]">{n.note}</p>}
      {n.kcal && <Btn kind="soft" className="mt-3 w-full" onClick={() => {
        const kcal = n.kcal!; const split = n.p && n.c && n.f ? (() => { const P = n.p! * 4, Cc = n.c! * 4, F = n.f! * 9, sum = P + Cc + F; return { p: Math.round((P / sum) * 100), c: Math.round((Cc / sum) * 100), f: 100 - Math.round((P / sum) * 100) - Math.round((Cc / sum) * 100) }; })() : undefined;
        update((d) => ({ ...d, profile: { ...d.profile, kcalGoal: kcal, ...(split ? { macroSplit: split } : {}), ...(n.waterL ? { waterGoalMl: Math.round(n.waterL * 1000) } : {}) } }));
        window.alert("Your Food goals now match your trainer's targets.");
      }} testId="fit-use-targets">Use these as my Food goals</Btn>}
    </Card></>}
    {c.goals.length > 0 && <><Title><Target className="h-4 w-4" />Goals</Title><Card className="!p-2">{c.goals.map((g, k) => <div key={g.id} className="flex items-center gap-3 px-2 py-2.5" style={k ? { borderTop: `1px solid ${C.line}` } : undefined}>
      <Flag className="h-4 w-4 shrink-0" style={{ color: g.done ? C.lime : C.dim }} /><span className={`min-w-0 flex-1 text-[15px] ${g.done ? "line-through opacity-60" : ""}`}>{g.text}</span>{g.due && <span className="text-[12px]" style={{ color: C.dim }}>{shortDate(g.due)}</span>}</div>)}</Card></>}
    {c.checkin && !due && <Btn kind="soft" className="mt-4 w-full" onClick={() => setCheckin(true)}><ClipboardCheck className="h-5 w-5" />{c.checkin.title}</Btn>}
    {checkin && c.checkin && <CheckinSheet form={c.checkin} onClose={() => setCheckin(false)} onSubmit={(answers) => { saveSide({ ...side, checkins: [...side.checkins, { formId: c.checkin!.id, date: dayKey(), answers }].slice(-200) }); setCheckin(false); }} />}
  </div>;
}

function CheckinSheet({ form, onClose, onSubmit }: { form: NonNullable<MyLink["coaching"]["checkin"]>; onClose: () => void; onSubmit: (a: CheckinAnswer["answers"]) => void }) {
  const [a, setA] = useState<CheckinAnswer["answers"]>({});
  return <Sheet title={form.title} onClose={onClose} testId="fit-checkin">
    <div className="mt-2 space-y-4">{form.questions.map((q) => <Field key={q.id} label={q.q}>
      {q.kind === "text" && <textarea rows={3} value={String(a[q.id] ?? "")} onChange={(e) => setA({ ...a, [q.id]: e.target.value })} className="w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} />}
      {q.kind === "number" && <input inputMode="decimal" value={String(a[q.id] ?? "")} onChange={(e) => setA({ ...a, [q.id]: e.target.value.replace(/[^\d.]/g, "") === "" ? "" : Number(e.target.value.replace(/[^\d.]/g, "")) })} className={inputCls} style={inputStyle} />}
      {q.kind === "scale" && <div className="grid grid-cols-10 gap-1">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} type="button" onClick={() => setA({ ...a, [q.id]: n })} className="h-11 rounded-[8px] text-[15px] font-bold" style={a[q.id] === n ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2 }}>{n}</button>)}</div>}
      {q.kind === "yesno" && <div className="grid grid-cols-2 gap-2">{["Yes", "No"].map((v) => <button key={v} type="button" onClick={() => setA({ ...a, [q.id]: v })} className="h-12 rounded-[10px] font-semibold" style={a[q.id] === v ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2 }}>{v}</button>)}</div>}
    </Field>)}</div>
    <Btn className="mt-6 w-full" onClick={() => onSubmit(a)} testId="fit-checkin-send">Send to my trainer</Btn>
  </Sheet>;
}

function Sessions({ token, link, reload }: { token: string | null; link: MyLink; reload: () => void }) {
  const t = link.trainer!;
  const now = Date.now();
  const next = link.coaching.appts.filter((a) => a.status === "booked" && Date.parse(a.at) >= now - 3600e3);
  const past = link.coaching.appts.filter((a) => a.status !== "booked" || Date.parse(a.at) < now - 3600e3).slice(-10).reverse();
  const [asking, setAsking] = useState(false);
  const [at, setAt] = useState(""); const [mode, setMode] = useState<Mode>(t.modes[0] ?? "virtual"); const [note, setNote] = useState("");
  const appt = (a: (typeof next)[number]) => <Card key={a.id} className="!p-3.5"><div className="flex items-center gap-3"><CalendarDays className="h-6 w-6 shrink-0" style={{ color: C.lime }} />
    <div className="min-w-0 flex-1"><p className="font-semibold">{when(a.at)}</p><p className="truncate text-[12px]" style={{ color: C.dim }}>{MODE_LABEL[a.mode]} · {a.mins} min{a.requested ? " · you asked for this time" : ""}{a.status === "cancelled" ? " · cancelled" : a.status === "done" ? " · done" : ""}</p></div></div>
    {a.place && (/^https:\/\//.test(a.place) ? <a href={a.place} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate rounded-[8px] px-3 py-2 text-[14px] font-semibold" style={{ background: C.card2, color: C.lime }}>Join: {a.place.replace(/^https:\/\//, "")}</a> : <p className="mt-2 text-[14px]" style={{ color: C.steel }}>{a.place}</p>)}
    {a.note && <p className="mt-1 text-[13px]" style={{ color: C.dim }}>{a.note}</p>}</Card>;
  return <div>
    <Title>Coming up</Title>
    {next.length ? <div className="space-y-2">{next.map(appt)}</div> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>No sessions booked.</p>}
    {t.bookingUrl && <a href={t.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-12 items-center justify-center rounded-[10px] text-[18px]" style={{ ...display, background: C.card2 }}>Open {t.name.split(" ")[0]}'s booking page</a>}
    <Btn className="mt-3 w-full" onClick={() => setAsking(true)} testId="fit-session-ask"><CalendarDays className="h-5 w-5" />Ask for a session</Btn>
    {past.length > 0 && <><Title>Past</Title><div className="space-y-2 opacity-80">{past.map(appt)}</div></>}
    {asking && <Sheet title="Ask for a session" onClose={() => setAsking(false)}>
      <div className="mt-2 space-y-4">
        <Field label="When"><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={inputCls} style={inputStyle} /></Field>
        <Field label="How"><div className="grid grid-cols-3 gap-2">{(t.modes.length ? t.modes : (["virtual"] as Mode[])).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className="h-12 rounded-[10px] text-[13px] font-semibold" style={mode === m ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2 }}>{MODE_LABEL[m]}</button>)}</div></Field>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="What you'd like to work on" className={inputCls} style={inputStyle} /></Field>
      </div>
      <Btn className="mt-6 w-full" disabled={!at} onClick={async () => { await post(token, `/links/${link.id}/appointment`, { at: new Date(at).toISOString(), mode, note, mins: 60, place: "" }); setAsking(false); reload(); }}>Send to {t.name.split(" ")[0]}</Btn>
      <p className="mt-2 text-center text-[12px]" style={{ color: C.dim }}>Your trainer confirms the time with you in Chat.</p>
    </Sheet>}
  </div>;
}

function Photos({ link, side, saveSide }: { link: MyLink; side: ClientSide; saveSide: (s: ClientSide) => void }) {
  const [pose, setPose] = useState<Photo["pose"]>("front");
  const [big, setBig] = useState<Photo | null>(null);
  const byDate = useMemo(() => [...side.photos].sort((a, b) => b.date.localeCompare(a.date)), [side.photos]);
  if (!link.consent.photos) return <Card className="text-center"><Lock className="mx-auto h-8 w-8" style={{ color: C.dim }} /><p className="mt-2 text-[20px]" style={display}>Photos are off</p><p className="mt-1 text-[14px]" style={{ color: C.dim }}>Turn on Progress photos under Sharing to send your trainer photos of your progress.</p></Card>;
  return <div>
    <Chips label="Pose" value={pose} onChange={setPose} items={[{ id: "front", label: "Front" }, { id: "side", label: "Side" }, { id: "back", label: "Back" }, { id: "other", label: "Other" }]} />
    <label className="mt-3 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[12px] text-[18px]" style={{ ...display, background: C.lime, color: "#0b0b0c" }} data-testid="fit-photo-add"><Camera className="h-5 w-5" />Add a progress photo
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const img = await shrinkImage(f, 900, 0.75); saveSide({ ...side, photos: [...side.photos, { id: Math.random().toString(36).slice(2, 10), date: dayKey(), pose, img }].slice(-60) }); }} /></label>
    <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Only you and your trainer see these.</p>
    <div className="mt-3 grid grid-cols-3 gap-2">{byDate.map((p, k) => <button key={p.id} type="button" onClick={() => setBig(p)} className="fit-pop relative aspect-[3/4] overflow-hidden rounded-[10px]" style={stagger(Math.min(k, 9), 0.04)}>
      <img src={p.img} alt={`${p.pose} photo ${p.date}`} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 p-1 text-[10px] font-semibold" style={{ background: "rgba(0,0,0,.6)" }}>{shortDate(p.date)}</span></button>)}</div>
    {big && <Sheet title={`${big.pose[0].toUpperCase()}${big.pose.slice(1)} · ${shortDate(big.date)}`} onClose={() => setBig(null)}>
      <img src={big.img} alt="" className="w-full rounded-[14px]" />
      <button type="button" onClick={() => { if (window.confirm("Delete this photo?")) { saveSide({ ...side, photos: side.photos.filter((x) => x.id !== big.id) }); setBig(null); } }} className="mt-4 h-12 w-full font-semibold" style={{ color: C.red }}>Delete photo</button>
    </Sheet>}
  </div>;
}

function Sharing({ token, link, reload }: { token: string | null; link: MyLink; reload: () => void }) {
  const t = link.trainer!;
  const [consent, setConsent] = useState<Consent>(link.consent);
  const [stars, setStars] = useState(0); const [text, setText] = useState(""); const [sent, setSent] = useState(false); const [err, setErr] = useState("");
  const change = async (next: Consent) => { setConsent(next); await put(token, `/links/${link.id}/consent`, { consent: next }).catch(() => {}); reload(); };
  return <div>
    <p className="px-1 text-[13px]" style={{ color: C.dim }}>What {t.name.split(" ")[0]} can see from Arise Fit. Turning something off stops it right away.</p>
    <div className="mt-2 space-y-2">{(Object.keys(CONSENT_LABEL) as (keyof Consent)[]).map((k) => <label key={k} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: C.card }}>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{CONSENT_LABEL[k][0]}</span><span className="block text-[12px]" style={{ color: C.dim }}>{CONSENT_LABEL[k][1]}</span></span>
      <input type="checkbox" checked={consent[k]} onChange={(e) => void change({ ...consent, [k]: e.target.checked })} className="h-6 w-6 shrink-0 accent-[#ff5a1f]" /></label>)}</div>
    <Title>Review {t.name.split(" ")[0]}</Title>
    <Card>{sent ? <p className="flex items-center gap-2 font-semibold"><BadgeCheck className="h-5 w-5" style={{ color: C.lime }} />Thanks! Your review is on {t.name.split(" ")[0]}'s page.</p> : <>
      <Stars value={stars} size={30} onPick={setStars} />
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1200))} rows={3} placeholder="What's it like training with them?" className="mt-2 w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} />
      {err && <p className="mt-1 text-[13px]" style={{ color: C.red }}>{err}</p>}
      <Btn className="mt-2 w-full" disabled={!stars} onClick={async () => { try { await post(token, `/trainers/${t.id}/review`, { stars, text }); setSent(true); } catch (e: any) { setErr(e.message); } }} testId="fit-review-send">Post review</Btn></>}</Card>
    <button type="button" onClick={async () => { if (window.confirm(`End coaching with ${t.name}? They'll stop seeing your Arise Fit data right away.`)) { await post(token, `/links/${link.id}/end`); reload(); } }} className="mt-6 h-12 w-full text-[15px] font-semibold" style={{ color: C.red }} data-testid="fit-coach-end">End coaching</button>
  </div>;
}

export { MessageCircle };
