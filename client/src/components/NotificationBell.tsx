import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BookPlus, UserPlus, X, MessageSquare, Brain, ShieldCheck } from "lucide-react";
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

type ActionableType = "request" | "user" | "teacher" | "message" | "ai_quiz";
type ItemType = ActionableType | "parent" | "generic";
type IconType = "book" | "user" | "teacher" | "parent" | "message" | "ai" | "generic";

interface DisplayItem {
  key: string;
  type: ItemType;
  id: number;
  title: string;
  subtitle: string;
  icon: IconType;
  createdAt: string;
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);

  const fetchCount = async () => {
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
    fetchCount();
    const interval = window.setInterval(fetchCount, 15000);
    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (refreshKey > 0) fetchCount();
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
      ...(notifData.pendingAIQuizItems || []).map((item) => ({
        key: `ai-${item.id}`, type: "ai_quiz" as const, id: item.id,
        title: item.bookTitle || "AI Quiz Request",
        subtitle: `AI quiz • ${item.studentName || "Student"}`,
        icon: "ai" as const, createdAt: item.createdAt,
      })),
      ...(notifData.pendingTeacherItems || []).map((item) => ({
        key: `teacher-${item.id}`, type: "teacher" as const, id: item.id,
        title: item.displayName || "Teacher approval",
        subtitle: `${item.username ? `@${item.username} • ` : ""}Pending teacher approval`,
        icon: "teacher" as const, createdAt: item.createdAt,
      })),
      ...(notifData.pendingParentItems || []).map((item) => ({
        key: `parent-${item.id}`, type: "parent" as const, id: item.id,
        title: item.displayName || "Parent approval",
        subtitle: `${item.username ? `@${item.username} • ` : ""}Pending parent approval`,
        icon: "parent" as const, createdAt: item.createdAt,
      })),
      ...(notifData.pendingRequestItems || []).map((item) => ({
        key: `request-${item.id}`, type: "request" as const, id: item.id,
        title: item.bookTitle || "Book request",
        subtitle: `${item.author ? `by ${item.author} • ` : ""}${item.studentName || "Student"}`,
        icon: "book" as const, createdAt: item.createdAt,
      })),
      ...(notifData.newUserItems || []).map((item) => ({
        key: `user-${item.id}`, type: "user" as const, id: item.id,
        title: item.displayName || "New student",
        subtitle: item.username ? `@${item.username}` : "New student account",
        icon: "user" as const, createdAt: item.createdAt,
      })),
      ...(notifData.messageItems || []).map((item) => ({
        key: `message-${item.id}`, type: "message" as const, id: item.id,
        title: "New message", subtitle: item.messageText || "Open message",
        icon: "message" as const, createdAt: item.createdAt,
      })),
      ...(notifData.genericItems || []).map((item) => ({
        key: `generic-${item.id}`, type: "generic" as const, id: item.id,
        title: item.title || "Notification", subtitle: item.messageText || "",
        icon: "generic" as const, createdAt: item.createdAt,
      })),
    ];
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifData]);

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
      await fetchCount();
      return true;
    } catch {
      return false;
    } finally {
      if (key) setBusyKey(null);
    }
  };

  const handleBellClick = async () => {
    const opening = !showDropdown;
    setShowDropdown(opening);
    if (opening) {
      setLoading(true);
      await fetchCount();
      setLoading(false);
    }
  };

  const handleItemClick = async (item: DisplayItem) => {
    const ok = await updateSeen({ itemType: item.type, id: item.id }, item.key);
    if (!ok) return;
    setShowDropdown(false);
    if (["request", "user", "teacher", "message", "ai_quiz"].includes(item.type)) {
      onNavigate?.(item.type as ActionableType, item.id);
    }
  };

  const handleDismissItem = async (event: React.MouseEvent, item: DisplayItem) => {
    event.stopPropagation();
    await updateSeen({ itemType: item.type, id: item.id }, item.key);
  };

  const clearAll = async () => {
    setBusyKey("clear-all");
    const ok = await updateSeen({ all: true });
    setBusyKey(null);
    if (ok) setNotifData((previous) => ({ ...previous, unreadCount: 0, pendingRequestItems: [], newUserItems: [], pendingTeacherItems: [], pendingParentItems: [], pendingAIQuizItems: [], messageItems: [], genericItems: [] }));
  };

  const badgeCount = Math.max(0, Number(notifData.unreadCount) || items.length);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-full hover:bg-muted transition-colors"
        aria-label={badgeCount ? `Notifications, ${badgeCount} unread` : "Notifications"}
        aria-expanded={showDropdown}
      >
        <Bell className="w-5 h-5 text-foreground" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-14 sm:top-auto sm:mt-2 sm:w-[min(380px,calc(100vw-2rem))] max-h-[70vh] flex flex-col rounded-xl bg-card border border-border shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-[11px] text-muted-foreground">{badgeCount ? `${badgeCount} need${badgeCount === 1 ? "s" : ""} attention` : "You're all caught up"}</p>
            </div>
            {items.length > 0 && (
              <button
                onClick={clearAll}
                disabled={busyKey === "clear-all"}
                className="text-xs text-primary hover:underline disabled:opacity-50 whitespace-nowrap"
              >
                {busyKey === "clear-all" ? "Clearing…" : "Clear all"}
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-7">Checking notifications…</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-7">No new notifications</p>
            ) : (
              items.map((item) => {
                const busy = busyKey === item.key;
                return (
                  <div key={item.key} className="flex items-stretch border-b border-border/50 last:border-b-0 hover:bg-muted/50 transition-colors group">
                    <button
                      onClick={() => handleItemClick(item)}
                      disabled={busy}
                      className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left min-w-0 disabled:opacity-50"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.icon === "book" ? "bg-orange-500/20" :
                        item.icon === "user" ? "bg-blue-500/20" :
                        item.icon === "teacher" ? "bg-yellow-500/20" :
                        item.icon === "parent" ? "bg-cyan-500/20" :
                        item.icon === "ai" ? "bg-purple-500/20" : "bg-emerald-500/20"
                      }`}>
                        {item.icon === "book" ? <BookPlus className="w-4 h-4 text-orange-500" /> :
                         item.icon === "user" ? <UserPlus className="w-4 h-4 text-blue-400" /> :
                         item.icon === "teacher" ? <UserPlus className="w-4 h-4 text-yellow-400" /> :
                         item.icon === "parent" ? <ShieldCheck className="w-4 h-4 text-cyan-400" /> :
                         item.icon === "ai" ? <Brain className="w-4 h-4 text-purple-400" /> :
                         <MessageSquare className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-xs font-semibold truncate flex-1">{item.title}</p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{relativeTime(item.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-4">{item.subtitle}</p>
                      </div>
                    </button>
                    <button
                      onClick={(event) => handleDismissItem(event, item)}
                      disabled={busy}
                      className="px-2.5 flex items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-40"
                      aria-label={`Dismiss ${item.title}`}
                      title="Dismiss this notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
