// A LifeHub app shared between two accounts (shared/sharedApps.ts). Above every app:
//  - the person who owns it gets a Share button: pick who sees it (View) or uses it with them (Edit);
//  - the person it's shared with is asked once: use their copy, merge mine into it, or keep mine. Using
//    theirs, the app on this phone IS their copy: what they change shows here, and with Edit what you change
//    is saved into theirs (the server writes only that app's part of their LifeHub; their devices merge it in).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Eye, Loader2, Pencil, Share2, UserPlus, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { linksApi, setSharedChoice, sharedChoice, type LinksState, type SharedLink } from "@/lib/profileLinks";
import { cleanFamily, emptyFamily, type Family } from "@shared/familyHub";
import { mergeSlices, pickParts, sharedAppFor, sliceHasData, type SharedApp } from "@shared/sharedApps";
import type { Access, Grants } from "@shared/profileLinks";
import { gatherPeople, type AcctSpaces, type Person } from "./LinkedProfiles";
import { Modal, plain, primary, type SectionProps } from "./ui";

// What's shared with this person and who they're connected to, loaded once and refreshed now and then.
let cache: { at: number; links: LinksState | null; acct: AcctSpaces | null } | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
async function refresh(token: string | null, force = false) {
  if (!token) return;
  if (!force && cache && Date.now() - cache.at < 60_000) return;
  loading ??= (async () => {
    const api = linksApi(token);
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
    const [links, acct] = await Promise.all([
      api.list().catch(() => cache?.links ?? null),
      fetch(`${API_BASE}/api/accountability?tz=${encodeURIComponent(tz)}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => cache?.acct ?? null),
    ]);
    cache = { at: Date.now(), links, acct };
    listeners.forEach((f) => f());
  })().finally(() => { loading = null; });
  return loading;
}
function useSharing() {
  const { token } = useAuth();
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((x) => x + 1); listeners.add(f); void refresh(token); return () => { listeners.delete(f); }; }, [token]);
  return { links: cache?.links ?? null, acct: cache?.acct ?? null, reload: () => refresh(token, true) };
}

type Host = { owner: SharedLink; access: Access; family: Family; slice: Record<string, unknown>; loadedAt: number };

/** For the app on screen: the props to draw it with (their copy, when that's the one in use) and the bar above it. */
export function useSharedApp(section: string, common: SectionProps): { props: SectionProps | null; bar: ReactNode } {
  const { token } = useAuth();
  const api = useMemo(() => linksApi(token), [token]);
  const app = sharedAppFor(section);
  const { links, acct, reload } = useSharing();
  const [choice, setChoice] = useState<string | null>(() => sharedChoice(section));
  useEffect(() => { setChoice(sharedChoice(section)); const f = () => setChoice(sharedChoice(section)); window.addEventListener("arise-shared-choice", f); return () => window.removeEventListener("arise-shared-choice", f); }, [section]);
  const offers = useMemo(() => (app ? (links?.withMe ?? []).filter((l) => l.status === "active" && l.grants[app.id]) : []), [links, app]);
  const owner = offers.find((l) => String(l.ownerId) === choice) ?? null;
  const [host, setHost] = useState<Host | null>(null);
  const [error, setError] = useState("");
  const pending = useRef<number | null>(null);
  /** Their copy as the server last gave it: what this device's edits are measured against when saving. */
  const baseRef = useRef<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(false);

  // Their copy: loaded, and checked again every 30 seconds while nothing of ours is waiting to save.
  const load = useCallback(async () => {
    if (!app || !owner) return;
    try {
      const r = await api.appGet(owner.ownerId, section);
      if (pending.current !== null) return; // an edit is waiting to save: keep it on screen
      baseRef.current = r.slice;
      setHost({ owner, access: r.access, slice: r.slice, loadedAt: Date.now(), family: cleanFamily({ ...emptyFamily(), members: r.members, sections: common.family.sections, bundleSet: common.family.bundleSet, ...r.slice }) });
      setError("");
    } catch (e: any) { setError(e.message || "Their copy couldn't be opened."); }
  }, [api, app, owner?.ownerId, section]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setHost(null); if (!owner) return; void load(); const t = window.setInterval(() => { if (document.visibilityState === "visible" && pending.current === null) void load(); }, 8_000); const vis = () => { if (document.visibilityState === "visible" && pending.current === null) void load(); }; document.addEventListener("visibilitychange", vis); return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", vis); }; }, [owner?.ownerId, section]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!app) return { props: null, bar: null };
  const ownerName = owner?.ownerName || offers[0]?.ownerName || "They";
  const save = (next: Family) => {
    if (!host || !owner) return;
    if (pending.current !== null) window.clearTimeout(pending.current);
    setSaving(true);
    pending.current = window.setTimeout(() => {
      pending.current = null;
      const base = baseRef.current;
      api.appPut(owner.ownerId, section, pickParts(next, app.parts), base ?? undefined).then((r) => { baseRef.current = r.slice; setHost((h) => (h ? { ...h, slice: r.slice, ...(pending.current === null ? { family: cleanFamily({ ...h.family, ...r.slice }) } : {}) } : h)); }).catch((e: any) => common.say(e.message || "Couldn't save to their copy.")).finally(() => setSaving(false));
    }, 150);
  };
  const props: SectionProps | null = owner && host ? {
    ...common, family: host.family,
    setFamily: (upd: any) => {
      if (host.access !== "edit") { common.say(`${ownerName} shared this to look at. Ask them for Edit to change it.`); return; }
      setHost((h) => { if (!h) return h; const next = typeof upd === "function" ? upd(h.family) : upd; save(next); return { ...h, family: next }; });
    },
  } : null;

  const mine = pickParts(common.family, app.parts);
  const use = (ownerId: number) => { setSharedChoice(section, String(ownerId)); common.say(`You're using ${offers.find((o) => o.ownerId === ownerId)?.ownerName || "their"} ${app.label}.`); };
  const merge = async (o: SharedLink) => {
    try {
      const theirs = await api.appGet(o.ownerId, section);
      await api.appPut(o.ownerId, section, mergeSlices(theirs.slice, mine, app.parts));
      setSharedChoice(section, String(o.ownerId));
      common.say(`Merged. Yours and ${o.ownerName}'s are one ${app.label} now. Your own copy is still kept if you switch back.`);
    } catch (e: any) { common.say(e.message || "Couldn't merge. Try again."); }
  };

  let bar: ReactNode;
  if (owner) {
    bar = <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-violet-50 px-3 py-2.5 text-sm ring-1 ring-violet-100" data-testid="shared-app-bar">
      <Users size={16} className="shrink-0 text-violet-600" />
      <span className="min-w-0 flex-1"><b>{ownerName}'s {app.label}</b> · {host?.access === "edit" ? <span className="text-emerald-700">you both can change it</span> : <span className="text-sky-700">view only</span>}{saving && <Loader2 size={13} className="ml-1.5 inline animate-spin text-slate-400" />}{error && <span className="ml-1.5 text-rose-600">{error}</span>}</span>
      <button type="button" onClick={() => setSharedChoice(section, "mine")} className="rounded-lg px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-white" data-testid="shared-app-mine">Use mine instead</button>
    </div>;
  } else if (offers.length && !choice) {
    const o = offers[0], edit = o.grants[app.id] === "edit";
    bar = <div className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-4" data-testid="shared-app-offer">
      <p className="flex items-center gap-2 font-black text-slate-900"><Users size={17} className="text-violet-600" />{o.ownerName} shares {app.label} with you</p>
      <p className="mt-1 text-sm text-slate-600">{edit ? "You can both change it: one copy, kept the same on both your phones." : "You can look at it. They decide what's in it."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => use(o.ownerId)} className={primary + " min-h-10"} data-testid="shared-app-use"><Check size={16} /> Use {o.ownerName}'s</button>
        {edit && sliceHasData(mine) && <button type="button" onClick={() => void merge(o)} className={plain + " min-h-10"} data-testid="shared-app-merge">Merge mine into it</button>}
        <button type="button" onClick={() => setSharedChoice(section, "mine")} className={plain + " min-h-10"}>Keep mine</button>
      </div>
    </div>;
  } else {
    bar = <div className="mb-3 flex items-center justify-end gap-2">
      {offers.length > 0 && <button type="button" onClick={() => use(offers[0].ownerId)} className="text-xs font-bold text-violet-700 hover:underline" data-testid="shared-app-open-theirs">Open {offers[0].ownerName}'s</button>}
      <button type="button" onClick={() => setSheet(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-bold text-violet-700 shadow-sm ring-1 ring-violet-200 hover:bg-violet-50" data-testid="shared-app-share"><Share2 size={15} />Share</button>
    </div>;
  }
  return { props, bar: <>{bar}{sheet && <ShareAppSheet app={app} links={links} acct={acct} onClose={() => setSheet(false)} onChanged={() => void reload()} say={common.say} />}</> };
}

/** The Share button's sheet: everyone you're connected with, each with Off / View / Edit for this one app. */
function ShareAppSheet({ app, links, acct, onClose, onChanged, say }: { app: SharedApp; links: LinksState | null; acct: AcctSpaces | null; onClose: () => void; onChanged: () => void; say: (m: string) => void }) {
  const { token } = useAuth();
  const api = useMemo(() => linksApi(token), [token]);
  const people = gatherPeople(links, acct).filter((p) => p.mine || p.userId);
  const [busy, setBusy] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Access | null>>({});
  const current = (p: Person): Access | null => (p.key in local ? local[p.key] : (p.mine?.grants[app.id] as Access | undefined) ?? null);
  const set = async (p: Person, v: Access | null) => {
    setBusy(p.key); setLocal((l) => ({ ...l, [p.key]: v }));
    const grants: Grants = { ...(p.mine?.grants ?? {}) }; if (v) grants[app.id] = v; else delete grants[app.id];
    try {
      if (p.mine) await api.update(p.mine.id, { grants }); else if (p.userId) await api.person(p.userId, grants, p.name);
      say(v ? `${p.name} can ${v === "edit" ? "use and change" : "see"} your ${app.label}.` : `${p.name} no longer sees your ${app.label}.`); onChanged();
    } catch (e: any) { say(e.message || "Couldn't save."); setLocal((l) => { const n = { ...l }; delete n[p.key]; return n; }); }
    finally { setBusy(null); }
  };
  return <Modal title={`Share ${app.label}`} eyebrow="Sharing" onClose={onClose}>
    <div className="space-y-4" data-testid="share-app-sheet">
      <p className="text-sm text-slate-600"><b>Edit</b>: one {app.label}, the same on both your phones; you both add and change things. <b>View</b>: they can look, not change.</p>
      {people.length ? <ul className="space-y-2">{people.map((p) => { const v = current(p); return <li key={p.key} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-100 font-black text-violet-700">{p.name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1 truncate font-bold">{p.name}{p.mine?.status === "pending" && <span className="block text-xs font-normal text-slate-500">Hasn't accepted yet</span>}</span>
        {busy === p.key ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <span className="flex shrink-0 gap-0.5 rounded-xl bg-slate-100 p-0.5">
          {([[null, "Off", null], ["view", "View", <Eye key="v" size={13} />], ["edit", "Edit", <Pencil key="e" size={13} />]] as const).map(([val, label, icon]) => <button key={label} type="button" onClick={() => void set(p, val)} aria-pressed={v === val} data-testid={`share-app-${p.key}-${label.toLowerCase()}`}
            className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold ${v === val ? (val === "edit" ? "bg-emerald-600 text-white" : val === "view" ? "bg-sky-600 text-white" : "bg-slate-700 text-white") : "text-slate-500"}`}>{icon}{label}</button>)}
        </span>}
      </li>; })}</ul> : <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">You're not connected with anyone yet.</p>}
      <a href={`#/lifehub?go=linked&add=${encodeURIComponent(app.id)}`} onClick={onClose} className={plain + " w-full"} data-testid="share-app-add"><UserPlus size={16} /> Add someone new</a>
      <button type="button" onClick={onClose} className={primary + " w-full"}><X size={16} /> Done</button>
    </div>
  </Modal>;
}
