// Direct messages: the inbox, message requests, a new-message picker, and a chat.
import { useEffect, useRef, useState } from "react";
import { Ban, Flag, Image as ImageIcon, Loader2, MailPlus, MoreHorizontal, Search, Send } from "lucide-react";
import { ReportSheet } from "./Rules";
import { ActionSheet, Avatar, Empty, NameLine, NeedSignIn, PillButton, Sheet, Spinner, TopBar, shortAgo, uploadMedia, type Message, type Person, type Post, type Profile, type SCtx, type Thread } from "./kit";
import { Body } from "./PostCard";

export function InboxScreen({ ctx, requests, onOpen, onBack }: { ctx: SCtx; requests?: boolean; onOpen: (t: Thread) => void; onBack?: () => void }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [reqCount, setReqCount] = useState(0);
  const [picking, setPicking] = useState(false);
  const load = () => ctx.api(`/api/earshot/social/dm${requests ? "?box=requests" : ""}`).then((b) => { setThreads(b.threads || []); setReqCount(b.requests || 0); }).catch(() => setThreads([]));
  useEffect(() => { void load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [requests]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="min-h-full">
    <TopBar onBack={onBack} title={requests ? "Message requests" : "Messages"} right={!requests ? <button type="button" onClick={() => (ctx.needProfile() ? null : setPicking(true))} aria-label="New message" className="hov grid h-10 w-10 place-items-center rounded-full"><MailPlus size={20} /></button> : undefined} />
    {!requests && reqCount > 0 && <button type="button" onClick={() => onOpen({ id: "requests" } as Thread)} className="hov flex w-full items-center justify-between border-b line px-4 py-3 text-left"><b className="text-[15px]">Message requests</b><span className="bg-accent rounded-full px-2 text-[13px] font-bold">{reqCount}</span></button>}
    {!threads ? <Spinner /> : !threads.length ? <Empty title={requests ? "No message requests" : "Welcome to your inbox!"} text={requests ? "Messages from people you don't follow show up here first." : "Talk privately with people on Pod+. Share posts, episodes and photos."} action={!requests ? <PillButton kind="accent" onClick={() => (ctx.needProfile() ? null : setPicking(true))}>Write a message</PillButton> : undefined} />
      : threads.map((t) => <button key={t.id} type="button" onClick={() => onOpen(t)} className="hov flex w-full items-center gap-3 px-4 py-3 text-left">
        <Avatar p={t.with} size={52} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[15px]"><NameLine p={t.with} /><span className="muted truncate">@{t.with.handle} · {shortAgo(t.lastAt)}</span></span>
          <span className={`block truncate text-[15px] ${t.unread ? "font-bold" : "muted"}`}>{t.lastFromMe ? "You: " : ""}{t.lastText || "Say hi"}</span>
        </span>
        {t.unread && <span className="h-2.5 w-2.5 flex-none rounded-full bg-[color:var(--link)]" />}
      </button>)}
    {picking && <PeoplePicker ctx={ctx} title="New message" onClose={() => setPicking(false)} onPick={(p) => { setPicking(false); ctx.openChatWith(p.handle); }} />}
  </div>;
}

export function PeoplePicker({ ctx, title, onClose, onPick }: { ctx: SCtx; title: string; onClose: () => void; onPick: (p: Person) => void }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => ctx.api(`/api/earshot/social/people?q=${encodeURIComponent(q.trim())}`).then((b) => { if (live) setPeople(b.people || []); }).catch(() => { if (live) setPeople([]); }), 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, ctx]);
  return <Sheet title={title} onClose={onClose} full>
    <div className="px-4 py-3"><label className="elev flex min-h-11 items-center gap-2 rounded-full px-4"><Search size={18} className="muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" /></label></div>
    <div className="min-h-0 flex-1 overflow-y-auto">{!people ? <Spinner /> : !people.length ? <p className="muted px-6 py-8 text-center">No one found.</p>
      : people.map((p) => <button key={p.handle} type="button" onClick={() => onPick(p)} className="hov flex w-full items-center gap-3 px-4 py-2.5 text-left"><Avatar p={p} size={44} /><span className="min-w-0"><NameLine p={p} /><span className="muted block truncate text-[14px]">@{p.handle}</span></span></button>)}</div>
  </Sheet>;
}

const dayLabel = (iso: string) => { const d = new Date(iso); const t = new Date(); return d.toDateString() === t.toDateString() ? "Today" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === t.getFullYear() ? undefined : "numeric" }); };

export function ChatScreen({ thread, ctx, onBack }: { thread: Thread; ctx: SCtx; onBack: () => void }) {
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [info, setInfo] = useState<{ with: Profile | null; seenAt: string | null; request: boolean; waiting: boolean }>({ with: thread.with, seenAt: null, request: thread.request, waiting: false });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const pic = useRef<HTMLInputElement>(null);
  const last = useRef("0");
  const pull = (first = false) => ctx.api(`/api/earshot/social/dm/${thread.id}/messages${first ? "" : `?after=${last.current}`}`).then((b) => {
    const got: Message[] = b.messages || [];
    if (got.length) last.current = got[got.length - 1].id;
    setMsgs((l) => { const have = new Set((l || []).map((m) => m.id)); return first ? got : [...(l || []), ...got.filter((m) => !have.has(m.id))]; });
    setInfo({ with: b.with, seenAt: b.seenAt, request: !!b.request, waiting: !!b.waiting });
    if (got.length && got.some((m) => !m.mine)) ctx.api(`/api/earshot/social/dm/${thread.id}/read`, { method: "POST" }).catch(() => {});
  }).catch(() => { if (first) setMsgs([]); });
  useEffect(() => { void pull(true); const t = setInterval(() => pull(), 3500); return () => clearInterval(t); }, [thread.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs?.length]);
  const send = async (extra?: { media?: unknown[]; postId?: string }) => {
    const body = text.trim();
    if (!body && !extra) return;
    setBusy(true);
    try {
      const b = await ctx.api(`/api/earshot/social/dm/${thread.id}/messages`, { method: "POST", body: { body: extra ? "" : body, ...extra } });
      setMsgs((l) => [...(l || []), b.message]); last.current = b.message.id; if (!extra) setText("");
      setInfo((i) => ({ ...i, request: false }));
    } catch (e: any) { ctx.say(e?.message || "That didn't send."); } finally { setBusy(false); }
  };
  const photo = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const go = () => uploadMedia(ctx.api, f, () => {});
      let m; try { m = await go(); } catch (e) { if (e instanceof NeedSignIn && (await ctx.signIn())) m = await go(); else throw e; }
      await send({ media: [m] });
    } catch (e: any) { ctx.say(e instanceof NeedSignIn ? "Sign in with your email to send photos." : e?.message || "That didn't send."); } finally { setBusy(false); }
  };
  const accept = () => ctx.api(`/api/earshot/social/dm/${thread.id}/accept`, { method: "POST" }).then(() => setInfo((i) => ({ ...i, request: false }))).catch((e) => ctx.say(e.message));
  const decline = () => ctx.api(`/api/earshot/social/dm/${thread.id}`, { method: "DELETE" }).then(onBack).catch((e) => ctx.say(e.message));
  const block = () => ctx.api("/api/earshot/social/block", { method: "POST", body: { handle: thread.with.handle, on: true } }).then(() => { ctx.say(`You blocked @${thread.with.handle}.`); onBack(); }).catch((e) => ctx.say(e.message));
  const who = info.with || thread.with;
  // Report a message (the ⋯ under it) or the person, and block them, from the chat's ⋯ menu.
  const [chatMenu, setChatMenu] = useState(false);
  const [reporting, setReporting] = useState<{ path: string; what: string } | null>(null);
  const lastMine = [...(msgs || [])].reverse().find((m) => m.mine);
  const seen = lastMine && info.seenAt && Date.parse(info.seenAt) >= Date.parse(lastMine.at);

  return <div className="flex h-full min-h-full flex-col">
    <TopBar onBack={onBack} title={<button type="button" onClick={() => ctx.openProfile(who.handle)} className="flex items-center gap-2"><Avatar p={who} size={30} /><span className="truncate">{who.name}</span></button>}
      right={<button type="button" onClick={() => setChatMenu(true)} aria-label="Report or block" className="hov grid h-10 w-10 place-items-center rounded-full"><MoreHorizontal size={20} /></button>} />
    {chatMenu && <ActionSheet onClose={() => setChatMenu(false)} items={[
      { label: `Block @${who.handle}`, icon: <Ban size={18} />, danger: true, onClick: block },
      { label: `Report @${who.handle}`, icon: <Flag size={18} />, danger: true, onClick: () => setReporting({ path: `/api/earshot/social/profile/${encodeURIComponent(who.handle)}/report`, what: "account" }) },
    ]} />}
    {reporting && <ReportSheet api={ctx.api} path={reporting.path} what={reporting.what} onClose={() => setReporting(null)} onDone={(m) => ctx.say(m)} />}
    <div className="min-h-0 flex-1 px-3 py-3">
      {!msgs ? <Spinner /> : !msgs.length && <div className="py-8 text-center"><div className="mx-auto w-fit"><Avatar p={who} size={72} /></div><p className="mt-2 text-[17px] font-bold">{who.name}</p><p className="muted text-[14px]">@{who.handle}</p><PillButton small kind="line" className="mt-3" onClick={() => ctx.openProfile(who.handle)}>View profile</PillButton></div>}
      {msgs?.map((m, i) => {
        const showDay = i === 0 || dayLabel(msgs[i - 1].at) !== dayLabel(m.at);
        return <div key={m.id}>
          {showDay && <p className="muted py-3 text-center text-[12px] font-semibold">{dayLabel(m.at)}</p>}
          <div className={`flex ${m.mine ? "justify-end" : "justify-start"} py-0.5`}>
            <div className="max-w-[78%]">
              {m.media.map((x) => (x.type === "image" ? <img key={x.url} src={x.url} alt="" className="mb-1 max-h-72 rounded-2xl object-cover" /> : <video key={x.url} src={x.url} controls playsInline className="mb-1 max-h-72 rounded-2xl" />))}
              {m.post && <button type="button" onClick={() => ctx.openPost(m.post as Post)} className="mb-1 block w-64 overflow-hidden rounded-2xl border line p-3 text-left"><Body p={m.post} ctx={ctx} compact /></button>}
              {m.body && <p className={`whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-[15px] ${m.mine ? "rounded-br-md bg-[color:var(--link)] text-white" : "elev rounded-bl-md"}`}>{m.body}</p>}
              <p className={`muted mt-0.5 text-[11px] ${m.mine ? "text-right" : ""}`}>{new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{m.id === lastMine?.id && seen ? " · Seen" : ""}
                {!m.mine && <> · <button type="button" onClick={() => setReporting({ path: `/api/earshot/social/dm/${thread.id}/messages/${m.id}/report`, what: "message" })} className="underline-offset-2 hover:underline">Report</button></>}</p>
            </div>
          </div>
        </div>;
      })}
      {info.waiting && <p className="muted py-3 text-center text-[13px]">They'll see your message once they accept your request.</p>}
      <div ref={end} />
    </div>
    {info.request ? <div className="border-t line p-4 text-center">
      <p className="text-[15px]"><b>{who.name}</b> wants to message you.</p><p className="muted text-[13px]">They won't know you've seen it until you accept.</p>
      <div className="mt-3 flex justify-center gap-2"><PillButton kind="line" className="!text-[#f4212e]" onClick={block}>Block</PillButton><PillButton kind="line" onClick={decline}>Delete</PillButton><PillButton onClick={accept}>Accept</PillButton></div>
    </div> : <div className="glass sticky bottom-0 flex items-end gap-2 border-t line px-3 py-2">
      <button type="button" onClick={() => pic.current?.click()} aria-label="Send a photo" className="hov link grid h-10 w-10 flex-none place-items-center rounded-full"><ImageIcon size={20} /></button>
      <input ref={pic} type="file" accept="image/*,video/*" hidden onChange={(e) => { void photo(e.target.files?.[0]); e.target.value = ""; }} />
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={1} placeholder="Start a message" aria-label="Message"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} className="elev max-h-32 min-h-10 flex-1 resize-none rounded-2xl px-3.5 py-2.5 text-[15px] outline-none" />
      <button type="button" onClick={() => void send()} disabled={busy || !text.trim()} aria-label="Send" className="link grid h-10 w-10 flex-none place-items-center rounded-full disabled:opacity-40">{busy ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}</button>
    </div>}
  </div>;
}
