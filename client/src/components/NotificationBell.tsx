import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BookPlus, UserPlus, X, MessageSquare, Brain, ShieldCheck, CheckCircle2, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

interface NotifItem {
  id: number;
  title?: string;
  bookTitle?: string;
  author?: string;
  studentName?: string;
  displayName?: string;
  username?: string;
  createdAt: string;
  messageText?: string;
  notificationType?: string;
}

interface NotifData {
  unreadCount: number;
  type: string;
  pendingRequestItems?: NotifItem[];
  newUserItems?: NotifItem[];
  pendingTeacherItems?: NotifItem[];
  pendingParentItems?: NotifItem[];
  pendingAIQuizItems?: NotifItem[];
  messageItems?: NotifItem[];
  genericItems?: NotifItem[];
}

export type ActionableType = "request" | "user" | "teacher" | "parent" | "message" | "ai_quiz";
type ItemType = ActionableType | "generic";
type IconType = "book" | "user" | "teacher" | "parent" | "message" | "ai" | "generic";

interface DisplayItem {
  key: string;
  type: ItemType;
  id: number;
  title: string;
  subtitle: string;
  icon: IconType;
  createdAt: string;
  actionable: boolean;
}

const SESSION_COOKIE = "arise_session";
function getTokenFromCookie(): string | null {
  try {
    for (const rawCookie of document.cookie.split(";")) {
      const cookie = rawCookie.trim();
      if (!cookie.startsWith(`${SESSION_COOKIE}=`)) continue;
      const raw = cookie.substring(SESSION_COOKIE.length + 1);
      const data = JSON.parse(atob(raw));
      return data.token || null;
    }
  } catch {}
  return null;
}

function relativeTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function iconClass(icon: IconType) {
  if (icon === "book") return "bg-orange-500/15 text-orange-500";
  if (icon === "user") return "bg-blue-500/15 text-blue-500";
  if (icon === "teacher") return "bg-amber-500/15 text-amber-500";
  if (icon === "parent") return "bg-cyan-500/15 text-cyan-500";
  if (icon === "ai") return "bg-violet-500/15 text-violet-500";
  if (icon === "message") return "bg-emerald-500/15 text-emerald-500";
  return "bg-slate-500/15 text-slate-500";
}

function ItemIcon({ icon }: { icon: IconType }) {
  const cls="h-4 w-4";
  if (icon === "book") return <BookPlus className={cls}/>;
  if (icon === "user" || icon === "teacher") return <UserPlus className={cls}/>;
  if (icon === "parent") return <ShieldCheck className={cls}/>;
  if (icon === "ai") return <Brain className={cls}/>;
  return <MessageSquare className={cls}/>;
}

export function NotificationBell({
  refreshKey = 0,
  onNavigate,
}: {
  refreshKey?: number;
  onNavigate?: (type: ActionableType, id: number) => void;
}) {
  const { token } = useAuth();
  const [notifData, setNotifData] = useState<NotifData>({ unreadCount: 0, type: "" });
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);

  const fetchNotifications = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    const sequence = ++requestSequence.current;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (sequence === requestSequence.current) setNotifData(data);
    } catch {}
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => void fetchNotifications(), 12000);
    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (refreshKey > 0) void fetchNotifications();
  }, [refreshKey]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = triggerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items = useMemo<DisplayItem[]>(() => {
    const combined: DisplayItem[] = [
      ...(notifData.pendingAIQuizItems || []).map((item) => ({
        key: `ai-${item.id}`, type: "ai_quiz" as const, id: item.id,
        title: item.bookTitle || "AI quiz awaiting review",
        subtitle: `${item.studentName || "Student"} • Review and approve or reject`,
        icon: "ai" as const, createdAt: item.createdAt, actionable: true,
      })),
      ...(notifData.pendingTeacherItems || []).map((item) => ({
        key: `teacher-${item.id}`, type: "teacher" as const, id: item.id,
        title: item.displayName || "Teacher approval",
        subtitle: `${item.username ? `@${item.username} • ` : ""}Waiting for account approval`,
        icon: "teacher" as const, createdAt: item.createdAt, actionable: true,
      })),
      ...(notifData.pendingParentItems || []).map((item) => ({
        key: `parent-${item.id}`, type: "parent" as const, id: item.id,
        title: item.displayName || "Parent approval",
        subtitle: `${item.username ? `@${item.username} • ` : ""}Waiting for account approval`,
        icon: "parent" as const, createdAt: item.createdAt, actionable: true,
      })),
      ...(notifData.pendingRequestItems || []).map((item) => ({
        key: `request-${item.id}`, type: "request" as const, id: item.id,
        title: item.bookTitle || "Book / quiz request",
        subtitle: `${item.studentName || "Student"}${item.author ? ` • ${item.author}` : ""}`,
        icon: "book" as const, createdAt: item.createdAt, actionable: true,
      })),
      ...(notifData.newUserItems || []).map((item) => ({
        key: `user-${item.id}`, type: "user" as const, id: item.id,
        title: item.displayName || "Student account",
        subtitle: item.username ? `@${item.username} • Needs attention` : "Student account needs attention",
        icon: "user" as const, createdAt: item.createdAt, actionable: true,
      })),
      ...(notifData.messageItems || []).map((item) => ({
        key: `message-${item.id}`, type: "message" as const, id: item.id,
        title: "New message", subtitle: item.messageText || "Open message",
        icon: "message" as const, createdAt: item.createdAt, actionable: false,
      })),
      ...(notifData.genericItems || []).map((item) => ({
        key: `generic-${item.id}`, type: "generic" as const, id: item.id,
        title: item.title || "Update", subtitle: item.messageText || "",
        icon: "generic" as const, createdAt: item.createdAt, actionable: false,
      })),
    ];
    return combined.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  }, [notifData]);

  const actionItems=items.filter(item=>item.actionable);
  const updateItems=items.filter(item=>!item.actionable);
  const badgeCount=items.length;

  const updateSeen = async (body: Record<string, unknown>, key?: string) => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return false;
    if (key) setBusyKey(key);
    try {
      const res = await fetch(`${API_BASE}/api/notifications/mark-seen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      await fetchNotifications();
      return true;
    } catch {
      return false;
    } finally {
      if (key) setBusyKey(null);
    }
  };

  const handleBellClick = async () => {
    const opening=!showDropdown;
    setShowDropdown(opening);
    if(opening){
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  };

  const handleItemClick = async (item: DisplayItem) => {
    // Action items remain visible until the underlying task is resolved or the
    // user explicitly dismisses it. Opening it should never make work vanish.
    if(item.actionable){
      setShowDropdown(false);
      onNavigate?.(item.type as ActionableType,item.id);
      return;
    }

    const ok=await updateSeen({itemType:item.type,id:item.id},item.key);
    if(!ok)return;
    setShowDropdown(false);
    if(item.type==="message") onNavigate?.("message",item.id);
  };

  const handleDismissItem=async(event:React.MouseEvent,item:DisplayItem)=>{
    event.stopPropagation();
    await updateSeen({itemType:item.type,id:item.id},item.key);
  };

  const clearAll=async()=>{
    setBusyKey("clear-all");
    const ok=await updateSeen({all:true});
    if(ok)setNotifData({unreadCount:0,type:notifData.type,pendingRequestItems:[],newUserItems:[],pendingTeacherItems:[],pendingParentItems:[],pendingAIQuizItems:[],messageItems:[],genericItems:[]});
    setBusyKey(null);
  };

  const renderItem=(item:DisplayItem)=>{
    const busy=busyKey===item.key;
    return <div key={item.key} className="group flex items-stretch border-b border-border/50 last:border-b-0 transition hover:bg-muted/45">
      <button onClick={()=>void handleItemClick(item)} disabled={busy} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left disabled:opacity-50">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconClass(item.icon)}`}><ItemIcon icon={item.icon}/></div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="flex-1 truncate text-xs font-black">{item.title}</p>
            <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{relativeTime(item.createdAt)}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{item.subtitle}</p>
          {item.actionable&&<span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-primary">Open task <ChevronRight className="h-3 w-3"/></span>}
        </div>
      </button>
      <button onClick={(event)=>void handleDismissItem(event,item)} disabled={busy} className="grid w-10 shrink-0 place-items-center text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label={`Dismiss ${item.title}`} title="Dismiss this notification"><X className="h-3.5 w-3.5"/></button>
    </div>;
  };

  const dropdown = showDropdown ? (
    <div
      ref={dropdownRef}
      className="fixed left-2 right-2 top-[4.5rem] z-[10000] flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151326] shadow-[0_28px_90px_rgba(0,0,0,.55)] ring-1 ring-violet-400/10 backdrop-blur-xl sm:left-auto sm:right-4 sm:w-[400px]"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/[.06] to-cyan-400/[.07] px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-black">Notifications</p>
            {badgeCount>0&&<span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-black text-violet-200">{badgeCount}</span>}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{actionItems.length? `${actionItems.length} item${actionItems.length===1?"":"s"} need attention` : "No action items waiting"}</p>
        </div>
        {items.length>0&&<button onClick={()=>void clearAll()} disabled={busyKey==="clear-all"} className="rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-white/[.07] hover:text-foreground disabled:opacity-50">{busyKey==="clear-all"?"Clearing…":"Clear all"}</button>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading&&items.length===0?<p className="py-8 text-center text-xs text-muted-foreground">Checking notifications…</p>:items.length===0?
          <div className="px-5 py-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-500/10 text-cyan-300"><CheckCircle2 className="h-6 w-6"/></div><p className="mt-3 text-sm font-black">You’re all caught up</p><p className="mt-1 text-xs text-muted-foreground">New tasks and updates will appear here.</p></div>
        :<>
          {actionItems.length>0&&<section><div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/10 bg-[#151326]/95 px-3 py-2 backdrop-blur"><span className="h-2 w-2 rounded-full bg-fuchsia-400"/><span className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">Needs action</span><span className="ml-auto text-[10px] font-bold text-fuchsia-300">{actionItems.length}</span></div>{actionItems.map(renderItem)}</section>}
          {updateItems.length>0&&<section><div className="sticky top-0 z-10 flex items-center gap-2 border-y border-white/10 bg-[#151326]/95 px-3 py-2 backdrop-blur"><span className="h-2 w-2 rounded-full bg-cyan-400"/><span className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">Updates</span><span className="ml-auto text-[10px] font-bold text-cyan-300">{updateItems.length}</span></div>{updateItems.map(renderItem)}</section>}
        </>}
      </div>

      {actionItems.length>0&&<div className="shrink-0 border-t border-white/10 bg-white/[.035] px-3 py-2 text-[10px] leading-4 text-muted-foreground">Opening a task does <strong>not</strong> remove it. It disappears when the task is resolved, or when you dismiss it with ×.</div>}
    </div>
  ) : null;

  return <>
    <div className="relative" ref={triggerRef}>
      <button onClick={()=>void handleBellClick()} className="relative rounded-full p-2 transition-colors hover:bg-muted" aria-label={badgeCount?`Notifications, ${badgeCount} items`:"Notifications"} aria-expanded={showDropdown}>
        <Bell className="h-5 w-5 text-foreground"/>
        {badgeCount>0&&<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black text-white">{badgeCount>99?"99+":badgeCount}</span>}
      </button>
    </div>
    {dropdown && typeof document !== "undefined" ? createPortal(dropdown, document.body) : null}
  </>;
}
