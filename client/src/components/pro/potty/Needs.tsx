// Additional needs: a guide for each condition, and the tools specialists use — picture steps
// (edit, show step by step, print), talk cards that speak, a first–then board, a personalised
// social story (template or AI), a sensory checklist and body checks.
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Printer, Sparkles, Trash2 } from "lucide-react";
import { askAppAi } from "@/lib/cloudDocs";
import { FullScreen, esc, printPage, uid } from "../kit";
import { BODY_CHECKS, NEEDS, SENSORY, STEP_EMOJIS, TALK_CARDS, contextFor, defaultVisual, methodById, socialStory, stageById, videoById, ytThumb, type NeedId, type VisualStep } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, FONT_HEAD, Label, Note, Panel, PottyStyles, Section, field, fieldStyle, say } from "./theme";

type Tool = "guides" | "steps" | "talk" | "firstthen" | "story" | "sensory" | "body";

export default function Needs() {
  const { kid } = usePotty();
  const [tool, setTool] = useState<Tool>("guides");
  return <div className="space-y-6">
    <Panel tone="night"><h2 className="text-2xl font-extrabold">Every child can learn</h2><p className="mt-1 max-w-2xl text-sm text-white/75">ERIC, the children's bladder and bowel charity, puts it simply: almost all children can learn to be clean and dry. Children with autism, Down syndrome, cerebral palsy or developmental delays often start later and take longer — the plan is adapted, not abandoned. {kid.needs.length ? `${kid.name}'s plan, coach and schedule already take ${kid.name}'s needs into account.` : "Add needs in the profile (gear icon) and the plan, coach and schedule adapt."}</p></Panel>
    <div className="flex flex-wrap gap-1.5">{([["guides", "📘 Guides"], ["steps", "🖼️ Picture steps"], ["talk", "🗣️ Talk cards"], ["firstthen", "➡️ First–then"], ["story", "📖 Social story"], ["sensory", "🎧 Sensory check"], ["body", "🫶 Body checks"]] as const).map(([v, l]) => <Chip key={v} on={tool === v} onClick={() => setTool(v)}>{l}</Chip>)}</div>
    {tool === "guides" && <Guides />}
    {tool === "steps" && <Steps />}
    {tool === "talk" && <Talk />}
    {tool === "firstthen" && <FirstThen />}
    {tool === "story" && <Story />}
    {tool === "sensory" && <Sensory />}
    {tool === "body" && <Body />}
  </div>;
}

function Guides() {
  const { kid, go } = usePotty();
  const [id, setId] = useState<NeedId>(kid.needs[0] || "autism");
  const g = NEEDS.find((n) => n.id === id)!;
  return <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
    <div className="flex flex-wrap gap-1.5 lg:flex-col">{NEEDS.map((n) => <button key={n.id} type="button" onClick={() => setId(n.id)} aria-pressed={id === n.id} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition" style={id === n.id ? { background: C.ink, color: "#fff" } : { background: "#fff", boxShadow: `inset 0 0 0 1.5px ${kid.needs.includes(n.id) ? C.duck : C.line}` }}><span className="text-lg">{n.emoji}</span>{n.label}{kid.needs.includes(n.id) && <span className="ml-auto text-[10px]" style={{ color: id === n.id ? C.duck : C.duckDeep }}>{kid.name}</span>}</button>)}</div>
    <div className="space-y-5">
      <Section title={<span className="text-2xl">{g.emoji} {g.label}</span>}><p className="text-[16px] leading-relaxed">{g.about}</p></Section>
      <Section title="What matters most"><Panel><ul className="space-y-2.5">{g.keys.map((k) => <li key={k} className="flex gap-3 text-[15px] leading-snug"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: C.duck }} />{k}</li>)}</ul></Panel></Section>
      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Adapt the plan"><ul className="space-y-1.5">{g.adapt.map((a) => <li key={a} className="text-sm">✓ {a}</li>)}</ul></Section>
        <Section title="Who can help"><ul className="space-y-1.5">{g.help.map((a) => <li key={a} className="text-sm">• {a}</li>)}</ul></Section>
      </div>
      {g.videos.length > 0 && <Section title="Videos"><div className="grid gap-3 sm:grid-cols-3">{g.videos.map((vid) => { const v = videoById(vid); return v ? <button key={vid} type="button" onClick={() => go("videos", `v:${vid}`)} className="overflow-hidden rounded-2xl bg-white text-left" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><img src={ytThumb(v.yt)} alt="" loading="lazy" className="aspect-video w-full object-cover" /><span className="block p-2 text-[13px] font-bold leading-tight">{v.title}</span><span className="block px-2 pb-2 text-[11px]" style={{ color: C.muted }}>{v.channel}</span></button> : null; })}</div></Section>}
    </div>
  </div>;
}

function Steps() {
  const { data, set, kid } = usePotty();
  const steps = data.visual[kid.id]?.length ? data.visual[kid.id] : defaultVisual();
  const put = (s: VisualStep[]) => set((d) => ({ ...d, visual: { ...d.visual, [kid.id]: s } }));
  const [show, setShow] = useState<number | null>(null);
  const on = steps.filter((s) => s.on);
  const move = (i: number, by: number) => { const s = [...steps]; const j = i + by; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; put(s); };
  const print = () => printPage(`${kid.name}'s potty steps`, `<h1 style="text-align:center">${esc(kid.name)}'s potty steps</h1><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px">${on.map((s, i) => `<div style="border:3px solid #1F2544;border-radius:18px;padding:14px;text-align:center;page-break-inside:avoid"><div style="font-size:14px;font-weight:bold;color:#B7860B">${i + 1}</div><div style="font-size:64px;line-height:1.1">${esc(s.emoji)}</div><div style="font:800 18px Arial;margin-top:6px">${esc(s.label)}</div></div>`).join("")}</div><p class="muted" style="text-align:center;margin-top:14px">Cut out the cards for a strip by the toilet, or tape the whole sheet at eye level.</p>`);
  return <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
    <Section title="Picture steps" sub="ERIC's toilet routine as picture cards. Turn steps on or off, reorder, rename them in your words, add your own." action={<div className="flex gap-2"><Btn2 kind="duck" onClick={() => setShow(0)}>Show step by step</Btn2><Btn2 onClick={print}><Printer size={15} />Print</Btn2></div>}>
      <Panel pad={false}>{steps.map((s, i) => <div key={s.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-0" style={{ borderColor: C.line, opacity: s.on ? 1 : 0.45 }}>
        <input type="checkbox" checked={s.on} onChange={() => put(steps.map((x) => (x.id === s.id ? { ...x, on: !x.on } : x)))} className="h-5 w-5" aria-label={`Use step ${s.label}`} />
        <select value={s.emoji} onChange={(e) => put(steps.map((x) => (x.id === s.id ? { ...x, emoji: e.target.value } : x)))} className="h-10 w-14 rounded-xl border bg-white text-center text-xl" style={{ borderColor: C.line }} aria-label="Picture">{[s.emoji, ...STEP_EMOJIS.filter((e) => e !== s.emoji)].map((e) => <option key={e}>{e}</option>)}</select>
        <input value={s.label} onChange={(e) => put(steps.map((x) => (x.id === s.id ? { ...x, label: e.target.value.slice(0, 40) } : x)))} className={`${field} !h-10 flex-1`} style={fieldStyle} aria-label="Step name" />
        <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="p-1" style={{ color: C.muted }}><ArrowUp size={16} /></button><button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="p-1" style={{ color: C.muted }}><ArrowDown size={16} /></button>
        {!defaultVisual().some((d) => d.id === s.id) && <button type="button" aria-label="Remove step" onClick={() => put(steps.filter((x) => x.id !== s.id))} className="p-1" style={{ color: C.accident }}><Trash2 size={16} /></button>}
      </div>)}</Panel>
      <div className="mt-3 flex gap-2"><Btn2 onClick={() => put([...steps, { id: uid(), emoji: "⭐", label: "New step", on: true }])}>+ Add a step</Btn2><Btn2 kind="ghost" onClick={() => put(defaultVisual())}>Reset</Btn2></div>
    </Section>
    <Section title="Preview"><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{on.map((s, i) => <div key={s.id} className="flex flex-col items-center rounded-2xl bg-white p-2 text-center" style={{ boxShadow: `inset 0 0 0 2px ${C.ink}` }}><span className="text-[11px] font-extrabold" style={{ color: C.duckDeep }}>{i + 1}</span><span className="text-4xl">{s.emoji}</span><span className="mt-1 text-[12px] font-extrabold leading-tight">{s.label}</span></div>)}</div>
      <Note tone="tip">Point to each card as your child does the step, every time. Many families photograph their own bathroom for each step; tape those next to the cards.</Note></Section>
    {show !== null && <FullScreen bg={C.ground} onClose={() => setShow(null)}><PottyStyles /><StepShow steps={on} i={show} setI={setShow} /></FullScreen>}
  </div>;
}
function StepShow({ steps, i, setI }: { steps: VisualStep[]; i: number; setI: (n: number) => void }) {
  const { data } = usePotty(); const s = steps[i];
  return <div className="flex w-full max-w-xl flex-col items-center px-4 text-center" style={{ fontFamily: FONT_HEAD, color: C.ink }}>
    <p className="text-lg font-bold" style={{ color: C.muted }}>Step {i + 1} of {steps.length}</p>
    <button type="button" onClick={() => say(s.label, data.voice)} className="mt-3 flex h-72 w-72 flex-col items-center justify-center rounded-[40px] bg-white shadow-xl" aria-label={`Say ${s.label}`}><span className="pt-pop text-[8rem] leading-none" key={s.id}>{s.emoji}</span></button>
    <p className="mt-5 text-4xl font-extrabold">{s.label}</p>
    <div className="mt-6 flex gap-3"><Btn2 big kind="plain" disabled={i === 0} onClick={() => { setI(i - 1); say(steps[i - 1].label, data.voice); }}><ChevronLeft size={20} />Back</Btn2><Btn2 big kind="duck" onClick={() => { if (i + 1 < steps.length) { setI(i + 1); say(steps[i + 1].label, data.voice); } else say("All done! Great job!", data.voice); }}>{i + 1 < steps.length ? "Next" : "Done!"}<ChevronRight size={20} /></Btn2></div>
  </div>;
}

function Talk() {
  const { data, kid } = usePotty();
  const [board, setBoard] = useState(false);
  const cards = TALK_CARDS.map((c) => (c.id === "pee" ? { ...c, text: kid.words.pee[0].toUpperCase() + kid.words.pee.slice(1) } : c.id === "poop" ? { ...c, text: kid.words.poop[0].toUpperCase() + kid.words.poop.slice(1) } : c.id === "need" ? { ...c, text: `I need to go ${kid.words.potty}` } : c));
  const grid = (big: boolean) => <div className={`grid gap-3 ${big ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-5"}`}>{cards.map((c) => <button key={c.id} type="button" onClick={() => say(c.text, true)} className={`flex flex-col items-center justify-center rounded-[26px] bg-white text-center transition active:scale-95 ${big ? "h-44" : "h-32"}`} style={{ boxShadow: `inset 0 0 0 3px ${c.color}` }}><span className={big ? "text-7xl" : "text-5xl"}>{c.emoji}</span><span className={`ph mt-2 px-2 font-extrabold leading-tight ${big ? "text-xl" : "text-[15px]"}`}>{c.text}</span></button>)}</div>;
  const print = () => printPage("Talk cards", `<h1>Talk cards</h1><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">${cards.map((c) => `<div style="border:4px solid ${c.color};border-radius:20px;height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-inside:avoid"><div style="font-size:72px">${esc(c.emoji)}</div><div style="font:800 20px Arial;margin-top:8px;text-align:center">${esc(c.text)}</div></div>`).join("")}</div><p class="muted">Cut out. Keep one 'I need to go' card where your child plays, and one in the bathroom.</p>`);
  return <Section title="Talk cards" sub={`Tap a card and it speaks${data.voice ? "" : " (voice is off — turn it on at the top)"}. For children who are learning words, use signs, pictures or a device.`} action={<div className="flex gap-2"><Btn2 kind="duck" onClick={() => setBoard(true)}>Full-screen board</Btn2><Btn2 onClick={print}><Printer size={15} />Print cards</Btn2></div>}>
    {grid(false)}
    <Note tone="tip">Teach it like this: hand your child the "I need to go" card before every trip, then walk to the potty together. Once that's routine, wait a moment for them to hand it to you first — and celebrate big when they do.</Note>
    {board && <FullScreen bg={C.ground} onClose={() => setBoard(false)}><PottyStyles /><div className="w-full max-w-5xl px-4" style={{ fontFamily: FONT_HEAD, color: C.ink }}>{grid(true)}</div></FullScreen>}
  </Section>;
}

const FIRSTS = [{ e: "🚽", t: "Potty" }, { e: "🧼", t: "Wash hands" }, { e: "👖", t: "Pants on" }, { e: "🪑", t: "Sit for a minute" }];
const THENS = [{ e: "🫧", t: "Bubbles" }, { e: "📺", t: "Show" }, { e: "🛝", t: "Playground" }, { e: "🍓", t: "Snack" }, { e: "🧸", t: "Toy" }, { e: "📖", t: "Story" }, { e: "🎵", t: "Song" }, { e: "⭐", t: "Sticker" }];
function FirstThen() {
  const { data } = usePotty();
  const [f, setF] = useState(0); const [t, setT] = useState(0); const [custom, setCustom] = useState(""); const [full, setFull] = useState(false);
  const then = custom.trim() ? { e: "🎁", t: custom.trim() } : THENS[t];
  const board = (big: boolean) => <div className="grid grid-cols-2 gap-4" style={{ fontFamily: FONT_HEAD, color: C.ink }}>{[["First", FIRSTS[f]], ["Then", then]].map(([label, x]: any) => <div key={label} className="flex flex-col items-center rounded-[30px] bg-white p-5 text-center" style={{ boxShadow: `inset 0 0 0 4px ${label === "First" ? C.pee : C.duck}` }}><span className={`font-extrabold ${big ? "text-4xl" : "text-xl"}`}>{label}</span><span className={big ? "my-4 text-[9rem] leading-none" : "my-2 text-7xl"}>{x.e}</span><span className={`font-extrabold ${big ? "text-4xl" : "text-xl"}`}>{x.t}</span></div>)}</div>;
  return <div className="grid gap-6 lg:grid-cols-2">
    <Section title="First–then board" sub="Makes what happens next predictable: first the potty, then something good. Widely used with autistic children and toddlers who resist transitions.">
      <Panel className="space-y-4"><Label text="First"><div className="flex flex-wrap gap-1.5">{FIRSTS.map((x, i) => <Chip key={x.t} on={f === i} onClick={() => setF(i)}>{x.e} {x.t}</Chip>)}</div></Label>
        <Label text="Then"><div className="flex flex-wrap gap-1.5">{THENS.map((x, i) => <Chip key={x.t} on={!custom && t === i} onClick={() => { setT(i); setCustom(""); }}>{x.e} {x.t}</Chip>)}</div></Label>
        <Label text="Or your own"><input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 30))} placeholder="Grandma's call" className={field} style={fieldStyle} /></Label>
        <div className="flex gap-2"><Btn2 kind="duck" onClick={() => { setFull(true); say(`First ${FIRSTS[f].t}, then ${then.t}!`, data.voice); }}>Show it full screen</Btn2></div></Panel>
    </Section>
    <Section title="Preview">{board(false)}</Section>
    {full && <FullScreen bg={C.ground} onClose={() => setFull(false)}><PottyStyles /><div className="w-full max-w-3xl px-4">{board(true)}</div></FullScreen>}
  </div>;
}

function Story() {
  const { data, set, kid, token } = usePotty();
  const saved = data.story[kid.id];
  const story = saved?.pages?.length ? saved : socialStory(kid);
  const [i, setI] = useState<number | null>(null); const [focus, setFocus] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const makeAi = async () => {
    setBusy(true); setErr("");
    try {
      const text = contextFor(kid, data.logs, { readiness: (data.ready[kid.id] || []).length, stageTitle: stageById(kid.stage).title, methodTitle: methodById(kid.method).name, needLabels: kid.needs.map((n) => NEEDS.find((x) => x.id === n)?.label || n) });
      const r = await askAppAi<{ title: string; pages: { text: string; emoji: string }[] }>(token, "potty-story", { text, focus });
      const pages = (r.pages || []).filter((p) => p && p.text).map((p) => ({ text: String(p.text).slice(0, 300), emoji: String(p.emoji || "🙂").slice(0, 8) }));
      if (pages.length < 4) throw new Error("The story came back too short. Try again.");
      set((d) => ({ ...d, story: { ...d.story, [kid.id]: { title: String(r.title || `${kid.name}'s potty story`), pages } } }));
    } catch (e: any) { setErr(e?.message || "Couldn't write a story right now."); } finally { setBusy(false); }
  };
  const print = () => printPage(story.title, `<h1 style="text-align:center;font-size:30px">${esc(story.title)}</h1>${story.pages.map((p, n) => `<div style="border:2px solid #cbd5e1;border-radius:16px;padding:22px;margin:12px 0;page-break-inside:avoid;display:flex;gap:18px;align-items:center"><div style="font-size:70px">${esc(p.emoji)}</div><div style="font:600 22px Arial;line-height:1.4">${esc(p.text)}</div><div style="margin-left:auto;color:#94a3b8">${n + 1}</div></div>`).join("")}`);
  return <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
    <Section title={story.title} sub="A social story explains what happens and why, in calm first-person sentences — read it together before sits, every day for a while." action={<div className="flex gap-2"><Btn2 kind="duck" onClick={() => { setI(0); say(story.pages[0].text, data.voice); }}>Read it together</Btn2><Btn2 onClick={print}><Printer size={15} />Print booklet</Btn2></div>}>
      <Panel pad={false}><ol>{story.pages.map((p, n) => <li key={n} className="flex items-center gap-4 border-b px-4 py-3 last:border-0" style={{ borderColor: C.line }}><span className="text-4xl">{p.emoji}</span><span className="text-[15px] leading-snug">{p.text}</span></li>)}</ol></Panel>
    </Section>
    <div className="space-y-5">
      <Section title="Make it fit your child" sub={`Uses ${kid.name}'s name, words${kid.needs.length ? ", needs" : ""} and stage.`}>
        <Panel className="space-y-3"><Label text="What should it focus on? (optional)"><input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Scared of the flush · pooping on the potty · potty at daycare" className={field} style={fieldStyle} maxLength={300} /></Label>
          <div className="flex flex-wrap gap-2"><Btn2 kind="ink" disabled={busy} onClick={() => void makeAi()}><Sparkles size={15} />{busy ? "Writing…" : "Write a new story with AI"}</Btn2>{saved && <Btn2 kind="ghost" onClick={() => set((d) => { const s = { ...d.story }; delete s[kid.id]; return { ...d, story: s }; })}>Back to the standard story</Btn2>}</div>{err && <Note tone="warn">{err}</Note>}</Panel>
      </Section>
      <Note tone="info">Autism Speaks has a printable personalized teaching story too (Learn → Trusted resources).</Note>
    </div>
    {i !== null && <FullScreen bg={C.ground} onClose={() => setI(null)}><PottyStyles /><div className="flex w-full max-w-2xl flex-col items-center px-4 text-center" style={{ fontFamily: FONT_HEAD, color: C.ink }}>
      <p className="font-bold" style={{ color: C.muted }}>Page {i + 1} of {story.pages.length}</p>
      <span key={i} className="pt-pop my-6 text-[9rem] leading-none">{story.pages[i].emoji}</span>
      <p className="text-3xl font-extrabold leading-snug">{story.pages[i].text}</p>
      <div className="mt-8 flex gap-3"><Btn2 big kind="plain" disabled={i === 0} onClick={() => { setI(i - 1); say(story.pages[i - 1].text, data.voice); }}><ChevronLeft size={20} />Back</Btn2><Btn2 big kind="duck" onClick={() => { if (i + 1 < story.pages.length) { setI(i + 1); say(story.pages[i + 1].text, data.voice); } else setI(null); }}>{i + 1 < story.pages.length ? "Next page" : "The end"}<ChevronRight size={20} /></Btn2></div>
    </div></FullScreen>}
  </div>;
}

function Sensory() {
  const { data, set, kid } = usePotty();
  const picked = data.sensory[kid.id] || [];
  const toggle = (id: string) => set((d) => ({ ...d, sensory: { ...d.sensory, [kid.id]: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] } }));
  return <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
    <Section title="What bothers your child?" sub="The AAP suggests finding what's uncomfortable in the bathroom — noise, cold, smell — and changing it. Tick anything you've noticed.">
      <div className="space-y-2">{SENSORY.map((s) => { const on = picked.includes(s.id); return <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-2xl p-3" style={on ? { background: C.duckSoft } : { background: "#fff", boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="mt-0.5 h-5 w-5" /><span><span className="block font-bold">{s.trigger}</span><span className="text-[13px]" style={{ color: C.muted }}>{s.signs}</span></span></label>; })}</div>
    </Section>
    <Section title={picked.length ? `Fixes to try (${picked.length})` : "Fixes to try"} sub="Change one thing at a time for a few days so you can tell what helps.">
      {picked.length ? <div className="space-y-3">{SENSORY.filter((s) => picked.includes(s.id)).map((s) => <Panel key={s.id}><p className="ph font-extrabold">{s.trigger}</p><ul className="mt-2 space-y-1">{s.fix.map((f) => <li key={f} className="text-sm">✓ {f}</li>)}</ul></Panel>)}</div> : <Note tone="info">Tick what you've noticed on the left. An occupational therapist can do a full sensory assessment.</Note>}
    </Section>
  </div>;
}

function Body() {
  const { data, kid } = usePotty();
  const [i, setI] = useState(0);
  return <Section title="Body checks" sub="Interoception — noticing what's happening inside the body — is a skill. A few times a day, pause and check in together, especially for children who don't notice the urge (ERIC's interoception guide).">
    <Panel tone="duck"><p className="ph text-2xl font-extrabold leading-snug">{BODY_CHECKS[i]}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Btn2 kind="ink" onClick={() => say(BODY_CHECKS[i], data.voice)}>Say it to {kid.name}</Btn2><Btn2 onClick={() => setI((i + 1) % BODY_CHECKS.length)}>Another one</Btn2></div></Panel>
    <ul className="mt-4 space-y-2">{BODY_CHECKS.map((b) => <li key={b} className="rounded-2xl bg-white px-4 py-3 text-sm" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>{b}</li>)}</ul>
    <Note tone="tip">When you see a sign (wiggling, going quiet), name it: "You're wiggling — I think your {kid.words.pee} is telling you. Let's go!" Naming it out loud is how children learn the feeling.</Note>
  </Section>;
}
