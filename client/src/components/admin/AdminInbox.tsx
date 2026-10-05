// The admin inbox: everything students, parents and teachers send to the admin, as conversations.
// Opening a conversation marks it read in one step, so the inbox badge and the bell clear at once.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Inbox, Link2, MessageSquarePlus, RefreshCw, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/queryClient";
import { onNotificationsRefresh, refreshNotifications, relativeTime, sessionToken } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Avatar, EmptyState, INPUT_CLASS, StatusPill } from "./AdminUi";

type InboxMessage = {
  id: number;
  userId: number;
  studentName: string;
  studentUsername: string;
  senderRole?: string;
  messageText: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
};
type ThreadMessage = InboxMessage & { from: "them" | "me" };
type Person = { id: number; displayName: string; username: string };
type Conversation = { userId: number; name: string; username: string; role: string; lastText: string; lastAt: string; lastFromMe: boolean; unread: number; hasReport: boolean };

const REPORT = /^\[REPORT A PROBLEM(?: - ([^\]]+))?\]\s*/i;
const REVIEW = /^\[MANUAL REVIEW REQUEST\]\s*/i;

function readable(text: string): { label: string | null; body: string } {
  const report = REPORT.exec(text);
  if (report) return { label: `Problem report${report[1] ? ` · ${report[1]}` : ""}`, body: text.slice(report[0].length).trim() };
  const review = REVIEW.exec(text);
  if (review) return { label: "Grade review request", body: text.slice(review[0].length).trim() };
  return { label: null, body: text };
}

export default function AdminInbox({
  token, people, openConversation, onUnreadChange,
}: {
  token: string | null;
  people: Person[];
  /** Opens this person's conversation (for example from the bell). */
  openConversation?: { userId: number; nonce: number } | null;
  onUnreadChange?: (count: number) => void;
}) {
  const [incoming, setIncoming] = useState<InboxMessage[]>([]);
  const [sent, setSent] = useState<InboxMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "reports">("all");
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);
  const onUnreadRef = useRef(onUnreadChange);
  onUnreadRef.current = onUnreadChange;

  const headers = useCallback(() => ({ Authorization: `Bearer ${token || sessionToken()}`, "Content-Type": "application/json" }), [token]);

  const load = useCallback(async () => {
    try {
      const [inRes, sentRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/messages`, { headers: headers(), cache: "no-store" }),
        fetch(`${API_BASE}/api/admin/messages/sent`, { headers: headers(), cache: "no-store" }),
      ]);
      if (!inRes.ok || !sentRes.ok) throw new Error("load");
      const [inData, sentData] = await Promise.all([inRes.json(), sentRes.json()]);
      setIncoming(Array.isArray(inData) ? inData : []);
      setSent(Array.isArray(sentData) ? sentData : []);
      setError("");
    } catch {
      setError("Couldn't load messages.");
    } finally {
      setLoaded(true);
    }
  }, [headers]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000);
    const stop = onNotificationsRefresh(() => void load());
    return () => { window.clearInterval(interval); stop(); };
  }, [load]);

  const unreadTotal = useMemo(() => incoming.filter((m) => !m.isRead).length, [incoming]);
  useEffect(() => { onUnreadRef.current?.(unreadTotal); }, [unreadTotal]);

  const conversations = useMemo<Conversation[]>(() => {
    const map = new Map<number, Conversation>();
    const touch = (m: InboxMessage, fromMe: boolean) => {
      const existing = map.get(m.userId);
      const isReport = !fromMe && REPORT.test(m.messageText);
      if (!existing) {
        map.set(m.userId, {
          userId: m.userId, name: m.studentName || "Unknown", username: m.studentUsername || "", role: m.senderRole || "student",
          lastText: m.messageText, lastAt: m.createdAt, lastFromMe: fromMe, unread: !fromMe && !m.isRead ? 1 : 0, hasReport: isReport,
        });
        return;
      }
      if (!fromMe && !m.isRead) existing.unread += 1;
      if (isReport) existing.hasReport = true;
      if (!fromMe && m.senderRole) existing.role = m.senderRole;
      if (new Date(m.createdAt) > new Date(existing.lastAt)) { existing.lastAt = m.createdAt; existing.lastText = m.messageText; existing.lastFromMe = fromMe; }
    };
    incoming.forEach((m) => touch(m, false));
    sent.forEach((m) => touch(m, true));
    return Array.from(map.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }, [incoming, sent]);

  const visible = conversations.filter((c) => {
    if (filter === "unread" && !c.unread) return false;
    if (filter === "reports" && !c.hasReport) return false;
    const q = search.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
  });

  const active = activeId ? conversations.find((c) => c.userId === activeId) : null;
  const activePerson = activeId ? people.find((p) => p.id === activeId) : null;
  const thread = useMemo<ThreadMessage[]>(() => {
    if (!activeId) return [];
    return [
      ...incoming.filter((m) => m.userId === activeId).map((m) => ({ ...m, from: "them" as const })),
      ...sent.filter((m) => m.userId === activeId).map((m) => ({ ...m, from: "me" as const })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeId, incoming, sent]);

  const markRead = useCallback(async (userId: number) => {
    if (!incoming.some((m) => m.userId === userId && !m.isRead)) return;
    setIncoming((list) => list.map((m) => (m.userId === userId ? { ...m, isRead: true } : m)));
    try {
      await fetch(`${API_BASE}/api/admin/messages/conversation/${userId}/read`, { method: "POST", headers: headers() });
    } finally {
      refreshNotifications();
    }
  }, [incoming, headers]);

  const open = (userId: number) => {
    setActiveId(userId);
    setComposing(false);
    setDraft("");
    setLink("");
    setShowLink(false);
    setSendError("");
    void markRead(userId);
  };

  // Opened from the bell or another part of the page.
  useEffect(() => {
    if (openConversation?.userId) open(openConversation.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConversation?.nonce]);

  // New messages arriving while a conversation is open are read straight away.
  useEffect(() => {
    if (activeId) void markRead(activeId);
  }, [activeId, incoming, markRead]);

  useEffect(() => { threadEndRef.current?.scrollIntoView({ block: "end" }); }, [activeId, thread.length]);

  const send = async () => {
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${activeId}/message`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ messageText: draft.trim(), linkUrl: link.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not send.");
      setDraft("");
      setLink("");
      setShowLink(false);
      await load();
    } catch (e: any) {
      setSendError(e?.message || "Could not send.");
    } finally {
      setSending(false);
    }
  };

  const pickable = people
    .filter((p) => { const q = pickSearch.trim().toLowerCase(); return !q || p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q); })
    .slice(0, 40);

  const listPane = (
    <div className={cn("flex min-h-0 min-w-0 flex-col lg:w-[340px] lg:shrink-0 lg:border-r lg:border-border/60", activeId || composing ? "hidden lg:flex" : "flex")}>
      <div className="space-y-2 border-b border-border/60 p-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" className={cn(INPUT_CLASS, "pl-9")} aria-label="Search conversations" />
          </div>
          <Button onClick={() => { setComposing(true); setActiveId(null); setPickSearch(""); }} className="h-10 shrink-0" aria-label="New message">
            <MessageSquarePlus className="h-4 w-4" /><span className="hidden sm:inline">New</span>
          </Button>
        </div>
        <div className="flex gap-1.5">
          {([["all", "All"], ["unread", `Unread${unreadTotal ? ` (${unreadTotal})` : ""}`], ["reports", "Reports"]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", filter === value ? "border-primary/50 bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => void load()} className="ml-auto grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Check for new messages" title="Check now">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="m-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
        {!loaded ? (
          <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/40" />)}</div>
        ) : visible.length === 0 ? (
          <EmptyState icon={Inbox} title={conversations.length ? "Nothing matches" : "No messages yet"} hint={conversations.length ? "Try a different filter or search." : "Messages from students, parents and teachers show up here."} className="m-3" />
        ) : (
          <ul className="divide-y divide-border/50">
            {visible.map((c) => {
              const { label, body } = readable(c.lastText);
              return (
                <li key={c.userId}>
                  <button type="button" onClick={() => open(c.userId)} className={cn("flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40", activeId === c.userId && "bg-primary/10")}>
                    <Avatar name={c.name} tone={c.hasReport ? "red" : c.role === "parent" ? "cyan" : c.role === "teacher" ? "amber" : "violet"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("min-w-0 flex-1 truncate text-sm", c.unread ? "font-bold" : "font-medium")}>{c.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(c.lastAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {c.role !== "student" && <StatusPill tone={c.role === "parent" ? "cyan" : "amber"}>{c.role}</StatusPill>}
                        {label && !c.lastFromMe && <StatusPill tone="red">Report</StatusPill>}
                        <span className={cn("min-w-0 flex-1 truncate text-xs", c.unread ? "text-foreground" : "text-muted-foreground")}>{c.lastFromMe ? "You: " : ""}{body}</span>
                        {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const composePane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setComposing(false)} aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></Button>
        <p className="font-semibold">New message</p>
        <Button variant="ghost" size="sm" className="ml-auto hidden lg:inline-flex" onClick={() => setComposing(false)} aria-label="Close"><X className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-2 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} placeholder="Find a student by name or username" className={cn(INPUT_CLASS, "pl-9")} aria-label="Find a student" />
        </div>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto">
        {pickable.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => open(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40">
              <Avatar name={p.displayName} size="sm" />
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{p.displayName}</span><span className="block truncate text-xs text-muted-foreground">@{p.username}</span></span>
            </button>
          </li>
        ))}
        {pickable.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No student matches that.</li>}
      </ul>
    </div>
  );

  const name = active?.name || activePerson?.displayName || "Conversation";
  const username = active?.username || activePerson?.username || "";
  const threadPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setActiveId(null)} aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></Button>
        <Avatar name={name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          {username && <p className="truncate text-xs text-muted-foreground">@{username}{active && active.role !== "student" ? ` · ${active.role}` : ""}</p>}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {thread.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Write the first one below.</p>
        ) : thread.map((m) => {
          const { label, body } = m.from === "them" ? readable(m.messageText) : { label: null, body: m.messageText };
          return (
            <div key={`${m.from}-${m.id}`} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%]", m.from === "me" ? "rounded-br-md bg-primary text-primary-foreground" : label ? "rounded-bl-md border border-red-500/30 bg-red-500/10" : "rounded-bl-md border border-border bg-muted/50")}>
                {label && <p className="mb-1 flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-red-300"><AlertTriangle className="h-3 w-3" />{label}</p>}
                <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{body}</p>
                {m.linkUrl && <a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className={cn("mt-1 inline-flex items-center gap-1 text-xs underline", m.from === "me" ? "text-primary-foreground/85" : "text-primary")}><Link2 className="h-3 w-3" />Open link</a>}
                <p className={cn("mt-1 text-[11px]", m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground")}>{new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        <div ref={threadEndRef} />
      </div>
      <div className="space-y-2 border-t border-border/60 p-3">
        {sendError && <p className="text-xs text-red-300">{sendError}</p>}
        {showLink && (
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… (optional link)" className={INPUT_CLASS} aria-label="Link to include" />
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => setShowLink(!showLink)} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground", showLink && "border-primary/50 text-foreground")} aria-label="Add a link" title="Add a link">
            <Link2 className="h-4 w-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
            rows={Math.min(5, Math.max(1, draft.split("\n").length))}
            placeholder={`Message ${name}`}
            className="min-h-10 w-full min-w-0 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Your message"
          />
          <Button onClick={() => void send()} disabled={!draft.trim() || sending} className="h-10 shrink-0" aria-label="Send">
            <Send className="h-4 w-4" /><span className="hidden sm:inline">{sending ? "Sending…" : "Send"}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[min(78dvh,760px)] min-h-[460px] min-w-0 flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm lg:flex-row">
      {listPane}
      {composing ? composePane : activeId ? threadPane : (
        <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <EmptyState icon={Inbox} title="Pick a conversation" hint="Or start a new message to any student." className="border-0" />
        </div>
      )}
    </div>
  );
}
