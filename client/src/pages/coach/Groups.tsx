// Groups in Arise Trainer and Arise Fit: a group page (posts, photos, comments, likes, pins), a group chat and
// challenges with a leaderboard. The same screen serves the coach and the members. Server: server/coachGroups.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Crown, Flame, Heart, MessageCircle, Pin, Plus, Send, Settings, Trash2, Trophy, Users, X } from "lucide-react";
import { CHALLENGE_TEMPLATES, COVER_COLORS, challengeDay, challengeEnd, maxPoints, type Challenge, type Group, type GroupMsg, type GroupPost, type Standing } from "@shared/coachGroups";
import { ago, coachApi, dayKeyOf, post, put, shortDate, shrinkImage, usePoll } from "./coachApi";
import { Btn, C, Card, Chips, Field, Sheet, Title, display, inputCls, inputStyle } from "../fit/fitUi";

type Board = (Standing & { name: string; me: boolean })[];
type ChallengeView = Challenge & { state: "upcoming" | "live" | "done"; board: Board };
type GroupView = { group: Group; memberNames: Record<number, string>; memberCount: number; coach: boolean; me: number; posts: GroupPost[]; chat: GroupMsg[]; challenges: ChallengeView[] };
export type GroupSummary = { id: string; trainerId?: number; name: string; about: string; cover: string; memberCount?: number; members?: number[]; live?: string | { name: string; start: string; days: number } | null; posts?: number };

const today = () => dayKeyOf();
const yesterday = () => dayKeyOf(new Date(Date.now() - 864e5));
const isPhoto = (c: string) => c.startsWith("data:");
const coverStyle = (c: string): React.CSSProperties => (isPhoto(c) ? { backgroundImage: `url(${c})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(140deg, ${c}, color-mix(in srgb, ${c} 55%, #000))` });
const liveName = (g: GroupSummary) => (typeof g.live === "string" ? g.live : g.live?.name ?? "");

/** A row of group cards (Arise Trainer's Clients tab, Arise Fit's Groups tab). */
export function GroupCards({ groups, onOpen, onNew }: { groups: GroupSummary[]; onOpen: (g: GroupSummary) => void; onNew?: () => void }) {
  return <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" data-testid="groups-row">
    {groups.map((g) => <button key={g.id} type="button" onClick={() => onOpen(g)} className="relative h-[124px] w-[200px] shrink-0 snap-start overflow-hidden rounded-[16px] p-3 text-left text-white" style={coverStyle(g.cover)}>
      <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.6))" }} />
      <span className="relative flex h-full flex-col justify-end">
        {liveName(g) && <span className="mb-auto inline-flex w-fit items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold backdrop-blur"><Flame className="h-3 w-3" />{liveName(g)}</span>}
        <span className="block truncate text-[20px] leading-none" style={display}>{g.name}</span>
        <span className="mt-1 block text-[12px] opacity-85">{(g.memberCount ?? g.members?.length ?? 0)} member{(g.memberCount ?? g.members?.length ?? 0) === 1 ? "" : "s"}</span>
      </span></button>)}
    {onNew && <button type="button" onClick={onNew} className="grid h-[124px] w-[120px] shrink-0 snap-start place-items-center rounded-[16px] text-center" style={{ background: C.card, border: `1.5px dashed ${C.line}` }} data-testid="group-new">
      <span><Plus className="mx-auto h-6 w-6" style={{ color: C.lime }} /><span className="mt-1 block text-[13px] font-semibold">New group</span></span></button>}
  </div>;
}

/** Arise Trainer: the groups strip on the Clients tab. */
export function TrainerGroups({ token, clients, say, seed, onSeeded }: { token: string | null; clients: { clientId: number; name: string; status: string }[]; say: (m: string) => void; seed?: number[] | null; onSeeded?: () => void }) {
  const { data, reload } = usePoll(() => coachApi<{ groups: GroupSummary[] }>(token, `/trainer/groups?today=${today()}`), [token], 60_000);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<Group | "new" | null>(null);
  useEffect(() => { if (seed?.length) setEdit("new"); }, [seed]);
  const groups = data?.groups ?? [];
  return <>
    <Title right={groups.length ? <button type="button" onClick={() => setEdit("new")} className="text-[14px] font-semibold" style={{ color: C.lime }}>New</button> : undefined}>Groups and challenges</Title>
    {groups.length ? <GroupCards groups={groups} onOpen={(g) => setOpen(g.id)} onNew={() => setEdit("new")} />
      : <Card onClick={() => setEdit("new")} className="!p-4" testId="group-empty"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: C.card2 }}><Users className="h-5 w-5" style={{ color: C.lime }} /></span>
        <span className="flex-1"><b className="block text-[16px]">Start a group</b><span className="text-[13px]" style={{ color: C.dim }}>A page, a group chat and challenges like a 21-day sugar reset, with a leaderboard.</span></span><Plus className="h-5 w-5" style={{ color: C.lime }} /></div></Card>}
    {edit && <GroupEditor token={token} initial={edit === "new" ? null : edit} seed={edit === "new" ? seed ?? [] : []} clients={clients} onClose={() => { setEdit(null); onSeeded?.(); }}
      onSaved={(g, created) => { setEdit(null); onSeeded?.(); reload(); say(created ? "Group made." : "Saved."); if (created) setOpen(g.id); }} onDeleted={() => { setEdit(null); setOpen(null); reload(); say("Group deleted."); }} />}
    {open && <GroupScreen token={token} gid={open} say={say} onClose={() => { setOpen(null); reload(); }} onSettings={(g) => setEdit(g)} />}
  </>;
}

export function GroupEditor({ token, initial, seed, clients, onClose, onSaved, onDeleted }: { token: string | null; initial: Group | null; seed: number[]; clients: { clientId: number; name: string; status: string }[]; onClose: () => void; onSaved: (g: Group, created: boolean) => void; onDeleted: () => void }) {
  const [g, setG] = useState({ name: initial?.name ?? "", about: initial?.about ?? "", cover: initial?.cover ?? COVER_COLORS[Math.floor(Math.random() * 6)], members: initial?.members ?? seed, memberPosts: initial?.memberPosts ?? true, chatOn: initial?.chatOn ?? true });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [q, setQ] = useState("");
  const active = clients.filter((c) => c.status === "active");
  const shown = active.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: number) => setG((x) => ({ ...x, members: x.members.includes(id) ? x.members.filter((m) => m !== id) : [...x.members, id] }));
  const save = async () => {
    setBusy(true); setErr("");
    try { const r = initial ? await put<{ group: Group }>(token, `/trainer/groups/${initial.id}`, { group: g }) : await post<{ group: Group }>(token, "/trainer/groups", { group: g }); onSaved(r.group, !initial); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const del = async () => { if (!initial || !window.confirm(`Delete ${initial.name}? Its posts, chat and challenges go too.`)) return; setBusy(true); try { await put(token, `/trainer/groups/${initial.id}`, { remove: true }); onDeleted(); } catch (e: any) { setErr(e.message); setBusy(false); } };
  return <Sheet title={initial ? "Group settings" : "New group"} onClose={onClose} testId="group-editor" right={<Btn className="!min-h-10 !px-3 !text-[15px]" disabled={busy || !g.name.trim()} onClick={save} testId="group-save">{initial ? "Save" : "Create"}</Btn>}>
    <div className="space-y-4">
      <div className="h-28 overflow-hidden rounded-[16px] p-3 text-white" style={coverStyle(g.cover)}><div className="flex h-full flex-col justify-end"><span className="text-[24px] leading-none" style={{ ...display, textShadow: "0 1px 8px rgba(0,0,0,.35)" }}>{g.name || "Group name"}</span></div></div>
      <div className="flex flex-wrap items-center gap-2">{COVER_COLORS.map((c) => <button key={c} type="button" aria-label={`Cover ${c}`} onClick={() => setG({ ...g, cover: c })} className="grid h-9 w-9 place-items-center rounded-full" style={{ background: c }}>{g.cover === c && <Check className="h-4 w-4 text-white" />}</button>)}
        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" style={{ background: C.card2 }}><Camera className="h-4 w-4" />Photo<input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const d = await shrinkImage(f, 900, 0.72); if (d.length <= 300_000) setG((x) => ({ ...x, cover: d })); else setErr("That photo is too large."); } }} /></label></div>
      <Field label="Name"><input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value.slice(0, 60) })} placeholder="Sugar squad, 6am crew, New moms…" className={inputCls} style={inputStyle} data-testid="group-name" /></Field>
      <Field label="About"><textarea value={g.about} onChange={(e) => setG({ ...g, about: e.target.value.slice(0, 600) })} rows={3} placeholder="What this group is for, and how it works" className="w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} /></Field>
      <Title right={active.length > 1 ? <button type="button" onClick={() => setG({ ...g, members: g.members.length === active.length ? [] : active.map((c) => c.clientId) })} className="text-[14px] font-semibold" style={{ color: C.lime }}>{g.members.length === active.length ? "None" : "All"}</button> : undefined}>Members · {g.members.length}</Title>
      {active.length > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className={inputCls} style={inputStyle} />}
      {active.length ? <div className="space-y-1.5">{shown.map((c) => { const on = g.members.includes(c.clientId); return <button key={c.clientId} type="button" onClick={() => toggle(c.clientId)} className="flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left" style={{ background: C.card }} data-testid={`group-m-${c.clientId}`}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px]" style={on ? { background: C.lime, color: "var(--fit-on-accent)" } : { border: `2px solid ${C.line}` }}>{on && <Check className="h-4 w-4" />}</span><span className="flex-1 font-semibold">{c.name}</span></button>; })}</div>
        : <p className="text-[14px]" style={{ color: C.dim }}>Invite clients first. Only your active clients can be in your groups.</p>}
      <div className="space-y-2">
        <Toggle on={g.memberPosts} onChange={(v) => setG({ ...g, memberPosts: v })} label="Members can post" sub="Off: only you post. Members can still like and comment." />
        <Toggle on={g.chatOn} onChange={(v) => setG({ ...g, chatOn: v })} label="Group chat" sub="Everyone in the group can message together." />
      </div>
    </div>
    {err && <p className="mt-3 text-[14px]" style={{ color: C.red }}>{err}</p>}
    <Btn className="mt-6 w-full" disabled={busy || !g.name.trim()} onClick={save}>{initial ? "Save group" : `Create group${g.members.length ? ` with ${g.members.length}` : ""}`}</Btn>
    {initial && <Btn kind="danger" className="mt-2 w-full" disabled={busy} onClick={del}><Trash2 className="h-4 w-4" />Delete group</Btn>}
  </Sheet>;
}
const Toggle = ({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub: string }) => <label className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: C.card }}>
  <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-6 w-6 accent-[var(--fit-accent)]" /><span className="flex-1"><b className="block text-[15px]">{label}</b><span className="text-[12px]" style={{ color: C.dim }}>{sub}</span></span></label>;

type Tab = "page" | "chat" | "challenge";
/** One group, for the coach or a member. */
export function GroupScreen({ token, gid, say, onClose, onSettings, onLeft }: { token: string | null; gid: string; say: (m: string) => void; onClose: () => void; onSettings?: (g: Group) => void; onLeft?: () => void }) {
  const { data, reload, err: error } = usePoll(() => coachApi<GroupView>(token, `/groups/${gid}?today=${today()}`), [token, gid], 30_000);
  const [tab, setTab] = useState<Tab>("page");
  const v = data;
  const live = v?.challenges.find((c) => c.state === "live");
  useEffect(() => { if (live && tab === "page" && !sessionStorage.getItem(`gtab-${gid}`)) { setTab("challenge"); } }, [!!live]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (t: Tab) => { setTab(t); try { sessionStorage.setItem(`gtab-${gid}`, t); } catch { /* fine */ } };
  if (!v) return <Sheet title="Group" onClose={onClose}><p className="py-10 text-center" style={{ color: C.dim }}>{error || "Loading…"}</p></Sheet>;
  const g = v.group;
  const tabs: { id: Tab; label: string }[] = [{ id: "page", label: "Page" }, ...(g.chatOn ? [{ id: "chat" as Tab, label: "Chat" }] : []), { id: "challenge", label: live ? "Challenge · live" : "Challenges" }];
  const leave = async () => { if (!window.confirm(`Leave ${g.name}?`)) return; try { await post(token, `/groups/${gid}/leave`); say("You left the group."); onLeft?.(); onClose(); } catch (e: any) { say(e.message); } };
  return <Sheet title={g.name} onClose={onClose} testId="group-screen" right={v.coach && onSettings ? <button type="button" aria-label="Group settings" onClick={() => onSettings(g)} className="grid h-10 w-10 place-items-center rounded-full" style={{ background: C.card }} data-testid="group-settings"><Settings className="h-5 w-5" /></button> : undefined}>
    <div className="-mx-4 -mt-2 mb-4 px-4">
      <div className="relative h-32 overflow-hidden rounded-[18px] p-4 text-white" style={coverStyle(g.cover)}>
        <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.55))" }} />
        <div className="relative flex h-full flex-col justify-end"><p className="text-[28px] leading-none" style={display}>{g.name}</p><p className="mt-1 text-[13px] opacity-90">{v.memberCount} member{v.memberCount === 1 ? "" : "s"}{v.coach ? "" : " · with your coach"}</p></div>
      </div>
      {g.about && <p className="mt-3 text-[15px] leading-relaxed" style={{ color: C.steel }}>{g.about}</p>}
    </div>
    <Chips label="Section" value={tab} onChange={pick} items={tabs} />
    <div key={tab} className="fit-in mt-4">
      {tab === "page" && <Page token={token} v={v} reload={reload} say={say} />}
      {tab === "chat" && <GroupChat token={token} gid={gid} me={v.me} initial={v.chat} />}
      {tab === "challenge" && <Challenges token={token} v={v} reload={reload} say={say} />}
    </div>
    {!v.coach && <button type="button" onClick={leave} className="mt-8 w-full py-3 text-center text-[13px] font-semibold" style={{ color: C.dim }}>Leave group</button>}
  </Sheet>;
}

function Page({ token, v, reload, say }: { token: string | null; v: GroupView; reload: () => void; say: (m: string) => void }) {
  const g = v.group;
  const [posts, setPosts] = useState(v.posts);
  useEffect(() => setPosts(v.posts), [v.posts]);
  const [text, setText] = useState(""); const [photo, setPhoto] = useState(""); const [busy, setBusy] = useState(false);
  const canPost = v.coach || g.memberPosts;
  const send = async () => {
    setBusy(true);
    try { const r = await post<{ post: GroupPost }>(token, `/groups/${g.id}/posts`, { text, photo }); setPosts((p) => [r.post, ...p]); setText(""); setPhoto(""); }
    catch (e: any) { say(e.message); } finally { setBusy(false); }
  };
  const swap = (p: GroupPost | null, id: string) => setPosts((all) => (p ? all.map((x) => (x.id === id ? p : x)) : all.filter((x) => x.id !== id)));
  return <div>
    {canPost && <Card className="mb-3 !p-3" testId="group-composer">
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 3000))} rows={text ? 3 : 2} placeholder={v.coach ? "Share a tip, a win or a plan for the week…" : "Share a win, a question or a photo…"} className="w-full resize-none rounded-[12px] p-3 text-[16px] outline-none" style={inputStyle} data-testid="group-post-text" />
      {photo && <div className="relative mt-2"><img src={photo} alt="" className="max-h-56 w-full rounded-[12px] object-cover" /><button type="button" aria-label="Remove photo" onClick={() => setPhoto("")} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white"><X className="h-4 w-4" /></button></div>}
      <div className="mt-2 flex items-center gap-2">
        <label className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold" style={{ background: C.card2 }}><Camera className="h-4 w-4" />Photo<input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const d = await shrinkImage(f, 1100, 0.72); if (d.length <= 300_000) setPhoto(d); else setPhoto(await shrinkImage(f, 800, 0.62)); } }} /></label>
        <Btn className="ml-auto !min-h-10 !px-4 !text-[15px]" disabled={busy || (!text.trim() && !photo)} onClick={send} testId="group-post">{busy ? "Posting…" : "Post"}</Btn></div>
    </Card>}
    {!canPost && <p className="mb-3 text-[13px]" style={{ color: C.dim }}>Your coach posts here. You can like and comment.</p>}
    {posts.length ? <div className="space-y-3">{posts.map((p) => <PostCard key={p.id} token={token} gid={g.id} p={p} me={v.me} coach={v.coach} onChange={(n) => swap(n, p.id)} say={say} />)}</div>
      : <Card className="text-center"><MessageCircle className="mx-auto h-7 w-7" style={{ color: C.dim }} /><p className="mt-2 text-[14px]" style={{ color: C.dim }}>{v.coach ? "Post a welcome and ask everyone to introduce themselves." : "Nothing here yet. Say hi!"}</p></Card>}
  </div>;
}

function PostCard({ token, gid, p, me, coach, onChange, say }: { token: string | null; gid: string; p: GroupPost; me: number; coach: boolean; onChange: (p: GroupPost | null) => void; say: (m: string) => void }) {
  const [open, setOpen] = useState(p.comments.length > 0 && p.comments.length <= 2);
  const [c, setC] = useState("");
  const liked = p.likes.includes(me);
  const act = async (fn: () => Promise<GroupPost | { post: GroupPost | null }>) => { try { const r: any = await fn(); onChange("post" in r ? r.post : r); } catch (e: any) { say(e.message); } };
  return <Card className="!p-3.5" testId="group-post-card">
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-bold" style={p.coach ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }}>{p.name.slice(0, 1).toUpperCase()}</span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 font-semibold"><span className="truncate">{p.name}</span>{p.coach && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: C.emberSoft, color: C.lime }}>Coach</span>}</span>
        <span className="block text-[12px]" style={{ color: C.dim }}>{ago(p.at)}{p.pinned ? " · Pinned" : ""}</span></span>
      {p.pinned && <Pin className="h-4 w-4" style={{ color: C.lime }} />}
    </div>
    {p.text && <p className="mt-2.5 whitespace-pre-line text-[16px] leading-relaxed">{p.text}</p>}
    {p.photo && <img src={p.photo} alt="" className="mt-2.5 max-h-[420px] w-full rounded-[12px] object-cover" loading="lazy" />}
    <div className="mt-2.5 flex items-center gap-1 border-t pt-2" style={{ borderColor: C.line }}>
      <button type="button" onClick={() => act(() => post(token, `/groups/${gid}/posts/${p.id}/like`))} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold" style={{ color: liked ? C.red : C.steel }} data-testid="group-like"><Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />{p.likes.length || ""}</button>
      <button type="button" onClick={() => setOpen(!open)} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold" style={{ color: C.steel }}><MessageCircle className="h-4 w-4" />{p.comments.length || "Comment"}</button>
      <span className="ml-auto flex gap-1">
        {coach && <button type="button" aria-label={p.pinned ? "Unpin" : "Pin"} onClick={() => act(() => put(token, `/groups/${gid}/posts/${p.id}`, { pinned: !p.pinned }))} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: p.pinned ? C.lime : C.dim }}><Pin className="h-4 w-4" /></button>}
        {(coach || p.by === me) && <button type="button" aria-label="Delete post" onClick={() => { if (window.confirm("Delete this post?")) void act(() => put(token, `/groups/${gid}/posts/${p.id}`, { remove: true })); }} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button>}
      </span>
    </div>
    {open && <div className="mt-1 space-y-2">
      {p.comments.map((x) => <div key={x.id} className="flex items-start gap-2">
        <div className="min-w-0 flex-1 rounded-[12px] px-3 py-2" style={{ background: C.card2 }}><p className="text-[13px] font-semibold">{x.name}<span className="ml-1.5 font-normal" style={{ color: C.dim }}>{ago(x.at)}</span></p><p className="whitespace-pre-line text-[15px]">{x.text}</p></div>
        {(coach || x.by === me) && <button type="button" aria-label="Delete comment" onClick={() => act(() => put(token, `/groups/${gid}/posts/${p.id}`, { comment: x.id }))} className="grid h-8 w-8 place-items-center" style={{ color: C.dim }}><X className="h-4 w-4" /></button>}</div>)}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!c.trim()) return; void act(() => post(token, `/groups/${gid}/posts/${p.id}/comments`, { text: c })).then(() => setC("")); }}>
        <input value={c} onChange={(e) => setC(e.target.value.slice(0, 1000))} placeholder="Write a comment" className="h-11 min-w-0 flex-1 rounded-full px-4 text-[16px] outline-none" style={inputStyle} data-testid="group-comment" />
        <button type="submit" aria-label="Send comment" disabled={!c.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-40" style={{ background: C.lime, color: "var(--fit-on-accent)" }}><Send className="h-4 w-4" /></button></form>
    </div>}
  </Card>;
}

function GroupChat({ token, gid, me, initial }: { token: string | null; gid: string; me: number; initial: GroupMsg[] }) {
  const [list, setList] = useState<GroupMsg[]>(initial);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const last = list.at(-1)?.at ?? "";
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [list.length]);
  useEffect(() => {
    const t = window.setInterval(() => { if (document.hidden) return; coachApi<{ chat: GroupMsg[] }>(token, `/groups/${gid}/chat${last ? `?after=${encodeURIComponent(last)}` : ""}`).then((r) => { if (r.chat.length) setList((l) => [...l, ...r.chat.filter((m) => !l.some((x) => x.id === m.id))]); }).catch(() => {}); }, 5000);
    return () => window.clearInterval(t);
  }, [token, gid, last]);
  const send = async () => {
    if (!text.trim()) return; setBusy(true); setErr("");
    try { const r = await post<{ msg: GroupMsg }>(token, `/groups/${gid}/chat`, { text }); setList((l) => [...l, r.msg]); setText(""); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return <div className="flex min-h-[55vh] flex-col" data-testid="group-chat">
    <div className="flex-1 space-y-2 pb-3">
      {!list.length && <p className="py-10 text-center text-[14px]" style={{ color: C.dim }}>Start the conversation.</p>}
      {list.map((m, i) => { const mine = m.by === me; const showName = !mine && list[i - 1]?.by !== m.by; return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[80%]">{showName && <p className="mb-0.5 ml-1 text-[12px] font-semibold" style={{ color: m.coach ? C.lime : C.dim }}>{m.name}{m.coach ? " · Coach" : ""}</p>}
          <div className="rounded-[16px] px-3.5 py-2.5" style={mine ? { background: C.lime, color: "var(--fit-on-accent)", borderBottomRightRadius: 4 } : { background: C.card2, borderBottomLeftRadius: 4 }}>
            <p className="whitespace-pre-line text-[15px] leading-snug">{m.text}</p><p className="mt-1 text-[10px] opacity-60">{ago(m.at)}</p></div></div></div>; })}
      <div ref={end} />
    </div>
    <div className="sticky bottom-0 pb-[max(8px,env(safe-area-inset-bottom))] pt-2" style={{ background: C.bg }}>
      {err && <p className="mb-1 text-[13px]" style={{ color: C.red }}>{err}</p>}
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={1} placeholder="Message the group" className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-[22px] px-4 py-3 text-[16px] outline-none" style={inputStyle} data-testid="group-chat-text" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !/iPhone|iPad|Android/.test(navigator.userAgent)) { e.preventDefault(); void send(); } }} />
        <button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-40" style={{ background: C.lime, color: "var(--fit-on-accent)" }} data-testid="group-chat-send"><Send className="h-5 w-5" /></button></form>
    </div>
  </div>;
}

function Challenges({ token, v, reload, say }: { token: string | null; v: GroupView; reload: () => void; say: (m: string) => void }) {
  const [making, setMaking] = useState(false);
  const order = { live: 0, upcoming: 1, done: 2 } as const;
  const list = [...v.challenges].sort((a, b) => order[a.state] - order[b.state] || b.start.localeCompare(a.start));
  return <div>
    {v.coach && <Btn className="mb-3 w-full" onClick={() => setMaking(true)} testId="challenge-new"><Trophy className="h-5 w-5" />Start a challenge</Btn>}
    {list.length ? <div className="space-y-4">{list.map((c) => <ChallengeCard key={c.id} token={token} gid={v.group.id} c={c} v={v} reload={reload} say={say} />)}</div>
      : <Card className="text-center"><Trophy className="mx-auto h-7 w-7" style={{ color: C.dim }} /><p className="mt-2 text-[14px]" style={{ color: C.dim }}>{v.coach ? "Run a sugar reset, a step challenge or your own. Members check off daily goals and climb the leaderboard." : "No challenges yet. Your coach will start one here."}</p></Card>}
    {making && <ChallengeMaker token={token} gid={v.group.id} onClose={() => setMaking(false)} onMade={() => { setMaking(false); reload(); say("Challenge started. Everyone was notified."); }} />}
  </div>;
}

function ChallengeCard({ token, gid, c, v, reload, say }: { token: string | null; gid: string; c: ChallengeView; v: GroupView; reload: () => void; say: (m: string) => void }) {
  const [log, setLog] = useState<Record<string, string[]>>(c.log[String(v.me)] ?? {});
  const [board, setBoard] = useState<Board>(c.board);
  const [day, setDay] = useState(today());
  const [all, setAll] = useState(false);
  useEffect(() => { setLog(c.log[String(v.me)] ?? {}); setBoard(c.board); }, [c]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = today(); const n = Math.min(c.days, Math.max(0, challengeDay(c, t)));
  const done = new Set(log[day] ?? []);
  const myPoints = board.find((b) => b.me);
  const check = async (task: string) => {
    const on = !done.has(task);
    setLog((l) => ({ ...l, [day]: on ? [...(l[day] ?? []), task] : (l[day] ?? []).filter((x) => x !== task) }));
    try { const r = await post<{ log: Record<string, string[]>; board: Board }>(token, `/groups/${gid}/challenges/${c.id}/check`, { task, day, on, today: t }); setLog(r.log); setBoard(r.board); }
    catch (e: any) { say(e.message); setLog(c.log[String(v.me)] ?? {}); }
  };
  const remove = async () => { if (!window.confirm(`Delete ${c.name}? Everyone's check-offs go too.`)) return; try { await put(token, `/groups/${gid}/challenges/${c.id}`, { remove: true }); reload(); } catch (e: any) { say(e.message); } };
  // The coach's view of today: who hasn't checked in yet.
  const quiet = v.coach && c.state === "live" ? v.group.members.filter((m) => !(c.log[String(m)]?.[t]?.length)) : [];
  const shown = all ? board : board.slice(0, 5);
  const pct = Math.round((n / c.days) * 100);
  const canYesterday = c.state === "live" && yesterday() >= c.start;
  return <Card className="!p-4" testId="challenge-card">
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: c.state === "live" ? C.lime : C.card2, color: c.state === "live" ? "var(--fit-on-accent)" : C.dim }}><Trophy className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-[22px] leading-none" style={display}>{c.name}</p>
        <p className="mt-1 text-[13px]" style={{ color: C.dim }}>{c.state === "live" ? `Day ${n} of ${c.days} · ends ${shortDate(challengeEnd(c))}` : c.state === "upcoming" ? `Starts ${shortDate(c.start)} · ${c.days} days` : `Finished ${shortDate(challengeEnd(c))}`}</p></div>
      {v.coach && <button type="button" aria-label="Delete challenge" onClick={remove} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button>}
    </div>
    {c.state === "live" && <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: C.track }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.lime }} /></div>}
    {c.about && <p className="mt-3 text-[14px] leading-relaxed" style={{ color: C.steel }}>{c.about}</p>}
    {c.prize && <p className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold"><Crown className="h-4 w-4" style={{ color: C.orange }} />Prize: {c.prize}</p>}

    {!v.coach && c.state === "live" && <div className="mt-4" data-testid="challenge-today">
      <div className="mb-2 flex items-center gap-2"><p className="flex-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: C.dim }}>{day === t ? "Today" : "Yesterday"}</p>
        {canYesterday && <button type="button" onClick={() => setDay(day === t ? yesterday() : t)} className="text-[13px] font-semibold" style={{ color: C.lime }}>{day === t ? "Forgot yesterday?" : "Back to today"}</button>}</div>
      <div className="space-y-2">{c.tasks.map((x) => { const on = done.has(x.id); return <button key={x.id} type="button" onClick={() => check(x.id)} className="flex min-h-14 w-full items-center gap-3 rounded-[14px] px-3.5 text-left transition" style={on ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }} data-testid="challenge-task">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={on ? { background: "rgba(255,255,255,.25)" } : { border: `2px solid ${C.line}` }}>{on && <Check className="h-4 w-4" />}</span>
        <span className="flex-1 text-[16px] font-semibold">{x.label}</span><span className="text-[13px] font-bold opacity-80">+{x.points}</span></button>; })}</div>
      {myPoints && <p className="mt-3 text-center text-[14px]" style={{ color: C.steel }}><b style={{ color: C.text }}>{myPoints.points}</b> points · <b style={{ color: C.text }}>{myPoints.perfect}</b> perfect day{myPoints.perfect === 1 ? "" : "s"}{myPoints.streak > 1 ? <> · <Flame className="inline h-4 w-4" style={{ color: C.orange }} /> {myPoints.streak}-day streak</> : ""}</p>}
    </div>}

    {quiet.length > 0 && <p className="mt-3 rounded-[10px] p-2.5 text-[13px]" style={{ background: C.card2, color: C.steel }}><b>{quiet.length}</b> haven't checked in today: {quiet.slice(0, 6).map((m) => v.memberNames[m] || "Member").join(", ")}{quiet.length > 6 ? "…" : ""}</p>}

    {c.state !== "upcoming" && board.length > 0 && <div className="mt-4" data-testid="challenge-board">
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide" style={{ color: C.dim }}>Leaderboard</p>
      <div className="space-y-1.5">{shown.map((b, i) => <div key={b.clientId} className="flex h-11 items-center gap-3 rounded-[12px] px-3" style={{ background: b.me ? C.emberSoft : C.card2 }}>
        <span className="w-6 text-center text-[16px] font-bold" style={{ color: i < 3 && b.points ? [C.orange, C.steel, C.lime][i] : C.dim }}>{i + 1}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{b.name}{b.me ? " (you)" : ""}</span>
        {b.streak > 1 && <span className="flex items-center gap-0.5 text-[12px] font-semibold" style={{ color: C.orange }}><Flame className="h-3.5 w-3.5" />{b.streak}</span>}
        <span className="w-14 text-right text-[15px] font-bold">{b.points}</span></div>)}</div>
      {board.length > 5 && <button type="button" onClick={() => setAll(!all)} className="mt-2 w-full text-center text-[13px] font-semibold" style={{ color: C.lime }}>{all ? "Top 5" : `All ${board.length}`}</button>}
      <p className="mt-2 text-center text-[11px]" style={{ color: C.dim }}>Up to {maxPoints(c)} points · ties go to more perfect days</p>
    </div>}
  </Card>;
}

function ChallengeMaker({ token, gid, onClose, onMade }: { token: string | null; gid: string; onClose: () => void; onMade: () => void }) {
  const [tpl, setTpl] = useState(CHALLENGE_TEMPLATES[0].id);
  const base = useMemo(() => CHALLENGE_TEMPLATES.find((t) => t.id === tpl), [tpl]);
  const fromTpl = (id: string) => { const t = CHALLENGE_TEMPLATES.find((x) => x.id === id); return { name: t?.name ?? "", about: t?.about ?? "", days: t?.days ?? 21, tasks: (t?.tasks ?? [{ label: "", points: 1 }]).map((x, i) => ({ id: `t${i}`, ...x })) }; };
  const [c, setC] = useState({ ...fromTpl(tpl), start: today(), prize: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const choose = (id: string) => { setTpl(id); setC((x) => ({ ...x, ...fromTpl(id) })); };
  const make = async () => { setBusy(true); setErr(""); try { await post(token, `/groups/${gid}/challenges`, { challenge: c, today: today() }); onMade(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const setTask = (i: number, p: Partial<{ label: string; points: number }>) => setC((x) => ({ ...x, tasks: x.tasks.map((t, k) => (k === i ? { ...t, ...p } : t)) }));
  return <Sheet title="New challenge" onClose={onClose} testId="challenge-maker" right={<Btn className="!min-h-10 !px-3 !text-[15px]" disabled={busy} onClick={make} testId="challenge-start">Start</Btn>}>
    <div className="space-y-4">
      <Field label="Start from"><div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{[...CHALLENGE_TEMPLATES.map((t) => ({ id: t.id, label: t.name })), { id: "own", label: "My own" }].map((t) => <button key={t.id} type="button" onClick={() => choose(t.id)} className="h-10 shrink-0 rounded-full px-3.5 text-[14px] font-semibold" style={tpl === t.id ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }} data-testid={`challenge-tpl-${t.id}`}>{t.label}</button>)}</div></Field>
      <Field label="Name"><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value.slice(0, 60) })} placeholder="21-day sugar reset" className={inputCls} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Starts"><input type="date" value={c.start} min={today()} onChange={(e) => setC({ ...c, start: e.target.value })} className={inputCls} style={inputStyle} /></Field>
        <Field label="Days"><input inputMode="numeric" value={c.days || ""} onChange={(e) => setC({ ...c, days: Math.min(90, Number(e.target.value.replace(/\D/g, "")) || 0) })} className={inputCls} style={inputStyle} /></Field></div>
      <Title right={c.tasks.length < 8 ? <button type="button" onClick={() => setC({ ...c, tasks: [...c.tasks, { id: `t${Date.now()}`, label: "", points: 1 }] })} className="text-[14px] font-semibold" style={{ color: C.lime }}>Add</button> : undefined}>Daily goals</Title>
      {c.tasks.map((t, i) => <div key={t.id} className="flex items-center gap-2">
        <input value={t.label} onChange={(e) => setTask(i, { label: e.target.value.slice(0, 80) })} placeholder="No added sugar today" className="h-12 min-w-0 flex-1 rounded-[12px] px-3 text-[16px] outline-none" style={inputStyle} />
        <select value={t.points} onChange={(e) => setTask(i, { points: Number(e.target.value) })} aria-label="Points" className="h-12 w-[74px] rounded-[12px] px-2 text-[15px] outline-none" style={inputStyle}>{[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{p} pt{p > 1 ? "s" : ""}</option>)}</select>
        <button type="button" aria-label="Remove goal" onClick={() => setC({ ...c, tasks: c.tasks.filter((_, k) => k !== i) })} className="grid h-12 w-8 place-items-center" style={{ color: C.dim }}><X className="h-4 w-4" /></button></div>)}
      <Field label="About (members see this)"><textarea value={c.about} onChange={(e) => setC({ ...c, about: e.target.value.slice(0, 800) })} rows={3} className="w-full rounded-[12px] p-3 text-[16px] outline-none" style={inputStyle} /></Field>
      <Field label="Prize (optional)"><input value={c.prize} onChange={(e) => setC({ ...c, prize: e.target.value.slice(0, 120) })} placeholder="Free session for the winner" className={inputCls} style={inputStyle} /></Field>
      {base && <p className="text-[12px]" style={{ color: C.dim }}>Members check off each goal every day (and can catch up on yesterday). Points add up on the leaderboard.</p>}
    </div>
    {err && <p className="mt-3 text-[14px]" style={{ color: C.red }}>{err}</p>}
    <Btn className="mt-6 w-full" disabled={busy} onClick={make}>Start challenge</Btn>
  </Sheet>;
}

/** Arise Fit: the groups a client is in with this trainer. */
export function MyGroups({ token, trainerId, say }: { token: string | null; trainerId: number; say: (m: string) => void }) {
  const { data, reload } = usePoll(() => coachApi<{ groups: GroupSummary[] }>(token, `/groups?today=${today()}`), [token], 60_000);
  const [open, setOpen] = useState<string | null>(null);
  const mine = (data?.groups ?? []).filter((g) => g.trainerId === trainerId);
  return <div data-testid="my-groups">
    {mine.length ? <div className="space-y-2.5">{mine.map((g) => <button key={g.id} type="button" onClick={() => setOpen(g.id)} className="relative block h-28 w-full overflow-hidden rounded-[16px] p-3.5 text-left text-white" style={coverStyle(g.cover)}>
      <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.6))" }} />
      <span className="relative flex h-full flex-col justify-end">{liveName(g) && <span className="mb-auto inline-flex w-fit items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold"><Flame className="h-3 w-3" />{liveName(g)}</span>}
        <span className="text-[22px] leading-none" style={display}>{g.name}</span><span className="mt-1 text-[12px] opacity-85">{g.memberCount} members</span></span></button>)}</div>
      : <Card className="text-center"><Users className="mx-auto h-7 w-7" style={{ color: C.dim }} /><p className="mt-2 text-[14px]" style={{ color: C.dim }}>{data ? "You're not in any groups yet. When your coach adds you to one, it shows up here." : "Loading…"}</p></Card>}
    {open && <GroupScreen token={token} gid={open} say={say} onClose={() => { setOpen(null); reload(); }} onLeft={reload} />}
  </div>;
}
