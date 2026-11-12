// Branded coaching. Cooked PT: set your app's name, logo and color. Cooked: your trainer's brand replaces
// Arise's accent and shows on your coach card. The web app (#/c/<slug>): your trainer's own home-screen app.
// Shapes: shared/coachBrand.ts. Server: server/coach.ts.
import { useEffect, useState } from "react";
import { Check, Palette, Share2, Smartphone } from "lucide-react";
import { useParams } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { BRAND_COLORS, brandCss, mix, onColor, type Brand } from "@shared/coachBrand";
import { coachApi, put } from "./coachApi";
import { Btn, C, Card, Field, Sheet, Title, display, inputCls, inputStyle } from "../fit/fitUi";

type Public = { trainerId: number; name: string; photo: string; brand: Brand; invite: string };
const STORE = "arise-fit-brand";
export const rememberBrand = (tid: number) => { try { localStorage.setItem(STORE, String(tid)); } catch { /* fine */ } };
export const forgetBrand = () => { try { localStorage.removeItem(STORE); } catch { /* fine */ } };
const remembered = () => { try { return Number(localStorage.getItem(STORE)) || 0; } catch { return 0; } };

/** Applies a trainer's brand color to Cooked while mounted, and returns it (null when they have none). */
export function useTrainerBrand(trainerId: number | null | undefined): Public | null {
  const id = trainerId || remembered();
  const [b, setB] = useState<Public | null>(null);
  useEffect(() => {
    if (!id) { setB(null); return; }
    let live = true;
    fetch(`${API_BASE}/api/coach/brand/${id}`).then((r) => (r.ok ? r.json() : null)).then((x) => { if (live) setB(x); }).catch(() => {});
    return () => { live = false; };
  }, [id]);
  useEffect(() => {
    const el = document.getElementById("fit-brand");
    if (!b?.brand.on) { el?.remove(); return; }
    const st = el ?? Object.assign(document.createElement("style"), { id: "fit-brand" });
    st.textContent = brandCss(b.brand.color); if (!el) document.head.appendChild(st);
  }, [b]);
  return b?.brand.on ? b : null;
}

/** A small square logo. */
export function BrandMark({ b, size = 48 }: { b: Brand; size?: number }) {
  return b.logo ? <img src={b.logo} alt="" className="shrink-0 object-cover" style={{ width: size, height: size, borderRadius: size * 0.24 }} />
    : <span className="grid shrink-0 place-items-center font-black" style={{ width: size, height: size, borderRadius: size * 0.24, background: b.color, color: onColor(b.color), fontSize: size * 0.42 }}>{(b.appName || "A").slice(0, 1).toUpperCase()}</span>;
}

/** Crops a picture to a centered square, 512 px, under 200 KB. */
async function squareLogo(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That picture couldn't be opened.")); i.src = url; });
    const s = Math.min(img.width, img.height); const c = document.createElement("canvas"); c.width = c.height = 512;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 512, 512);
    for (const q of [0.86, 0.75, 0.62]) { const d = c.toDataURL("image/jpeg", q); if (d.length <= 200_000) return d; }
    throw new Error("That picture is too detailed. Try a simpler logo.");
  } finally { URL.revokeObjectURL(url); }
}

/** Cooked PT, Business: your brand. */
export function BrandCard({ token, name, say }: { token: string | null; name: string; say: (m: string) => void }) {
  const [res, setRes] = useState<{ brand: Brand; url: string } | null>(null);
  const [edit, setEdit] = useState(false);
  useEffect(() => { coachApi<{ brand: Brand; url: string }>(token, "/trainer/brand").then(setRes).catch(() => {}); }, [token]);
  if (!res) return null;
  const b = res.brand;
  const share = async () => { try { if (navigator.share) { await navigator.share({ title: b.appName, url: res.url }); return; } } catch { return; } try { await navigator.clipboard.writeText(res.url); say("Link copied."); } catch { say(res.url); } };
  return <>
    <Title>Your brand</Title>
    <Card className="!p-4" testId="tr-brand">
      <div className="flex items-center gap-3">{b.on ? <BrandMark b={b} size={48} /> : <span className="grid h-12 w-12 place-items-center rounded-[12px]" style={{ background: C.card2 }}><Palette className="h-5 w-5" style={{ color: C.dim }} /></span>}
        <div className="min-w-0 flex-1"><p className="truncate text-[22px] leading-none" style={display}>{b.on ? b.appName : "Your own coaching app"}</p>
          <p className="mt-1 text-[13px]" style={{ color: C.dim }}>{b.on ? "Clients see your name, logo and color in Cooked." : "Your logo, color and app name for your clients, plus a home-screen web app of your own."}</p></div></div>
      <div className={`mt-3 grid gap-2 ${b.on ? "grid-cols-2" : ""}`}><Btn kind={b.on ? "soft" : "primary"} className="!text-[15px]" onClick={() => setEdit(true)} testId="tr-brand-edit">{b.on ? "Edit" : "Set up my brand"}</Btn>
        {b.on && <Btn kind="soft" className="!text-[15px]" onClick={share}><Share2 className="h-4 w-4" />Share app</Btn>}</div>
    </Card>
    {edit && <BrandEditor token={token} initial={b} name={name} url={res.url} onClose={() => setEdit(false)} onSaved={(nb) => { setRes({ ...res, brand: nb }); setEdit(false); say(nb.on ? "Your brand is on." : "Saved. Your brand is off."); }} />}
  </>;
}

function BrandEditor({ token, initial, name, url, onClose, onSaved }: { token: string | null; initial: Brand; name: string; url: string; onClose: () => void; onSaved: (b: Brand) => void }) {
  const [b, setB] = useState<Brand>({ ...initial, appName: initial.appName || (name ? `${name.split(" ")[0]} Coaching` : "") });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const save = async (on: boolean) => { setBusy(true); setErr(""); try { const r = await put<{ brand: Brand }>(token, "/trainer/brand", { brand: { ...b, on } }); onSaved(r.brand); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const fg = onColor(b.color);
  return <Sheet title="Your brand" onClose={onClose} testId="tr-brand-editor">
    <div className="space-y-4">
      {/* What a client's phone shows. */}
      <div className="mx-auto w-[240px] overflow-hidden rounded-[28px] p-3" style={{ background: "#f2f2f4", border: "6px solid #111" }}>
        <div className="flex items-center gap-2"><BrandMark b={b} size={34} /><div className="min-w-0"><p className="truncate text-[13px] font-black text-black">{b.appName || "Your app"}</p><p className="truncate text-[10px] text-neutral-500">{b.tagline || "Coaching by " + (name || "you")}</p></div></div>
        <div className="mt-3 rounded-[14px] p-3" style={{ background: b.color, color: fg }}><p className="text-[10px] font-bold uppercase opacity-80">Today from {name.split(" ")[0] || "your coach"}</p><p className="text-[15px] font-black">Upper strength</p><p className="mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: fg, color: b.color }}>Start workout</p></div>
        <div className="mt-2 h-2 rounded-full bg-neutral-200"><div className="h-full w-2/3 rounded-full" style={{ background: b.color }} /></div>
      </div>
      <Field label="App name (what clients see)"><input value={b.appName} onChange={(e) => setB({ ...b, appName: e.target.value.slice(0, 30) })} placeholder="Maya Fit" className={inputCls} style={inputStyle} data-testid="tr-brand-name" /></Field>
      <Field label="Tagline (optional)"><input value={b.tagline} onChange={(e) => setB({ ...b, tagline: e.target.value.slice(0, 80) })} placeholder="Strong at any age" className={inputCls} style={inputStyle} /></Field>
      <Field label="Color"><div className="flex flex-wrap items-center gap-2">{BRAND_COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setB({ ...b, color: c })} className="grid h-10 w-10 place-items-center rounded-full" style={{ background: c }}>{b.color === c && <Check className="h-5 w-5" style={{ color: onColor(c) }} />}</button>)}
        <label className="relative grid h-10 w-10 cursor-pointer place-items-center overflow-hidden rounded-full text-[11px] font-bold" style={{ background: C.card2 }} aria-label="Your own color">Own<input type="color" value={b.color} onChange={(e) => setB({ ...b, color: e.target.value })} className="absolute inset-0 opacity-0" /></label></div></Field>
      <Field label="Logo (square works best)"><div className="flex items-center gap-3"><BrandMark b={b} size={56} />
        <label className="flex min-h-11 cursor-pointer items-center rounded-[10px] px-4 text-[15px] font-semibold" style={{ background: C.card2 }}>{b.logo ? "Change logo" : "Add a logo"}<input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setB({ ...b, logo: await squareLogo(f) }); } catch (x: any) { setErr(x.message); } }} data-testid="tr-brand-logo" /></label>
        {b.logo && <button type="button" onClick={() => setB({ ...b, logo: "" })} className="text-[13px] font-semibold" style={{ color: C.dim }}>Remove</button>}</div></Field>
      <Card className="!p-3.5"><p className="flex items-center gap-2 font-semibold"><Smartphone className="h-5 w-5" style={{ color: C.lime }} />Your own web app</p>
        <p className="mt-1 text-[13px]" style={{ color: C.steel }}>Send clients <b className="break-all">{url.replace(/^https?:\/\//, "")}</b>. They add it to their home screen and it opens as {b.appName || "your app"}, with your icon.</p></Card>
    </div>
    {err && <p className="mt-3 text-[14px]" style={{ color: C.red }}>{err}</p>}
    <div className="mt-5 grid gap-2">
      <Btn disabled={busy || !b.appName.trim()} onClick={() => save(true)} testId="tr-brand-save">{busy ? "Saving…" : initial.on ? "Save" : "Turn on my brand"}</Btn>
      {initial.on && <Btn kind="ghost" disabled={busy} onClick={() => save(false)}>Turn my brand off</Btn>}
    </div>
    <p className="mt-2 text-center text-[12px]" style={{ color: C.dim }}>Included while Cooked PT is in early access.</p>
  </Sheet>;
}

/** #/c/<slug>: a trainer's own web app. Clients add it to their home screen; it opens their coaching. */
export default function BrandApp() {
  const { slug } = useParams<{ slug: string }>();
  const [p, setP] = useState<Public | null>(null); const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`${API_BASE}/api/coach/brand/${encodeURIComponent(slug ?? "")}`).then(async (r) => { if (!r.ok) throw new Error("This coaching app isn't available."); setP(await r.json()); }).catch((e) => setErr(e.message));
  }, [slug]);
  useEffect(() => {
    if (!p) return;
    const b = p.brand; document.title = b.appName;
    const set = (sel: string, make: () => HTMLElement, attr: string, val: string) => { let el = document.head.querySelector(sel) as HTMLElement | null; if (!el) { el = make(); document.head.appendChild(el); } el.setAttribute(attr, val); };
    set('meta[name="theme-color"]', () => Object.assign(document.createElement("meta"), { name: "theme-color" }), "content", b.color);
    set('meta[name="apple-mobile-web-app-title"]', () => Object.assign(document.createElement("meta"), { name: "apple-mobile-web-app-title" }), "content", b.appName);
    set('link[rel="manifest"]', () => Object.assign(document.createElement("link"), { rel: "manifest" }), "href", `${API_BASE}/api/coach/brand/${p.trainerId}/manifest.webmanifest`);
    if (b.logo) set('link[rel="apple-touch-icon"]', () => Object.assign(document.createElement("link"), { rel: "apple-touch-icon" }), "href", `${API_BASE}/api/coach/brand/${p.trainerId}/icon`);
    // Opened from the home screen after the first time: straight into coaching.
    try { if (localStorage.getItem(`arise-brand-started-${p.trainerId}`) && (window.navigator as any).standalone) open(); } catch { /* show the page */ }
  }, [p]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = () => {
    if (!p) return; rememberBrand(p.trainerId);
    let before = false; try { before = !!localStorage.getItem(`arise-brand-started-${p.trainerId}`); localStorage.setItem(`arise-brand-started-${p.trainerId}`, "1"); } catch { /* fine */ }
    // The first time, the trainer's invite connects them; after that it just opens their coaching.
    window.location.hash = before ? "#/fit" : `#/fit?coach=${p.invite}`;
  };
  if (!p) return <div className="grid min-h-screen place-items-center bg-white p-6 text-center text-neutral-500">{err || "Loading…"}</div>;
  const b = p.brand; const deep = mix(b.color, "#000000", 0.35); const fg = onColor(deep);
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  return <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center" style={{ background: `linear-gradient(170deg, ${b.color}, ${deep})`, color: fg }} data-testid="brand-app">
    <BrandMark b={b} size={112} />
    <h1 className="mt-6 text-[40px] font-black leading-none tracking-tight">{b.appName}</h1>
    {b.tagline && <p className="mt-2 text-[18px] opacity-90">{b.tagline}</p>}
    <p className="mt-1 text-[15px] opacity-80">Coaching by {p.name}</p>
    <button type="button" onClick={open} className="mt-10 w-full max-w-xs rounded-[16px] px-6 py-4 text-[18px] font-bold" style={{ background: fg, color: b.color }} data-testid="brand-open">Open my coaching</button>
    <div className="mt-8 max-w-xs rounded-[16px] p-4 text-left text-[14px] leading-relaxed" style={{ background: "rgba(255,255,255,.14)" }}>
      <p className="font-bold">Put {b.appName} on your home screen</p>
      <p className="mt-1 opacity-90">{ios ? "Tap the Share button in Safari, then Add to Home Screen." : "Open your browser menu, then Add to Home screen or Install app."}</p>
    </div>
    <p className="mt-10 text-[12px] opacity-60">Powered by Arise</p>
  </div>;
}
