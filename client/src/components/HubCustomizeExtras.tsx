// Customize, for both hubs: where the menu sits on a computer, and menu folders (group sections into a
// folder that opens with a tap, like folders of apps on a phone). Used in WorkHub's and LifeHub's Customize.
import { useState } from "react";
import { Folder, FolderPlus, Trash2 } from "lucide-react";
import { DESK_SIDES, FOLDER_LIMIT, type AnyLayout, type MenuFolder } from "@shared/hubLayout";

export function DeskSidePicker<L extends AnyLayout>({ layout, setLayout, dark = "#292446" }: { layout: L; setLayout: (l: L) => void; dark?: string }) {
  return <section>
    <h3 className="text-sm font-black text-slate-900">Menu on a computer</h3>
    <p className="mb-3 mt-1 text-sm text-slate-500">Where the menu sits on a bigger screen.</p>
    <div role="radiogroup" aria-label="Menu on a computer" className="grid gap-2 sm:grid-cols-2">
      {DESK_SIDES.map((o) => { const on = layout.deskSide === o.id; return <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setLayout({ ...layout, deskSide: o.id })} data-testid={`desk-side-${o.id}`}
        className={`flex min-h-12 items-start gap-3 rounded-xl border px-3 py-2 text-left text-sm ${on ? "bg-slate-50" : "border-slate-200 bg-white"}`} style={on ? { borderColor: dark } : undefined}>
        <DeskIcon side={o.id} on={on} dark={dark} />
        <span><span className="block font-bold text-slate-900">{o.label}</span><span className="block text-xs text-slate-500">{o.detail}</span></span>
      </button>; })}
    </div>
  </section>;
}

/** A tiny picture of each menu position. */
function DeskIcon({ side, on, dark }: { side: string; on: boolean; dark: string }) {
  const c = on ? dark : "#94a3b8";
  return <svg viewBox="0 0 32 22" className="mt-0.5 h-6 w-9 shrink-0" aria-hidden>
    <rect x="0.5" y="0.5" width="31" height="21" rx="3" fill="white" stroke={c} />
    {side === "left" && <rect x="2" y="2" width="8" height="18" rx="1.5" fill={c} />}
    {side === "right" && <rect x="22" y="2" width="8" height="18" rx="1.5" fill={c} />}
    {side === "compact" && <rect x="2" y="2" width="3.5" height="18" rx="1" fill={c} />}
    {side === "top" && <rect x="2" y="2" width="28" height="4" rx="1" fill={c} />}
    {side === "drawer" && <circle cx="16" cy="17" r="3" fill={c} />}
  </svg>;
}

export function FolderEditor<L extends AnyLayout>({ layout, setLayout, items, makeId }: { layout: L; setLayout: (l: L) => void; items: { id: string; label: string }[]; makeId: () => string }) {
  const [name, setName] = useState("");
  const folders = layout.folders;
  const save = (next: MenuFolder[]) => setLayout({ ...layout, folders: next });
  const inFolder = (id: string) => folders.find((f) => f.items.includes(id));
  const add = () => { const n = name.trim().slice(0, 30); if (!n || folders.length >= FOLDER_LIMIT) return; save([...folders, { id: makeId(), name: n, items: [] }]); setName(""); };
  const toggle = (folder: MenuFolder, id: string, on: boolean) => save(folders.map((f) => f.id === folder.id
    ? { ...f, items: on ? [...f.items, id] : f.items.filter((x) => x !== id) }
    : { ...f, items: on ? f.items.filter((x) => x !== id) : f.items }));
  return <section>
    <h3 className="text-sm font-black text-slate-900">Folders</h3>
    <p className="mb-3 mt-1 text-sm text-slate-500">Put sections together in a folder to keep the menu short. Tap a folder in the menu to open it.</p>
    <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="New folder name (e.g. Planning)" aria-label="New folder name" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
      <button type="submit" disabled={!name.trim() || folders.length >= FOLDER_LIMIT} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-40"><FolderPlus className="h-4 w-4" />Add</button>
    </form>
    <div className="mt-3 space-y-3">{folders.map((f) => <div key={f.id} className="rounded-2xl border border-slate-200 p-3" data-testid={`folder-${f.id}`}>
      <div className="flex items-center gap-2">
        <Folder className="h-4 w-4 text-slate-500" />
        <input value={f.name} maxLength={30} onChange={(e) => save(folders.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))} aria-label="Folder name" className="min-h-10 min-w-0 flex-1 rounded-lg border border-transparent px-2 text-sm font-bold hover:border-slate-200 focus:border-slate-300 focus:outline-none" />
        <span className="text-xs text-slate-500">{f.items.length}</span>
        <button type="button" onClick={() => save(folders.filter((x) => x.id !== f.id))} aria-label={`Delete folder ${f.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{items.map((it) => { const where = inFolder(it.id), on = where?.id === f.id;
        return <button key={it.id} type="button" aria-pressed={on} onClick={() => toggle(f, it.id, !on)} title={where && !on ? `In ${where.name}` : undefined}
          className={`min-h-9 rounded-full px-3 text-xs font-semibold ${on ? "bg-slate-900 text-white" : where ? "border border-dashed border-slate-300 text-slate-400" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{it.label}</button>; })}</div>
    </div>)}</div>
  </section>;
}
