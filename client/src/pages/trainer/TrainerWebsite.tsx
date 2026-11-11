// "Your website" in Arise Trainer's Business tab: build, preview and publish a trainer's own site (#/t/<slug>),
// and work the leads its contact form sends in. Server: server/coach.ts. Shapes: shared/coachSite.ts.
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, Globe, Mail, Phone, Send, Share2, Sparkles, Trash2, X } from "lucide-react";
import { LEAD_STATUS, SITE_ACCENTS, SITE_TEMPLATES, emptySite, type Lead, type LeadStatus, type SiteConfig } from "@shared/coachSite";
import type { Review, TrainerProfile } from "@shared/coach";
import { coachApi, post, put, shrinkImage, ago } from "../coach/coachApi";
import { TrainerSiteView, type SiteData } from "../coach/TrainerSite";
import { Btn, C, Card, Field, Layer, Sheet, Title, display, inputCls, inputStyle } from "../fit/fitUi";
import { newId } from "./TrainerBuilder";

type SiteRes = { site: SiteConfig; slug: string; url: string };

/** Shrinks until the photo fits the site's 400 KB-per-photo limit. */
async function sitePhoto(f: File): Promise<string> {
  for (const [max, q] of [[1400, 0.78], [1200, 0.72], [1000, 0.68], [800, 0.62]] as const) {
    const d = await shrinkImage(f, max, q);
    if (d.length <= 400_000) return d;
  }
  throw new Error("That photo is too large. Try another one.");
}

export function WebsiteCard({ token, profile, reviews, say }: { token: string | null; profile: TrainerProfile; reviews: Review[]; say: (m: string) => void }) {
  const [res, setRes] = useState<SiteRes | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [edit, setEdit] = useState(false); const [lead, setLead] = useState<Lead | null>(null); const [all, setAll] = useState(false);
  const [invite, setInvite] = useState("");
  useEffect(() => { coachApi<{ url: string }>(token, "/trainer/invite").then((r) => setInvite(r.url)).catch(() => {}); }, [token]);
  const load = () => { coachApi<SiteRes>(token, "/trainer/site").then(setRes).catch(() => {}); coachApi<{ leads: Lead[] }>(token, "/trainer/leads").then((r) => setLeads(r.leads)).catch(() => {}); };
  useEffect(load, [token]);
  const fresh = leads.filter((l) => l.status === "new").length;
  const share = async () => {
    if (!res) return;
    try { if (navigator.share) { await navigator.share({ title: profile.name, url: res.url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(res.url); say("Link copied."); } catch { say(res.url); }
  };
  const setStatus = async (l: Lead, body: { status?: LeadStatus; remove?: boolean }) => {
    try { const r = await put<{ leads: Lead[] }>(token, `/trainer/leads/${l.id}`, body); setLeads(r.leads); setLead(body.remove ? null : r.leads.find((x) => x.id === l.id) ?? null); } catch (e: any) { say(e.message); }
  };
  const live = !!res?.site.published;
  const shown = all ? leads : leads.slice(0, 4);
  return <>
    <Title>Your website</Title>
    <Card className="!p-4" testId="tr-website">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: live ? C.lime : C.card2, color: live ? "var(--fit-on-accent)" : C.dim }}><Globe className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[22px] leading-none" style={display}>{live ? "Your site is live" : "Get your own website"}</p>
          <p className="mt-1 text-[13px]" style={{ color: C.dim }}>{live ? <span className="break-all">{res!.url.replace(/^https?:\/\//, "")}</span> : "A real site with your bio, services, reviews and a contact form. Free, no web designer, ready in minutes."}</p>
        </div>
      </div>
      {live ? <div className="mt-3 grid grid-cols-3 gap-2">
        <Btn kind="soft" className="!px-2 !text-[14px]" onClick={() => setEdit(true)} testId="tr-site-edit">Edit</Btn>
        <Btn kind="soft" className="!px-2 !text-[14px]" onClick={() => window.open(res!.url, "_blank")}><ExternalLink className="h-4 w-4" />Open</Btn>
        <Btn kind="soft" className="!px-2 !text-[14px]" onClick={share}><Share2 className="h-4 w-4" />Share</Btn>
      </div> : <Btn className="mt-3 w-full" disabled={!res} onClick={() => setEdit(true)} testId="tr-site-build">Build my website</Btn>}
    </Card>

    <Title right={leads.length > 4 ? <button type="button" onClick={() => setAll(!all)} className="text-[14px] font-semibold" style={{ color: C.lime }}>{all ? "Fewer" : `All ${leads.length}`}</button> : undefined}>Leads{fresh ? ` · ${fresh} new` : ""}</Title>
    {leads.length ? <div className="space-y-2" data-testid="tr-leads">{shown.map((l) => <Card key={l.id} onClick={() => setLead(l)} className="!p-3.5">
      <div className="flex items-center gap-2">
        {l.status === "new" && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: C.lime }} />}
        <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: C.card2, color: C.steel }}>{LEAD_STATUS.find((s) => s.id === l.status)?.label}</span>
        <span className="shrink-0 text-[11px]" style={{ color: C.dim }}>{ago(l.at)}</span>
      </div>
      {(l.goal || l.message) && <p className="mt-1 line-clamp-2 text-[13px]" style={{ color: C.steel }}>{[l.goal, l.message].filter(Boolean).join(" · ")}</p>}
    </Card>)}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>{live ? "When someone fills in your site's contact form, they show up here and you get a notification." : "Publish your site and people who reach out show up here."}</p>}

    {edit && res && <SiteEditor token={token} initial={res} profile={profile} reviews={reviews} say={say} onClose={() => setEdit(false)} onSaved={(r) => { setRes(r); setEdit(false); say(r.site.published ? "Your site is live." : "Saved. Your site is hidden."); }} />}
    {lead && <LeadSheet lead={lead} invite={invite} onClose={() => setLead(null)} onStatus={(s) => setStatus(lead, { status: s })} onRemove={() => setStatus(lead, { remove: true })} />}
  </>;
}

function LeadSheet({ lead: l, invite, onClose, onStatus, onRemove }: { lead: Lead; invite: string; onClose: () => void; onStatus: (s: LeadStatus) => void; onRemove: () => void }) {
  const first = l.name.split(" ")[0];
  return <Sheet title={l.name} onClose={onClose} testId="tr-lead">
    <p className="text-[13px]" style={{ color: C.dim }}>{l.source === "import" ? "Imported" : `From your ${l.source === "site" ? "website" : "marketplace"}`} · {new Date(l.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
    {l.goal && <p className="mt-3 text-[15px]"><span style={{ color: C.dim }}>Goal: </span><b>{l.goal}</b></p>}
    {l.message && <p className="mt-3 whitespace-pre-wrap rounded-[12px] p-3 text-[16px] leading-relaxed" style={{ background: C.card2 }}>{l.message}</p>}
    <div className="mt-4 grid gap-2">
      {l.email && <a href={`mailto:${l.email}?subject=${encodeURIComponent(`Training with me`)}&body=${encodeURIComponent(`Hi ${first},\n\nThanks for reaching out! `)}`} onClick={() => l.status === "new" && onStatus("contacted")} className="flex min-h-12 items-center gap-3 rounded-[12px] px-4 font-semibold" style={{ background: C.card }}><Mail className="h-5 w-5" style={{ color: C.lime }} /><span className="min-w-0 flex-1 truncate">{l.email}</span></a>}
      {l.phone && <div className="flex min-h-12 items-center gap-3 rounded-[12px] px-4 font-semibold" style={{ background: C.card }}><Phone className="h-5 w-5" style={{ color: C.lime }} />
        <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} onClick={() => l.status === "new" && onStatus("contacted")} className="flex-1 py-3">{l.phone}</a>
        <a href={`sms:${l.phone.replace(/[^\d+]/g, "")}`} onClick={() => l.status === "new" && onStatus("contacted")} className="py-3 text-[14px]" style={{ color: C.lime }}>Text</a></div>}
    </div>
    <Title>Status</Title>
    <div className="grid grid-cols-2 gap-2">{LEAD_STATUS.map((s) => <button key={s.id} type="button" onClick={() => onStatus(s.id)} className="flex h-12 items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-semibold" style={l.status === s.id ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2, color: C.text }} data-testid={`tr-lead-${s.id}`}>{l.status === s.id && <Check className="h-4 w-4" />}{s.label}</button>)}</div>
    {(l.email || l.phone) && <Btn kind="soft" className="mt-3 w-full !text-[15px]" disabled={!invite} onClick={() => {
      const msg = `Hi ${first}! Here's how we get started: tap this to join me in the Cooked app. Your plan and our chat live there. ${invite}`;
      if (l.status === "new") onStatus("contacted");
      window.location.href = l.phone ? `sms:${l.phone.replace(/[^\d+]/g, "")}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(msg)}` : `mailto:${l.email}?subject=${encodeURIComponent("Getting started")}&body=${encodeURIComponent(msg)}`;
    }} testId="tr-lead-invite"><Send className="h-4 w-4" />{l.phone ? "Text" : "Email"} {first} my invite link</Btn>}
    <p className="mt-2 text-[13px]" style={{ color: C.dim }}>When {first} opens it, they join you in Cooked and show up in Clients.</p>
    <Btn kind="danger" className="mt-5 w-full" onClick={onRemove}><Trash2 className="h-4 w-4" />Delete lead</Btn>
  </Sheet>;
}

function SiteEditor({ token, initial, profile, reviews, say, onClose, onSaved }: { token: string | null; initial: SiteRes; profile: TrainerProfile; reviews: Review[]; say: (m: string) => void; onClose: () => void; onSaved: (r: SiteRes) => void }) {
  const [s, setS] = useState<SiteConfig>({ ...emptySite(), ...initial.site });
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [preview, setPreview] = useState(false);
  const set = (p: Partial<SiteConfig>) => setS((x) => ({ ...x, ...p }));
  const save = async (published = s.published) => {
    setBusy("save"); setErr("");
    try { const r = await put<{ site: SiteConfig; url: string }>(token, "/trainer/site", { site: { ...s, published } }); onSaved({ ...initial, site: r.site, url: r.url }); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  };
  const ai = async () => {
    setBusy("ai"); setErr("");
    try { const r = await post<{ draft: Partial<SiteConfig> }>(token, "/trainer/site/ai", {}); set(r.draft); say("Draft written. Read it over and make it yours."); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files) return; setBusy("photo"); setErr("");
    try { const add: string[] = []; for (const f of Array.from(files).slice(0, 8 - s.photos.length)) add.push(await sitePhoto(f)); set({ photos: [...s.photos, ...add].slice(0, 8) }); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  };
  const move = <T,>(list: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return list; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; return n; };
  const data: SiteData = { site: s, slug: initial.slug, invite: "preview", reviews: s.showReviews ? reviews.slice(0, 12) : [],
    trainer: { id: 0, name: profile.name || "Your name", headline: profile.headline, bio: profile.bio, photo: profile.photo, specialties: profile.specialties, certifications: profile.certifications, years: profile.years, languages: profile.languages, city: profile.city, state: profile.state, modes: profile.modes, prices: s.showPrices ? profile.prices : [], instagram: profile.instagram, bookingUrl: profile.bookingUrl, accepting: profile.accepting } };
  const area = "w-full rounded-[12px] p-3 text-[17px] outline-none";
  return <Sheet title="Your website" onClose={onClose} testId="tr-site-editor" right={<Btn kind="soft" className="!min-h-10 !px-3 !text-[15px]" onClick={() => setPreview(true)} testId="tr-site-preview"><Eye className="h-4 w-4" />Preview</Btn>}>
    <div className="space-y-4">
      {!profile.name && <p className="rounded-[12px] p-3 text-[14px]" style={{ background: C.card2, color: C.orange }}>Add your name and photo in Edit listing first. Your site uses them.</p>}
      <button type="button" onClick={ai} disabled={!!busy} className="flex w-full items-center gap-3 rounded-[14px] p-4 text-left disabled:opacity-60" style={{ background: "linear-gradient(150deg, var(--fit-accent), var(--fit-accent-deep))", color: "var(--fit-on-accent)" }} data-testid="tr-site-ai">
        <Sparkles className="h-6 w-6 shrink-0" /><span className="flex-1"><b className="block text-[16px]">{busy === "ai" ? "Writing…" : "Write it with AI"}</b><span className="text-[13px] opacity-85">Uses your listing. Nothing made up, edit anything after.</span></span></button>

      <Field label="Look"><div className="grid grid-cols-2 gap-2">{SITE_TEMPLATES.map((t) => <button key={t.id} type="button" onClick={() => set({ template: t.id })} className="rounded-[12px] p-3 text-left" style={s.template === t.id ? { background: C.card2, boxShadow: `inset 0 0 0 2px ${C.lime}` } : { background: C.card2 }} data-testid={`tr-site-look-${t.id}`}>
        <Swatch look={t.id} accent={s.accent} /><b className="mt-2 block text-[15px]">{t.name}</b><span className="text-[12px] leading-tight" style={{ color: C.dim }}>{t.blurb}</span></button>)}</div></Field>
      <Field label="Color"><div className="flex flex-wrap gap-2">{SITE_ACCENTS.map((a) => <button key={a} type="button" aria-label={`Color ${a}`} onClick={() => set({ accent: a })} className="grid h-10 w-10 place-items-center rounded-full" style={{ background: a, boxShadow: s.accent === a ? `0 0 0 3px var(--fit-bg, #000), 0 0 0 5px ${a}` : undefined }}>{s.accent === a && <Check className="h-5 w-5 text-white" />}</button>)}</div></Field>

      <Field label="Headline"><input value={s.heroTitle} onChange={(e) => set({ heroTitle: e.target.value.slice(0, 90) })} placeholder={profile.headline || "Get strong without living in the gym"} className={inputCls} style={inputStyle} data-testid="tr-site-title" /></Field>
      <Field label="Under the headline"><input value={s.heroSub} onChange={(e) => set({ heroSub: e.target.value.slice(0, 220) })} placeholder="Coaching for busy parents in Denver and online" className={inputCls} style={inputStyle} /></Field>
      <Field label="Main button"><input value={s.cta} onChange={(e) => set({ cta: e.target.value.slice(0, 40) })} placeholder="Book a free consult" className={inputCls} style={inputStyle} /></Field>
      <Field label="About (leave empty to use your listing bio)"><textarea value={s.about} onChange={(e) => set({ about: e.target.value.slice(0, 3000) })} rows={6} placeholder={profile.bio ? profile.bio.slice(0, 140) + "…" : "Your story, how you coach, who you help best"} className={area} style={inputStyle} /></Field>

      <Title right={s.photos.length < 8 ? <label className="cursor-pointer text-[14px] font-semibold" style={{ color: C.lime }}>{busy === "photo" ? "Adding…" : "Add photos"}<input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const f = e.target.files; addPhotos(f); e.target.value = ""; }} data-testid="tr-site-photos" /></label> : undefined}>Photos</Title>
      {s.photos.length ? <div className="grid grid-cols-3 gap-2">{s.photos.map((p, i) => <div key={i} className="relative">
        <img src={p} alt="" className="aspect-square w-full rounded-[10px] object-cover" />
        {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
        <div className="absolute bottom-1 right-1 flex gap-1">
          {i > 0 && <button type="button" aria-label="Make cover" onClick={() => set({ photos: move(s.photos, i, -i) })} className="grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"><ArrowUp className="h-3.5 w-3.5" /></button>}
          <button type="button" aria-label="Remove photo" onClick={() => set({ photos: s.photos.filter((_, k) => k !== i) })} className="grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"><X className="h-3.5 w-3.5" /></button></div></div>)}</div>
        : <p className="text-[13px]" style={{ color: C.dim }}>The first photo is your cover. Without photos, your listing photo is used.</p>}

      <Title right={s.services.length < 8 ? <button type="button" onClick={() => set({ services: [...s.services, { id: newId(), title: "", text: "", price: "" }] })} className="text-[14px] font-semibold" style={{ color: C.lime }} data-testid="tr-site-add-service">Add</button> : undefined}>Services</Title>
      {!s.services.length && <p className="text-[13px]" style={{ color: C.dim }}>Leave empty to show the prices from your listing.</p>}
      {s.services.map((x, i) => <Card key={x.id} className="!p-3">
        <div className="flex gap-1.5"><input value={x.title} onChange={(e) => set({ services: s.services.map((y, k) => (k === i ? { ...y, title: e.target.value.slice(0, 60) } : y)) })} placeholder="1-on-1 training" className="h-11 min-w-0 flex-1 rounded-[10px] px-3 text-[16px] font-semibold outline-none" style={inputStyle} />
          <IconBtn label="Move up" onClick={() => set({ services: move(s.services, i, -1) })}><ArrowUp className="h-4 w-4" /></IconBtn><IconBtn label="Move down" onClick={() => set({ services: move(s.services, i, 1) })}><ArrowDown className="h-4 w-4" /></IconBtn>
          <IconBtn label="Remove" onClick={() => set({ services: s.services.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></IconBtn></div>
        <textarea value={x.text} onChange={(e) => set({ services: s.services.map((y, k) => (k === i ? { ...y, text: e.target.value.slice(0, 400) } : y)) })} rows={2} placeholder="What's included" className="mt-2 w-full rounded-[10px] p-3 text-[15px] outline-none" style={inputStyle} />
        <input value={x.price} onChange={(e) => set({ services: s.services.map((y, k) => (k === i ? { ...y, price: e.target.value.slice(0, 40) } : y)) })} placeholder="$80 a session (optional)" className="mt-2 h-10 w-full rounded-[10px] px-3 text-[15px] outline-none" style={inputStyle} /></Card>)}

      <Title right={s.faqs.length < 10 ? <button type="button" onClick={() => set({ faqs: [...s.faqs, { id: newId(), q: "", a: "" }] })} className="text-[14px] font-semibold" style={{ color: C.lime }}>Add</button> : undefined}>Questions people ask</Title>
      {s.faqs.map((x, i) => <Card key={x.id} className="!p-3">
        <div className="flex gap-1.5"><input value={x.q} onChange={(e) => set({ faqs: s.faqs.map((y, k) => (k === i ? { ...y, q: e.target.value.slice(0, 160) } : y)) })} placeholder="Do I need a gym membership?" className="h-11 min-w-0 flex-1 rounded-[10px] px-3 text-[16px] font-semibold outline-none" style={inputStyle} />
          <IconBtn label="Remove" onClick={() => set({ faqs: s.faqs.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></IconBtn></div>
        <textarea value={x.a} onChange={(e) => set({ faqs: s.faqs.map((y, k) => (k === i ? { ...y, a: e.target.value.slice(0, 800) } : y)) })} rows={2} placeholder="Answer" className="mt-2 w-full rounded-[10px] p-3 text-[15px] outline-none" style={inputStyle} /></Card>)}

      <div className="space-y-2">
        <Toggle on={s.showReviews} onChange={(v) => set({ showReviews: v })} label="Show client reviews" sub={reviews.length ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "None yet"} />
        <Toggle on={s.showPrices} onChange={(v) => set({ showPrices: v })} label="Show listing prices" sub="When you haven't added services" />
      </div>
    </div>
    {err && <p className="mt-3 text-[14px]" style={{ color: C.red }} data-testid="tr-site-err">{err}</p>}
    <div className="mt-6 grid gap-2">
      {s.published ? <><Btn disabled={!!busy} onClick={() => save(true)} testId="tr-site-save">{busy === "save" ? "Saving…" : "Save changes"}</Btn><Btn kind="ghost" disabled={!!busy} onClick={() => save(false)}>Take my site down</Btn></>
        : <><Btn disabled={!!busy || !profile.name} onClick={() => save(true)} testId="tr-site-publish">{busy === "save" ? "Publishing…" : "Publish my site"}</Btn><Btn kind="ghost" disabled={!!busy} onClick={() => save(false)}>Save without publishing</Btn></>}
      <p className="text-center text-[12px]" style={{ color: C.dim }}>Your address: {initial.url.replace(/^https?:\/\//, "")}</p>
    </div>
    {preview && <Layer><div className="fixed inset-0 z-[95] overflow-y-auto bg-white" data-testid="tr-site-preview-layer">
      <button type="button" onClick={() => setPreview(false)} className="fixed right-3 z-[96] flex h-11 items-center gap-1.5 rounded-full bg-black/85 px-4 text-[15px] font-semibold text-white shadow-lg" style={{ top: "calc(env(safe-area-inset-top, 0px) + 64px)" }}><X className="h-4 w-4" />Close preview</button>
      <TrainerSiteView data={data} preview /></div></Layer>}
  </Sheet>;
}

const IconBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => <button type="button" aria-label={label} onClick={onClick} className="grid h-11 w-9 shrink-0 place-items-center rounded-[10px]" style={{ color: C.dim }}>{children}</button>;
const Toggle = ({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub: string }) => <label className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: C.card }}>
  <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-6 w-6 accent-[var(--fit-accent)]" /><span className="flex-1"><b className="block text-[15px]">{label}</b><span className="text-[12px]" style={{ color: C.dim }}>{sub}</span></span></label>;

/** A tiny drawing of each look, so trainers can pick without previewing. */
function Swatch({ look, accent }: { look: SiteConfig["template"]; accent: string }) {
  const bg = { bold: "#0b0b0d", clean: "#ffffff", studio: "#3f3f46", warm: "#fbf6ef" }[look];
  const ink = look === "bold" || look === "studio" ? "#fff" : "#1f2937";
  return <div className="h-16 overflow-hidden rounded-[8px] p-2" style={{ background: bg, border: "1px solid rgba(127,127,127,.25)" }}>
    <div className="h-2 w-3/4" style={{ background: ink, borderRadius: look === "studio" ? 4 : look === "clean" ? 0 : 2, opacity: look === "clean" ? 0.85 : 1 }} />
    <div className="mt-1 h-1.5 w-1/2 rounded-full" style={{ background: ink, opacity: 0.4 }} />
    <div className="mt-2.5 h-3.5 w-10" style={{ background: accent, borderRadius: look === "clean" ? 2 : look === "studio" || look === "warm" ? 8 : 3 }} />
  </div>;
}
