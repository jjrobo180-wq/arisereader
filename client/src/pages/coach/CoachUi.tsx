// Pieces both apps share: stars, a trainer's photo, the directory, a trainer's page and the chat.
import { useEffect, useMemo, useRef, useState } from "react";
import { Award, BadgeCheck, Camera, ChevronRight, Globe, AtSign, Languages, Mail, MapPin, MessageCircle, Phone, Search, Send, SlidersHorizontal, Star, Users, Video, Dumbbell, Wifi, Calendar, CreditCard } from "lucide-react";
import { MODES, MODE_BLURB, MODE_LABEL, SORT_LABEL, SPECIALTIES, US_STATES, filterTrainers, money, priceText, sortTrainers, type Filter, type Message, type Mode, type PublicTrainer, type Review, type Sort } from "@shared/coach";
import { Btn, C, Card, Chips, Field, Sheet, Title, display, inputCls, inputStyle, stagger } from "../fit/fitUi";
import { coachApi, shrinkImage, usePoll, useMessages, when } from "./coachApi";

export const MODE_ICON: Record<Mode, typeof Users> = { inPerson: Dumbbell, virtual: Video, remote: Wifi };

export function Stars({ value, size = 14, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  return <span className="inline-flex items-center gap-0.5" role={onPick ? "radiogroup" : "img"} aria-label={onPick ? "Stars" : `${value.toFixed(1)} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => { const on = value >= n - 0.25; const half = !on && value >= n - 0.75;
      const s = <Star key={n} style={{ width: size, height: size, color: on || half ? C.orange : "#3a3d42" }} fill={on ? C.orange : half ? "rgba(255,176,32,.45)" : "none"} strokeWidth={1.8} />;
      return onPick ? <button key={n} type="button" role="radio" aria-checked={Math.round(value) === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onPick(n)} className="p-1">{s}</button> : s; })}
  </span>;
}

export function Avatar({ t, size = 64 }: { t: { name: string; photo: string }; size?: number }) {
  const initials = t.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return t.photo
    ? <img src={t.photo} alt="" className="shrink-0 rounded-[14px] object-cover" style={{ width: size, height: size }} />
    : <span className="grid shrink-0 place-items-center rounded-[14px]" style={{ width: size, height: size, background: "linear-gradient(150deg, #ff5a1f, #8a2a07)", ...display, fontSize: size * 0.38, color: "#0b0b0c" }} aria-hidden>{initials}</span>;
}

const place = (t: PublicTrainer) => [t.city, t.state].filter(Boolean).join(", ");

export function TrainerCard({ t, onOpen, k = 0 }: { t: PublicTrainer; onOpen: () => void; k?: number }) {
  return <Card onClick={onOpen} className="!p-3.5" style={stagger(Math.min(k, 10), 0.05)} testId={`coach-trainer-${t.id}`}>
    <div className="flex gap-3">
      <Avatar t={t} size={72} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[22px] leading-none" style={display}>{t.name}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug" style={{ color: C.steel }}>{t.headline}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={{ color: C.dim }}>
          {t.reviews > 0 ? <span className="flex items-center gap-1"><Stars value={t.rating} size={12} /><span className="font-semibold" style={{ color: C.text }}>{t.rating.toFixed(1)}</span>({t.reviews})</span> : <span>New trainer</span>}
          {place(t) && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{place(t)}</span>}
        </div>
      </div>
    </div>
    <div className="mt-2.5 flex items-center gap-1.5">
      {t.modes.map((m) => { const I = MODE_ICON[m]; return <span key={m} className="flex h-7 items-center gap-1 rounded-[8px] px-2 text-[11px] font-semibold" style={{ background: C.card2 }}><I className="h-3.5 w-3.5" style={{ color: C.lime }} />{MODE_LABEL[m]}</span>; })}
      <span className="ml-auto text-right"><span className="block text-[10px] uppercase" style={{ color: C.dim }}>from</span><span className="text-[22px] leading-none" style={display}>{money(t.fromCents)}</span></span>
    </div>
    {!t.accepting && <p className="mt-2 text-[12px] font-semibold" style={{ color: C.orange }}>Waitlist only: not taking new clients right now</p>}
  </Card>;
}

/** Search, filters and sorting over the listed trainers. */
export function Directory({ onOpen, intro }: { onOpen: (t: PublicTrainer) => void; intro?: React.ReactNode }) {
  const { data, err } = usePoll(() => coachApi<{ trainers: PublicTrainer[] }>(null, "/trainers").then((r) => r.trainers), [], 0);
  const [f, setF] = useState<Filter>({});
  const [sort, setSort] = useState<Sort>("best");
  const [more, setMore] = useState(false);
  const shown = useMemo(() => sortTrainers(filterTrainers(data ?? [], f), sort, f), [data, f, sort]);
  const count = [f.state, f.specialty, f.maxCents, f.minStars, f.accepting].filter(Boolean).length;
  return <div data-testid="coach-directory">
    {intro}
    <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.dim }} />
      <input value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Name, specialty, city" className={`${inputCls} pl-10`} style={inputStyle} aria-label="Search trainers" data-testid="coach-search" /></div>
    <div className="mt-3"><Chips label="How you train" value={(f.mode ?? "") as Mode | ""} onChange={(m) => setF({ ...f, mode: m })} items={[{ id: "" as const, label: "Any way" }, ...MODES.map((m) => ({ id: m, label: MODE_LABEL[m] }))]} /></div>
    <div className="mt-2 flex items-center gap-2">
      <button type="button" onClick={() => setMore(true)} className="flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold" style={{ background: count ? C.lime : C.card, color: count ? "#0b0b0c" : C.text }} data-testid="coach-filters"><SlidersHorizontal className="h-4 w-4" />Filters{count ? ` · ${count}` : ""}</button>
      <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="h-10 min-w-0 flex-1 rounded-[10px] px-3 text-[15px] outline-none" style={inputStyle} data-testid="coach-sort">
        {(Object.keys(SORT_LABEL) as Sort[]).map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}</select>
    </div>
    {f.mode && <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>{MODE_BLURB[f.mode]}</p>}
    <p className="mb-2 mt-3 px-1 text-[12px]" style={{ color: C.dim }}>{data ? `${shown.length} ${shown.length === 1 ? "trainer" : "trainers"}` : err || "Loading trainers…"}</p>
    <div className="space-y-2.5">{shown.map((t, k) => <TrainerCard key={t.id} t={t} k={k} onOpen={() => onOpen(t)} />)}</div>
    {data && !shown.length && <Card className="text-center"><p className="text-[22px]" style={display}>No trainers match yet</p><p className="mt-1 text-[14px]" style={{ color: C.dim }}>{data.length ? "Try fewer filters, or Online coaching: those trainers work with anyone, anywhere." : "Trainers are joining now. Check back soon."}</p></Card>}
    {more && <Sheet title="Filters" onClose={() => setMore(false)}>
      <div className="mt-2 space-y-4">
        <Field label="State (for in-person)"><select value={f.state ?? ""} onChange={(e) => setF({ ...f, state: e.target.value })} className={inputCls} style={inputStyle} data-testid="coach-state"><option value="">Anywhere</option>{US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></Field>
        <Field label="Specialty"><select value={f.specialty ?? ""} onChange={(e) => setF({ ...f, specialty: e.target.value })} className={inputCls} style={inputStyle}><option value="">Any specialty</option>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Most I'd pay (per session or month)"><select value={f.maxCents ?? 0} onChange={(e) => setF({ ...f, maxCents: Number(e.target.value) || undefined })} className={inputCls} style={inputStyle}><option value={0}>Any price</option>{[2500, 5000, 7500, 10000, 15000, 20000, 30000].map((c) => <option key={c} value={c}>Up to {money(c)}</option>)}</select></Field>
        <Field label="Rating"><select value={f.minStars ?? 0} onChange={(e) => setF({ ...f, minStars: Number(e.target.value) || undefined })} className={inputCls} style={inputStyle}><option value={0}>Any rating</option><option value={4}>4 stars and up</option><option value={4.5}>4.5 stars and up</option></select></Field>
        <label className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: C.card }}><input type="checkbox" checked={!!f.accepting} onChange={(e) => setF({ ...f, accepting: e.target.checked })} className="h-5 w-5 accent-[#ff5a1f]" /><span className="font-semibold">Taking new clients now</span></label>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2"><Btn kind="soft" onClick={() => setF({ q: f.q, mode: f.mode })}>Clear</Btn><Btn onClick={() => setMore(false)}>Show {shown.length}</Btn></div>
    </Sheet>}
  </div>;
}

const linkRow = (href: string, Icon: typeof Globe, label: string, value: string) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-3" style={{ borderTop: `1px solid ${C.line}`, color: C.text }}>
  <Icon className="h-5 w-5 shrink-0" style={{ color: C.lime }} /><span className="min-w-0 flex-1"><span className="block text-[12px]" style={{ color: C.dim }}>{label}</span><span className="block truncate text-[15px] font-semibold">{value}</span></span><ChevronRight className="h-4 w-4" style={{ color: C.dim }} /></a>;

/** A trainer's full listing: about, prices, contact, reviews. `action` is the button at the bottom. */
export function TrainerPage({ id, onClose, action, preview }: { id: number; onClose: () => void; action?: (t: PublicTrainer) => React.ReactNode; preview?: { trainer: PublicTrainer; reviews: Review[] } }) {
  const { data, err } = usePoll(() => (preview ? Promise.resolve(preview) : coachApi<{ trainer: PublicTrainer; reviews: Review[] }>(null, `/trainers/${id}`)), [id, preview], 0);
  const t = data?.trainer;
  return <Sheet title={t?.name ?? "Trainer"} onClose={onClose} testId="coach-trainer-page">
    {!t ? <p className="mt-10 text-center" style={{ color: C.dim }}>{err || "Loading…"}</p> : <>
      <div className="fit-in flex items-center gap-4"><Avatar t={t} size={96} />
        <div className="min-w-0"><p className="text-[30px] leading-none" style={display}>{t.name}</p><p className="mt-1 text-[14px] leading-snug" style={{ color: C.steel }}>{t.headline}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]" style={{ color: C.dim }}>{t.reviews ? <><Stars value={t.rating} /><b style={{ color: C.text }}>{t.rating.toFixed(1)}</b>· {t.reviews} reviews</> : "New on Arise"}</p></div></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {([[t.years ? `${t.years} yr` : "—", "experience"], [String(t.clients || "—"), "clients now"], [place(t) || "Online", "based in"]] as const).map(([v, l], k) => <Card key={l} className="!px-1 !py-3" style={stagger(k, 0.06, 0.1)}><p className="truncate px-1 text-[20px] leading-none" style={display}>{v}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>{l}</p></Card>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{t.specialties.map((s) => <span key={s} className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: "rgba(255,90,31,.12)", color: C.lime }}>{s}</span>)}</div>
      <Title>About</Title><Card><p className="whitespace-pre-line text-[15px] leading-relaxed">{t.bio}</p>
        {t.languages.length > 0 && <p className="mt-3 flex items-center gap-2 text-[13px]" style={{ color: C.dim }}><Languages className="h-4 w-4" />{t.languages.join(", ")}</p>}</Card>
      <Title>Prices</Title>
      <div className="space-y-2">{t.prices.map((p, k) => { const I = MODE_ICON[p.mode]; return <Card key={p.id} className="flex items-center gap-3 !p-3.5" style={stagger(k, 0.05)}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px]" style={{ background: C.card2 }}><I className="h-5 w-5" style={{ color: C.lime }} /></span>
        <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">{p.label}</p><p className="text-[12px]" style={{ color: C.dim }}>{MODE_LABEL[p.mode]}{p.note ? ` · ${p.note}` : ""}</p></div>
        <p className="text-right text-[20px] leading-tight" style={display}>{priceText(p)}</p></Card>; })}</div>
      <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>You pay the trainer directly. Prices are set by the trainer.</p>
      {t.certifications.length > 0 && <><Title>Certifications</Title><Card className="!p-3"><ul className="space-y-2">{t.certifications.map((c) => <li key={c} className="flex items-center gap-2 text-[15px]"><Award className="h-4 w-4 shrink-0" style={{ color: C.orange }} />{c}</li>)}</ul></Card></>}
      {(t.website || t.instagram || t.bookingUrl || t.payUrl || t.email || t.phone) && <><Title>Contact and links</Title><Card className="!p-0 overflow-hidden">
        <div className="-mt-px">{[
          t.website && linkRow(t.website, Globe, "Website", t.website.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")),
          t.bookingUrl && linkRow(t.bookingUrl, Calendar, "Book a session", t.bookingUrl.replace(/^https:\/\//, "").replace(/\/$/, "")),
          t.payUrl && linkRow(t.payUrl, CreditCard, "Pay the trainer", t.payUrl.replace(/^https:\/\//, "").replace(/\/$/, "")),
          t.instagram && linkRow(`https://instagram.com/${t.instagram}`, AtSign, "Instagram", `@${t.instagram}`),
          t.email && linkRow(`mailto:${t.email}`, Mail, "Email", t.email),
          t.phone && linkRow(`tel:${t.phone.replace(/[^\d+]/g, "")}`, Phone, "Phone", t.phone),
        ]}</div></Card></>}
      <Title>Reviews{t.reviews ? ` · ${t.rating.toFixed(1)}` : ""}</Title>
      {data!.reviews.length ? <div className="space-y-2">{data!.reviews.map((r, k) => <Card key={r.id} className="!p-3.5" style={stagger(Math.min(k, 8), 0.05)}>
        <div className="flex items-center gap-2"><Stars value={r.stars} /><span className="text-[13px] font-semibold">{r.name}</span><span className="flex items-center gap-0.5 text-[11px]" style={{ color: C.dim }}><BadgeCheck className="h-3.5 w-3.5" style={{ color: C.blue }} />Coached client</span><span className="ml-auto text-[11px]" style={{ color: C.dim }}>{new Date(r.date).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span></div>
        {r.text && <p className="mt-2 text-[14px] leading-snug">{r.text}</p>}
        {r.reply && <p className="mt-2 rounded-[10px] p-2.5 text-[13px]" style={{ background: C.card2, color: C.steel }}><b style={{ color: C.text }}>{t.name.split(" ")[0]}:</b> {r.reply}</p>}
      </Card>)}</div> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>No reviews yet. Only people this trainer has coached can leave one.</p>}
      {action && <div className="sticky bottom-0 mt-6 pb-2 pt-3" style={{ background: C.bg }}>{action(t)}</div>}
    </>}
  </Sheet>;
}

/** A conversation with a trainer or client: messages, photos, quick replies. */
export function Chat({ token, linkId, me, other, quick = [], disabled }: { token: string | null; linkId: string; me: number; other: string; quick?: string[]; disabled?: boolean }) {
  const { list, send, err } = useMessages(token, linkId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [list.length]);
  const go = async (body: string, img?: string) => {
    if (!body.trim() && !img) return;
    setBusy(true); setProblem("");
    try { await send(body.trim(), img); setText(""); } catch (e: any) { setProblem(e.message); } finally { setBusy(false); }
  };
  return <div className="flex min-h-[60vh] flex-col" data-testid="coach-chat">
    <div className="flex-1 space-y-2 pb-3">
      {!list.length && <p className="py-10 text-center text-[14px]" style={{ color: C.dim }}>{err || `Messages with ${other} show up here.`}</p>}
      {list.map((m: Message) => { const mine = m.from === me; return <div key={m.id} className={`fit-in flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[80%] rounded-[16px] px-3.5 py-2.5" style={mine ? { background: C.lime, color: "#0b0b0c", borderBottomRightRadius: 4 } : { background: C.card2, borderBottomLeftRadius: 4 }}>
          {m.img && <img src={m.img} alt="" className="mb-1.5 max-h-64 rounded-[10px] object-cover" />}
          {m.body && <p className="whitespace-pre-line text-[15px] leading-snug">{m.body}</p>}
          <p className="mt-1 text-[10px] opacity-60">{when(m.at)}{mine && m.read ? " · Read" : ""}</p>
        </div></div>; })}
      <div ref={end} />
    </div>
    {disabled ? <p className="py-3 text-center text-[13px]" style={{ color: C.dim }}>This coaching has ended.</p> : <div className="sticky bottom-0 pb-[max(8px,env(safe-area-inset-bottom))] pt-2" style={{ background: C.bg }}>
      {quick.length > 0 && <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">{quick.map((q) => <button key={q} type="button" onClick={() => setText(q)} className="h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold" style={{ background: C.card }}>{q.length > 30 ? q.slice(0, 30) + "…" : q}</button>)}</div>}
      {problem && <p className="mb-1 text-[13px]" style={{ color: C.red }}>{problem}</p>}
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void go(text); }}>
        <label className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full" style={{ background: C.card }} aria-label="Send a photo"><Camera className="h-5 w-5" />
          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { await go(text, await shrinkImage(f, 1100)); } catch (er: any) { setProblem(er.message); } } }} /></label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={`Message ${other}`} className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-[22px] px-4 py-3 text-[17px] outline-none" style={inputStyle} aria-label="Message" data-testid="coach-chat-input" />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-40" style={{ background: C.lime, color: "#0b0b0c" }} data-testid="coach-chat-send"><Send className="h-5 w-5" /></button>
      </form>
    </div>}
  </div>;
}

export { MessageCircle };
