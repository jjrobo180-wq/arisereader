// Schedule: a daily potty schedule built from the child's routine, stage and rhythm (works with no
// AI), an AI-personalised version, today's schedule ringing as reminders, and a print for the
// fridge or daycare.
import { useState } from "react";
import { Bell, Copy, Printer, Sparkles } from "lucide-react";
import { askAppAi } from "@/lib/cloudDocs";
import { esc, printPage, uid } from "../kit";
import { NEEDS, buildSchedule, clock12, contextFor, dayOf, defaultInterval, hm, methodById, minsOf, rhythm, sitMinutes, stageById, type SchedItem } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Label, Note, Panel, Section, field, fieldStyle } from "./theme";

const ICON: Record<SchedItem["kind"], string> = { sit: "🚽", prompt: "⏰", drink: "🥤", meal: "🍽️", routine: "☀️", sleep: "😴", note: "📝" };
const COLOR: Record<SchedItem["kind"], string> = { sit: C.pee, prompt: C.duckDeep, drink: C.drink, meal: C.food, routine: C.inkSoft, sleep: C.sleep, note: C.muted };

export default function Schedule() {
  const { data, set, kid, token, months, editKid } = usePotty();
  const r = rhythm(data.logs, kid.id);
  const suggested = r.peeGap ? Math.max(30, r.peeGap - 15) : defaultInterval(months);
  const [gap, setGap] = useState(kid.interval || suggested);
  const [dow, setDow] = useState(new Date().getDay());
  const [goal, setGoal] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const saved = data.schedules[kid.id];
  const [showing, setShowing] = useState<"builder" | "saved">(saved?.items?.length ? "saved" : "builder");
  const built = buildSchedule(kid, { interval: gap, months, day: dow });
  const items = showing === "saved" && saved?.items?.length ? saved.items : built;
  const title = showing === "saved" && saved ? saved.title : `${kid.name}'s potty day`;
  const nowM = minsOf(hm(Date.now()));
  const running = data.schedRun?.kid === kid.id && data.schedRun.day === dayOf(Date.now());
  const makeAi = async () => {
    setBusy(true); setErr("");
    try {
      const stage = stageById(kid.stage);
      const text = contextFor(kid, data.logs, { readiness: (data.ready[kid.id] || []).length, stageTitle: stage.title, methodTitle: methodById(kid.method).name, needLabels: kid.needs.map((n) => NEEDS.find((x) => x.id === n)?.label || n) }) + `\nSuggested reminder interval: ${gap} min. Sit length: ${sitMinutes(months)} min.`;
      const res = await askAppAi<{ title: string; items: { time: string; kind: string; label: string; why: string }[]; tips: string[] }>(token, "potty-schedule", { text, goal });
      const kinds: SchedItem["kind"][] = ["sit", "prompt", "drink", "meal", "routine", "sleep", "note"];
      const its = (res.items || []).filter((i) => /^\d{1,2}:\d{2}$/.test(i.time) && i.label).map((i) => ({ id: uid(), time: i.time.padStart(5, "0"), kind: (kinds.includes(i.kind as SchedItem["kind"]) ? i.kind : "note") as SchedItem["kind"], label: String(i.label).slice(0, 80), why: String(i.why || "").slice(0, 200) })).sort((a, b) => minsOf(a.time) - minsOf(b.time));
      if (!its.length) throw new Error("The AI didn't return a usable schedule. Try again.");
      set((d) => ({ ...d, schedules: { ...d.schedules, [kid.id]: { kid: kid.id, made: dayOf(Date.now()), source: "ai", title: res.title || `${kid.name}'s potty day`, items: its, tips: (res.tips || []).map(String).slice(0, 6) } } }));
      setShowing("saved");
    } catch (e: any) { setErr(e?.message || "The AI couldn't make a schedule right now."); }
    finally { setBusy(false); }
  };
  const keep = () => { set((d) => ({ ...d, schedules: { ...d.schedules, [kid.id]: { kid: kid.id, made: dayOf(Date.now()), source: "builder", title: `${kid.name}'s potty day`, items: built, tips: [] } } })); setShowing("saved"); };
  const text = `${title}\n\n${items.map((i) => `${clock12(i.time)}  ${i.label}`).join("\n")}\n\nWords: ${kid.words.pee} / ${kid.words.poop} / ${kid.words.potty}. Sits last about ${sitMinutes(months)} minutes.`;
  const print = () => printPage(title, `<div style="text-align:center"><div style="font-size:54px">${esc(kid.avatar)}</div><h1 style="font-size:30px">${esc(title)}</h1><p class="muted">Our words: ${esc(kid.words.pee)}, ${esc(kid.words.poop)}, ${esc(kid.words.potty)} · Sits last about ${sitMinutes(months)} minutes</p></div>
    <table style="margin-top:16px">${items.map((i) => `<tr><td style="width:110px;font-size:18px;font-weight:bold">${esc(clock12(i.time))}</td><td style="width:44px;font-size:24px">${ICON[i.kind]}</td><td style="font-size:17px"><b>${esc(i.label)}</b>${i.why ? `<br><span class="muted">${esc(i.why)}</span>` : ""}</td><td style="width:40px;border:2px solid #cbd5e1"></td></tr>`).join("")}</table>
    <p class="muted" style="margin-top:14px">Tick the box after each one. Stay calm with accidents; praise every try.</p>`);
  return <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
    <Section title={title} sub={showing === "saved" && saved ? `${saved.source === "ai" ? "Made with AI" : "Saved"} ${saved.made}.` : `Built from ${kid.name}'s routine and stage. Change the routine in the profile.`} action={<div className="flex flex-wrap gap-1.5">{saved?.items?.length ? <><Chip on={showing === "saved"} onClick={() => setShowing("saved")}>Saved</Chip><Chip on={showing === "builder"} onClick={() => setShowing("builder")}>Fresh from routine</Chip></> : null}</div>}>
      <Panel pad={false}><ol>{items.map((i) => { const past = dow === new Date().getDay() && minsOf(i.time) < nowM; return <li key={i.id} className="flex gap-3 border-b px-4 py-3 last:border-0" style={{ borderColor: C.line, opacity: past ? 0.55 : 1 }}>
        <span className="w-[70px] shrink-0 pt-0.5 text-[13px] font-extrabold tabular-nums">{clock12(i.time)}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base" style={{ background: `${COLOR[i.kind]}1f` }}>{ICON[i.kind]}</span>
        <span className="min-w-0"><span className="block text-[15px] font-bold">{i.label}</span>{i.why && <span className="block text-[13px]" style={{ color: C.muted }}>{i.why}</span>}</span></li>; })}</ol></Panel>
      {showing === "saved" && saved?.tips?.length ? <Panel tone="duck" className="mt-4"><p className="mb-2 font-extrabold">Tips for this schedule</p><ul className="space-y-1">{saved.tips.map((t) => <li key={t} className="text-sm">• {t}</li>)}</ul></Panel> : null}
    </Section>
    <div className="space-y-6">
      <Section title="Use it today">
        <Panel>
          {running ? <Note tone="tip">Today's schedule is ringing reminders. Keep this page open (on a phone, keep the screen on).</Note> : <p className="text-sm" style={{ color: C.inkSoft }}>Ring a reminder at every sit and potty break today. Works while this page is open.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {running ? <Btn2 onClick={() => set((d) => ({ ...d, schedRun: null }))}>Stop reminders</Btn2> : <Btn2 kind="duck" onClick={() => { if (showing === "builder") keep(); set((d) => ({ ...d, schedRun: { kid: kid.id, day: dayOf(Date.now()) } })); }}><Bell size={15} />Ring today's reminders</Btn2>}
            <Btn2 onClick={print}><Printer size={15} />Print for the fridge</Btn2>
            <Btn2 onClick={() => void navigator.clipboard?.writeText(text)}><Copy size={15} />Copy for daycare</Btn2>
          </div>
          {"Notification" in window && Notification.permission === "default" && <button type="button" onClick={() => void Notification.requestPermission()} className="mt-3 text-[13px] font-bold underline" style={{ color: C.inkSoft }}>Allow alerts when this tab is in the background</button>}
        </Panel>
      </Section>
      <Section title="Adjust">
        <Panel className="space-y-4">
          <Label text={`Potty breaks every ${gap} minutes`} hint={r.peeGap ? `${kid.name} usually pees every ${r.peeGap} min — breaks 15 min sooner land just before.` : "Toddlers usually pee every 1.5–2 hours. Log a few days and the app suggests a time from your child's own pattern."}>
            <input type="range" min={20} max={180} step={5} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full" style={{ accentColor: C.ink }} /></Label>
          <Label text="Day"><div className="flex flex-wrap gap-1">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <Chip key={d} on={dow === i} onClick={() => { setDow(i); setShowing("builder"); }}>{d}</Chip>)}</div></Label>
          <div className="flex flex-wrap gap-2"><Btn2 onClick={() => { putInterval(gap); keep(); }}>Save this schedule</Btn2><Btn2 kind="ghost" onClick={editKid}>Change wake, meals, naps…</Btn2></div>
        </Panel>
      </Section>
      <Section title="Personalise with AI" sub="Describe your day or worries; the AI builds a schedule around them using the same rules.">
        <Panel className="space-y-3"><textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. We're doing the 3-day method this weekend. She naps 1–3 and we have swim class at 10 on Saturday." className={`${field} h-auto py-2`} style={fieldStyle} aria-label="Your goal or worries" maxLength={1400} />
          <Btn2 kind="ink" disabled={busy} onClick={() => void makeAi()}><Sparkles size={15} />{busy ? "Building…" : "Make my schedule"}</Btn2>{err && <Note tone="warn">{err}</Note>}</Panel>
      </Section>
    </div>
  </div>;
  function putInterval(n: number) { set((d) => ({ ...d, kids: d.kids.map((k) => (k.id === kid.id ? { ...k, interval: n } : k)) })); }
}
