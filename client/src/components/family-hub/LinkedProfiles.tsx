// Sharing (LifeHub section "linked", opened from Settings): the one place for sharing in Arise To Duo. Everyone
// you're connected to (linked either way, invited, or in an Accountability space with you), what you share with
// each and what they share with you, one "Add someone", and the links anyone can open without an account.
// For each thing: Off, View or Edit. Premium apps (Potty Training…) can be shared to edit; LifeHub
// pages are view only. The rules and checks are in shared/profileLinks.ts and server/profileLinks.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Copy, Eye, Link2, Loader2, Mail, Pencil, Search, Share2, Trash2, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { SharedLinks } from "./ShareLink";
import { kitIcon } from "@/components/plugin-kit/kitIcons";
import { joinUrl, linksApi, setSharedChoice, sharedAppHref, type LinksState, type MyLink, type SharedLink } from "@/lib/profileLinks";
import { sharedAppById } from "@shared/sharedApps";
import { sendLink } from "@/lib/todoShares";
import { SharedViewBody } from "@/pages/TodoShare";
import { healthPeople } from "@shared/familyHealth";
import { ACCOUNTABILITY_SHARE, partnerGrants, isJoinLinkEmail, shareCatalog, type Access, type Grants, type ShareItem } from "@shared/profileLinks";
import type { Family } from "@shared/familyHub";
import { Empty, Modal, PageHead, Panel, danger, inputClass, plain, primary, stickyFoot, type SectionProps } from "./ui";

/** The LifeHub apps families share most, shown first. */
const LIFE_POPULAR = ["life:calendar", "life:bills", "life:meals", "life:grocery", "life:tasks", "life:chores", "life:moneyhub", "life:trips", "life:goals", "life:pets", "life:birthdays", "life:contacts"];
const POPULAR = [ACCOUNTABILITY_SHARE, "app:potty", "app:water", "app:sleep", "app:meds", "app:food", "app:appointments", "app:weight", "app:steps", "app:mood", "app:workouts"];
const PRESETS: { label: string; blurb: string; grants: (people: { id: string }[]) => Grants }[] = [
  { label: "Partner or spouse", blurb: "Everything together: Accountability, bills, kitchen, calendar and every app", grants: (people) => partnerGrants(people) },
  { label: "Co-parent", blurb: "Logs potty trips, sees the family calendar and to-dos", grants: () => ({ [ACCOUNTABILITY_SHARE]: "edit", "app:potty": "edit", "app:meds": "edit", "app:appointments": "edit", "life:calendar": "view", "life:tasks": "view", "life:chores": "view" }) },
  { label: "Grandparent", blurb: "Sees how potty training and the week are going", grants: () => ({ "app:potty": "view", "life:calendar": "view", "life:goals": "view" }) },
  { label: "Sitter or daycare", blurb: "Logs potty trips while the child is with them", grants: () => ({ "app:potty": "edit", "life:calendar": "view" }) },
];
const count = (g: Grants) => Object.keys(g).length;

/** One person on the Sharing page, however you're connected: a link either way, an invite, or an Accountability space. */
export type Person = { key: string; userId?: number; name: string; mine?: MyLink; theirs?: SharedLink; spaces: string[] };
export type AcctSpaces = { me: number; spaces: { id: string; name: string; members: { userId: number; name: string }[] }[] };

export function gatherPeople(state: LinksState | null, acct: AcctSpaces | null): Person[] {
  const out = new Map<string, Person>();
  const get = (key: string, name: string, userId?: number) => { let p = out.get(key); if (!p) { p = { key, userId, name, spaces: [] }; out.set(key, p); } if (!p.name && name) p.name = name; return p; };
  for (const l of state?.mine ?? []) {
    const p = get(l.viewerId ? `u${l.viewerId}` : `l${l.id}`, l.nickname || l.viewerName || (isJoinLinkEmail(l.email) ? "Someone with your link" : l.email), l.viewerId ?? undefined);
    p.mine = l; if (l.nickname) p.name = l.nickname;
  }
  for (const l of state?.withMe ?? []) get(`u${l.ownerId}`, l.ownerName, l.ownerId).theirs = l;
  for (const s of acct?.spaces ?? []) for (const m of s.members) if (m.userId !== acct!.me) get(`u${m.userId}`, m.name, m.userId).spaces.push(s.name);
  return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Sharing (LifeHub section "linked", in Settings): the one place for everyone you share with and how. People
 *  (from a link either way, an invite, or an Accountability space), one "Add someone" (their email, a link, or
 *  asking to see theirs), and the links anyone can open without an account. */
export default function LinkedProfiles({ family, say }: SectionProps) {
  const { token, user } = useAuth();
  const api = useMemo(() => linksApi(token), [token]);
  const [state, setState] = useState<LinksState | null>(null);
  const [acct, setAcct] = useState<AcctSpaces | null>(null);
  const [error, setError] = useState("");
  // Opened to add someone for one thing: Accountability (its Invite) or an app (its Share button: add=life:bills…).
  const [adding, setAdding] = useState<null | { grants?: Grants }>(() => {
    const m = /[?&]add=([\w:.-]+)/.exec(window.location.hash); if (!m) return null;
    const id = decodeURIComponent(m[1]);
    return { grants: id === "accountability" ? { [ACCOUNTABILITY_SHARE]: "edit" } : { [id]: "edit" } };
  });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ owner: SharedLink; item: ShareItem } | null>(null);
  const people = useMemo(() => healthPeople(family, user?.displayName?.split(" ")[0] || "Me").map((m) => ({ id: m.id, name: m.name })), [family, user?.displayName]);
  const catalog = useMemo(() => shareCatalog(people), [people]);
  const load = useCallback(async () => {
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
    const [links, spaces] = await Promise.all([
      api.list().then((s) => { setError(""); return s; }).catch((e) => { setError(e.message); return null; }),
      fetch(`${API_BASE}/api/accountability?tz=${encodeURIComponent(tz)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (links) setState(links);
    setAcct(spaces);
  }, [api, token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (adding) { try { const h = window.location.hash; if (/[?&]add=/.test(h)) window.history.replaceState(null, "", h.replace(/[?&]add=[^&]*/, "")); } catch { /* fine */ } } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = gatherPeople(state, acct);
  const open = list.find((p) => p.key === openKey) ?? null;
  const pending = state?.withMe.filter((l) => l.status === "pending") ?? [];
  const act = async (fn: () => Promise<unknown>, done: string) => { try { await fn(); say(done); await load(); } catch (e: any) { say(e.message); } };

  return <div className="space-y-6" data-testid="sharing-page">
    <PageHead eyebrow="Settings" title="Sharing" blurb="Everyone you share with, in one place. Pick what each person can see and change, do Accountability together, or stop sharing any time."
      action={<button type="button" onClick={() => setAdding({})} className={primary + " min-h-11 px-5"} data-testid="link-invite-open"><UserPlus size={17} /> Add someone</button>} />
    {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error} <button type="button" onClick={() => void load()} className="font-bold underline">Try again</button></p>}
    {!state && !error && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}

    {(state?.requests ?? []).map((r) => <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="link-request">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white"><Eye size={18} /></span>
      <div className="min-w-0 flex-1"><p className="font-black text-slate-900">{r.fromName} asks to see yours</p><p className="text-sm text-slate-600">{grantSummary(r.grants, catalog)} · {Object.values(r.grants).includes("edit") ? "can log and change things" : "view only"}</p></div>
      <button type="button" onClick={() => void act(() => api.approve(r.id), `You're sharing with ${r.fromName}.`)} className={primary} data-testid="link-request-approve"><Check size={16} /> Share</button>
      <button type="button" onClick={() => void act(() => api.decline(r.id), "Request declined")} className={plain}>Not now</button>
    </div>)}
    {pending.map((l) => <div key={`${l.ownerId}-${l.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4" data-testid="link-invite">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"><Mail size={18} /></span>
      <div className="min-w-0 flex-1"><p className="font-black text-slate-900">{l.ownerName} wants to share with you</p><p className="text-sm text-slate-600">{grantSummary(l.grants, catalog)}</p></div>
      <button type="button" onClick={() => void act(() => api.accept(l.ownerId, l.id), `You're linked with ${l.ownerName}.`)} className={primary} data-testid="link-accept"><Check size={16} /> Accept</button>
      <button type="button" onClick={() => void act(() => api.leave(l.ownerId, l.id), "Invite declined")} className={plain}>Decline</button>
    </div>)}

    {state && <Panel eyebrow="People" title={list.length ? `${list.length} ${list.length === 1 ? "person" : "people"}` : "No one yet"}>
      {list.length ? <ul className="space-y-2" data-testid="sharing-people">{list.map((p) => {
        const mine = p.mine ? count(p.mine.grants) - (p.mine.grants[ACCOUNTABILITY_SHARE] ? 1 : 0) : 0;
        const theirs = p.theirs?.status === "active" ? count(p.theirs.grants) - (p.theirs.grants[ACCOUNTABILITY_SHARE] ? 1 : 0) : 0;
        const bits = [p.spaces.length ? `Accountability · ${p.spaces.join(", ")}` : "", mine ? `You share ${mine}` : "", theirs ? `They share ${theirs}` : "",
          p.mine?.status === "pending" ? (isJoinLinkEmail(p.mine.email) ? "Link not opened yet" : `Invite sent to ${p.mine.email}`) : "", p.theirs?.status === "pending" ? "Invited you" : ""].filter(Boolean);
        return <li key={p.key}><button type="button" onClick={() => setOpenKey(p.key)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-violet-300" data-testid="sharing-person">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg font-black text-violet-700">{(p.name || "?").charAt(0).toUpperCase()}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-black text-slate-900">{p.name || "Someone"}</span><span className="block truncate text-xs text-slate-500">{bits.join(" · ") || "Nothing shared yet"}</span></span>
          <ChevronDown size={18} className="-rotate-90 text-slate-400" />
        </button></li>;
      })}</ul> : <Empty icon={<Users />} title="You're not sharing with anyone yet">Tap “Add someone” to share with your partner, a co-parent, a grandparent or a sitter. Invites sent to {state.myEmail || "your email"} show up here too.</Empty>}
    </Panel>}

    <SharedLinks say={say} title="Links anyone can open" />

    {adding && <LinkSomeoneModal family={family} say={say} initialGrants={adding.grants} onClose={() => setAdding(null)} onDone={() => void load()} />}
    {open && <PersonModal person={open} catalog={catalog} api={api} say={say} onClose={() => setOpenKey(null)} onChanged={() => void load()}
      onOpenLife={(item) => open.theirs && setViewing({ owner: open.theirs, item })} />}
    {viewing && <LifeViewModal owner={viewing.owner} item={viewing.item} onClose={() => setViewing(null)} />}
  </div>;
}

/** Everything with one person: what you share with them, what they share with you, and Accountability together. */
function PersonModal({ person, catalog, api, say, onClose, onChanged, onOpenLife }: { person: Person; catalog: ShareItem[]; api: ReturnType<typeof linksApi>; say: (m: string) => void; onClose: () => void; onChanged: () => void; onOpenLife: (item: ShareItem) => void }) {
  const [grants, setGrantsState] = useState<Grants>(person.mine?.grants ?? (person.spaces.length ? { [ACCOUNTABILITY_SHARE]: "edit" } : {}));
  const [saving, setSaving] = useState(false);
  const timer = useRef(0);
  const name = person.name || "them";
  // Each change saves by itself a moment later, so toggling several things is one save.
  const save = (g: Grants) => {
    window.clearTimeout(timer.current); setSaving(true);
    timer.current = window.setTimeout(() => {
      const run = person.mine ? api.update(person.mine.id, { grants: g }) : person.userId ? api.person(person.userId, g, person.name) : Promise.reject(new Error("Add them by email or a link first."));
      void run.then(() => onChanged()).catch((e: any) => say(e.message)).finally(() => setSaving(false));
    }, 600);
  };
  const setGrants = (g: Grants) => { setGrantsState(g); save(g); };
  const canShare = !!person.mine || !!person.userId;
  const theirs = person.theirs?.status === "active" ? catalog.filter((c) => person.theirs!.grants[c.id]) : [];
  return <Modal title={name} eyebrow="Sharing" onClose={onClose} wide>
    <div className="space-y-6" data-testid="sharing-person-sheet">
      {person.spaces.length > 0 && <a href="#/lifehub?go=accountability" className="flex items-center gap-3 rounded-2xl bg-teal-50 p-3.5 text-sm" data-testid="sharing-person-acct">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white"><Users size={17} /></span>
        <span className="min-w-0 flex-1"><span className="block font-black text-teal-900">Accountability together</span><span className="block text-xs text-teal-800">{person.spaces.join(", ")}</span></span>
        <span className="text-xs font-bold text-teal-700">Open</span>
      </a>}
      {person.theirs?.status === "pending" && <p className="rounded-2xl bg-violet-50 p-3.5 text-sm text-violet-900">{name} invited you. Accept it at the top of the Sharing page.</p>}

      <section>
        <div className="mb-2 flex items-center gap-2"><h3 className="flex-1 text-sm font-black text-slate-900">What you share with {name}</h3>{saving && <Loader2 size={15} className="animate-spin text-slate-400" />}</div>
        {person.mine?.status === "pending" && <p className="mb-2 text-xs text-slate-500">{isJoinLinkEmail(person.mine.email) ? "They haven't opened your link yet." : `Waiting for them to accept the invite sent to ${person.mine.email}.`}</p>}
        {canShare ? <GrantPicker grants={grants} setGrants={setGrants} catalog={catalog} /> : <p className="text-sm text-slate-500">Add them with “Add someone” to share.</p>}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-black text-slate-900">What {name} shares with you</h3>
        {theirs.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{theirs.map((item) => {
          const access = person.theirs!.grants[item.id];
          const badge = <span className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${item.kind === "together" ? "bg-teal-100 text-teal-800" : access === "edit" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{item.kind === "together" ? <><Users size={11} /> Together</> : access === "edit" ? <><Pencil size={11} /> Edit</> : <><Eye size={11} /> View</>}</span>;
          const cls = "flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left hover:bg-slate-50";
          if (item.kind === "together") return <a key={item.id} href="#/lifehub?go=accountability" className={cls}><ItemIcon item={item} /><span className="min-w-0 truncate text-sm font-bold">{item.label}</span>{badge}</a>;
          // A LifeHub app: opens the app itself, showing their copy (SharedApp.tsx).
          const live = sharedAppById(item.id);
          if (live) return <a key={item.id} href={`#/lifehub?go=${live.section}`} onClick={() => setSharedChoice(live.section, String(person.theirs!.ownerId))} className={cls} data-testid={`shared-open-${item.id}`}><ItemIcon item={item} /><span className="min-w-0 truncate text-sm font-bold">{item.label}</span>{badge}</a>;
          return item.kind === "app"
            ? <a key={item.id} href={sharedAppHref(item.id.slice(4), person.theirs!.ownerId)} className={cls} data-testid={`shared-open-${item.id}`}><ItemIcon item={item} /><span className="min-w-0 truncate text-sm font-bold">{item.label}</span>{badge}</a>
            : <button key={item.id} type="button" onClick={() => onOpenLife(item)} className={cls}><ItemIcon item={item} /><span className="min-w-0 truncate text-sm font-bold">{item.label}</span>{badge}</button>;
        })}</div> : <p className="text-sm text-slate-500">{person.theirs?.status === "active" ? `${name} hasn't turned anything on yet.` : `Nothing yet. They can share with you from their own Sharing page.`}</p>}
      </section>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
        {person.mine && <button type="button" onClick={() => { if (window.confirm(`Stop sharing with ${name}? They lose access right away.`)) void api.remove(person.mine!.id).then(() => { say("Sharing stopped"); onChanged(); onClose(); }).catch((e: any) => say(e.message)); }} className={danger} data-testid="sharing-stop"><Trash2 size={15} /> Stop sharing with {name}</button>}
        {person.theirs && <button type="button" onClick={() => { if (window.confirm(`Stop seeing what ${name} shares? They can invite you again.`)) void api.leave(person.theirs!.ownerId, person.theirs!.id).then(() => { say("Done"); onChanged(); onClose(); }).catch((e: any) => say(e.message)); }} className={plain}>Stop seeing what {name} shares</button>}
      </div>
    </div>
  </Modal>;
}

function grantSummary(g: Grants, catalog: ShareItem[]): string {
  const names = Object.keys(g).map((id) => catalog.find((c) => c.id === id)?.label).filter(Boolean) as string[];
  return names.length ? `${names.slice(0, 4).join(", ")}${names.length > 4 ? ` and ${names.length - 4} more` : ""}` : "Nothing yet";
}

function ItemIcon({ item }: { item: ShareItem }) {
  if (item.emoji) return <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg" aria-hidden>{item.emoji}</span>;
  const Icon = kitIcon(item.icon || "Puzzle");
  return <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: item.color || "#64748b" }} aria-hidden><Icon size={17} /></span>;
}

/** Off / View / Edit for each thing: premium apps, then every LifeHub app (Edit: one copy you both use). */
function GrantPicker({ grants, setGrants, catalog }: { grants: Grants; setGrants: (g: Grants) => void; catalog: ShareItem[] }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const q = query.trim().toLowerCase();
  const apps = catalog.filter((c) => c.kind === "app" || c.kind === "together");
  const [allLife, setAllLife] = useState(false);
  const lifeAll = catalog.filter((c) => c.kind === "life" && (!q || c.label.toLowerCase().includes(q)));
  const life = q || allLife ? lifeAll : lifeAll.filter((c) => LIFE_POPULAR.includes(c.id) || grants[c.id]).sort((a, b) => LIFE_POPULAR.indexOf(a.id) - LIFE_POPULAR.indexOf(b.id));
  const shownApps = q ? apps.filter((a) => a.label.toLowerCase().includes(q)) : all ? apps : apps.filter((a) => POPULAR.includes(a.id) || grants[a.id]).sort((a, b) => POPULAR.indexOf(a.id) - POPULAR.indexOf(b.id));
  const set = (id: string, v: Access | null) => { const next = { ...grants }; if (v) next[id] = v; else delete next[id]; setGrants(next); };
  const row = (item: ShareItem) => {
    const v = grants[item.id] ?? null;
    const opt = (val: Access | null, label: string) => <button type="button" onClick={() => set(item.id, val)} aria-pressed={v === val}
      className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition ${v === val ? (val === "edit" ? "bg-emerald-600 text-white" : val === "view" ? "bg-sky-600 text-white" : "bg-slate-700 text-white") : "text-slate-500 hover:bg-white"}`}>{label}</button>;
    return <li key={item.id} className="flex items-center gap-3 py-2" data-testid={`grant-${item.id}`}>
      <ItemIcon item={item} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{item.label}</span>{item.blurb && <span className="block truncate text-xs text-slate-500">{item.blurb}</span>}</span>
      <span className="flex shrink-0 gap-0.5 rounded-xl bg-slate-100 p-0.5">{item.kind === "together" ? <>{opt(null, "Off")}{opt("edit", "Together")}</> : <>{opt(null, "Off")}{opt("view", "View")}{item.editable && opt("edit", "Edit")}</>}</span>
    </li>;
  };
  return <div className="space-y-4">
    <section>
      <h4 className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Apps</h4>
      <div className="relative mt-2"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find any of ${apps.length + catalog.filter((c) => c.kind === "life").length} apps`} aria-label="Find an app" className={inputClass + " h-10 min-h-10 pl-9"} /></div>
      <ul className="divide-y divide-slate-100">{shownApps.map(row)}</ul>
      {!q && apps.length > shownApps.length && <button type="button" onClick={() => setAll(true)} className="mt-1 w-full rounded-xl py-2 text-sm font-bold text-violet-700 hover:bg-violet-50" data-testid="grant-show-all">Show all {apps.length} apps</button>}
      {q && !shownApps.length && <p className="py-3 text-sm text-slate-500">No app matches “{query}”.</p>}
    </section>
    <section>
      <h4 className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">LifeHub apps <span className="font-semibold normal-case tracking-normal text-slate-400">(Edit: one copy you both use)</span></h4>
      <ul className="divide-y divide-slate-100" data-testid="grant-life">{life.map(row)}</ul>
      {!q && !allLife && lifeAll.length > life.length && <button type="button" onClick={() => setAllLife(true)} className="mt-1 w-full rounded-xl py-2 text-sm font-bold text-violet-700 hover:bg-violet-50" data-testid="grant-show-all-life">Show all {lifeAll.length} LifeHub apps</button>}
    </section>
  </div>;
}

/** "Add someone", the only one in Arise To Duo (it opens from the Sharing page, and Accountability's Invite goes
 *  there): send an invite to their email, make a link to send them, or ask to see theirs; pick what's shared. */
export function LinkSomeoneModal({ family, onClose, onDone, say, initialGrants, initialName = "", initialHow = "email", title = "Add someone" }: { family: Family; onClose: () => void; onDone?: () => void; say: (m: string) => void; initialGrants?: Grants; initialName?: string; initialHow?: "email" | "link" | "ask"; title?: string }) {
  const { token, user } = useAuth();
  const api = useMemo(() => linksApi(token), [token]);
  const people = useMemo(() => healthPeople(family, user?.displayName?.split(" ")[0] || "Me").map((m) => ({ id: m.id, name: m.name })), [family, user?.displayName]);
  const catalog = useMemo(() => shareCatalog(people), [people]);
  const [how, setHow] = useState<"email" | "link" | "ask">(initialHow);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState(initialName);
  const [grants, setGrants] = useState<Grants>(initialGrants ?? { [ACCOUNTABILITY_SHARE]: "edit", "app:potty": "edit" });
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !count(grants)) return;
    if (how !== "link" && !email.trim()) return;
    setBusy(true);
    try {
      if (how === "email") {
        await api.invite(email.trim(), nickname.trim(), grants);
        say(`Invite sent. ${nickname.trim() || email.trim()} sees it after signing in.`); onDone?.(); onClose();
      } else if (how === "ask") {
        await api.ask(email.trim(), nickname.trim(), grants);
        say(`Request sent. When ${nickname.trim() || email.trim()} opens A.R.I.S.E., they can tap Share.`); onDone?.(); onClose();
      } else {
        const r = await api.makeLink(nickname.trim(), grants);
        setUrl(joinUrl(r.token)); onDone?.();
      }
    } catch (err: any) { say(err?.message || "That didn't work. Try again."); } finally { setBusy(false); }
  };
  const send = async () => {
    const r = await sendLink(url, "Join me on Arise To Duo");
    if (r === "cancelled") return;
    setCopied(true); window.setTimeout(() => setCopied(false), 2500);
    say(r === "copied" ? "Link copied. Send it to them." : "Link ready.");
  };
  const tab = (v: "email" | "link" | "ask", label: string, Icon: typeof Mail) => <button type="button" onClick={() => { setHow(v); setUrl(""); }} aria-pressed={how === v} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${how === v ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`} data-testid={`link-how-${v}`}><Icon size={15} />{label}</button>;
  return <Modal title={title} eyebrow="Sharing" onClose={onClose} wide>
    {url ? <div className="space-y-4 text-center" data-testid="link-made">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Link2 size={26} /></span>
      <p className="text-sm text-slate-600">Send this to {nickname.trim() || "them"}. When they open it and sign in (or make an account), you're linked with what you picked. It works once.</p>
      <p className="break-all rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-700">{url}</p>
      <button type="button" onClick={() => void send()} className={primary + " min-h-12 w-full"} data-testid="link-made-send">{copied ? <><Check size={17} /> Sent</> : <><Share2 size={17} /> Send the link</>}</button>
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(url).then(() => say("Link copied")); }} className={plain + " w-full"}><Copy size={15} /> Copy</button>
      <button type="button" onClick={onClose} className={plain + " w-full"}>Done</button>
    </div> : <form onSubmit={submit} className="space-y-5" data-testid="link-invite-form">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">{tab("email", "Their email", Mail)}{tab("link", "Send a link", Link2)}{tab("ask", "See theirs", Eye)}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {how !== "link" && <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" aria-label="Their email" className={inputClass} autoCapitalize="none" required />}
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} placeholder="Who is this? (Wife, Grandma, Mike…)" aria-label="Name" className={inputClass + (how === "link" ? " sm:col-span-2" : "")} />
      </div>
      <p className="-mt-3 text-xs text-slate-500">{how === "email" ? "They'll need an A.R.I.S.E. account with this email. They see your invite after they sign in, and nothing is shared until they accept." : how === "link" ? "You'll get a link to text or email them. They open it and sign in (or make an account) to link." : "Already logging on their own phone? Ask, and what they keep opens here too, once they say yes. Pick below what you'd like to see."}</p>
      {how !== "ask" && <div>
        <p className="mb-2 text-xs font-bold text-slate-500">Quick start</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{PRESETS.map((p) => <button key={p.label} type="button" onClick={() => setGrants(p.grants(people))} className="rounded-xl border border-slate-200 p-3 text-left hover:border-violet-300 hover:bg-violet-50/50" data-testid={`link-preset-${p.label.split(" ")[0].toLowerCase()}`}>
          <span className="block text-sm font-black text-slate-900">{p.label}</span><span className="mt-0.5 block text-xs text-slate-500">{p.blurb}</span></button>)}</div>
      </div>}
      <GrantPicker grants={grants} setGrants={setGrants} catalog={catalog} />
      <div className={stickyFoot}>
        <button type="submit" disabled={busy || !count(grants) || (how !== "link" && !email.trim())} className={primary + " min-h-12 flex-1"} data-testid="link-invite-send">{busy ? <Loader2 size={17} className="animate-spin" /> : how === "email" ? <UserPlus size={17} /> : how === "ask" ? <Eye size={17} /> : <Link2 size={17} />} {how === "email" ? "Send invite" : how === "ask" ? "Send request" : "Make the link"} · {count(grants)} {how === "ask" ? "asked" : "shared"}</button>
        <button type="button" onClick={onClose} className={plain}>Cancel</button>
      </div>
    </form>}
  </Modal>;
}

function LifeViewModal({ owner, item, onClose }: { owner: SharedLink; item: ShareItem; onClose: () => void }) {
  const { token } = useAuth();
  const [data, setData] = useState<{ view: any; today: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    linksApi(token).lifeView(owner.ownerId, item.id.replace(/^life:/, ""), today).then(setData).catch((e) => setError(e.message));
  }, [token, owner.ownerId, item.id]);
  return <Modal title={`${owner.ownerName}'s ${item.label.replace(/^Food & fitness · /, "food & fitness · ")}`} eyebrow="Shared with you · view only" onClose={onClose} wide>
    {!data && !error && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
    {error && <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-600">{error}</p>}
    {data && <div className="space-y-3"><SharedViewBody view={data.view} today={data.today} /></div>}
  </Modal>;
}

