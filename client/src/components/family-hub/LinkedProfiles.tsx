// Linked profiles (LifeHub section "linked"): share parts of your account with someone else's A.R.I.S.E.
// account — a co-parent, grandparent, sitter or teacher — and see what others share with you.
// For each thing: Off, View or Edit. Premium apps (Potty Training…) can be shared to edit; LifeHub
// pages are view only. The rules and checks are in shared/profileLinks.ts and server/profileLinks.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Eye, Loader2, Mail, Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { kitIcon } from "@/components/plugin-kit/kitIcons";
import { linksApi, sharedAppHref, type LinksState, type MyLink, type SharedLink } from "@/lib/profileLinks";
import { SharedViewBody } from "@/pages/TodoShare";
import { healthPeople } from "@shared/familyHealth";
import { shareCatalog, type Access, type Grants, type ShareItem } from "@shared/profileLinks";
import { Empty, Modal, PageHead, Panel, danger, inputClass, plain, primary, type SectionProps } from "./ui";

const POPULAR = ["app:potty", "app:water", "app:sleep", "app:meds", "app:food", "app:appointments", "app:weight", "app:steps", "app:mood", "app:workouts"];
const PRESETS: { label: string; blurb: string; grants: Grants }[] = [
  { label: "Co-parent", blurb: "Logs potty trips, sees the family calendar and to-dos", grants: { "app:potty": "edit", "app:meds": "edit", "app:appointments": "edit", "life:calendar": "view", "life:tasks": "view", "life:chores": "view" } },
  { label: "Grandparent", blurb: "Sees how potty training and the week are going", grants: { "app:potty": "view", "life:calendar": "view", "life:goals": "view" } },
  { label: "Sitter or daycare", blurb: "Logs potty trips while the child is with them", grants: { "app:potty": "edit", "life:calendar": "view" } },
];
const count = (g: Grants) => Object.keys(g).length;

export default function LinkedProfiles({ family, say }: SectionProps) {
  const { token, user } = useAuth();
  const api = useMemo(() => linksApi(token), [token]);
  const [state, setState] = useState<LinksState | null>(null);
  const [error, setError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [viewing, setViewing] = useState<{ owner: SharedLink; item: ShareItem } | null>(null);
  const people = useMemo(() => healthPeople(family, user?.displayName?.split(" ")[0] || "Me").map((m) => ({ id: m.id, name: m.name })), [family, user?.displayName]);
  const catalog = useMemo(() => shareCatalog(people), [people]);
  const load = useCallback(() => api.list().then((s) => { setState(s); setError(""); }).catch((e) => setError(e.message)), [api]);
  useEffect(() => { void load(); }, [load]);

  const pending = state?.withMe.filter((l) => l.status === "pending") ?? [];
  const active = state?.withMe.filter((l) => l.status === "active") ?? [];
  const act = async (fn: () => Promise<unknown>, done: string) => { try { await fn(); say(done); await load(); } catch (e: any) { say(e.message); } };

  return <div className="space-y-6">
    <PageHead eyebrow="Linked profiles" title="Share with the people who help" blurb="Link a co-parent, grandparent, sitter or teacher's A.R.I.S.E. account. You pick what they can see, and what they can change. Change it or stop sharing any time."
      action={<button type="button" onClick={() => setInviting(true)} className={primary + " min-h-11 px-5"} data-testid="link-invite-open"><UserPlus size={17} /> Link someone</button>} />
    {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error} <button type="button" onClick={() => void load()} className="font-bold underline">Try again</button></p>}
    {!state && !error && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}

    {pending.map((l) => <div key={`${l.ownerId}-${l.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4" data-testid="link-invite">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"><Mail size={18} /></span>
      <div className="min-w-0 flex-1"><p className="font-black text-slate-900">{l.ownerName} wants to share with you</p><p className="text-sm text-slate-600">{grantSummary(l.grants, catalog)}</p></div>
      <button type="button" onClick={() => void act(() => api.accept(l.ownerId, l.id), `You're linked with ${l.ownerName}.`)} className={primary} data-testid="link-accept"><Check size={16} /> Accept</button>
      <button type="button" onClick={() => void act(() => api.leave(l.ownerId, l.id), "Invite declined")} className={plain}>Decline</button>
    </div>)}

    {state && <>
      <Panel title={`Shared with me · ${active.length}`}>
        {active.length ? <ul className="space-y-4">{active.map((l) => <SharedWithMe key={`${l.ownerId}-${l.id}`} link={l} catalog={catalog} onOpenLife={(item) => setViewing({ owner: l, item })}
          onLeave={() => { if (window.confirm(`Stop seeing what ${l.ownerName} shares? They can invite you again.`)) void act(() => api.leave(l.ownerId, l.id), `You've left ${l.ownerName}'s shared profile.`); }} />)}</ul>
          : <Empty icon={<Users />} title="Nothing shared with you yet">When someone invites your email ({state.myEmail || "your account's email"}), it shows up here to accept.</Empty>}
      </Panel>

      <Panel title={`I share with · ${state.mine.length}`}>
        {state.mine.length ? <ul className="space-y-3">{state.mine.map((l) => <MySharing key={l.id} link={l} catalog={catalog}
          onSave={async (patch) => { try { const next = await api.update(l.id, patch); setState((s) => s && { ...s, mine: s.mine.map((x) => (x.id === l.id ? { ...x, ...next } : x)) }); } catch (e: any) { say(e.message); } }}
          onRemove={() => { if (window.confirm(`Stop sharing with ${l.nickname || l.viewerName || l.email}? They'll lose access right away.`)) void act(() => api.remove(l.id), "Sharing stopped"); }} />)}</ul>
          : <Empty icon={<UserPlus />} title="You're not sharing with anyone">Tap “Link someone” to share Potty Training, the calendar and more.</Empty>}
      </Panel>
    </>}

    {inviting && <InviteModal catalog={catalog} onClose={() => setInviting(false)} onInvite={async (email, nickname, grants) => {
      try { await api.invite(email, nickname, grants); setInviting(false); say(`Invite sent. When ${nickname || email} signs in to A.R.I.S.E., they'll see it to accept.`); await load(); } catch (e: any) { say(e.message); throw e; }
    }} />}
    {viewing && <LifeViewModal owner={viewing.owner} item={viewing.item} onClose={() => setViewing(null)} />}
  </div>;
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

function SharedWithMe({ link, catalog, onOpenLife, onLeave }: { link: SharedLink; catalog: ShareItem[]; onOpenLife: (item: ShareItem) => void; onLeave: () => void }) {
  const items = catalog.filter((c) => link.grants[c.id]);
  return <li className="rounded-2xl border border-slate-200 p-4">
    <div className="mb-3 flex items-center gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 font-black text-violet-700">{link.ownerName.charAt(0).toUpperCase()}</span>
      <p className="min-w-0 flex-1 font-black text-slate-900">{link.ownerName}</p>
      <button type="button" onClick={onLeave} className="text-xs font-semibold text-slate-400 hover:text-rose-600">Leave</button>
    </div>
    {items.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{items.map((item) => {
      const access = link.grants[item.id];
      const badge = <span className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${access === "edit" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{access === "edit" ? <><Pencil size={11} /> Edit</> : <><Eye size={11} /> View</>}</span>;
      return item.kind === "app"
        ? <a key={item.id} href={sharedAppHref(item.id.slice(4), link.ownerId)} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-50" data-testid={`shared-open-${item.id}`}><ItemIcon item={item} /><span className="min-w-0 truncate text-sm font-bold">{item.label}</span>{badge}</a>
        : <button key={item.id} type="button" onClick={() => onOpenLife(item)} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left hover:bg-slate-50"><ItemIcon item={item} /><span className="min-w-0 truncate text-sm font-bold">{item.label}</span>{badge}</button>;
    })}</div> : <p className="text-sm text-slate-500">{link.ownerName} hasn't turned anything on yet.</p>}
  </li>;
}

/** Off / View / Edit for each thing. LifeHub pages stop at View. */
function GrantPicker({ grants, setGrants, catalog }: { grants: Grants; setGrants: (g: Grants) => void; catalog: ShareItem[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const apps = catalog.filter((c) => c.kind === "app");
  const life = catalog.filter((c) => c.kind === "life");
  const shownApps = q ? apps.filter((a) => a.label.toLowerCase().includes(q)) : apps.filter((a) => POPULAR.includes(a.id) || grants[a.id]).sort((a, b) => POPULAR.indexOf(a.id) - POPULAR.indexOf(b.id));
  const set = (id: string, v: Access | null) => { const next = { ...grants }; if (v) next[id] = v; else delete next[id]; setGrants(next); };
  const row = (item: ShareItem) => {
    const v = grants[item.id] ?? null;
    const opt = (val: Access | null, label: string) => <button type="button" onClick={() => set(item.id, val)} aria-pressed={v === val}
      className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition ${v === val ? (val === "edit" ? "bg-emerald-600 text-white" : val === "view" ? "bg-sky-600 text-white" : "bg-slate-700 text-white") : "text-slate-500 hover:bg-white"}`}>{label}</button>;
    return <li key={item.id} className="flex items-center gap-3 py-2" data-testid={`grant-${item.id}`}>
      <ItemIcon item={item} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{item.label}</span>
      <span className="flex shrink-0 gap-0.5 rounded-xl bg-slate-100 p-0.5">{opt(null, "Off")}{opt("view", "View")}{item.editable && opt("edit", "Edit")}</span>
    </li>;
  };
  return <div className="space-y-4">
    <section>
      <h4 className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Apps</h4>
      <div className="relative mt-2"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find any of ${apps.length} apps`} aria-label="Find an app" className={inputClass + " h-10 min-h-10 pl-9"} /></div>
      <ul className="divide-y divide-slate-100">{shownApps.map(row)}</ul>
      {q && !shownApps.length && <p className="py-3 text-sm text-slate-500">No app matches “{query}”.</p>}
    </section>
    <section>
      <h4 className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">LifeHub pages <span className="font-semibold normal-case tracking-normal text-slate-400">(view only)</span></h4>
      <ul className="divide-y divide-slate-100">{life.map(row)}</ul>
    </section>
  </div>;
}

function MySharing({ link, catalog, onSave, onRemove }: { link: MyLink; catalog: ShareItem[]; onSave: (patch: { grants?: Grants; nickname?: string }) => Promise<void>; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [grants, setGrantsState] = useState<Grants>(link.grants);
  const [saving, setSaving] = useState(false);
  const timer = useRef(0);
  useEffect(() => setGrantsState(link.grants), [link.grants]);
  // Each change saves by itself a moment later, so toggling several things is one save.
  const setGrants = (g: Grants) => { setGrantsState(g); window.clearTimeout(timer.current); setSaving(true); timer.current = window.setTimeout(() => { void onSave({ grants: g }).finally(() => setSaving(false)); }, 600); };
  const who = link.nickname || link.viewerName || link.email;
  return <li className="rounded-2xl border border-slate-200" data-testid={`my-link-${link.id}`}>
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-black text-slate-600">{who.charAt(0).toUpperCase()}</span>
      <span className="min-w-0 flex-1"><span className="block truncate font-black text-slate-900">{who}</span>
        <span className="block truncate text-xs text-slate-500">{link.status === "pending" ? `Invite sent to ${link.email} · waiting for them to accept` : `${link.viewerName || link.email} · linked`} · {count(grants)} shared</span></span>
      {saving ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <ChevronDown size={18} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />}
    </button>
    {open && <div className="border-t border-slate-100 p-4">
      <GrantPicker grants={grants} setGrants={setGrants} catalog={catalog} />
      <button type="button" onClick={onRemove} className={danger + " mt-4 w-full"}><Trash2 size={15} /> Stop sharing with {who}</button>
    </div>}
  </li>;
}

function InviteModal({ catalog, onClose, onInvite }: { catalog: ShareItem[]; onClose: () => void; onInvite: (email: string, nickname: string, grants: Grants) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [grants, setGrants] = useState<Grants>({ "app:potty": "edit" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    try { await onInvite(email.trim(), nickname.trim(), grants); } catch { /* the message is shown */ } finally { setBusy(false); }
  };
  return <Modal title="Link someone" eyebrow="Linked profiles" onClose={onClose} wide>
    <form onSubmit={submit} className="space-y-5" data-testid="link-invite-form">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" aria-label="Their email" className={inputClass} autoCapitalize="none" required />
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} placeholder="Who is this? (Grandma, Mike…)" aria-label="Name" className={inputClass} />
      </div>
      <p className="-mt-3 text-xs text-slate-500">They'll need an A.R.I.S.E. account with this email. They see your invite after they sign in, and nothing is shared until they accept.</p>
      <div>
        <p className="mb-2 text-xs font-bold text-slate-500">Quick start</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{PRESETS.map((p) => <button key={p.label} type="button" onClick={() => setGrants(p.grants)} className="rounded-xl border border-slate-200 p-3 text-left hover:border-violet-300 hover:bg-violet-50/50">
          <span className="block text-sm font-black text-slate-900">{p.label}</span><span className="mt-0.5 block text-xs text-slate-500">{p.blurb}</span></button>)}</div>
      </div>
      <GrantPicker grants={grants} setGrants={setGrants} catalog={catalog} />
      <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white pt-4">
        <button type="submit" disabled={!email.trim() || busy} className={primary + " min-h-12 flex-1"} data-testid="link-invite-send">{busy ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />} Send invite · {count(grants)} shared</button>
        <button type="button" onClick={onClose} className={plain}>Cancel</button>
      </div>
    </form>
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

