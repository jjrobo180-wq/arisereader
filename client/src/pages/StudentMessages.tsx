import { useEffect, useState, useCallback } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MessageSquare, Send, ExternalLink } from "lucide-react";

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

interface Message {
  id: number;
  senderType: string;
  messageText: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function StudentMessages() {
  const [match, params] = useRoute("/messages/:id");
  const studentId = match ? params.id : null;
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("");

  const fetchMessages = useCallback(async () => {
    if (!studentId) return;
    const authToken = token || getTokenFromCookie();
    if (!authToken) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/teacher/student/${studentId}/messages`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setMessages(arr);
      // Mark unread messages as read
      arr.forEach((m: Message) => {
        if (!m.isRead) {
          fetch(`${API_BASE}/api/messages/${m.id}/read`, {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
          }).catch(() => {});
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Get student name from messages or fetch profile
  useEffect(() => {
    if (!studentId) return;
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    fetch(`${API_BASE}/api/teacher/student/${studentId}/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.student?.displayName) setStudentName(data.student.displayName); })
      .catch(() => {});
  }, [studentId, token]);

  const handleSend = async () => {
    if (!messageText.trim() || !studentId) return;
    setSending(true);
    const authToken = token || getTokenFromCookie();
    if (!authToken) { setSending(false); return; }
    try {
      await fetch(`${API_BASE}/api/teacher/student/${studentId}/message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messageText, linkUrl: linkUrl || undefined }),
      });
      setMessageText("");
      setLinkUrl("");
      fetchMessages();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-3 h-16">
          <Button variant="ghost" size="sm" onClick={() => window.location.hash = "/teacher-dashboard"}>
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-white">
              {studentName ? `Messages with ${studentName}` : "Messages"}
            </h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? (
              <p className="text-red-400 text-center py-4">{error}</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Send one below!</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === "student" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl ${
                        msg.senderType === "student"
                          ? "bg-primary text-white rounded-tr-sm"
                          : "bg-muted/50 border border-border rounded-tl-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${
                          msg.senderType === "student" ? "text-white/80" : "text-muted-foreground"
                        }`}>
                          {msg.senderType === "student" ? studentName || "Student" : "Teacher"}
                        </span>
                        <span className={`text-xs ${
                          msg.senderType === "student" ? "text-white/60" : "text-muted-foreground"
                        }`}>
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={`text-sm ${
                        msg.senderType === "student" ? "text-white" : "text-white"
                      }`}>{msg.messageText}</p>
                      {msg.linkUrl && (
                        <a
                          href={msg.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 mt-2 text-xs hover:underline ${
                            msg.senderType === "student" ? "text-white/80" : "text-primary"
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open link
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Send message */}
            <div className="pt-3 border-t border-border space-y-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Send a message to this student..."
                rows={2}
              />
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Optional link URL"
                className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-white placeholder:text-muted-foreground"
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!messageText.trim() || sending}
              >
                <Send className="w-4 h-4 mr-1" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
