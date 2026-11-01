// Arise Trainer: the coaching app for personal trainers (the iPhone app built with VITE_NATIVE_APP=trainer,
// and #/trainer on the website). Tabs: Clients, Inbox, Schedule, Library, Business. Clients come from
// Arise Fit, with their training, food and health data shared automatically (server/coach.ts).
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Briefcase, CalendarDays, CheckSquare, ChevronRight, Dumbbell, Inbox, BookOpen, LogOut, Megaphone, MessageCircle, Plus, Search, ShieldCheck, Square, Star, Trash2, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AccountPrivacy from "@/components/AccountPrivacy";
import { goToSignIn } from "@/lib/hubs";
import { isNativeApp } from "@/lib/nativeApp";
import { startApplePush } from "@/lib/applePush";
import { MODES, MODE_LABEL, PER_LABEL, SPECIALTIES, US_STATES, cleanTrainer, fromCents, money, type Library, type Mode, type Per, type Price, type PublicTrainer, type TrainerProfile } from "@shared/coach";
import { Avatar, Stars, TrainerPage } from "../coach/CoachUi";
import { ago, coachApi, post, put, shortDate, shrinkImage, usePoll, when, type ClientRow, type TrainerHome } from "../coach/coachApi";
import { Btn, C, Card, Chips, Field, Ring, Sheet, Title, display, font, glowBg, inputCls, inputStyle, stagger, useFitFonts, Layer} from "../fit/fitUi";
import { ClientSheet } from "./TrainerClient";
import { FormBuilder, OwnExerciseSheet, ProgramBuilder, WorkoutBuilder, newId } from "./TrainerBuilder";

type Tab = "clients" | "inbox" | "schedule" | "library" | "business";

export default function TrainerApp() {
  useFitFonts();
  const { user, token } = useAuth();
  const me = Number(user?.id) || 0;
  const { data, err, reload, setData } = usePoll(() => coachApi<TrainerHome>(token, "/trainer"), [token], 30_000);
  const [tab, setTab] = useState<Tab>("clients");
  const [open, setOpen] = useState<ClientRow | null>(null);
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? "" : t)), 2600); };
  // Notifications for new requests, messages and check-ins (asks once, the first time).
  useEffect(() => { if (isNativeApp()) void startApplePush(true); }, []);
  useEffect(() => { const was = document.documentElement.style.background; document.documentElement.style.background = C.bg; return () => { document.documentElement.style.background = was; }; }, []);
  // Back from Stripe after starting the listing plan.
  useEffect(() => {
    const m = window.location.hash.match(/[?&]listing=(cs_[A-Za-z0-9_]+)/);
    if (!m) return;
    window.location.hash = "#/trainer";
    void post(token, "/trainer/listing/confirm", { session: m[1] }).then(() => { say("Your listing is live!"); reload(); setTab("business"); }).catch((e) => say(e.message));
  }, [token, reload]);
  const saveLib = async (library: Library) => { if (!data) return; setData({ ...data, library }); try { await put(token, "/trainer/library", { library }); } catch (e: any) { say(e.message); } };
  const quick = data?.library.quickReplies ?? [];
  const unread = (data?.clients ?? []).reduce((t, c) => t + c.unread, 0);
  const requests = (data?.clients ?? []).filter((c) => c.status === "requested").length;
  const tabs: [Tab, string, typeof Users, number][] = [["clients", "Clients", Users, requests], ["inbox", "Inbox", Inbox, unread], ["schedule", "Schedule", CalendarDays, 0], ["library", "Library", BookOpen, 0], ["business", "Business", Briefcase, 0]];
  const at = tabs.findIndex(([id]) => id === tab);
  return <div className="fixed inset-0 flex flex-col" style={{ background: glowBg, color: C.text, ...font }} data-testid="trainer-app">
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-[max(14px,env(safe-area-inset-top))]">
      {!data ? <p className="mt-24 text-center" style={{ color: C.dim }}>{err || "Loading…"}</p> : <div key={tab} className="fit-in">
        {tab === "clients" && <Clients data={data} token={token} onOpen={setOpen} say={say} goBusiness={() => setTab("business")} />}
        {tab === "inbox" && <InboxTab data={data} onOpen={setOpen} />}
        {tab === "schedule" && <Schedule token={token} data={data} onOpen={setOpen} />}
        {tab === "library" && <LibraryTab lib={data.library} saveLib={saveLib} />}
        {tab === "business" && <Business data={data} token={token} reload={reload} say={say} />}
      </div>}
    </main>
    <nav aria-label="Arise Trainer" className="fixed inset-x-3 z-[40] mx-auto flex max-w-md items-center rounded-[14px] p-1.5" style={{ bottom: "max(12px, env(safe-area-inset-bottom))", background: "rgba(32,35,41,.96)", backdropFilter: "blur(16px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.6)" }}>
      <span aria-hidden className="absolute bottom-1.5 top-1.5 rounded-[10px]" style={{ width: `calc((100% - 12px) / ${tabs.length})`, left: `calc(6px + ${at} * (100% - 12px) / ${tabs.length})`, background: "linear-gradient(180deg, rgba(255,90,31,.24), rgba(255,90,31,.08))", boxShadow: "inset 0 -2px 0 #ff5a1f", transition: "left .35s cubic-bezier(.2,.9,.2,1)" }} />
      {tabs.map(([id, label, Icon, badge]) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} data-testid={`tr-tab-${id}`}
        className="relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[11px] uppercase tracking-[.06em] transition-colors" style={{ fontFamily: display.fontFamily, fontWeight: 800, color: tab === id ? C.lime : C.dim }}>
        <Icon className="h-[22px] w-[22px]" />{label}{badge > 0 && <span className="fit-pop absolute right-[18%] top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]" style={{ background: C.lime, color: "#0b0b0c" }}>{badge}</span>}</button>)}
    </nav>
    {open && data && <ClientSheet token={token} me={me} linkId={open.id} name={open.name} lib={data.library} saveLib={saveLib} quick={quick} onClose={() => { setOpen(null); reload(); }} />}
    <div role="status" aria-live="polite" className={`pointer-events-none fixed left-1/2 z-[95] -translate-x-1/2 rounded-full px-4 py-2.5 text-[14px] font-semibold shadow-xl transition ${toast ? "opacity-100" : "opacity-0"}`} style={{ top: "max(16px, env(safe-area-inset-top))", background: C.text, color: C.bg }}>{toast}</div>
  </div>;
}

function Header({ title, kicker, right }: { title: string; kicker?: string; right?: React.ReactNode }) {
  return <div className="mb-4 flex items-end justify-between px-1"><div>{kicker && <p className="text-[14px]" style={{ color: C.dim }}>{kicker}</p>}<h1 className="text-[46px] leading-[.95]" style={display}>{title}</h1></div>{right}</div>;
}

function ClientRowCard({ c, onOpen, k, pick }: { c: ClientRow; onOpen: () => void; k: number; pick?: { on: boolean; toggle: () => void } }) {
  const pct = c.compliance.pct;
  return <Card className="!p-3" style={stagger(Math.min(k, 10), 0.04)} testId={`tr-client-${c.clientId}`}>
    <div className="flex items-center gap-3">
      {pick && <button type="button" onClick={pick.toggle} aria-pressed={pick.on} aria-label={`Select ${c.name}`} className="shrink-0" style={{ color: pick.on ? C.lime : C.dim }}>{pick.on ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}</button>}
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {c.status === "active" ? <Ring value={pct ?? 0} goal={100} size={50} stroke={5}><span className="text-[13px] font-bold">{pct ?? "–"}</span></Ring> : <span className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full" style={{ background: C.lime, color: "#0b0b0c" }}><Plus className="h-6 w-6" /></span>}
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-[20px] leading-none" style={display}>{c.name}</span>{c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold" style={{ background: C.lime, color: "#0b0b0c" }}>{c.unread}</span>}</span>
          <span className="block truncate text-[12px]" style={{ color: C.dim }}>{c.status === "requested" ? "Wants you to coach them · tap to accept" : [c.phase, c.lastWorkout ? `trained ${ago(c.lastWorkout)} ago` : "no workouts yet", c.nextAppt ? `next ${when(c.nextAppt)}` : ""].filter(Boolean).join(" · ")}</span>
          {c.tags.length > 0 && <span className="mt-1 flex gap-1">{c.tags.slice(0, 3).map((t) => <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.card2 }}>{t}</span>)}</span>}</span>
        <ChevronRight className="h-5 w-5 shrink-0" style={{ color: C.dim }} />
      </button>
    </div>
  </Card>;
}

function Clients({ data, token, onOpen, say, goBusiness }: { data: TrainerHome; token: string | null; onOpen: (c: ClientRow) => void; say: (m: string) => void; goBusiness: () => void }) {
  const [q, setQ] = useState(""); const [tag, setTag] = useState(""); const [sort, setSort] = useState<"attention" | "name" | "recent">("attention");
  const [picking, setPicking] = useState(false); const [picked, setPicked] = useState<string[]>([]); const [cast, setCast] = useState(false);
  const tags = [...new Set(data.clients.flatMap((c) => c.tags))];
  const reqs = data.clients.filter((c) => c.status === "requested");
  const active = data.clients.filter((c) => c.status === "active" && (!q || c.name.toLowerCase().includes(q.toLowerCase())) && (!tag || c.tags.includes(tag)))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "recent" ? (b.lastWorkout ?? "").localeCompare(a.lastWorkout ?? "") : (b.unread - a.unread) || ((a.compliance.pct ?? 101) - (b.compliance.pct ?? 101)));
  const hour = new Date().getHours();
  return <div>
    <Header kicker={`${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${data.profile.name.split(" ")[0] || "coach"}`} title="Clients" right={active.length > 1 ? <button type="button" onClick={() => { setPicking(!picking); setPicked([]); }} className="h-10 rounded-full px-3 text-[13px] font-semibold" style={{ background: picking ? C.lime : C.card, color: picking ? "#0b0b0c" : C.text }}>{picking ? "Done" : "Select"}</button> : undefined} />
    {!data.listed && <Card onClick={goBusiness} className="fit-shine mb-3 !p-4" style={{ background: "linear-gradient(150deg, #ff5a1f, #b8360a)", color: "#0b0b0c" }} testId="tr-get-listed">
      <p className="text-[24px] leading-none" style={display}>Get listed in Arise Fit</p><p className="mt-1 text-[13px] font-semibold">{data.problems.length ? `Finish your profile: ${data.problems[0].toLowerCase()}.` : `Go live in the trainer directory. ${data.price.trialDays} days free, then ${money(data.price.cents)}/month.`}</p></Card>}
    <div className="grid grid-cols-3 gap-2 text-center">{([[data.clients.filter((c) => c.status === "active").length, "clients"], [reqs.length, "requests"], [data.reviews.length ? data.reviews.reduce((t, r) => t + r.stars, 0) / data.reviews.length : 0, "rating"]] as const).map(([v, l], k) => <Card key={l} className="!px-1 !py-3" style={stagger(k, 0.06)}><p className="text-[28px] leading-none" style={display}>{l === "rating" ? (v ? v.toFixed(1) : "—") : v}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>{l}</p></Card>)}</div>
    {reqs.length > 0 && <><Title>New requests</Title><div className="space-y-2">{reqs.map((c, k) => <ClientRowCard key={c.id} c={c} k={k} onOpen={() => onOpen(c)} />)}</div></>}
    <Title right={<select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort clients" className="h-8 rounded-[8px] px-2 text-[13px] outline-none" style={inputStyle}><option value="attention">Needs attention</option><option value="recent">Trained recently</option><option value="name">Name</option></select>}>Active</Title>
    {data.clients.some((c) => c.status === "active") && <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.dim }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className={`${inputCls} pl-10`} style={inputStyle} /></div>}
    {tags.length > 0 && <div className="mb-2"><Chips label="Tag" value={tag} onChange={setTag} items={[{ id: "", label: "All" }, ...tags.map((t) => ({ id: t, label: t }))]} /></div>}
    {active.length ? <div className="space-y-2">{active.map((c, k) => <ClientRowCard key={c.id} c={c} k={k} onOpen={() => onOpen(c)} pick={picking ? { on: picked.includes(c.id), toggle: () => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id])) } : undefined} />)}</div>
      : <Card className="text-center"><Users className="mx-auto h-8 w-8" style={{ color: C.dim }} /><p className="mt-2 text-[20px]" style={display}>No clients yet</p><p className="mt-1 text-[14px]" style={{ color: C.dim }}>When someone in Arise Fit asks you to coach them, they show up here. Their workouts, food and health data come with them.</p></Card>}
    {picking && picked.length > 0 && <Layer><div className="fit-up fixed inset-x-3 z-[45] flex gap-2 rounded-[14px] p-2" style={{ bottom: "calc(max(12px, env(safe-area-inset-bottom)) + 76px)", background: C.card2, boxShadow: "0 -10px 40px rgba(0,0,0,.6)" }}>
      <Btn className="flex-1 !text-[15px]" onClick={() => setCast(true)} testId="tr-broadcast"><Megaphone className="h-4 w-4" />Message {picked.length}</Btn></div></Layer>}
    {cast && <Broadcast token={token} ids={picked} onClose={() => setCast(false)} onSent={(n) => { setCast(false); setPicking(false); setPicked([]); say(`Sent to ${n} ${n === 1 ? "client" : "clients"}.`); }} />}
  </div>;
}

function Broadcast({ token, ids, onClose, onSent }: { token: string | null; ids: string[]; onClose: () => void; onSent: (n: number) => void }) {
  const [body, setBody] = useState(""); const [err, setErr] = useState("");
  return <Sheet title={`Message ${ids.length} clients`} onClose={onClose}>
    <p className="px-1 text-[13px]" style={{ color: C.dim }}>Each client gets it as a private message from you.</p>
    <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 4000))} rows={6} placeholder="New program starts Monday…" className="mt-3 w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} />
    {err && <p className="mt-1 text-[13px]" style={{ color: C.red }}>{err}</p>}
    <Btn className="mt-3 w-full" disabled={!body.trim()} onClick={async () => { try { const r = await post<{ sent: number }>(token, "/trainer/broadcast", { linkIds: ids, body }); onSent(r.sent); } catch (e: any) { setErr(e.message); } }}>Send</Btn>
  </Sheet>;
}

function InboxTab({ data, onOpen }: { data: TrainerHome; onOpen: (c: ClientRow) => void }) {
  const list = data.clients.filter((c) => c.last || c.status === "requested").sort((a, b) => (b.last?.at ?? b.since).localeCompare(a.last?.at ?? a.since));
  return <div>
    <Header title="Inbox" />
    {list.length ? <div className="space-y-2">{list.map((c, k) => <Card key={c.id} onClick={() => onOpen(c)} className="!p-3" style={stagger(Math.min(k, 10), 0.04)}>
      <div className="flex items-center gap-3"><MessageCircle className="h-6 w-6 shrink-0" style={{ color: c.unread ? C.lime : C.dim }} />
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[18px] leading-none" style={display}>{c.name}</p>{c.last && <span className="ml-auto shrink-0 text-[11px]" style={{ color: C.dim }}>{ago(c.last.at)}</span>}</div>
          <p className={`truncate text-[13px] ${c.unread ? "font-semibold" : ""}`} style={{ color: c.unread ? C.text : C.dim }}>{c.last ? `${c.last.from === c.clientId ? "" : "You: "}${c.last.body || "Photo"}` : "New request"}</p></div>
        {c.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-bold" style={{ background: C.lime, color: "#0b0b0c" }}>{c.unread}</span>}</div></Card>)}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Messages from your clients show up here.</p>}
  </div>;
}

/** Every booked session, across clients. */
function Schedule({ token, data, onOpen }: { token: string | null; data: TrainerHome; onOpen: (c: ClientRow) => void }) {
  const active = data.clients.filter((c) => c.status === "active");
  const { data: all } = usePoll(async () => {
    const out: { c: ClientRow; at: string; mins: number; mode: Mode; place: string; requested?: boolean }[] = [];
    await Promise.all(active.map(async (c) => { const d = await coachApi<{ coaching: { appts: { at: string; mins: number; mode: Mode; place: string; status: string; requested?: boolean }[] } }>(token, `/links/${c.id}/client`); for (const a of d.coaching.appts) if (a.status === "booked" && Date.parse(a.at) > Date.now() - 3600e3) out.push({ c, ...a }); }));
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [token, active.map((c) => c.id).join()], 60_000);
  const byDay = useMemo(() => { const m = new Map<string, NonNullable<typeof all>>(); for (const a of all ?? []) { const k = new Date(a.at).toDateString(); m.set(k, [...(m.get(k) ?? []), a]); } return [...m.entries()]; }, [all]);
  return <div>
    <Header title="Schedule" />
    {!all ? <p className="px-1" style={{ color: C.dim }}>Loading…</p> : byDay.length ? byDay.map(([d, list]) => <div key={d}><Title>{shortDate(list[0].at)}</Title><div className="space-y-2">{list.map((a, k) => <Card key={k} onClick={() => onOpen(a.c)} className="!p-3" style={a.requested ? { boxShadow: "inset 0 0 0 1px #ff5a1f" } : undefined}>
      <div className="flex items-center gap-3"><span className="w-16 shrink-0 text-[18px] leading-none" style={display}>{new Date(a.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{a.c.name}</p><p className="truncate text-[12px]" style={{ color: C.dim }}>{MODE_LABEL[a.mode]} · {a.mins} min{a.place ? ` · ${a.place}` : ""}{a.requested ? " · requested" : ""}</p></div></div></Card>)}</div></div>)
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>No sessions booked. Book one from a client's Sessions.</p>}
  </div>;
}

function LibraryTab({ lib, saveLib }: { lib: Library; saveLib: (l: Library) => void }) {
  const [sec, setSec] = useState<"workouts" | "programs" | "exercises" | "forms" | "replies">("workouts");
  const [w, setW] = useState<Library["workouts"][number] | null | "new">(null);
  const [p, setP] = useState<Library["programs"][number] | null | "new">(null);
  const [e, setE] = useState<Library["exercises"][number] | null | "new">(null);
  const [f, setF] = useState<Library["forms"][number] | null | "new">(null);
  const [reply, setReply] = useState("");
  const upsert = <T extends { id: string }>(list: T[], x: T) => (list.some((y) => y.id === x.id) ? list.map((y) => (y.id === x.id ? x : y)) : [...list, x]);
  const item = (title: string, sub: string, onClick: () => void, onDelete: () => void, k: number) => <Card key={title + k} className="!p-3" style={stagger(Math.min(k, 10), 0.04)}><div className="flex items-center gap-2">
    <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left"><p className="truncate font-semibold">{title}</p><p className="truncate text-[12px]" style={{ color: C.dim }}>{sub}</p></button>
    <button type="button" aria-label={`Delete ${title}`} onClick={() => window.confirm(`Delete ${title}?`) && onDelete()} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div></Card>;
  return <div>
    <Header title="Library" right={sec !== "replies" ? <Btn className="!min-h-10 !px-3 !text-[15px]" onClick={() => (sec === "workouts" ? setW("new") : sec === "programs" ? setP("new") : sec === "exercises" ? setE("new") : setF("new"))} testId="tr-lib-new"><Plus className="h-4 w-4" />New</Btn> : undefined} />
    <Chips label="Library" value={sec} onChange={setSec} items={[{ id: "workouts", label: `Workouts · ${lib.workouts.length}` }, { id: "programs", label: `Programs · ${lib.programs.length}` }, { id: "exercises", label: `My exercises · ${lib.exercises.length}` }, { id: "forms", label: "Check-in forms" }, { id: "replies", label: "Quick replies" }]} />
    <div className="mt-3 space-y-2">
      {sec === "workouts" && (lib.workouts.length ? lib.workouts.map((x, k) => item(x.name, `${x.items.length} exercises · ${x.items.map((i) => i.name).join(", ")}`, () => setW(x), () => saveLib({ ...lib, workouts: lib.workouts.filter((y) => y.id !== x.id) }), k)) : <Empty icon={Dumbbell} text="Build workouts once, then drop them on any client's calendar." />)}
      {sec === "programs" && (lib.programs.length ? lib.programs.map((x, k) => item(x.name, `${x.weeks} weeks · ${x.days.length} workouts`, () => setP(x), () => saveLib({ ...lib, programs: lib.programs.filter((y) => y.id !== x.id) }), k)) : <Empty icon={CalendarDays} text="Programs lay your workouts out over weeks. Assign one and the whole plan lands on the client's calendar." />)}
      {sec === "exercises" && (lib.exercises.length ? lib.exercises.map((x, k) => item(x.name, `${x.muscle || "exercise"}${x.video ? " · has video" : ""}`, () => setE(x), () => saveLib({ ...lib, exercises: lib.exercises.filter((y) => y.id !== x.id) }), k)) : <Empty icon={Dumbbell} text="Arise Fit's catalog is already here. Add your own moves with your demo video link." />)}
      {sec === "forms" && (lib.forms.length ? lib.forms.map((x, k) => item(x.title, `${x.questions.length} questions`, () => setF(x), () => saveLib({ ...lib, forms: lib.forms.filter((y) => y.id !== x.id) }), k)) : <Empty icon={CheckSquare} text="Check-in forms your clients answer each week." />)}
      {sec === "replies" && <>{lib.quickReplies.map((r, k) => item(r, "", () => {}, () => saveLib({ ...lib, quickReplies: lib.quickReplies.filter((y) => y !== r) }), k))}
        <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); if (reply.trim()) { saveLib({ ...lib, quickReplies: [...lib.quickReplies, reply.trim().slice(0, 300)] }); setReply(""); } }}><input value={reply} onChange={(ev) => setReply(ev.target.value)} placeholder="Great work today! 💪" className={inputCls} style={inputStyle} /><Btn type="submit" disabled={!reply.trim()}><Plus className="h-5 w-5" /></Btn></form>
        <p className="px-1 text-[12px]" style={{ color: C.dim }}>Tap one in any chat to start your message with it.</p></>}
    </div>
    {w && <WorkoutBuilder lib={lib} initial={w === "new" ? undefined : w} onClose={() => setW(null)} onSave={(x) => { saveLib({ ...lib, workouts: upsert(lib.workouts, x) }); setW(null); }} />}
    {p && <ProgramBuilder lib={lib} initial={p === "new" ? undefined : p} onClose={() => setP(null)} onSave={(x) => { saveLib({ ...lib, programs: upsert(lib.programs, x) }); setP(null); }} />}
    {e && <OwnExerciseSheet initial={e === "new" ? undefined : e} onClose={() => setE(null)} onSave={(x) => { saveLib({ ...lib, exercises: upsert(lib.exercises, x) }); setE(null); }} onDelete={e === "new" ? undefined : () => { saveLib({ ...lib, exercises: lib.exercises.filter((y) => y.id !== e.id) }); setE(null); }} />}
    {f && <FormBuilder initial={f === "new" ? undefined : f} onClose={() => setF(null)} onSave={(x) => { saveLib({ ...lib, forms: upsert(lib.forms, x) }); setF(null); }} />}
  </div>;
}
const Empty = ({ icon: I, text }: { icon: typeof Users; text: string }) => <Card className="text-center"><I className="mx-auto h-8 w-8" style={{ color: C.dim }} /><p className="mt-2 text-[14px]" style={{ color: C.dim }}>{text}</p></Card>;

function Business({ data, token, reload, say }: { data: TrainerHome; token: string | null; reload: () => void; say: (m: string) => void }) {
  const [edit, setEdit] = useState(false); const [preview, setPreview] = useState(false); const [account, setAccount] = useState(false);
  const [busy, setBusy] = useState(false); const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const { logout, user } = useAuth();
  const go = async (path: string) => { setBusy(true); try { const r = await post<{ url: string }>(token, path, { returnTo: window.location.origin + window.location.pathname }); window.location.href = r.url; } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  const pub: PublicTrainer = { ...data.profile, id: Number(user?.id) || 0, rating: data.reviews.length ? data.reviews.reduce((t, r) => t + r.stars, 0) / data.reviews.length : 0, reviews: data.reviews.length, since: new Date().toISOString(), fromCents: fromCents(data.profile), clients: data.clients.filter((c) => c.status === "active").length };
  return <div>
    <Header title="Business" />
    <Card className="!p-4"><div className="flex items-center gap-3"><Avatar t={data.profile} size={64} />
      <div className="min-w-0 flex-1"><p className="truncate text-[24px] leading-none" style={display}>{data.profile.name || "Your name"}</p><p className="truncate text-[13px]" style={{ color: C.dim }}>{data.profile.headline || "Add a headline"}</p></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><Btn kind="soft" className="!text-[15px]" onClick={() => setEdit(true)} testId="tr-edit-listing">Edit listing</Btn><Btn kind="soft" className="!text-[15px]" onClick={() => setPreview(true)}>Preview</Btn></div></Card>
    <Title>Directory listing</Title>
    <Card className="!p-4" testId="tr-plan">
      {data.listed ? <><p className="flex items-center gap-2 text-[22px] leading-none" style={display}><BadgeCheck className="h-6 w-6" style={{ color: C.lime }} />Live in Arise Fit</p>
        <p className="mt-1 text-[13px]" style={{ color: C.dim }}>Clients can find you, see your prices and ask you to coach them. {data.paidUntil ? `Paid through ${shortDate(data.paidUntil)}.` : ""}</p>
        {data.subscribed && !isNativeApp() && <Btn kind="soft" className="mt-3 w-full !text-[15px]" disabled={busy} onClick={() => go("/trainer/listing/manage")}>Card and billing</Btn>}</>
      : <><p className="text-[22px] leading-none" style={display}>Not listed yet</p>
        <p className="mt-1 text-[14px]" style={{ color: C.steel }}>{money(data.price.cents)} a month to be in the Arise trainer directory and coach clients here. First {data.price.trialDays} days free, cancel any time. You keep 100% of what clients pay you.</p>
        {data.problems.length > 0 && <ul className="mt-3 space-y-1">{data.problems.map((p) => <li key={p} className="text-[13px]" style={{ color: C.orange }}>• {p}</li>)}</ul>}
        {isNativeApp() ? <p className="mt-3 rounded-[10px] p-3 text-[13px]" style={{ background: C.card2, color: C.steel }}>Start your listing plan at arisetodo.com/#/trainer in a web browser. It shows up here right away.</p>
          : <Btn className="mt-3 w-full" disabled={busy || data.problems.length > 0 || !data.payments} onClick={() => go("/trainer/listing/checkout")} testId="tr-start-plan">{data.payments ? `Start ${data.price.trialDays}-day free trial` : "Payments open soon"}</Btn>}</>}
    </Card>
    <Title>Reviews{data.reviews.length ? ` · ${(data.reviews.reduce((t, r) => t + r.stars, 0) / data.reviews.length).toFixed(1)}` : ""}</Title>
    {data.reviews.length ? <div className="space-y-2">{data.reviews.map((r) => <Card key={r.id} className="!p-3.5"><div className="flex items-center gap-2"><Stars value={r.stars} /><span className="text-[13px] font-semibold">{r.name}</span><span className="ml-auto text-[11px]" style={{ color: C.dim }}>{shortDate(r.date)}</span></div>
      {r.text && <p className="mt-1.5 text-[14px]">{r.text}</p>}
      {r.reply ? <p className="mt-2 rounded-[8px] p-2 text-[13px]" style={{ background: C.card2, color: C.steel }}>You: {r.reply}</p> : <button type="button" onClick={() => setReply({ id: r.id, text: "" })} className="mt-2 text-[13px] font-semibold" style={{ color: C.lime }}>Reply</button>}</Card>)}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Clients you've coached can review you in Arise Fit. <Star className="inline h-3.5 w-3.5" /></p>}
    <Title>Account</Title>
    <Card onClick={() => setAccount(true)} className="!p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" style={{ color: C.dim }} /><span className="flex-1 font-semibold">Account & privacy</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Btn kind="danger" className="mt-2 w-full" onClick={() => { logout(); goToSignIn(); }}><LogOut className="h-5 w-5" />Sign out</Btn>
    <p className="mt-6 text-center text-[11px] leading-relaxed" style={{ color: C.dim }}>Clients pay you directly through your own links. Client data comes from Arise Fit only with the client's permission and stops when they stop sharing. Keep it private.</p>
    {edit && <ListingEditor token={token} initial={data.profile} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); say("Listing saved."); }} />}
    {preview && <TrainerPage id={pub.id} preview={{ trainer: pub, reviews: data.reviews }} onClose={() => setPreview(false)} />}
    {account && <Layer><div className="fixed inset-0 z-[90]"><AccountPrivacy onClose={() => setAccount(false)} /></div></Layer>}
    {reply && <Sheet title="Reply to review" onClose={() => setReply(null)}><textarea value={reply.text} onChange={(e) => setReply({ ...reply, text: e.target.value.slice(0, 800) })} rows={5} className="w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} />
      <Btn className="mt-3 w-full" disabled={!reply.text.trim()} onClick={async () => { await post(token, `/reviews/${reply.id}/reply`, { reply: reply.text }); setReply(null); reload(); }}>Post reply</Btn></Sheet>}
  </div>;
}

function ListingEditor({ token, initial, onClose, onSaved }: { token: string | null; initial: TrainerProfile; onClose: () => void; onSaved: () => void }) {
  const [t, setT] = useState<TrainerProfile>(initial);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [cert, setCert] = useState("");
  const set = (p: Partial<TrainerProfile>) => setT({ ...t, ...p });
  const setPrice = (i: number, p: Partial<Price>) => set({ prices: t.prices.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const toggle = <K extends "modes" | "specialties">(k: K, v: string) => set({ [k]: (t[k] as string[]).includes(v) ? (t[k] as string[]).filter((x) => x !== v) : [...(t[k] as string[]), v] } as Partial<TrainerProfile>);
  const save = async () => { setBusy(true); setErr(""); try { await put(token, "/trainer/profile", { profile: cleanTrainer(t) }); onSaved(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const pill = (on: boolean) => (on ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2, color: C.text });
  return <Sheet title="Your listing" onClose={onClose} testId="tr-listing" right={<Btn className="!min-h-10 !px-3 !text-[15px]" disabled={busy} onClick={save} testId="tr-listing-save">Save</Btn>}>
    <div className="space-y-4">
      <div className="flex items-center gap-4"><Avatar t={t} size={84} />
        <label className="flex min-h-11 cursor-pointer items-center rounded-[10px] px-4 text-[15px] font-semibold" style={{ background: C.card2 }}>{t.photo ? "Change photo" : "Add a photo"}
          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) set({ photo: await shrinkImage(f, 480, 0.8) }); }} /></label></div>
      <Field label="Name"><input value={t.name} onChange={(e) => set({ name: e.target.value.slice(0, 60) })} className={inputCls} style={inputStyle} data-testid="tr-l-name" /></Field>
      <Field label="Headline"><input value={t.headline} onChange={(e) => set({ headline: e.target.value.slice(0, 90) })} placeholder="NASM-certified strength coach for busy men" className={inputCls} style={inputStyle} data-testid="tr-l-headline" /></Field>
      <Field label="About you"><textarea value={t.bio} onChange={(e) => set({ bio: e.target.value.slice(0, 2000) })} rows={6} placeholder="Your background, how you coach, who you help best…" className="w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} data-testid="tr-l-bio" /></Field>
      <Field label="How you train"><div className="grid grid-cols-3 gap-2">{MODES.map((m) => <button key={m} type="button" onClick={() => toggle("modes", m)} className="h-12 rounded-[10px] text-[13px] font-semibold" style={pill(t.modes.includes(m))}>{MODE_LABEL[m]}</button>)}</div></Field>
      <Title right={<button type="button" onClick={() => set({ prices: [...t.prices, { id: newId(), label: "", mode: t.modes[0] ?? "remote", cents: 0, per: t.modes[0] === "remote" ? "month" : "session" }] })} className="text-[14px] font-semibold" style={{ color: C.lime }} data-testid="tr-l-add-price">Add price</button>}>Your prices</Title>
      {t.prices.map((p, i) => <Card key={p.id} className="!p-3"><div className="flex gap-2"><input value={p.label} onChange={(e) => setPrice(i, { label: e.target.value.slice(0, 60) })} placeholder="e.g. 1-on-1 session, Monthly online coaching" className="h-11 min-w-0 flex-1 rounded-[10px] px-3 text-[16px] outline-none" style={inputStyle} />
        <button type="button" aria-label="Remove price" onClick={() => set({ prices: t.prices.filter((_, k) => k !== i) })} className="grid h-11 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <select value={p.mode} onChange={(e) => setPrice(i, { mode: e.target.value as Mode })} className="h-11 rounded-[10px] px-2 text-[14px] outline-none" style={inputStyle}>{MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</select>
          <input inputMode="decimal" value={p.cents ? String(p.cents / 100) : ""} onChange={(e) => setPrice(i, { cents: Math.round((Number(e.target.value.replace(/[^\d.]/g, "")) || 0) * 100) })} placeholder="$ price" className="h-11 rounded-[10px] px-3 text-center text-[16px] font-semibold outline-none" style={inputStyle} data-testid={`tr-l-price-${i}`} />
          <select value={p.per} onChange={(e) => setPrice(i, { per: e.target.value as Per })} className="h-11 rounded-[10px] px-2 text-[14px] outline-none" style={inputStyle}>{(Object.keys(PER_LABEL) as Per[]).map((x) => <option key={x} value={x}>per {PER_LABEL[x]}</option>)}</select></div>
        {p.per === "package" && <input inputMode="numeric" value={p.sessions ?? ""} onChange={(e) => setPrice(i, { sessions: Number(e.target.value.replace(/\D/g, "")) || undefined })} placeholder="How many sessions in the package" className="mt-2 h-11 w-full rounded-[10px] px-3 text-[16px] outline-none" style={inputStyle} />}
        <input value={p.note ?? ""} onChange={(e) => setPrice(i, { note: e.target.value.slice(0, 160) })} placeholder="What's included (optional)" className="mt-2 h-10 w-full rounded-[10px] px-3 text-[15px] outline-none" style={inputStyle} /></Card>)}
      <Field label="Specialties"><div className="flex flex-wrap gap-1.5">{SPECIALTIES.map((s) => <button key={s} type="button" onClick={() => toggle("specialties", s)} className="h-9 rounded-full px-3 text-[13px] font-semibold" style={pill(t.specialties.includes(s))}>{s}</button>)}</div></Field>
      <Field label="Certifications"><div className="space-y-1.5">{t.certifications.map((c, i) => <div key={i} className="flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: C.card2 }}><span className="flex-1 text-[15px]">{c}</span><button type="button" aria-label="Remove" onClick={() => set({ certifications: t.certifications.filter((_, k) => k !== i) })} style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>)}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (cert.trim()) { set({ certifications: [...t.certifications, cert.trim().slice(0, 80)] }); setCert(""); } }}><input value={cert} onChange={(e) => setCert(e.target.value)} placeholder="NASM-CPT, CSCS, ACE…" className={inputCls} style={inputStyle} /><Btn type="submit" kind="soft" disabled={!cert.trim()}><Plus className="h-5 w-5" /></Btn></form></div></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Years coaching"><input inputMode="numeric" value={t.years || ""} onChange={(e) => set({ years: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={inputCls} style={inputStyle} /></Field>
        <Field label="Languages"><input value={t.languages.join(", ")} onChange={(e) => set({ languages: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className={inputCls} style={inputStyle} /></Field></div>
      <div className="grid grid-cols-[1fr_7rem_6rem] gap-2"><Field label="City"><input value={t.city} onChange={(e) => set({ city: e.target.value.slice(0, 60) })} className={inputCls} style={inputStyle} /></Field>
        <Field label="State"><select value={t.state} onChange={(e) => set({ state: e.target.value })} className={inputCls} style={inputStyle}><option value="">—</option>{US_STATES.map(([c]) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="ZIP"><input inputMode="numeric" value={t.zip} onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} className={inputCls} style={inputStyle} /></Field></div>
      <Title>Contact and links</Title>
      {([["website", "Website", "yourgym.com"], ["bookingUrl", "Booking link (Calendly, Mindbody…)", "https://"], ["payUrl", "Payment link (Stripe, PayPal, Venmo…)", "https://"], ["instagram", "Instagram", "@handle"], ["email", "Email", "you@email.com"], ["phone", "Phone", "(555) 555-5555"]] as const).map(([k, l, ph]) => <Field key={k} label={l}><input value={t[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<TrainerProfile>)} placeholder={ph} className={inputCls} style={inputStyle} /></Field>)}
      <Field label="Welcome message (sent when you accept a client)"><textarea value={t.welcome} onChange={(e) => set({ welcome: e.target.value.slice(0, 600) })} rows={3} placeholder="Welcome aboard! First, answer your check-in…" className="w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} /></Field>
      <label className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: C.card }}><input type="checkbox" checked={t.accepting} onChange={(e) => set({ accepting: e.target.checked })} className="h-6 w-6 accent-[#ff5a1f]" /><span className="font-semibold">Taking new clients</span></label>
    </div>
    {err && <p className="mt-3 text-[14px]" style={{ color: C.red }}>{err}</p>}
    <Btn className="mt-6 w-full" disabled={busy} onClick={save}>Save listing</Btn>
  </Sheet>;
}
