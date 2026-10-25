// Para Team › App Store and the team's apps. Any app from the Arise App Store (LifeHub apps like
// Polls, every Plugin Kit app from both hubs, and the Office apps) can be added to a team. Added
// apps show in the team's menu and work just as they do in LifeHub, on one shared copy of the data
// that everyone on the team sees and changes (shared/paraApps.ts). Office apps open the person's
// own Arise Office, since those files belong to one account.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Lock, Plus, Puzzle, Search, ShoppingBag, Trash2 } from "lucide-react";
import { ICONS } from "@/components/plugin-store/PluginStore";
import { KIT_ICONS } from "@/components/plugin-kit/kitIcons";
import KitPlugin from "@/components/plugin-kit/KitPlugin";
import FamilyCalendar from "@/components/family-hub/FamilyCalendar";
import Browser from "@/components/family-hub/Browser";
import { LIFE_VIEWS } from "@/components/family-hub/lifeApps";
import { cleanFamily, emptyFamily, MEMBER_COLORS, type Family, type FamilySection, type Member } from "@shared/familyHub";
import { kitDef } from "@shared/pluginKit";
import { canManageApps, canUseApps, cleanSettings, diffFamily, paraApp, paraApps, MAX_TEAM_APPS, type ParaApp } from "@shared/paraApps";
import { ofKind } from "@shared/paraTeam";
import { CARD, CHIP, EmptyNote, PRIMARY, SECOND, SMALL, SectionHead, usePara, type Para } from "./kit";

export const appIcon = (a: Pick<ParaApp, "icon">) => ICONS[a.icon] ?? KIT_ICONS[a.icon] ?? Puzzle;
const settingsOf = (p: Para) => p.team.settings ?? cleanSettings(null);

/** The team's added apps, in the order they were added (the ones that still exist). */
export function teamApps(p: Para): ParaApp[] {
  return settingsOf(p).apps.map(paraApp).filter((a): a is ParaApp => !!a);
}

function openOffice(a: ParaApp) {
  window.open(`${window.location.pathname}${window.location.search}${a.target}`, "_blank", "noopener");
}

// ─── the store ───

export function TeamStore() {
  const p = usePara();
  const settings = settingsOf(p);
  const manage = canManageApps(p.team.role, settings.perms);
  const all = useMemo(() => paraApps(), []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [shown, setShown] = useState(60);
  const added = new Set(settings.apps);
  const cats = useMemo(() => [...new Set(all.map((a) => a.category))].sort(), [all]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = all.filter((a) => (!cat || a.category === cat)
    && words.every((w) => `${a.name} ${a.tagline} ${a.category}`.toLowerCase().includes(w)));

  const setApps = (apps: string[], done: string) => p.act(() => p.api.saveSettings({ apps }), done);
  const add = (a: ParaApp) => {
    if (settings.apps.length >= MAX_TEAM_APPS) { p.say(`A team can have up to ${MAX_TEAM_APPS} apps. Remove one first.`); return; }
    void setApps([...settings.apps, a.key], `${a.name} added. It's in the team's menu.`);
  };
  const removeApp = (a: ParaApp) => setApps(settings.apps.filter((k) => k !== a.key), `${a.name} removed. Add it back any time; what's in it is kept.`);

  return <>
    <SectionHead title="App Store" line={`${all.length} apps from the Arise App Store, ready for your team: polls, sign-up lists, trackers, checklists, calculators and more. What you put in a team app is shared with everyone on the team.`} />
    {!manage && <p className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><Lock className="h-4 w-4 shrink-0" />Only the team's teacher can add or remove apps. You can open the ones already added from the menu.</p>}
    <div className="mb-3 flex flex-col gap-2 sm:flex-row">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search apps</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setShown(60); }} placeholder="Search: polls, sign-up, field trip, timer…" data-testid="para-store-search"
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-base outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:text-sm" />
      </label>
      <select value={cat} onChange={(e) => { setCat(e.target.value); setShown(60); }} aria-label="Category" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base sm:text-sm">
        <option value="">All categories</option>
        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
    <p className="mb-3 text-xs text-slate-500">{list.length} {list.length === 1 ? "app" : "apps"} · {settings.apps.length} added to this team</p>
    {list.length === 0 ? <EmptyNote>No apps match that. Try another word.</EmptyNote> : (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.slice(0, shown).map((a) => {
          const Icon = appIcon(a), on = added.has(a.key);
          return <li key={a.key} className={`${CARD} flex flex-col gap-3 !p-4`} data-testid={`para-store-${a.key}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: a.color }} aria-hidden><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight text-slate-950">{a.name}</p>
                <p className="mt-0.5 text-sm leading-snug text-slate-600">{a.tagline}</p>
                <p className="mt-1 flex flex-wrap gap-1"><span className={`${CHIP} bg-slate-100 text-slate-600`}>{a.category}</span>{a.kind === "office" && <span className={`${CHIP} bg-sky-50 text-sky-800`}>Opens your own Office</span>}</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              {on ? <>
                <button type="button" className={PRIMARY} onClick={() => (a.kind === "office" ? openOffice(a) : p.go("app", a.key))}>Open</button>
                {manage && <button type="button" className={SECOND} onClick={() => removeApp(a)}><Trash2 className="h-4 w-4" />Remove</button>}
              </> : manage ? <button type="button" className={PRIMARY} onClick={() => add(a)}><Plus className="h-4 w-4" />Add to team</button>
                : <span className="text-xs text-slate-500">Not added</span>}
            </div>
          </li>;
        })}
      </ul>
    )}
    {list.length > shown && <div className="mt-4 text-center"><button type="button" className={SECOND} onClick={() => setShown((n) => n + 90)}>Show more ({list.length - shown} more)</button></div>}
  </>;
}

// ─── one team app ───

/** The team as LifeHub "members", so apps that ask who (chores, sign-ups, IOUs) list the team. */
function teamMembers(p: Para): Member[] {
  return p.team.members.filter((m) => !m.left).map((m, i) => ({ id: `t${m.userId}`, name: m.name.slice(0, 40), emoji: "", color: MEMBER_COLORS[i % MEMBER_COLORS.length], kind: "adult" }));
}

/** The team's shared app data, saved a moment after each change. Only what changed is sent, and
 *  the server merges it with anyone else's changes (shared/paraApps.ts). */
function useTeamFamily(p: Para) {
  const item = ofKind(p.team.items, "hub")[0];
  const server = useMemo(() => (item ? cleanFamily(item.data) : emptyFamily()), [item?.id, item?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const [local, setLocal] = useState<Family>(server);
  const localRef = useRef(local);
  const base = useRef(server);
  const timer = useRef<number | null>(null);
  const saving = useRef(false);
  localRef.current = local;

  // Someone else's change arrived: take it, unless this person has changes still to send.
  useEffect(() => {
    if (timer.current || saving.current || diffFamily(base.current, localRef.current)) return;
    base.current = server;
    setLocal(server);
  }, [server]);

  const flush = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (saving.current) return;
    const sent = localRef.current;
    const patch = diffFamily(base.current, sent);
    if (!patch) return;
    saving.current = true;
    try {
      const saved = await p.api.saveApps(patch);
      base.current = cleanFamily(saved.data);
      // Nothing new typed while it saved: show the merged copy (with anyone else's changes).
      if (localRef.current === sent) setLocal(base.current);
    } catch (e: any) {
      p.say(e?.message || "That didn't save. Try again.");
      setLocal(base.current);
    } finally {
      saving.current = false;
    }
    if (localRef.current !== sent && diffFamily(base.current, localRef.current)) timer.current = window.setTimeout(() => { timer.current = null; void flush(); }, 600);
  }, [p.api, p.say]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the app saves what's left.
  useEffect(() => () => { if (timer.current) void flush(); }, [flush]);

  const editable = canUseApps(p.team.role, settingsOf(p).perms);
  const members = useMemo(() => teamMembers(p), [p.team.members]); // eslint-disable-line react-hooks/exhaustive-deps
  const family = useMemo(() => ({ ...local, members }), [local, members]);
  const setFamily = useCallback((update: (f: Family) => Family) => {
    if (!editable) { p.say("The team's teacher has made team apps look-only for paras."); return; }
    setLocal((f) => update({ ...f, members }));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; void flush(); }, 700);
  }, [editable, members, flush]); // eslint-disable-line react-hooks/exhaustive-deps
  return { family, setFamily, editable };
}

const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

export function TeamAppPage({ appKey }: { appKey: string }) {
  const p = usePara();
  const app = paraApp(appKey || "");
  const added = !!app && settingsOf(p).apps.includes(app.key);
  const { family, setFamily, editable } = useTeamFamily(p);
  if (!app || !added) return <><SectionHead title="App not found" /><EmptyNote>That app isn't on this team any more. <button type="button" className={SMALL} onClick={() => p.go("store")}>Open the App Store</button></EmptyNote></>;
  const common = { family, setFamily, today: p.today, makeId, say: p.say };
  let body: ReactNode = null;
  if (app.kind === "office") {
    const Icon = appIcon(app);
    body = <div className={`${CARD} text-center`}>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: app.color }}><Icon className="h-7 w-7" /></span>
      <h1 className="mt-3 text-2xl font-black text-slate-950">{app.name}</h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{app.description}</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">This one opens your own Arise Office in a new tab, and saves to your account. To share a file, add it to Docs & files.</p>
      <button type="button" className={`${PRIMARY} mt-4`} onClick={() => openOffice(app)}><ExternalLink className="h-4 w-4" />Open {app.name}</button>
    </div>;
  } else if (app.kind === "kit") {
    const def = kitDef(app.target);
    body = def ? <KitPlugin key={def.id} def={def} records={family.kit} setRecords={(update) => setFamily((f) => ({ ...f, kit: update(f.kit) }))} today={p.today} makeId={makeId} say={p.say} /> : null;
  } else if (app.target === "calendar") {
    body = <FamilyCalendar {...common} tasks={[]} onOpenTasks={() => p.go("tasks")} />;
  } else if (app.target === "browser") {
    body = <Browser {...common} onAddTask={(title, url) => void p.act(() => p.api.add("task", { title: title.slice(0, 200), note: url }), "Added to the team's to-dos.")} />;
  } else {
    body = LIFE_VIEWS[app.target as FamilySection]?.(common) ?? null;
  }
  return <div data-testid={`para-app-${app.key}`}>
    <p className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-teal-800">
      <span className={`${CHIP} bg-teal-50 text-teal-800`}>Team app</span>
      {app.kind !== "office" && <span className="text-slate-500">{editable ? "Everyone on the team sees and can change what's here." : "Look-only: the team's teacher has turned off changes by paras."}</span>}
    </p>
    {body ?? <EmptyNote>This app can't open here yet.</EmptyNote>}
  </div>;
}

/** The menu entries for the team's apps, and the App Store. */
export function TeamAppsNav({ current, onOpen, compact }: { current: string | null; onOpen: (key: string | null) => void; compact?: boolean }) {
  const p = usePara();
  const apps = teamApps(p);
  const cls = (on: boolean) => compact
    ? `relative inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${on ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`
    : `flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[15px] ${on ? "bg-teal-700 font-bold text-white" : "font-semibold text-slate-700 hover:bg-white"}`;
  return <>
    {!compact && apps.length > 0 && <p className="mt-3 px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Team apps</p>}
    {apps.map((a) => {
      const Icon = appIcon(a);
      return <button key={a.key} type="button" onClick={() => (a.kind === "office" ? openOffice(a) : onOpen(a.key))} aria-current={current === a.key ? "page" : undefined} className={cls(current === a.key)} data-testid={`para-nav-app-${a.key}`}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ background: a.color }}><Icon className="h-3.5 w-3.5" /></span>
        <span className={compact ? "" : "min-w-0 flex-1 truncate"}>{a.name}</span>
      </button>;
    })}
    <button type="button" onClick={() => onOpen(null)} aria-current={current === "" ? "page" : undefined} className={cls(current === "")} data-testid="para-nav-store">
      <ShoppingBag className="h-[18px] w-[18px] shrink-0" /><span className={compact ? "" : "flex-1"}>App Store</span>
    </button>
  </>;
}
