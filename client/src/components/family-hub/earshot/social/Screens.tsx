// A post with its replies (reply, like, delete, report), and Activity (notifications by day).
import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Ban, Flag, Heart, Loader2, MessageCircle, Mic, MoreHorizontal, Repeat2, Trash2, UserPlus } from "lucide-react";
import { hiRes } from "@shared/earshot";
import { ActionSheet, Avatar, Empty, NameLine, PillButton, RichText, Spinner, TopBar, compactCount, shortAgo, type Comment, type Note, type Post, type SCtx } from "./kit";
import { PostCard, PostSkeleton } from "./PostCard";
import { ReportSheet } from "./Rules";
import { TabBtn } from "./Explore";

export function PostScreen({ start, ctx, onBack }: { start: Post | string; ctx: SCtx; onBack: () => void }) {
  const id = typeof start === "string" ? start : start.id;
  const [post, setPost] = useState<Post | null>(typeof start === "string" ? null : start);
  const [gone, setGone] = useState(false);
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [to, setTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<Comment | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ctx.api(`/api/earshot/social/posts/${id}`).then((b) => setPost(b.post)).catch(() => { if (typeof start === "string") setGone(true); });
    ctx.api(`/api/earshot/social/posts/${id}/comments`).then((b) => setList(b.comments || [])).catch(() => setList([]));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const threads = useMemo(() => {
    const all = list || [];
    return all.filter((c) => !c.parentId).map((c) => ({ c, replies: all.filter((r) => r.parentId === c.id) }));
  }, [list]);
  const send = () => {
    const body = text.trim();
    if (!body || busy) return;
    if (ctx.needProfile()) return;
    setBusy(true);
    ctx.api(`/api/earshot/social/posts/${id}/comments`, { method: "POST", body: { body, ...(to ? { parent: to.id } : {}) } })
      .then((b) => { setList((l) => [...(l || []), b.comment]); setText(""); setTo(null); setPost((p) => (p ? { ...p, comments: p.comments + 1 } : p)); })
      .catch((e) => ctx.say(e.message)).finally(() => setBusy(false));
  };
  const like = (c: Comment) => {
    if (ctx.needProfile()) return;
    const on = !c.liked;
    setList((l) => (l || []).map((x) => (x.id === c.id ? { ...x, liked: on, likes: Math.max(0, x.likes + (on ? 1 : -1)) } : x)));
    ctx.api(`/api/earshot/social/comments/${c.id}/like`, { method: "POST", body: { on } }).catch(() => {});
  };
  const remove = (c: Comment) => ctx.api(`/api/earshot/social/comments/${c.id}`, { method: "DELETE" }).then(() => { setList((l) => (l || []).filter((x) => x.id !== c.id && x.parentId !== c.id)); ctx.say("Reply deleted."); }).catch((e) => ctx.say(e.message));
  const [reporting, setReporting] = useState<Comment | null>(null);
  const report = (c: Comment) => setReporting(c);
  const replyTo = (c: Comment) => { setTo(c); setText((t) => (t.startsWith(`@${c.author.handle}`) ? t : `@${c.author.handle} ${t}`)); setTimeout(() => box.current?.focus(), 30); };

  const row = (c: Comment, nested = false) => <div key={c.id} className={`flex gap-3 py-3 pr-4 ${nested ? "pl-[60px]" : "pl-4"}`}>
    <Avatar p={c.author} size={nested ? 30 : 38} onClick={() => ctx.openProfile(c.author.handle)} />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1 text-[15px]"><NameLine p={c.author} onClick={() => ctx.openProfile(c.author.handle)} /><span className="muted truncate">@{c.author.handle} · {shortAgo(c.at)}</span>
        <button type="button" onClick={() => setMenu(c)} aria-label="More" className="hov muted -my-1 ml-auto grid h-8 w-8 flex-none place-items-center rounded-full"><MoreHorizontal size={17} /></button></div>
      <p className="text-[15px] leading-snug"><RichText text={c.body} onMention={ctx.openProfile} onTag={ctx.openTag} /></p>
      <div className="muted mt-1.5 flex items-center gap-6 text-[13px]">
        <button type="button" onClick={() => replyTo(c)} className="flex items-center gap-1.5 hover:text-[color:var(--link)]"><MessageCircle size={16} />Reply</button>
        <button type="button" onClick={() => like(c)} aria-pressed={c.liked} className={`flex items-center gap-1.5 ${c.liked ? "text-[color:var(--like)]" : "hover:text-[color:var(--like)]"}`}><Heart size={16} className={c.liked ? "fill-current" : ""} />{c.likes > 0 ? compactCount(c.likes) : ""}</button>
      </div>
    </div>
  </div>;

  return <div className="flex min-h-full flex-col">
    <TopBar onBack={onBack} title="Post" />
    {gone ? <Empty title="This post is gone" text="It was deleted or isn't available." /> : !post ? <PostSkeleton /> : <PostCard detail post={post} ctx={ctx} onChange={setPost} onGone={onBack} />}
    {post && <div className="flex-1">
      {!list ? <Spinner /> : !threads.length ? <p className="muted px-6 py-10 text-center text-[15px]">No replies yet. Start the conversation.</p>
        : <div className="divide">{threads.map(({ c, replies }) => <div key={c.id}>{row(c)}{replies.map((r) => row(r, true))}</div>)}</div>}
    </div>}
    {post && <div className="glass sticky bottom-0 border-t line px-3 py-2">
      {to && <p className="muted px-1 pb-1 text-[13px]">Replying to <span className="link">@{to.author.handle}</span> <button type="button" onClick={() => { setTo(null); setText(""); }} className="ml-1 font-semibold underline">Cancel</button></p>}
      <div className="flex items-end gap-2">
        {ctx.me && <Avatar p={ctx.me} size={32} />}
        <textarea ref={box} value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={1} placeholder="Post your reply" aria-label="Your reply"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="elev max-h-32 min-h-10 flex-1 resize-none rounded-2xl px-3.5 py-2.5 text-[15px] outline-none" />
        <PillButton kind="accent" onClick={send} disabled={!text.trim() || busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : "Reply"}</PillButton>
      </div>
    </div>}
    {menu && <ActionSheet onClose={() => setMenu(null)} items={[
      ...(menu.mine || post?.mine ? [{ label: "Delete reply", icon: <Trash2 size={18} />, danger: true, onClick: () => remove(menu) }] : []),
      ...(!menu.mine ? [{ label: "Report reply", icon: <Flag size={18} />, onClick: () => report(menu) }] : []),
      ...(!menu.mine ? [{ label: `Block @${menu.author.handle}`, icon: <Ban size={18} />, danger: true, onClick: () => ctx.api("/api/earshot/social/block", { method: "POST", body: { handle: menu.author.handle } }).then(() => { setList((l) => (l || []).filter((x) => x.author.handle !== menu.author.handle)); ctx.say(`You blocked @${menu.author.handle}.`); }).catch((e) => ctx.say(e.message)) }] : []),
      { label: `View @${menu.author.handle}`, icon: <AtSign size={18} />, onClick: () => ctx.openProfile(menu.author.handle) },
    ]} />}
    {reporting && <ReportSheet api={ctx.api} path={`/api/earshot/social/comments/${reporting.id}/report`} what="reply" onClose={() => setReporting(null)} onDone={(m, ok) => { const gone = reporting; ctx.say(m); if (ok && gone) setList((l) => (l || []).filter((x) => x.id !== gone.id)); }} />}
  </div>;
}

const WORDS: Record<Note["kind"], string> = {
  like: "liked your post", comment: "replied to your post", reply: "replied to your comment", follow: "followed you", repost: "reposted your post",
  comment_like: "liked your reply", episode: "posted a new episode", guestbook: "left you a note", mention: "mentioned you",
};
function NoteIcon({ kind }: { kind: Note["kind"] }) {
  if (kind === "like" || kind === "comment_like") return <Heart size={26} className="fill-[color:var(--like)] text-[color:var(--like)]" />;
  if (kind === "repost") return <Repeat2 size={26} className="text-[color:var(--repost)]" />;
  if (kind === "follow") return <UserPlus size={26} className="link" />;
  if (kind === "episode") return <Mic size={26} className="accent" />;
  if (kind === "mention") return <AtSign size={26} className="link" />;
  return <MessageCircle size={26} className="link" />;
}
const dayGroup = (iso: string) => { const d = (Date.now() - Date.parse(iso)) / 86_400_000; return d < 1 ? "Today" : d < 7 ? "This week" : "Earlier"; };

export function ActivityScreen({ ctx, onBack, onRead }: { ctx: SCtx; onBack: () => void; onRead: () => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [tab, setTab] = useState<"all" | "mentions">("all");
  useEffect(() => {
    ctx.api("/api/earshot/social/notifications").then((b) => { setNotes(b.notes || []); if ((b.notes || []).some((n: Note) => !n.read)) ctx.api("/api/earshot/social/notifications/read", { method: "POST" }).then(onRead).catch(() => {}); }).catch(() => setNotes([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = (notes || []).filter((n) => tab === "all" || n.kind === "mention" || n.kind === "reply" || n.kind === "comment");
  const groups = ["Today", "This week", "Earlier"].map((g) => ({ g, list: shown.filter((n) => dayGroup(n.at) === g) })).filter((x) => x.list.length);
  const open = (n: Note) => (n.post ? ctx.openPost(n.post.id) : ctx.openProfile(n.actor.handle));
  return <div className="min-h-full">
    <TopBar onBack={onBack} title="Notifications" />
    <div className="flex border-b line" role="tablist"><TabBtn on={tab === "all"} onClick={() => setTab("all")}>All</TabBtn><TabBtn on={tab === "mentions"} onClick={() => setTab("mentions")}>Mentions & replies</TabBtn></div>
    {!notes ? <Spinner /> : !groups.length ? <Empty title={tab === "all" ? "Nothing to see here yet" : "No mentions yet"} text={tab === "all" ? "Likes, replies, reposts and new followers will show up here." : "When someone mentions or replies to you, you'll see it here."} />
      : groups.map(({ g, list }) => <section key={g}>
        <h3 className="px-4 pb-1 pt-4 text-[17px] font-extrabold">{g}</h3>
        {list.map((n) => <button key={n.id} type="button" onClick={() => open(n)} className={`hov flex w-full gap-3 border-b line px-4 py-3 text-left ${n.read ? "" : "bg-[color:var(--hover)]"}`}>
          <span className="w-8 flex-none pt-1"><NoteIcon kind={n.kind} /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><Avatar p={n.actor} size={32} /><span className="muted ml-auto text-[13px]">{shortAgo(n.at)}</span></span>
            <span className="mt-2 block text-[15px] leading-snug"><b>{n.actor.name}</b> {WORDS[n.kind] ?? ""}</span>
            {(n.comment || n.post?.text) && <span className="muted mt-1 line-clamp-2 block text-[14px]">{n.comment || n.post?.text}</span>}
          </span>
          {n.post?.art && <img src={hiRes(n.post.art, 120)} alt="" referrerPolicy="no-referrer" className="h-12 w-12 flex-none rounded-lg object-cover" />}
        </button>)}
      </section>)}
  </div>;
}
