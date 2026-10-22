// Arise Office: the home screen for Sheets, Docs and Slides — start a new file (blank or from a
// template), import one, and find files again (recent, starred, trash). Files live in the person's
// account (server/userDocs.ts), so they open on every device. Opening one shows its editor.
import { Suspense, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  FileText, LayoutGrid, List as ListIcon, MoreVertical, Plus, Presentation, Search, Star, Trash2, Upload, RotateCcw,
} from "lucide-react";
import { Grid3x3 } from "./icons";
import { useAuth } from "@/context/AuthContext";
import { docsApi, type DocEntry, type DocKind } from "@/lib/cloudDocs";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { Floating, MenuList, downloadBlob, pickFile, safeName, type MenuItem } from "./officeUi";

export type OfficeTemplate = { id: string; name: string; blurb: string; emoji: string; color: string; make: () => unknown };
export type OfficeKind = {
  kind: DocKind;
  title: string;
  noun: string;
  color: string;
  icon: ReactNode;
  blank: () => unknown;
  templates: OfficeTemplate[];
  importAccept: string;
  importFile: (f: File) => Promise<{ name: string; content: unknown }>;
  downloads: { label: string; run: (content: unknown, name: string) => void | Promise<void> }[];
  Editor: ComponentType<{ id: string; onBack: () => void; onOpen: (id: string) => void }>;
};

/** Older files kept in the hub itself (before files lived in the account), moved over on first open. */
export type LegacyFiles = { items: { id: string; name: string; content: unknown }[]; remove: (id: string) => void };

const ago = (iso: string) => {
  const t = new Date(iso).getTime(), d = Date.now() - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} hr ago`;
  if (d < 7 * 86_400_000) return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};
const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export default function OfficeApp({ config, legacy, say }: { config: OfficeKind; legacy?: LegacyFiles; say?: (m: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(() => { try { return sessionStorage.getItem(`arise-office-open:${config.kind}`); } catch { return null; } });
  const open = (id: string | null) => { setOpenId(id); try { if (id) sessionStorage.setItem(`arise-office-open:${config.kind}`, id); else sessionStorage.removeItem(`arise-office-open:${config.kind}`); } catch { /* fine */ } if (id) window.scrollTo({ top: 0 }); };
  const Editor = config.Editor;
  if (openId) return <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-slate-500">Opening {config.title}…</div>}><Editor key={openId} id={openId} onBack={() => open(null)} onOpen={(id) => open(id)} /></Suspense>;
  return <OfficeHome config={config} legacy={legacy} onOpen={open} say={say} />;
}

function OfficeHome({ config, legacy, onOpen, say: sayOut }: { config: OfficeKind; legacy?: LegacyFiles; onOpen: (id: string) => void; say?: (m: string) => void }) {
  const { token } = useAuth();
  const api = useMemo(() => docsApi(token), [token]);
  const [tab, setTab] = useSavedChoice<"recent" | "starred" | "trash">(`office-${config.kind}-tab`, "recent", ["recent", "starred", "trash"]);
  const [sort, setSort] = useSavedChoice<"modified" | "name">(`office-${config.kind}-sort`, "modified", ["modified", "name"]);
  const [view, setView] = useSavedChoice<"list" | "grid">(`office-${config.kind}-view`, "list", ["list", "grid"]);
  const [files, setFiles] = useState<DocEntry[] | null>(null);
  const [trash, setTrash] = useState<DocEntry[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [menu, setMenu] = useState<{ doc: DocEntry; el: HTMLElement } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [allTemplates, setAllTemplates] = useState(false);
  const [msg, setMsg] = useState("");
  const say = (m: string) => { setMsg(m); sayOut?.(m); window.setTimeout(() => setMsg(""), 3000); };

  const load = async () => {
    try { setErr(""); const [a, t] = await Promise.all([api.list(config.kind), api.list(config.kind, true)]); setFiles(a); setTrash(t); }
    catch (e: any) { setErr(e.message || "Your files couldn't be loaded."); setFiles((f) => f || []); setTrash((t) => t || []); }
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, config.kind]);

  // Older files saved inside the hub move into the account the first time Office opens.
  useEffect(() => {
    if (!legacy?.items.length || !token) return;
    let alive = true;
    (async () => {
      let moved = 0;
      for (const item of legacy.items) {
        const flag = `arise-office-moved:${item.id}`;
        try { if (localStorage.getItem(flag)) { legacy.remove(item.id); continue; } } catch { /* fine */ }
        try { await api.create(config.kind, item.name, item.content); moved++; try { localStorage.setItem(flag, "1"); } catch { /* fine */ } legacy.remove(item.id); } catch { break; }
        if (!alive) return;
      }
      if (moved && alive) { say(`Moved ${moved} older ${config.noun}${moved === 1 ? "" : "s"} into your files.`); void load(); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacy?.items.length, token]);

  const create = async (name: string, content: unknown) => {
    setBusy(name);
    try { const d = await api.create(config.kind, name, content); onOpen(d.id); }
    catch (e: any) { say(e.message || "Couldn't make the file."); } finally { setBusy(""); }
  };
  const importOne = async () => {
    const f = await pickFile(config.importAccept);
    if (!f) return;
    setBusy("import");
    try { const r = await config.importFile(f); await create(r.name, r.content); }
    catch (e: any) { say(e.message || "That file couldn't be opened."); } finally { setBusy(""); }
  };
  const act = async (fn: () => Promise<unknown>, done?: string) => { try { await fn(); if (done) say(done); await load(); } catch (e: any) { say(e.message || "That didn't work. Try again."); } };
  const docMenu = (d: DocEntry): MenuItem[] => tab === "trash" ? [
    { label: "Restore", icon: <RotateCcw size={14} />, onClick: () => void act(() => api.restore(d.id), "Restored.") },
  ] : [
    { label: "Open", onClick: () => onOpen(d.id) },
    { label: "Rename", onClick: () => setRenaming(d.id) },
    { label: d.starred ? "Remove star" : "Add star", icon: <Star size={14} />, onClick: () => void act(() => api.save(d.id, { starred: !d.starred })) },
    { label: "Make a copy", onClick: () => void act(async () => { const full = await api.open(d.id); await api.create(config.kind, `Copy of ${d.name}`, full.content); }, "Copy made.") },
    ...config.downloads.map((dl): MenuItem => ({ label: `Download ${dl.label}`, onClick: () => void act(async () => { const full = await api.open(d.id); await dl.run(full.content, safeName(d.name)); }) })),
    { sep: true },
    { label: "Move to trash", danger: true, icon: <Trash2 size={14} />, onClick: () => void act(() => api.trash(d.id), "Moved to trash. Restore it from Trash for 30 days.") },
  ];

  const source = tab === "trash" ? trash : (files || []).filter((d) => tab !== "starred" || d.starred);
  const shown = (source || []).filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt)));
  const templates = allTemplates ? config.templates : config.templates.slice(0, 5);

  return <div className="space-y-5 text-slate-900" data-testid={`office-home-${config.kind}`}>
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: config.color }}>{config.icon}</span>
      <div className="mr-auto"><h2 className="text-xl font-black">{config.title}</h2><p className="text-sm text-slate-500">Saved to your account. Opens on every device. Works with Microsoft Office files.</p></div>
      <div className="relative w-full sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${config.noun}s`} aria-label={`Search ${config.noun}s`} className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-slate-400 focus:bg-white focus:outline-none" /></div>
    </div>

    <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-700">Start a new {config.noun}</h3>
        <div className="flex gap-2">
          <button type="button" onClick={() => void importOne()} disabled={!!busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" data-testid="office-import"><Upload size={15} />{busy === "import" ? "Opening…" : "Import"}</button>
          {config.templates.length > 5 && <button type="button" onClick={() => setAllTemplates(!allTemplates)} className="text-sm font-bold text-sky-700">{allTemplates ? "Fewer" : "Template gallery"}</button>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button type="button" onClick={() => void create(`Untitled ${config.noun}`, config.blank())} disabled={!!busy} className="group text-left" data-testid="office-new-blank">
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 transition group-hover:ring-2 group-hover:ring-sky-400"><Plus size={40} style={{ color: config.color }} /></div>
          <p className="mt-1.5 text-sm font-bold">Blank {config.noun}</p>
        </button>
        {templates.map((t) => <button key={t.id} type="button" onClick={() => void create(t.name, t.make())} disabled={!!busy} className="group text-left" data-testid={`office-template-${t.id}`}>
          <div className="flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-xl bg-white p-3 ring-1 ring-slate-200 transition group-hover:ring-2 group-hover:ring-sky-400">
            <span className="text-3xl">{t.emoji}</span>
            <span className="line-clamp-2 text-[11px] leading-snug text-slate-500">{t.blurb}</span>
            <span className="h-1.5 w-full rounded-full" style={{ background: t.color }} />
          </div>
          <p className="mt-1.5 truncate text-sm font-bold">{busy === t.name ? "Making…" : t.name}</p>
        </button>)}
      </div>
    </section>

    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {(["recent", "starred", "trash"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t === "recent" ? "Recent" : t === "starred" ? "Starred" : "Trash"}{t === "trash" && trash?.length ? ` (${trash.length})` : ""}</button>)}
        <div className="ml-auto flex items-center gap-1">
          <select value={sort} onChange={(e) => setSort(e.target.value as "modified" | "name")} aria-label="Sort" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="modified">Last changed</option><option value="name">Name</option></select>
          <button type="button" onClick={() => setView(view === "list" ? "grid" : "list")} aria-label={view === "list" ? "Grid view" : "List view"} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">{view === "list" ? <LayoutGrid size={16} /> : <ListIcon size={16} />}</button>
        </div>
      </div>
      {err && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err} <button type="button" className="font-bold underline" onClick={() => void load()}>Try again</button></p>}
      {msg && <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" role="status">{msg}</p>}
      {files === null ? <p className="py-8 text-center text-sm text-slate-500">Loading your {config.noun}s…</p>
        : shown.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">{tab === "trash" ? "Trash is empty." : tab === "starred" ? `Star a ${config.noun} to keep it here.` : q ? "Nothing matches that search." : `No ${config.noun}s yet. Start one above.`}</p>
        : view === "list" ? <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200" data-testid="office-file-list">{shown.map((d) => <li key={d.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: config.color }}>{config.icon}</span>
            {renaming === d.id ? <input autoFocus defaultValue={d.name} className="h-9 flex-1 rounded-md border border-sky-500 px-2 text-sm" aria-label="New name"
                onBlur={(e) => { const v = e.target.value.trim(); setRenaming(null); if (v && v !== d.name) void act(() => api.save(d.id, { name: v })); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }} />
              : <button type="button" onClick={() => tab !== "trash" && onOpen(d.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold">{d.starred && <Star size={12} className="mr-1 inline fill-amber-400 text-amber-500" />}{d.name}</span><span className="block text-xs text-slate-500">{tab === "trash" && d.trashedAt ? `Trashed ${ago(d.trashedAt)}` : `Changed ${ago(d.updatedAt)}`} · {sizeText(d.size)}</span></button>}
            <button type="button" onClick={(e) => setMenu({ doc: d, el: e.currentTarget })} aria-label={`More for ${d.name}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><MoreVertical size={16} /></button>
          </li>)}</ul>
        : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{shown.map((d) => <div key={d.id} className="group relative rounded-xl bg-white ring-1 ring-slate-200 hover:ring-2 hover:ring-sky-400">
            <button type="button" onClick={() => tab !== "trash" && onOpen(d.id)} className="block w-full text-left">
              <div className="flex aspect-[4/3] items-center justify-center rounded-t-xl" style={{ background: `${config.color}12` }}><span className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ background: config.color }}>{config.icon}</span></div>
              <div className="p-2.5"><p className="truncate text-sm font-bold">{d.name}</p><p className="text-xs text-slate-500">{ago(d.updatedAt)}</p></div>
            </button>
            <button type="button" onClick={(e) => setMenu({ doc: d, el: e.currentTarget })} aria-label={`More for ${d.name}`} className="absolute bottom-2 right-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><MoreVertical size={15} /></button>
          </div>)}</div>}
      {tab === "trash" && !!trash?.length && <p className="mt-2 text-xs text-slate-500">Files in the trash are deleted for good after 30 days.</p>}
    </section>
    {menu && <Floating anchor={menu.el} onClose={() => setMenu(null)}><MenuList items={docMenu(menu.doc)} onDone={() => setMenu(null)} /></Floating>}
  </div>;
}

export const OfficeIcons = { sheet: <Grid3x3 size={18} />, doc: <FileText size={18} />, slides: <Presentation size={18} /> };
