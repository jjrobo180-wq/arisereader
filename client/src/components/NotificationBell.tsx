import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BookPlus, UserPlus, X, MessageSquare, Brain, ShieldCheck, Users, FileSearch, RefreshCw, CheckCheck } from "lucide-react";
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
  reason?: string;
}

interface NotifData {
  unreadCount: number;
  type: string;
  pendingRequestItems?: NotifItem[];
  newUserItems?: NotifItem[];
  pendingTeacherItems?: NotifItem[];
  pendingParentItems?: NotifItem[];
  pendingAIQuizItems?: NotifItem[];
  pendingReviewItems?: NotifItem[];
  messageItems?: NotifItem[];
  genericItems?: NotifItem[];
}

export type NotificationActionType = "request" | "user" | "teacher" | "parent" | "message" | "ai_quiz" | "review";
type ItemType = NotificationActionType | "generic";
type IconType = "book" | "user" | "teacher" | "parent" | "message" | "ai" | "review" | "generic";

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
      const data = JSON.parse(atob(cookie.substring(SESSION_COOKIE.length + 1)));
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
  if (days < 30) return `${days}d`;
  return new Date(value).toLocaleDateString();
}

const iconFor = (type: IconType) => {
  if (type === "book") return <BookPlus className="h-4 w-4"/>;
  if (type === "user") return <UserPlus className="h-4 w-4"/>;
  if (type === "teacher") return <ShieldCheck className="h-4 w-4"/>;
  if (type === "parent") return <Users className="h-4 w-4"/>;
  if (type === "message") return <MessageSquare className="h-4 w-4"/>;
  if (type === "ai") return <Brain className="h-4 w-4"/>;
  if (type === "review") return <FileSearch className="h-4 w-4"/>;
  return <Bell className="h-4 w-4"/>;
};

export function NotificationBell({
  refreshKey = 0,
  onNavigate,
}: {
  refreshKey?: number;
  onNavigate?: (type: NotificationActionType, id: number) => void;
}) {
  const { token } = useAuth();
  const [notifData, setNotifData] = useState<NotifData>({ unreadCount: 0, type: "" });
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error,setError] = useState("");
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
      if (!res.ok) throw new Error("Could not load notifications");
      const data = await res.json();
      if (sequence === requestSequence.current) {
        setNotifData(data);
        setError("");
      }
    } catch {
      if (sequence === requestSequence.current) setError("Could not refresh notifications.");
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => void fetchNotifications(), 15000);
    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (refreshKey > 0) void fetchNotifications();
  }, [refreshKey]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items = useMemo<DisplayItem[]>(() => {
    const combined: DisplayItem[] = [
      ...(notifData.pendingAIQuizItems || []).map(item => ({
        key:`ai_quiz:${item.id}`,type:"ai_quiz" as const,id:item.id,
        title:item.bookTitle || "AI Quiz Pending Review",
        subtitle:`Review requested by ${item.studentName || "a student"}`,
        icon:"ai" as const,createdAt:item.createdAt,actionable:true,
      })),
      ...(notifData.pendingReviewItems || []).map(item => ({
        key:`review:${item.id}`,type:"review" as const,id:item.id,
        title:item.bookTitle || "Quiz grade review",
        subtitle:item.studentName ? `${item.studentName} asked for a review` : (item.reason || "A quiz needs review"),
        icon:"review" as const,createdAt:item.createdAt,actionable:true,
      })),
      ...(notifData.pendingTeacherItems || []).map(item => ({
        key:`teacher:${item.id}`,type:"teacher" as const,id:item.id,
        title:item.displayName || "Teacher approval",
        subtitle:`${item.username ? `@${item.username} • ` : ""}Waiting for account approval`,
        icon:"teacher" as const,createdAt:item.createdAt,actionable:true,
      })),
      ...(notifData.pendingParentItems || []).map(item => ({
        key:`parent:${item.id}`,type:"parent" as const,id:item.id,
        title:item.displayName || "Parent approval",
        subtitle:`${item.username ? `@${item.username} • ` : ""}Waiting for account approval`,
        icon:"parent" as const,createdAt:item.createdAt,actionable:true,
      })),
      ...(notifData.pendingRequestItems || []).map(item => ({
        key:`request:${item.id}`,type:"request" as const,id:item.id,
        title:item.bookTitle || "Book request",
        subtitle:`${item.author ? `by ${item.author} • ` : ""}${item.studentName || "Student"}`,
        icon:"book" as const,createdAt:item.createdAt,actionable:true,
      })),
      ...(notifData.newUserItems || []).map(item => ({
        key:`user:${item.id}`,type:"user" as const,id:item.id,
        title:item.displayName || "New student",
        subtitle:item.username ? `@${item.username}` : "New student account",
        icon:"user" as const,createdAt:item.createdAt,actionable:true,
      })),
      ...(notifData.messageItems || []).map(item => ({
        key:`message:${item.id}`,type:"message" as const,id:item.id,
        title:"New message",subtitle:item.messageText || "Open message",
        icon:"message" as const,createdAt:item.createdAt,actionable:false,
      })),
      ...(notifData.genericItems || []).map(item => ({
        key:`generic:${item.id}`,type:"generic" as const,id:item.id,
        title:item.title || "Update",subtitle:item.messageText || "",
        icon:"generic" as const,createdAt:item.createdAt,actionable:false,
      })),
    ];
    const seen=new Set<string>();
    return combined
      .filter(item=>{ if(seen.has(item.key)) return false; seen.add(item.key); return true; })
      .sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  }, [notifData]);

  const needsAction=items.filter(i=>i.actionable);
  const updates=items.filter(i=>!i.actionable);
  const badgeCount=items.length;

  const updateSeen = async (body: Record<string, unknown>, key?: string) => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return false;
    if (key) setBusyKey(key);
    try {
      const res = await fetch(`${API_BASE}/api/notifications/mark-seen`, {
        method:"POST",
        headers:{ Authorization:`Bearer ${authToken}`, "Content-Type":"application/json" },
        body:JSON.stringify(body),
      });
      if (!res.ok) return false;
      await fetchNotifications();
      return true;
    } catch {
      setError("Could not update that notification.");
      return false;
    } finally {
      if (key) setBusyKey(null);
    }
  };

  const handleBellClick=async()=>{
    const opening=!showDropdown;
    setShowDropdown(opening);
    if(opening){setLoading(true);await fetchNotifications();setLoading(false);}
  };

  const handleItemClick=async(item:DisplayItem)=>{
    // Actionable admin/teacher tasks stay in the bell until resolved or explicitly dismissed.
    if(item.type==="message" || item.type==="generic"){
      const ok=await updateSeen({itemType:item.type,id:item.id},item.key);
      if(!ok)return;
    }
    setShowDropdown(false);
    if(item.type!=="generic") onNavigate?.(item.type as NotificationActionType,item.id);
  };

  const handleDismissItem=async(event:React.MouseEvent,item:DisplayItem)=>{
    event.stopPropagation();
    await updateSeen({itemType:item.type,id:item.id},item.key);
  };

  const clearAll=async()=>{
    setBusyKey("clear-all");
    const ok=await updateSeen({all:true,items:items.map(i=>({type:i.type,id:i.id}))});
    if(ok)setNotifData({unreadCount:0,type:notifData.type});
    setBusyKey(null);
  };

  const renderItem=(item:DisplayItem)=>(
    <button
      type="button"
      key={item.key}
      onClick={()=>void handleItemClick(item)}
      disabled={busyKey===item.key}
      className="group flex w-full items-start gap-3 border-b border-border/60 px-3 py-3 text-left transition hover:bg-muted/60 disabled:opacity-50"
    >
      <span className={"mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl "+(item.actionable?"bg-amber-500/15 text-amber-500":"bg-primary/10 text-primary")}>{iconFor(item.icon)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <strong className="text-sm leading-5 text-foreground">{item.title}</strong>
          <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(item.createdAt)}</span>
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.subtitle}</span>
        {item.actionable && <span className="mt-1 inline-block text-[10px] font-black uppercase tracking-wider text-amber-500">Open task</span>}
      </span>
      <span
        role="button"
        tabIndex={0}
        title="Dismiss this notification"
        aria-label="Dismiss this notification"
        onClick={e=>void handleDismissItem(e,item)}
        onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();void handleDismissItem(e as any,item);}}}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
      ><X className="h-3.5 w-3.5"/></span>
    </button>
  );

  return <div className="relative" ref={dropdownRef}>
    <button
      onClick={()=>void handleBellClick()}
      className="relative rounded-full p-2 transition-colors hover:bg-muted"
      aria-label={badgeCount ? `Notifications, ${badgeCount} unread` : "Notifications"}
      aria-expanded={showDropdown}
    >
      <Bell className="h-5 w-5 text-foreground"/>
      {badgeCount>0&&<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{badgeCount>99?"99+":badgeCount}</span>}
    </button>

    {showDropdown&&<div className="fixed left-2 right-2 top-14 z-[180] flex max-h-[76vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[410px]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div><p className="text-sm font-black">Notifications</p><p className="text-[11px] text-muted-foreground">{badgeCount ? `${badgeCount} visible item${badgeCount===1?"":"s"}` : "You're all caught up"}</p></div>
        <div className="flex items-center gap-1">
          <button onClick={()=>void fetchNotifications()} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted" aria-label="Refresh notifications"><RefreshCw className={"h-3.5 w-3.5 "+(loading?"animate-spin":"")}/></button>
          {items.length>0&&<button onClick={()=>void clearAll()} disabled={busyKey==="clear-all"} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-primary hover:bg-primary/10 disabled:opacity-50"><CheckCheck className="h-3.5 w-3.5"/>Clear all</button>}
        </div>
      </div>
      {error&&<div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</div>}
      <div className="overflow-y-auto">
        {loading&&!items.length?<div className="p-8 text-center text-sm text-muted-foreground">Refreshing…</div>:
          !items.length?<div className="p-8 text-center"><Bell className="mx-auto h-8 w-8 text-muted-foreground/40"/><p className="mt-2 text-sm font-semibold">Nothing needs your attention.</p></div>:
          <>
            {!!needsAction.length&&<><div className="sticky top-0 z-10 bg-card/95 px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-amber-500 backdrop-blur">Needs action · {needsAction.length}</div>{needsAction.map(renderItem)}</>}
            {!!updates.length&&<><div className="sticky top-0 z-10 bg-card/95 px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-muted-foreground backdrop-blur">Updates · {updates.length}</div>{updates.map(renderItem)}</>}
          </>
        }
      </div>
    </div>}
  </div>;
}
