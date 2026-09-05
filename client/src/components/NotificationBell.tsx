import { useState, useEffect, useRef } from "react";
import { Bell, BookPlus, UserPlus, X, MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

interface NotifItem {
  id: number;
  bookTitle?: string;
  author?: string;
  studentName?: string;
  displayName?: string;
  username?: string;
  createdAt: string;
  messageText?: string;
}

interface NotifData {
  unreadCount: number;
  type: string;
  pendingRequests?: number;
  newUsers?: number;
  pendingTeachers?: number;
  pendingRequestItems?: NotifItem[];
  newUserItems?: NotifItem[];
  pendingTeacherItems?: NotifItem[];
  messageItems?: NotifItem[];
}

const SESSION_COOKIE = "arise_session";
function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith(SESSION_COOKIE + "=")) {
        const raw = c.substring(SESSION_COOKIE.length + 1);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}

export function NotificationBell({
  refreshKey = 0,
  onNavigate,
}: {
  refreshKey?: number;
  onNavigate?: (type: "request" | "user" | "teacher" | "message", id: number) => void;
}) {
  const { token } = useAuth();
  const [notifData, setNotifData] = useState<NotifData>({ unreadCount: 0, type: "" });
  const [showDropdown, setShowDropdown] = useState(false);
  const [markedSeen, setMarkedSeen] = useState(false); // prevent re-mark loop
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchCount = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifData(data);
        setMarkedSeen(false); // new data loaded — allow re-mark next open
      }
    } catch {
      // ignore
    }
  };

  const markAllSeen = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken || markedSeen) return;
    try {
      await fetch(`${API_BASE}/api/notifications/mark-seen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setMarkedSeen(true);
      // Optimistically clear the badge count immediately
      setNotifData(prev => ({ ...prev, unreadCount: 0 }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, [token, getTokenFromCookie()]); // re-run when token changes

  useEffect(() => {
    if (refreshKey > 0) fetchCount();
  }, [refreshKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleBellClick = async () => {
    const willOpen = !showDropdown;
    setShowDropdown(willOpen);
    // Don't mark as seen on open — let the user click items first.
    // Marking as seen happens when user clicks an item or "Clear all".
  };

  const handleItemClick = (type: "request" | "user" | "teacher" | "message", id: number) => {
    setShowDropdown(false);
    // Mark notifications as seen when user clicks an item
    const authToken = token || getTokenFromCookie();
    if (authToken) {
      fetch(`${API_BASE}/api/notifications/mark-seen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).then(() => fetchCount()).catch(() => {});
    }
    setNotifData(prev => ({ ...prev, unreadCount: 0 }));
    onNavigate?.(type, id);
  };

  const handleDismissItem = (e: React.MouseEvent, type: "quiz_requests" | "new_users" | "pending_teachers" | "messages") => {
    e.stopPropagation();
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    // Mark just this type as seen (hides that item from the list)
    fetch(`${API_BASE}/api/notifications/mark-seen`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).then(() => fetchCount()).catch(() => {});
  };

  // Combined flat list of individual items for compact display
  const items: Array<{ key: string; type: "request" | "user" | "teacher" | "message"; id: number; title: string; subtitle: string; icon: "book" | "user" | "teacher" | "message" }> = [
    ...(notifData.pendingTeacherItems || []).map(t => ({
      key: `teacher-${t.id}`,
      type: "teacher" as const,
      id: t.id,
      title: t.displayName || "New teacher",
      subtitle: `@${t.username} — Pending approval`,
      icon: "teacher" as const,
    })),
    ...(notifData.pendingRequestItems || []).map(r => ({
      key: `req-${r.id}`,
      type: "request" as const,
      id: r.id,
      title: r.bookTitle || "Book request",
      subtitle: `by ${r.author || "Unknown"} — ${r.studentName || "Student"}`,
      icon: "book" as const,
    })),
    ...(notifData.newUserItems || []).map(u => ({
      key: `user-${u.id}`,
      type: "user" as const,
      id: u.id,
      title: u.displayName || "New student",
      subtitle: `@${u.username}`,
      icon: "user" as const,
    })),
    ...(notifData.messageItems || []).map(m => ({
      key: `msg-${m.id}`,
      type: "message" as const,
      id: m.id,
      title: "New message",
      subtitle: m.messageText || "",
      icon: "message" as const,
    })),
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-full hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {(notifData.unreadCount || 0) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {(notifData.unreadCount || 0) > 9 ? "9+" : notifData.unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-14 sm:top-auto sm:mt-2 sm:w-[min(320px,calc(100vw-2rem))] max-h-[60vh] flex flex-col rounded-xl bg-card border border-border shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-semibold">Notifications</span>
            {items.length > 0 && (
              <button
                onClick={() => {
                  const authToken = token || getTokenFromCookie();
                  if (!authToken) return;
                  fetch(`${API_BASE}/api/notifications/mark-seen`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  }).then(() => fetchCount()).catch(() => {});
                }}
                className="text-xs text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No new notifications</p>
            ) : (
              items.map((item) => (
                <div key={item.key} className="flex items-stretch hover:bg-muted/50 transition-colors group">
                  <button
                    onClick={() => handleItemClick(item.type, item.id)}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.icon === "book" ? "bg-orange-500/20" : item.icon === "user" ? "bg-blue-500/20" : item.icon === "teacher" ? "bg-yellow-500/20" : "bg-purple-500/20"
                    }`}>
                      {item.icon === "book" ? (
                        <BookPlus className="w-3.5 h-3.5 text-orange-500" />
                      ) : item.icon === "user" ? (
                        <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                      ) : item.icon === "teacher" ? (
                        <UserPlus className="w-3.5 h-3.5 text-yellow-400" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDismissItem(e, item.type === "request" ? "quiz_requests" : item.type === "user" ? "new_users" : item.type === "teacher" ? "pending_teachers" : "messages")}
                    className="px-2 flex items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
