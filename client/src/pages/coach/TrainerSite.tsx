// A trainer's own website (#/t/<slug>): built by Cooked Trainer from their listing and site settings (shared/coachSite.ts).
// Four looks. The contact form sends a lead to the trainer's app; "Start training" opens their Cooked invite.
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useParams } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { MODE_LABEL, priceText, type Mode, type Price, type Review } from "@shared/coach";
import type { SiteConfig } from "@shared/coachSite";

export type SiteData = {
  site: SiteConfig; slug: string; invite: string; reviews: Review[];
  trainer: { id: number; name: string; headline: string; bio: string; photo: string; specialties: string[]; certifications: string[]; years: number; languages: string[]; city: string; state: string; modes: Mode[]; prices: Price[]; instagram: string; bookingUrl: string; accepting: boolean };
};

type Look = { bg: string; ink: string; muted: string; card: string; line: string; head: CSSProperties; body: CSSProperties; upper: boolean; radius: number; heroDark: boolean };
const LOOKS: Record<SiteConfig["template"], Look> = {
  bold: { bg: "#0b0b0d", ink: "#f5f5f4", muted: "#a8a29e", card: "#17171a", line: "#2a2a2e", head: { fontFamily: "'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif", letterSpacing: ".01em", fontWeight: 400 }, body: { fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }, upper: true, radius: 14, heroDark: true },
  clean: { bg: "#ffffff", ink: "#111827", muted: "#6b7280", card: "#f8fafc", line: "#e5e7eb", head: { fontFamily: "'Playfair Display',Georgia,'Times New Roman',serif", fontWeight: 600, letterSpacing: "-.01em" }, body: { fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }, upper: false, radius: 6, heroDark: false },
  studio: { bg: "#f4f4f5", ink: "#18181b", muted: "#71717a", card: "#ffffff", line: "#e4e4e7", head: { fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif", fontWeight: 800, letterSpacing: "-.03em" }, body: { fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }, upper: false, radius: 22, heroDark: true },
  warm: { bg: "#fbf6ef", ink: "#2b2118", muted: "#7c6a58", card: "#ffffff", line: "#eadfce", head: { fontFamily: "'Fraunces',Georgia,serif", fontWeight: 600 }, body: { fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }, upper: false, radius: 18, heroDark: false },
};
const FONTS = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap";
function useSiteFonts() {
  useEffect(() => {
    if (document.getElementById("arise-site-fonts")) return;
    const l = document.createElement("link"); l.id = "arise-site-fonts"; l.rel = "stylesheet"; l.href = FONTS; document.head.appendChild(l);
  }, []);
}
const stars = (n: number) => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));

export default function TrainerSitePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<SiteData | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`${API_BASE}/api/coach/site/${encodeURIComponent(slug ?? "")}`).then(async (r) => { const b = await r.json().catch(() => null); if (!r.ok) throw new Error(b?.message || "This site isn't available."); setData(b); }).catch((e) => setErr(e.message));
  }, [slug]);
  useEffect(() => { if (data) document.title = `${data.trainer.name}${data.trainer.headline ? ` · ${data.trainer.headline}` : ""}`; }, [data]);
  if (!data) return <div className="grid min-h-screen place-items-center bg-white p-6 text-center text-slate-500">{err || "Loading…"}</div>;
  return <TrainerSiteView data={data} />;
}

/** The site itself, also used for the live preview in Cooked Trainer (`preview` turns the form off). */
export function TrainerSiteView({ data, preview }: { data: SiteData; preview?: boolean }) {
  const { site, trainer: t, reviews } = data;
  useSiteFonts();
  const L = LOOKS[site.template];
  const a = site.accent;
  const H = (s: string) => (L.upper ? s.toUpperCase() : s);
  const where = [t.city, t.state].filter(Boolean).join(", ");
  const rating = reviews.length ? reviews.reduce((x, r) => x + r.stars, 0) / reviews.length : 0;
  const join = `#/fit?coach=${data.invite}`;
  const about = site.about || t.bio;
  const services = site.services.length ? site.services : t.prices.map((p) => ({ id: p.id, title: p.label || MODE_LABEL[p.mode], text: p.note ?? "", price: priceText(p) }));
  const hero = site.photos[0] || t.photo;
  const go = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
  const btn: CSSProperties = { background: a, color: "#fff", borderRadius: L.radius, ...L.body };
  const section = "mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20";
  const h2 = (s: string) => <h2 className="mb-6 text-[30px] leading-[1.05] sm:text-[42px]" style={{ ...L.head, color: L.ink }}>{H(s)}</h2>;
  const dark = L.heroDark && !!hero;
  return <div style={{ background: L.bg, color: L.ink, ...L.body }} className="min-h-screen" data-testid="trainer-site">
    {/* Top bar */}
    <header className="sticky top-0 z-20 border-b backdrop-blur" style={{ borderColor: L.line, background: `color-mix(in srgb, ${L.bg} 88%, transparent)` }}>
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3 sm:px-8">
        <span className="min-w-0 flex-1 truncate text-[22px] leading-none" style={L.head}>{H(t.name)}</span>
        <a href="#contact" onClick={go("contact")} className="shrink-0 px-4 py-2.5 text-[14px] font-semibold" style={btn}>{site.cta}</a>
      </div>
    </header>

    {/* Hero */}
    <section className="relative overflow-hidden" style={dark ? { background: "#000" } : undefined}>
      {dark && <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />}
      {dark && <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.75))" }} />}
      <div className={`relative mx-auto grid max-w-5xl items-center gap-8 px-5 sm:px-8 ${dark ? "min-h-[78vh] py-20" : "py-16 sm:grid-cols-[1.2fr_1fr] sm:py-24"}`}>
        <div style={dark ? { color: "#fff" } : undefined}>
          {where && <p className="mb-3 text-[13px] font-semibold uppercase tracking-[.18em]" style={{ color: dark ? "rgba(255,255,255,.75)" : a }}>{where}{t.modes.some((m) => MODE_LABEL[m]) ? ` · ${t.modes.map((m) => MODE_LABEL[m]).filter(Boolean).join(" · ")}` : ""}</p>}
          <h1 className="text-[46px] leading-[.98] sm:text-[72px]" style={L.head}>{H(site.heroTitle || t.headline || t.name)}</h1>
          {(site.heroSub || (site.heroTitle && t.headline)) && <p className="mt-4 max-w-xl text-[18px] leading-relaxed" style={{ color: dark ? "rgba(255,255,255,.85)" : L.muted }}>{site.heroSub || t.headline}</p>}
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#contact" onClick={go("contact")} className="px-6 py-3.5 text-[16px] font-semibold" style={btn}>{site.cta}</a>
            {t.accepting && <a href={join} className="px-6 py-3.5 text-[16px] font-semibold" style={{ borderRadius: L.radius, border: `1.5px solid ${dark ? "rgba(255,255,255,.6)" : L.ink}`, color: dark ? "#fff" : L.ink }} data-testid="site-join">Start training with me</a>}
          </div>
          {rating > 0 && <p className="mt-5 text-[14px]" style={{ color: dark ? "rgba(255,255,255,.8)" : L.muted }}><span style={{ color: "#f59e0b" }}>{stars(rating)}</span> {rating.toFixed(1)} from {reviews.length} client review{reviews.length === 1 ? "" : "s"}</p>}
        </div>
        {!dark && hero && <img src={hero} alt={t.name} className="aspect-[4/5] w-full object-cover shadow-xl" style={{ borderRadius: L.radius * 1.5 }} />}
      </div>
    </section>

    {/* Specialties */}
    {t.specialties.length > 0 && <div className="border-y" style={{ borderColor: L.line, background: L.card }}><div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-5 py-5 sm:px-8">{t.specialties.map((s) => <span key={s} className="px-3.5 py-1.5 text-[13px] font-semibold" style={{ borderRadius: 999, background: `color-mix(in srgb, ${a} 14%, transparent)`, color: L.ink }}>{s}</span>)}</div></div>}

    {/* About */}
    {about && <section id="about" className={section}>
      <div className="grid gap-10 sm:grid-cols-[1fr_1.4fr]">
        <div>{h2(`About ${t.name.split(" ")[0]}`)}
          <dl className="space-y-3 text-[15px]">
            {t.years > 0 && <div><dt style={{ color: L.muted }}>Coaching for</dt><dd className="font-semibold">{t.years} year{t.years === 1 ? "" : "s"}</dd></div>}
            {t.certifications.length > 0 && <div><dt style={{ color: L.muted }}>Certifications</dt><dd className="font-semibold">{t.certifications.join(" · ")}</dd></div>}
            {t.languages.length > 0 && <div><dt style={{ color: L.muted }}>Languages</dt><dd className="font-semibold">{t.languages.join(", ")}</dd></div>}
          </dl></div>
        <div className="space-y-4 text-[17px] leading-relaxed" style={{ color: L.ink }}>{about.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
      </div>
    </section>}

    {/* Services */}
    {services.length > 0 && <section id="services" className="border-t" style={{ borderColor: L.line, background: L.card }}><div className={section}>
      {h2("How we can work together")}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.map((s) => <article key={s.id} className="flex flex-col p-6" style={{ background: L.bg, borderRadius: L.radius, border: `1px solid ${L.line}` }}>
        <h3 className="text-[22px] leading-tight" style={L.head}>{H(s.title)}</h3>
        {s.text && <p className="mt-2 flex-1 text-[15px] leading-relaxed" style={{ color: L.muted }}>{s.text}</p>}
        {s.price && <p className="mt-4 text-[17px] font-bold" style={{ color: a }}>{s.price}</p>}
      </article>)}</div>
    </div></section>}

    {/* How it works */}
    <section className={section}>
      {h2("How it works")}
      <ol className="grid gap-4 sm:grid-cols-3">{[["Talk", "A free consult about your goals, your schedule and anything holding you back."], ["Get your plan", "Workouts, nutrition targets and habits made for you, in the Cooked app."], ["Train and track", `${t.name.split(" ")[0]} sees your progress and adjusts every week. You're never guessing.`]].map(([h, p], i) => <li key={h} className="p-6" style={{ background: L.card, borderRadius: L.radius, border: `1px solid ${L.line}` }}>
        <span className="grid h-10 w-10 place-items-center text-[18px] font-bold text-white" style={{ background: a, borderRadius: 999 }}>{i + 1}</span>
        <h3 className="mt-4 text-[22px]" style={L.head}>{H(h)}</h3><p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: L.muted }}>{p}</p></li>)}</ol>
    </section>

    {/* Photos */}
    {site.photos.length > 1 && <section className="pb-6"><div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-5 sm:grid-cols-3 sm:px-8">{site.photos.slice(1).map((p, i) => <img key={i} src={p} alt="" className="aspect-square w-full object-cover" style={{ borderRadius: L.radius }} loading="lazy" />)}</div></section>}

    {/* Reviews */}
    {reviews.length > 0 && <section className={section}>
      {h2("What clients say")}
      <div className="grid gap-4 sm:grid-cols-2">{reviews.slice(0, 6).map((r) => <figure key={r.id} className="m-0 p-6" style={{ background: L.card, borderRadius: L.radius, border: `1px solid ${L.line}` }}>
        <p style={{ color: "#f59e0b" }}>{stars(r.stars)}</p>{r.text && <blockquote className="mt-2 text-[16px] leading-relaxed">{r.text}</blockquote>}<figcaption className="mt-3 text-[14px] font-semibold" style={{ color: L.muted }}>{r.name}</figcaption></figure>)}</div>
    </section>}

    {/* FAQ */}
    {site.faqs.length > 0 && <section className="border-t" style={{ borderColor: L.line }}><div className={section}>
      {h2("Questions")}
      <div className="divide-y" style={{ borderColor: L.line }}>{site.faqs.map((f) => <details key={f.id} className="group py-4" style={{ borderColor: L.line }}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-semibold">{f.q}<span className="text-[22px] transition group-open:rotate-45" style={{ color: a }}>+</span></summary>{f.a && <p className="mt-2 text-[16px] leading-relaxed" style={{ color: L.muted }}>{f.a}</p>}</details>)}</div>
    </div></section>}

    <Contact data={data} look={L} preview={preview} />

    <footer className="border-t" style={{ borderColor: L.line }}><div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 text-[14px] sm:px-8" style={{ color: L.muted }}>
      <span className="font-semibold" style={{ color: L.ink }}>{t.name}</span>{where && <span>{where}</span>}
      {t.instagram && <a href={`https://instagram.com/${t.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">Instagram {t.instagram.startsWith("@") ? t.instagram : `@${t.instagram}`}</a>}
      <span className="ml-auto text-[12px]">Built with Cooked Trainer</span>
    </div></footer>
  </div>;
}

const GOALS = ["Lose fat", "Build muscle", "Get stronger", "Get started", "Sport performance", "Feel better / move better", "Something else"];
function Contact({ data, look: L, preview }: { data: SiteData; look: Look; preview?: boolean }) {
  const { site, trainer: t } = data;
  const [f, setF] = useState({ name: "", email: "", phone: "", goal: "", message: "", website: "" });
  const [state, setState] = useState<"" | "sending" | "sent">(""); const [err, setErr] = useState("");
  const send = async (e: FormEvent) => {
    e.preventDefault(); if (preview) return;
    setState("sending"); setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/coach/site/${encodeURIComponent(data.slug)}/lead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const b = await r.json().catch(() => null);
      if (!r.ok) throw new Error(b?.message || "That didn't send. Try again.");
      setState("sent");
    } catch (x: any) { setErr(x.message); setState(""); }
  };
  const field: CSSProperties = { background: L.card, border: `1px solid ${L.line}`, borderRadius: Math.min(L.radius, 12), color: L.ink };
  const cls = "w-full px-4 py-3.5 text-[16px] outline-none";
  const first = t.name.split(" ")[0];
  return <section id="contact" style={{ background: site.accent, color: "#fff" }}>
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:grid-cols-2 sm:px-8 sm:py-20">
      <div><h2 className="text-[38px] leading-[1.02] sm:text-[52px]" style={L.head}>{L.upper ? `TRAIN WITH ${first.toUpperCase()}` : `Train with ${first}`}</h2>
        <p className="mt-3 max-w-md text-[17px] leading-relaxed opacity-90">{t.accepting ? `Tell ${first} a little about you and your goals. You'll hear back soon, usually within a day.` : `${first} is full right now. Leave your details to hear when a spot opens.`}</p>
        {t.bookingUrl && <a href={t.bookingUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-full bg-white px-5 py-3 text-[15px] font-semibold" style={{ color: site.accent }}>Book a time</a>}</div>
      {state === "sent" ? <div className="grid place-items-center rounded-2xl bg-white/15 p-8 text-center" data-testid="site-sent"><div><p className="text-[28px]" style={L.head}>{L.upper ? "SENT!" : "Sent!"}</p><p className="mt-2 text-[16px] opacity-90">{first} will be in touch soon.</p></div></div>
        : <form onSubmit={send} className="space-y-3" style={{ color: L.ink }} data-testid="site-form">
          <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Your name" aria-label="Your name" className={cls} style={field} />
          <div className="grid gap-3 sm:grid-cols-2"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email" aria-label="Email" className={cls} style={field} /><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone" aria-label="Phone" className={cls} style={field} /></div>
          <select value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} aria-label="Your main goal" className={cls} style={field}><option value="">Your main goal</option>{GOALS.map((g) => <option key={g}>{g}</option>)}</select>
          <textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} rows={4} placeholder="Anything else? Schedule, injuries, what you've tried…" aria-label="Message" className={cls} style={field} />
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="hidden" aria-hidden />
          {err && <p className="rounded-lg bg-white/90 px-3 py-2 text-[14px] text-rose-700">{err}</p>}
          <button type="submit" disabled={state === "sending" || preview} className="w-full bg-white px-6 py-4 text-[16px] font-bold disabled:opacity-60" style={{ color: site.accent, borderRadius: Math.min(L.radius, 14) }}>{preview ? "Sends to your Cooked Trainer app" : state === "sending" ? "Sending…" : "Send"}</button>
        </form>}
    </div>
  </section>;
}
