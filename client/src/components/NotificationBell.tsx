import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, BarChart3, Bell, BookPlus, Brain, CheckCircle2, ChevronRight, Eye, FileSearch, Gift,
  GraduationCap, MessageSquare, PartyPopper, RefreshCw, School, ShieldCheck, TrendingUp, UserPlus, Users, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { onNotificationsRefresh, relativeTime, sessionToken } from "@/lib/notifications";
import type { FeedCategory, FeedItem, FeedResponse } from "@shared/notifications";

/** The kind of thing an item links to; each page decides where that goes. */
export type ActionableType = string;

export type NotificationCounts = { actionCount: number; updateCount: number; unreadCount: number; inboxUnread: number };

const POLL_MS = 20_000;

const CATEGORY_STYLE: Record<FeedCategory, { icon: typeof Bell; tone: string }> = {
  teacher: { icon: GraduationCap, tone: "bg-amber-500/15 text-amber-300" },
  parent: { icon: ShieldCheck, tone: "bg-cyan-500/15 text-cyan-300" },
  student: { icon: Users, tone: "bg-blue-500/15 text-blue-300" },
  unlisted: { icon: School, tone: "bg-fuchsia-500/15 text-fuchsia-300" },
  ai_quiz: { icon: Brain, tone: "bg-violet-500/15 text-violet-300" },
  request: { icon: BookPlus, tone: "bg-orange-500/15 text-orange-300" },
  review: { icon: FileSearch, tone: "bg-orange-500/15 text-orange-300" },
  club: { icon: PartyPopper, tone: "bg-amber-500/15 text-amber-300" },
  grade_change: { icon: TrendingUp, tone: "bg-amber-500/15 text-amber-300" },
  eye_gaze: { icon: Eye, tone: "bg-sky-500/15 text-sky-300" },
  reward: { icon: Gift, tone: "bg-pink-500/15 text-pink-300" },
  message: { icon: MessageSquare, tone: "bg-emerald-500/15 text-emerald-300" },
  report: { icon: AlertTriangle, tone: "bg-red-500/15 text-red-300" },
  signup: { icon: UserPlus, tone: "bg-blue-500/15 text-blue-300" },
  quiz: { icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-300" },
  assessment: { icon: BarChart3, tone: "bg-violet-500/15 text-violet-300" },
  success: { icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-300" },
  info: { icon: Bell, tone: "bg-slate-500/15 text-slate-300" },
};

const EMPTY: FeedResponse = { type: "student", items: [], actionCount: 0, updateCount: 0, unreadCount: 0 };

export function NotificationBell({
  refreshKey = 0,
  onNavigate,
  onCounts,
}: {
  refreshKey?: number;
  onNavigate?: (type: ActionableType, id: number) => void;
  onCounts?: (counts: NotificationCounts) => void;
}) {
  const { token } = useAuth();
  const [feed, setFeed] = useState<FeedResponse>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  // Items already read or dismissed here, hidden at once while the server catches up.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState("");
  const [position, setPosition] = useState<{ top: number; right: number; mobile: boolean }>({ top: 64, right: 16, mobile: true });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const onCountsRef = useRef(onCounts);
  onCountsRef.current = onCounts;

  const authToken = useCallback(() => token || sessionToken(), [token]);

  const load = useCallback(async () => {
    const auth = authToken();
    if (!auth) return;
    const mine = ++sequence.current;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (mine !== sequence.current) return;
      const next: FeedResponse = Array.isArray(data?.items) ? data : EMPTY;
      setFeed(next);
      setFailed(false);
      setLoaded(true);
      // Forget hidden keys the server no longer sends.
      setHidden((current) => {
        if (!current.size) return current;
        const live = new Set(next.items.map((item) => item.key));
        const kept = new Set(Array.from(current).filter((key) => live.has(key)));
        return kept.size === current.size ? current : kept;
      });
    } catch {
      if (mine === sequence.current) { setFailed(true); setLoaded(true); }
    }
  }, [authToken]);

  // Check now, every 20 seconds while the page is visible, whenever it comes back into view,
  // and whenever another part of the page says something changed.
  useEffect(() => {
    void load();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const interval = window.setInterval(tick, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    const stop = onNotificationsRefresh(() => void load());
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      stop();
    };
  }, [load]);

  useEffect(() => { if (refreshKey > 0) void load(); }, [refreshKey, load]);

  const items = useMemo(() => feed.items.filter((item) => !hidden.has(item.key)), [feed.items, hidden]);
  const actions = items.filter((item) => item.kind === "action");
  const updates = items.filter((item) => item.kind === "update");
  const badge = actions.length + updates.length;

  useEffect(() => {
    onCountsRef.current?.({ actionCount: actions.length, updateCount: updates.length, unreadCount: badge, inboxUnread: feed.inboxUnread || 0 });
  }, [actions.length, updates.length, badge, feed.inboxUnread]);

  // Place the panel under the bell; full width on a phone.
  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    const mobile = window.innerWidth < 640;
    setPosition({ top: Math.round((rect?.bottom ?? 56) + 8), right: Math.max(8, Math.round(window.innerWidth - (rect?.right ?? window.innerWidth - 16))), mobile });
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  /** Reads or dismisses items: hidden at once, then saved; shown again if saving fails. */
  const markSeen = async (keys: string[], all = false) => {
    const auth = authToken();
    if (!auth || (!keys.length && !all)) return false;
    setActionError("");
    setHidden((current) => new Set([...Array.from(current), ...keys]));
    try {
      const res = await fetch(`${API_BASE}/api/notifications/mark-seen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify(all ? { all: true } : { keys }),
      });
      if (!res.ok) throw new Error(String(res.status));
      void load();
      return true;
    } catch {
      setHidden((current) => new Set(Array.from(current).filter((key) => !keys.includes(key))));
      setActionError("That didn't save. Check your connection and try again.");
      return false;
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) { setActionError(""); void load(); }
  };

  const openItem = (item: FeedItem) => {
    if (item.kind === "action") {
      // Opening a task keeps it in the list until the task itself is done.
      setOpen(false);
      if (item.target) onNavigate?.(item.target.type, item.target.id);
      return;
    }
    void markSeen([item.key]);
    if (item.target) { setOpen(false); onNavigate?.(item.target.type, item.target.id); }
  };

  const clearAll = async () => {
    const keys = items.map((item) => item.key);
    if (await markSeen(keys, true)) setOpen(false);
  };

  const renderItem = (item: FeedItem) => {
    const style = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.info;
    const Icon = style.icon;
    const linked = item.kind === "action" ? !!item.target && !!onNavigate : true;
    return (
      <li key={item.key} className="group flex items-stretch border-b border-white/[.06] last:border-b-0">
        <button
          type="button"
          onClick={() => openItem(item)}
          className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left transition hover:bg-white/[.04] focus-visible:bg-white/[.06] focus-visible:outline-none"
        >
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${style.tone}`}><Icon className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-foreground [overflow-wrap:anywhere]">{item.title}</span>
              <span className="shrink-0 pt-0.5 text-[11px] font-semibold text-muted-foreground">{relativeTime(item.createdAt)}</span>
            </span>
            {item.body && <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{item.body}</span>}
            {item.kind === "action" && linked && (
              <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold text-primary">Open <ChevronRight className="h-3 w-3" /></span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => void markSeen([item.key])}
          className="grid w-11 shrink-0 place-items-center text-muted-foreground transition hover:bg-white/[.05] hover:text-foreground"
          aria-label={item.kind === "action" ? `Dismiss: ${item.title}` : `Mark as read: ${item.title}`}
          title={item.kind === "action" ? "Dismiss" : "Mark as read"}
        >
          <X className="h-4 w-4" />
        </button>
      </li>
    );
  };

  const section = (label: string, list: FeedItem[], dot: string, extra?: ReactNode) => (
    <section aria-label={label}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[.08] bg-[#151326]/95 px-3 py-2 backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-[11px] font-black uppercase tracking-[.14em] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-bold text-muted-foreground">· {list.length}</span>
        <span className="ml-auto">{extra}</span>
      </div>
      <ul>{list.map(renderItem)}</ul>
    </section>
  );

  const panel = open ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      style={position.mobile ? { top: position.top, left: 8, right: 8 } : { top: position.top, right: position.right, width: 420 }}
      className="fixed z-[10000] flex max-h-[min(78vh,640px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151326] shadow-[0_28px_90px_rgba(0,0,0,.55)] ring-1 ring-violet-400/10"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/[.06] to-cyan-400/[.07] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-black">Notifications</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {!loaded ? "Checking…" : badge === 0 ? "Nothing new" : [actions.length && `${actions.length} need${actions.length === 1 ? "s" : ""} you`, updates.length && `${updates.length} update${updates.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => void load()} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/[.07] hover:text-foreground" aria-label="Check for new notifications" title="Check now">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {items.length > 0 && (
            <button type="button" onClick={() => void clearAll()} className="rounded-lg px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-white/[.07] hover:text-foreground">Clear all</button>
          )}
        </div>
      </div>

      {(failed || actionError) && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-200">
          <span>{actionError || "Couldn't check for notifications."}</span>
          <button type="button" onClick={() => { setActionError(""); void load(); }} className="shrink-0 font-bold underline">Retry</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {!loaded ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Checking notifications…</p>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-500/10 text-cyan-300"><CheckCircle2 className="h-6 w-6" /></div>
            <p className="mt-3 text-sm font-black">You're all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">New tasks and updates show up here.</p>
          </div>
        ) : (
          <>
            {actions.length > 0 && section("Needs you", actions, "bg-fuchsia-400")}
            {updates.length > 0 && section("Updates", updates, "bg-cyan-400", (
              <button type="button" onClick={() => void markSeen(updates.map((u) => u.key))} className="text-[11px] font-bold text-muted-foreground hover:text-foreground">Mark all read</button>
            ))}
          </>
        )}
      </div>

      {actions.length > 0 && (
        <p className="shrink-0 border-t border-white/10 bg-white/[.03] px-4 py-2 text-[11px] leading-4 text-muted-foreground">
          Tasks clear by themselves once they're done. Use × to hide one for now.
        </p>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        data-testid="notification-bell"
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted"
        aria-label={badge ? `Notifications, ${badge} new` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {badge > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-background">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </>
  );
}
