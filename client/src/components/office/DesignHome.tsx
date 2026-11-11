// Arise Design's home screen, made for design (not the Sheets/Docs file list): a big "What will you design?"
// with one search for templates and your designs, a row of sizes drawn to their shape, your designs as
// pictures of themselves, and the templates by category. Its colors come from the look Arise Notes is in
// (light or dark, via --an-* when it's there), set on its own variables so the look's blanket rules for
// white boxes don't half-repaint it.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ImagePlus, MoreHorizontal, Plus, RotateCcw, Search, Sparkles, Star, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { docsApi, type DocEntry } from "@/lib/cloudDocs";
import { SIZES, blankDesign, cleanDesign, type Design } from "@shared/office/designModel";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@shared/office/designTemplates";
import { DesignThumb, loadDesignFonts } from "./designDom";
import { Floating, MenuList, pickFile, safeName, type MenuItem } from "./officeUi";
import type { OfficeKind } from "./OfficeApp";

const VARS = {
  "--dz-card": "var(--an-card, #ffffff)",
  "--dz-ink": "var(--an-ink, #0f172a)",
  "--dz-muted": "var(--an-muted, #64748b)",
  "--dz-line": "var(--an-line, #e5e7eb)",
  "--dz-soft": "color-mix(in srgb, var(--an-ink, #0f172a) 6%, transparent)",
  "--dz-accent": "#7c3aed",
} as CSSProperties;

/** The sizes shown first (the rest are behind "More sizes"). */
const FIRST_SIZES = ["ig-post", "story", "ig-portrait", "flyer", "poster", "presentation", "yt-thumb", "invite", "card", "logo"];

const ago = (iso: string) => {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000) return "Just now";
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** A design drawn at whatever width its box has. */
function FitThumb({ design, className = "" }: { design: Design; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return <div ref={box} className={`w-full overflow-hidden ${className}`} style={{ aspectRatio: `${design.w} / ${design.h}` }}>
    {w > 0 && <DesignThumb design={design} width={w} />}
  </div>;
}

/** A size's shape, drawn small (a square, a tall story, a wide banner). */
function SizeShape({ w, h }: { w: number; h: number }) {
  const r = w / h, max = 40;
  const sw = r >= 1 ? max : Math.max(14, max * r), sh = r >= 1 ? Math.max(12, max / r) : max;
  return <span className="grid h-11 w-11 place-items-center"><span className="rounded-[5px] border-2 border-[var(--dz-accent)] bg-[color-mix(in_srgb,var(--dz-accent)_12%,transparent)]" style={{ width: sw, height: sh }} /></span>;
}

export default function DesignHome({ config, onOpen, say: sayOut }: { config: OfficeKind; onOpen: (id: string) => void; say?: (m: string) => void }) {
  const { token } = useAuth();
  const api = useMemo(() => docsApi(token), [token]);
  const [files, setFiles] = useState<DocEntry[] | null>(null);
  const [trash, setTrash] = useState<DocEntry[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, Design>>({});
  const [tab, setTab] = useState<"recent" | "starred" | "trash">("recent");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [more, setMore] = useState(false);
  const [allSizes, setAllSizes] = useState(false);
  const [busy, setBusy] = useState("");
  const [menu, setMenu] = useState<{ doc: DocEntry; el: HTMLElement } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const say = (m: string) => { setMsg(m); sayOut?.(m); window.setTimeout(() => setMsg((x) => (x === m ? "" : x)), 3200); };

  // The templates' own fonts (Bebas Neue, Poppins…), or their pictures fall back to plain type and the words collide.
  const [, fontsReady] = useState(0);
  useEffect(() => { loadDesignFonts(); void document.fonts?.ready.then(() => fontsReady((x) => x + 1)); }, []);

  const load = async () => {
    try { setErr(""); const [a, t] = await Promise.all([api.list("design"), api.list("design", true)]); setFiles(a); setTrash(t); }
    catch (e: any) { setErr(e.message || "Your designs couldn't be loaded."); setFiles((f) => f || []); }
  };
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pictures of the latest designs (opened one by one, in the background).
  useEffect(() => {
    let alive = true;
    const want = (files || []).slice(0, 12).filter((f) => !thumbs[f.id]);
    (async () => {
      for (const f of want) {
        try { const full = await api.open(f.id); if (!alive) return; setThumbs((t) => ({ ...t, [f.id]: cleanDesign(full.content) })); } catch { /* the tile shows its name */ }
      }
    })();
    return () => { alive = false; };
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (name: string, content: unknown) => {
    setBusy(name);
    try { const d = await api.create("design", name, content); onOpen(d.id); }
    catch (e: any) { say(e.message || "Couldn't start the design."); } finally { setBusy(""); }
  };
  const importOne = async () => {
    const f = await pickFile(config.importAccept); if (!f) return;
    setBusy("import");
    try { const r = await config.importFile(f); await create(r.name, r.content); }
    catch (e: any) { say(e.message || "That picture couldn't be opened."); } finally { setBusy(""); }
  };
  const act = async (fn: () => Promise<unknown>, done?: string) => { try { await fn(); if (done) say(done); await load(); } catch (e: any) { say(e.message || "That didn't work. Try again."); } };
  const docMenu = (d: DocEntry): MenuItem[] => tab === "trash" ? [
    { label: "Restore", icon: <RotateCcw size={14} />, onClick: () => void act(() => api.restore(d.id), "Restored.") },
  ] : [
    { label: "Open", onClick: () => onOpen(d.id) },
    { label: "Rename", onClick: () => setRenaming(d.id) },
    { label: d.starred ? "Remove star" : "Star", icon: <Star size={14} />, onClick: () => void act(() => api.save(d.id, { starred: !d.starred })) },
    { label: "Make a copy", onClick: () => void act(async () => { const full = await api.open(d.id); await api.create("design", `Copy of ${d.name}`, full.content); }, "Copy made.") },
    ...config.downloads.map((dl): MenuItem => ({ label: `Download ${dl.label}`, onClick: () => void act(async () => { const full = await api.open(d.id); await dl.run(full.content, safeName(d.name)); }) })),
    { sep: true },
    { label: "Move to trash", danger: true, icon: <Trash2 size={14} />, onClick: () => void act(() => api.trash(d.id), "Moved to trash. You can restore it for 30 days.") },
  ];

  const needle = q.trim().toLowerCase();
  const mine = (tab === "trash" ? trash : (files || []).filter((d) => tab !== "starred" || d.starred))
    .filter((d) => !needle || d.name.toLowerCase().includes(needle));
  const templates = useMemo(() => TEMPLATES.map((t) => ({ ...t, design: t.make() })), []);
  const shownTemplates = templates.filter((t) => (cat === "All" || t.category === cat) && (!needle || `${t.name} ${t.category}`.toLowerCase().includes(needle)));
  const limit = more || needle || cat !== "All" ? shownTemplates.length : 12;
  const sizes = allSizes ? SIZES : FIRST_SIZES.map((id) => SIZES.find((s) => s.id === id)!).filter(Boolean);
  const hasFiles = (files?.length || 0) + trash.length > 0;

  const H2 = ({ children, right }: { children: ReactNode; right?: ReactNode }) => <div className="mb-3 flex items-end justify-between gap-3">
    <h2 className="text-[19px] font-extrabold tracking-tight text-[var(--dz-ink)]">{children}</h2>{right}
  </div>;
  const chip = (on: boolean) => `shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition ${on ? "bg-[var(--dz-ink)] text-[var(--dz-card)]" : "bg-[var(--dz-soft)] text-[var(--dz-ink)] hover:bg-[color-mix(in_srgb,var(--dz-ink)_10%,transparent)]"}`;

  return <div style={VARS} className="space-y-9 pb-6 text-[var(--dz-ink)]" data-testid="office-home-design">
    {/* What will you design? */}
    <section className="relative overflow-hidden rounded-[28px] px-5 pb-6 pt-7 text-white sm:px-8 sm:pb-8 sm:pt-10" style={{ background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 40%, #c026d3 100%)" }} data-testid="design-hero">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/10" />
      <h1 className="relative text-[27px] font-black leading-tight tracking-tight sm:text-[34px]">What will you design today?</h1>
      <p className="relative mt-1 text-[14.5px] text-white/80">Posts, flyers, invitations and more. Saved to your account.</p>
      <label className="relative mt-5 flex h-12 items-center gap-2.5 rounded-2xl px-4 shadow-lg" style={{ background: "#ffffff", color: "#0f172a" }}>
        <Search size={18} className="shrink-0 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates and your designs" aria-label="Search templates and your designs"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400" style={{ color: "#0f172a" }} data-testid="design-search" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="grid h-8 w-8 place-items-center rounded-full text-slate-500"><X size={16} /></button>}
      </label>
    </section>

    {/* Sizes */}
    {!needle && <section>
      <H2 right={<button type="button" onClick={() => setAllSizes(!allSizes)} className="text-[13.5px] font-bold text-[var(--dz-accent)]">{allSizes ? "Fewer sizes" : "More sizes"}</button>}>Start from a size</H2>
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" data-testid="office-starts">
        <button type="button" onClick={() => void create("Untitled design", config.blank())} disabled={!!busy} data-testid="office-new-blank"
          className="flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1.5 py-3 text-center transition hover:bg-[var(--dz-soft)]">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--dz-accent)] text-white shadow-md"><Plus size={22} /></span>
          <span className="text-[13px] font-bold leading-tight">Blank</span>
        </button>
        {sizes.map((s) => <button key={s.id} type="button" onClick={() => void create(`Untitled ${s.name}`, blankDesign(s.id))} disabled={!!busy} data-testid={`office-start-${s.id}`}
          className="flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1.5 py-3 text-center transition hover:bg-[var(--dz-soft)]">
          <SizeShape w={s.w} h={s.h} />
          <span className="text-[13px] font-bold leading-tight">{busy === `Untitled ${s.name}` ? "Starting…" : s.name}</span>
          <span className="text-[11px] leading-tight text-[var(--dz-muted)]">{s.unit || `${s.w} × ${s.h}`}</span>
        </button>)}
        <button type="button" onClick={() => void importOne()} disabled={!!busy} data-testid="office-import"
          className="flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1.5 py-3 text-center transition hover:bg-[var(--dz-soft)]">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--dz-soft)] text-[var(--dz-accent)]"><ImagePlus size={21} /></span>
          <span className="text-[13px] font-bold leading-tight">{busy === "import" ? "Opening…" : "From a photo"}</span>
        </button>
      </div>
    </section>}

    {/* Your designs */}
    {(hasFiles || err) && <section>
      <H2>Your designs</H2>
      <div className="-mt-1 mb-4 flex gap-1.5">{(["recent", "starred", "trash"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={chip(tab === t)}>
        {t === "recent" ? "Recent" : t === "starred" ? "Starred" : `Trash${trash.length ? ` ${trash.length}` : ""}`}</button>)}</div>
      {err && <p className="mb-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600">{err} <button type="button" className="underline" onClick={() => void load()}>Try again</button></p>}
      {files === null ? <p className="py-6 text-sm text-[var(--dz-muted)]">Loading your designs…</p>
        : mine.length === 0 ? <p className="rounded-2xl bg-[var(--dz-soft)] px-4 py-8 text-center text-sm text-[var(--dz-muted)]">{tab === "trash" ? "Trash is empty." : tab === "starred" ? "Star a design to keep it here." : needle ? "None of your designs match." : "Nothing yet."}</p>
        : <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5" data-testid="office-file-list">{mine.slice(0, 30).map((d) => {
          const t = thumbs[d.id];
          return <div key={d.id} className="group min-w-0">
            <button type="button" onClick={() => tab !== "trash" && onOpen(d.id)} className="block w-full overflow-hidden rounded-2xl bg-[var(--dz-soft)] p-2.5 transition group-hover:ring-2 group-hover:ring-[var(--dz-accent)]" aria-label={`Open ${d.name}`}>
              <div className="grid aspect-square place-items-center">
                {t ? <div className="w-full" style={{ maxWidth: t.w >= t.h ? "100%" : `${(t.w / t.h) * 100}%` }}><FitThumb design={t} className="rounded-lg shadow-sm" /></div>
                  : <span className="h-10 w-10 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--dz-accent)_25%,transparent)]" />}
              </div>
            </button>
            <div className="mt-2 flex items-start gap-1">
              {renaming === d.id ? <input autoFocus defaultValue={d.name} aria-label="New name" className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--dz-accent)] bg-transparent px-2 text-sm text-[var(--dz-ink)] outline-none"
                  onBlur={(e) => { const v = e.target.value.trim(); setRenaming(null); if (v && v !== d.name) void act(() => api.save(d.id, { name: v })); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }} />
                : <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-bold">{d.starred && <Star size={12} className="mr-1 inline fill-amber-400 text-amber-500" />}{d.name}</p>
                  <p className="text-[12px] text-[var(--dz-muted)]">{tab === "trash" && d.trashedAt ? `Trashed ${ago(d.trashedAt).toLowerCase()}` : ago(d.updatedAt)}</p></div>}
              <button type="button" onClick={(e) => setMenu({ doc: d, el: e.currentTarget })} aria-label={`More for ${d.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--dz-muted)] hover:bg-[var(--dz-soft)]"><MoreHorizontal size={18} /></button>
            </div>
          </div>;
        })}</div>}
      {tab === "trash" && trash.length > 0 && <p className="mt-3 text-xs text-[var(--dz-muted)]">Designs in the trash are deleted for good after 30 days.</p>}
    </section>}

    {/* Templates */}
    <section>
      <H2 right={<span className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--dz-muted)]"><Sparkles size={14} className="text-[var(--dz-accent)]" />{TEMPLATES.length} templates</span>}>Templates</H2>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" data-testid="design-categories">
        {["All", ...TEMPLATE_CATEGORIES].map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>{c}</button>)}
      </div>
      {shownTemplates.length === 0 ? <p className="rounded-2xl bg-[var(--dz-soft)] px-4 py-8 text-center text-sm text-[var(--dz-muted)]">No templates match "{q}". Try a simpler word, like party or sale.</p>
        : <div className="columns-2 gap-3 sm:columns-3 lg:columns-5 [&>*]:mb-4" data-testid="design-templates">
          {shownTemplates.slice(0, limit).map((t) => <button key={t.id} type="button" onClick={() => void create(t.name, t.make())} disabled={!!busy} data-testid={`office-template-${t.id}`}
            className="group block w-full break-inside-avoid text-left">
            <FitThumb design={t.design} className="rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,.12)] ring-1 ring-black/5 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_24px_rgba(15,23,42,.18)]" />
            <p className="mt-2 truncate text-[13.5px] font-bold">{busy === t.name ? "Starting…" : t.name}</p>
            <p className="text-[12px] text-[var(--dz-muted)]">{t.category}</p>
          </button>)}
        </div>}
      {shownTemplates.length > limit && <button type="button" onClick={() => setMore(true)} className="mt-1 w-full rounded-2xl bg-[var(--dz-soft)] py-3.5 text-[14.5px] font-bold text-[var(--dz-ink)]" data-testid="design-more-templates">See all {shownTemplates.length} templates</button>}
    </section>

    {msg && <div role="status" className="fixed bottom-28 left-1/2 z-[800] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg" style={{ background: "#0f172a", color: "#ffffff" }}>{msg}</div>}
    {menu && <Floating anchor={menu.el} onClose={() => setMenu(null)}><MenuList items={docMenu(menu.doc)} onDone={() => setMenu(null)} /></Floating>}
  </div>;
}
