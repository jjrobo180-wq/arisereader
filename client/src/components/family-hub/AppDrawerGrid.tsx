// The app grid inside the app drawer, the same in LifeHub (and its family members) and WorkHub. Arranged like
// iPhone apps:
// - press and hold any app (a long press, HOLD_MS) and every app jiggles;
// - drag an app (or a folder) and the others glide out of its way; let go and the new order is kept;
// - tap ✕ on an app to take it off the drawer; "Put back" brings a removed one back;
// - tap an app, then another, to put both in a folder (or tap a folder to add the app to it). Inside a folder,
//   take apps out with −, rename the folder or remove it.
// Done (or closing the drawer) stops the jiggling. The order, removed apps and folders are kept in the hub's layout
// (shared/hubLayout.ts: drawerOrder, drawerHidden, folders).
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Folder, Plus, X } from "lucide-react";
import { arrangeDrawer, foldMenu, moveKey, orderFromKeys, type MenuEntry, type MenuFolder } from "@shared/hubLayout";

export type DrawerItem = {
  id: string; label: string; icon: ReactNode; onClick: () => void;
  active?: boolean; badge?: number;
  /** The tile's background (a color or a gradient). */ background?: string;
  /** Something on the tile's corner (an "Add" tag). */ corner?: ReactNode;
  /** Can't be taken off the drawer (Home, the Plugin Gallery). */ fixed?: boolean;
};

/** How long a press must last before the apps jiggle (a little longer than a tap-and-hesitate). */
export const HOLD_MS = 750;
/** How far a finger may drift during that press (more is a scroll, not a hold), and how far it moves to start a drag. */
const DRIFT = 10;

const keyOf = <T extends { id: string }>(e: MenuEntry<T>) => (e.kind === "item" ? e.item.id : `folder:${e.folder.id}`);

export function AppDrawerGrid({ items, folders, onFolders, order = [], hidden = [], onArrange, open, onClose, query, gridFolder, setGridFolder, prefix, base, activeBg, listId }: {
  items: DrawerItem[]; folders: MenuFolder[];
  /** Saves folders made right in the drawer. */ onFolders?: (next: MenuFolder[]) => void;
  order?: readonly string[]; hidden?: readonly string[];
  /** Saves the drawer's order and removed apps. */ onArrange?: (order: string[], hidden: string[]) => void;
  /** The drawer is showing. */ open: boolean; onClose: () => void;
  query: string; gridFolder: string | null; setGridFolder: (id: string | null) => void;
  /** Test ids start with this ("life" or "hub"). */ prefix: string;
  /** A tile's background, and the open section's. */ base: string; activeBg: string;
  listId: string;
}) {
  const canArrange = !!onArrange || !!onFolders;
  const [editing, setEditing] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const holdTimer = useRef<number | null>(null);
  const holdFired = useRef(false);
  const press = useRef<{ key: string; x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => { if (!open) { setEditing(false); setHeld(null); setDragKey(null); setPreview(null); } }, [open]);
  useEffect(() => () => { if (holdTimer.current) window.clearTimeout(holdTimer.current); }, []);

  const searching = query.trim().length > 0;
  const openFolder = gridFolder ? folders.find((f) => f.id === gridFolder) ?? null : null;
  const shownItems = arrangeDrawer(items, order, hidden);
  const removed = items.filter((i) => hidden.includes(i.id));
  // Searching looks across every app, folders included (flattened), so nothing tucked away becomes unfindable.
  // Not searching: a folder collapses to one tile, until tapped open. Inside a folder: just its own apps.
  const entries: MenuEntry<DrawerItem>[] = searching
    ? shownItems.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase())).map((item) => ({ kind: "item" as const, item }))
    : openFolder ? openFolder.items.map((id) => items.find((i) => i.id === id)).filter((i): i is DrawerItem => !!i).map((item) => ({ kind: "item" as const, item }))
    : foldMenu(shownItems, folders);
  const byKey = new Map(entries.map((e) => [keyOf(e), e]));
  const shown = preview ? preview.map((k) => byKey.get(k)).filter((e): e is MenuEntry<DrawerItem> => !!e) : entries;
  const canDrag = editing && !searching && !openFolder && !!onArrange;

  const saveFolders = (next: MenuFolder[]) => onFolders?.(next.filter((f) => f.items.length > 0 || f.id === gridFolder));
  const without = (fs: MenuFolder[], id: string) => fs.map((f) => ({ ...f, items: f.items.filter((x) => x !== id) }));
  const tapInEdit = (id: string, folderId?: string) => {
    if (!onFolders) return;
    if (folderId) { if (held) { saveFolders(without(folders, held).map((f) => (f.id === folderId ? { ...f, items: [...f.items, held] } : f))); setHeld(null); } else setGridFolder(folderId); return; }
    if (!held) { setHeld(id); return; }
    if (held === id) { setHeld(null); return; }
    if (folders.length >= 12) { setHeld(null); return; }
    const name = (window.prompt("Name this folder", "Folder") || "Folder").trim().slice(0, 30) || "Folder";
    const nf: MenuFolder = { id: `f${Date.now().toString(36)}`, name, items: [held, id] };
    saveFolders([...without(folders, held).map((f) => ({ ...f, items: f.items.filter((x) => x !== id) })), nf]);
    setHeld(null);
  };
  const remove = (id: string) => { onArrange?.(orderFromKeys(entries.map(keyOf), folders, order), [...hidden.filter((x) => x !== id), id]); if (held === id) setHeld(null); };
  const putBack = (id: string) => onArrange?.([...order.filter((x) => x !== id), id], hidden.filter((x) => x !== id));

  const stopHold = () => { if (holdTimer.current) window.clearTimeout(holdTimer.current); holdTimer.current = null; };
  const down = (e: ReactPointerEvent, key: string) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    press.current = { key, x: e.clientX, y: e.clientY, moved: false };
    if (editing || !canArrange) return;
    holdFired.current = false;
    stopHold();
    holdTimer.current = window.setTimeout(() => { holdFired.current = true; setEditing(true); try { navigator.vibrate?.(15); } catch { /* fine */ } }, HOLD_MS);
  };
  const move = (e: ReactPointerEvent) => {
    const p = press.current;
    if (!p) return;
    const far = Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRIFT;
    if (!editing) { if (far) stopHold(); return; }
    if (!canDrag) return;
    if (!p.moved) {
      if (!far) return;
      p.moved = true;
      setDragKey(p.key);
      setPreview(entries.map(keyOf));
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* fine */ }
    }
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-drawer-key]")?.dataset.drawerKey;
    if (over && over !== p.key) setPreview((keys) => (keys ? moveKey(keys, p.key, over) : keys));
  };
  const up = () => {
    stopHold();
    const p = press.current;
    press.current = null;
    if (p?.moved && preview) { justDragged.current = true; onArrange?.(orderFromKeys(preview, folders, order), [...hidden]); }
    setDragKey(null);
    setPreview(null);
  };
  const pressProps = (key: string) => ({
    onPointerDown: (e: ReactPointerEvent) => down(e, key), onPointerMove: move, onPointerUp: up, onPointerCancel: up,
    onPointerLeave: () => { if (!press.current?.moved) stopHold(); },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  });
  /** A click right after a hold or a drag isn't a tap. */
  const swallow = () => { if (holdFired.current || justDragged.current) { holdFired.current = false; justDragged.current = false; return true; } return false; };

  const badge = (n?: number) => (n ? <span className="absolute right-1 top-0.5 min-w-[16px] rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-4 text-white">{n > 99 ? "99+" : n}</span> : null);
  const tab = open ? 0 : -1;
  const wiggle = (k: string) => (editing && dragKey !== k ? "arise-wiggle" : "");

  return <>
    {editing && <div className={`mx-4 mb-2 flex flex-col gap-2 rounded-2xl px-3 py-2 text-[13px] ${prefix === "hub" ? "bg-slate-100 text-slate-800" : "bg-violet-50 text-violet-900"}`} data-testid={`${prefix}-apps-editing`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">{openFolder ? "Tap − to take an app out of this folder." : held ? `Now tap another app to make a folder, or a folder to add ${items.find((i) => i.id === held)?.label ?? "it"} to it.` : "Drag apps to move them. Tap ✕ to remove one. Tap an app, then another, to make a folder."}</span>
        <button type="button" onClick={() => { setEditing(false); setHeld(null); }} className={`min-h-9 shrink-0 rounded-full px-4 text-sm font-bold text-white ${prefix === "hub" ? "bg-slate-950" : "bg-violet-700"}`} data-testid={`${prefix}-apps-done`}>Done</button>
      </div>
      {!openFolder && removed.length > 0 && onArrange && <div className="flex flex-wrap items-center gap-1.5" data-testid={`${prefix}-apps-removed`}>
        <span className="text-xs font-bold uppercase tracking-wide opacity-70">Put back</span>
        {removed.map((i) => <button key={i.id} type="button" onClick={() => putBack(i.id)} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-white px-2.5 text-xs font-bold shadow-sm" data-testid={`${prefix}-app-putback-${i.id}`}><Plus className="h-3.5 w-3.5" />{i.label}</button>)}
      </div>}
    </div>}
    {openFolder && !searching && <div className="-mt-1 flex items-center gap-2 px-4 pb-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{openFolder.name}</p>
      {onFolders && <button type="button" onClick={() => { const n = window.prompt("Rename folder", openFolder.name)?.trim(); if (n) onFolders(folders.map((f) => (f.id === openFolder.id ? { ...f, name: n.slice(0, 30) } : f))); }} className="text-xs font-bold text-violet-700">Rename</button>}
      {onFolders && <button type="button" onClick={() => { onFolders(folders.filter((f) => f.id !== openFolder.id)); setGridFolder(null); }} className="text-xs font-bold text-rose-600">Remove folder</button>}</div>}
    <ul id={listId} style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }} className="grid flex-1 grid-cols-4 content-start gap-x-2 gap-y-5 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:grid-cols-6">
      {shown.map((entry) => {
        const key = keyOf(entry);
        const lifted = dragKey === key;
        return <motion.li key={key} layout={!!preview} transition={{ type: "spring", stiffness: 520, damping: 38 }} data-drawer-key={key}
          className={`relative ${lifted ? "z-20" : ""}`} style={canDrag ? { touchAction: "none" } : undefined}>
          {entry.kind === "item" ? <>
            <button type="button" tabIndex={tab} {...pressProps(key)} data-testid={`${prefix}-app-${entry.item.id}`}
              onClick={() => { if (swallow()) return; if (editing) { if (openFolder) return; tapInEdit(entry.item.id); return; } entry.item.onClick(); onClose(); }}
              className={`relative flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition ${editing ? "" : "active:scale-90"} ${wiggle(key)} ${held === entry.item.id ? "ring-4 ring-violet-400" : ""} ${lifted ? "scale-110 opacity-90 drop-shadow-xl" : ""}`}>
              <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem] text-white shadow-sm [&_svg]:h-7 [&_svg]:w-7 [&_svg]:text-white" style={{ background: entry.item.active ? activeBg : entry.item.background || base }}>{entry.item.icon}{entry.item.corner}</span>
              {badge(entry.item.badge)}
              <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800">{entry.item.label}</span>
            </button>
            {editing && openFolder && onFolders && <button type="button" aria-label={`Take ${entry.item.label} out of the folder`} onClick={() => saveFolders(without(folders, entry.item.id))} data-testid={`${prefix}-app-out-${entry.item.id}`}
              className="absolute left-0.5 top-[-4px] z-10 grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-[16px] font-bold leading-none text-white shadow">−</button>}
            {editing && !openFolder && !searching && onArrange && !entry.item.fixed && !lifted && <button type="button" aria-label={`Remove ${entry.item.label}`} onClick={() => remove(entry.item.id)} data-testid={`${prefix}-app-remove-${entry.item.id}`}
              className={`absolute left-0.5 top-[-4px] z-10 grid h-6 w-6 place-items-center rounded-full bg-slate-500/90 text-white shadow ring-2 ring-white ${wiggle(key)}`}><X className="h-3.5 w-3.5" strokeWidth={3} /></button>}
          </> : <button type="button" tabIndex={tab} {...pressProps(key)} data-testid={`${prefix}-app-folder-${entry.folder.id}`} aria-label={`Open folder ${entry.folder.name}`}
              onClick={() => { if (swallow()) return; if (editing) { tapInEdit("", entry.folder.id); return; } setGridFolder(entry.folder.id); }}
              className={`relative flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition ${editing ? "" : "active:scale-90"} ${wiggle(key)} ${lifted ? "scale-110 opacity-90 drop-shadow-xl" : ""}`}>
            <span className="grid h-14 w-14 grid-cols-2 gap-0.5 rounded-[1.1rem] bg-slate-200 p-2 shadow-sm">{Array.from({ length: 4 }, (_, i) => <span key={i} className="flex items-center justify-center rounded-[5px] bg-white text-slate-400 [&_svg]:h-3 [&_svg]:w-3">{entry.items[i]?.icon}</span>)}</span>
            <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800"><Folder className="-mt-0.5 mr-0.5 inline h-2.5 w-2.5 text-slate-400" />{entry.folder.name}</span>
          </button>}
        </motion.li>;
      })}
      {!shown.length && <li className="col-span-full py-10 text-center text-sm text-slate-400">{searching ? "No matches." : openFolder ? "This folder is empty." : "No apps here. Hold anywhere to put some back."}</li>}
    </ul>
  </>;
}
