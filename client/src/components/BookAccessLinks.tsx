import { useState } from "react";
import { Book, ExternalLink, Headphones, BookOpen, Bell, Check, Send } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

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

interface BookAccessLinksProps {
  bookTitle: string;
  author?: string;
  readUrl?: string | null;
  bookId?: number;
}

/**
 * Shows links to read/find the book on Amazon, Learning Ally (free via Clever),
 * and Hoopla (free via public library). Also includes a "Request from Teacher"
 * button so students can ask their teacher to help find any book.
 */
export default function BookAccessLinks({ bookTitle, author, readUrl, bookId }: BookAccessLinksProps) {
  const [requested, setRequested] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(bookTitle + (author ? ` ${author}` : ""))}`;
  const learningAllyUrl = `https://learningally.org`;
  const hooplaUrl = `https://www.hoopladigital.com/search?text=${encodeURIComponent(bookTitle)}`;

  const handleRequestClever = async () => {
    const authToken = getTokenFromCookie();
    try {
      await fetch(`${API_BASE}/api/books/request-learning-ally`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken || ""}` },
        body: JSON.stringify({ bookTitle, author }),
      });
      setRequested(true);
    } catch {}
  };

  const handleRequestTeacher = async () => {
    const authToken = getTokenFromCookie();
    setRequestLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/fyp/request-book`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken || ""}` },
        body: JSON.stringify({ bookId: bookId || null, title: bookTitle, author: author || "" }),
      });
      const data = await res.json();
      setRequestStatus(data.message || data.error || "Request sent!");
    } catch {
      setRequestStatus("Something went wrong. Please try again.");
    }
    setRequestLoading(false);
  };

  return (
    <div className="mt-3">
      <button
        onClick={(e) => { e.stopPropagation(); setShowLinks(!showLinks); }}
        className="flex items-center justify-center gap-2 w-full text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors rounded-xl py-3 px-4 border border-primary/30"
      >
        <Book className="w-4 h-4" />
        {showLinks ? "Hide ways to read" : "Ways to read this book"}
      </button>

      {showLinks && (
        <div className="mt-3 space-y-3 p-4 rounded-xl bg-muted/20 border border-border" onClick={(e) => e.stopPropagation()}>
          {/* Direct read link if available */}
          {readUrl && (
            <a
              href={readUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              Read Online
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Amazon */}
          <a
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-4 h-4 flex-shrink-0 text-orange-500" />
            Find on Amazon
          </a>

          {/* Learning Ally */}
          <div className="space-y-1">
            <a
              href={learningAllyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <Headphones className="w-4 h-4 flex-shrink-0 text-blue-500" />
              Learning Ally (audiobook)
              <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-[11px] text-muted-foreground ml-5">
              Free for students through Clever. Log in with your school account.
            </p>
            {requested ? (
              <div className="flex items-center gap-1.5 ml-5 text-[11px] text-green-500 font-medium">
                <Check className="w-3 h-3" /> Request sent! We'll add it to Clever soon.
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleRequestClever(); }}
                className="flex items-center gap-1 ml-5 text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                <Bell className="w-3 h-3" />
                Don't have it on Clever? Request it
              </button>
            )}
          </div>

          {/* Hoopla */}
          <div className="space-y-1">
            <a
              href={hooplaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <BookOpen className="w-4 h-4 flex-shrink-0 text-purple-500" />
              Hoopla (eBook/audiobook)
              <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-[11px] text-muted-foreground ml-5">
              Free through your public library or Libby app. You just need a library card.
            </p>
          </div>

          {/* Request from Teacher - works for ALL books */}
          <div className="pt-2 border-t border-border">
            {requestStatus ? (
              <div className="flex items-start gap-2 text-[11px] text-green-500 font-medium p-2 rounded-lg bg-green-500/10">
                <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {requestStatus}
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleRequestTeacher(); }}
                disabled={requestLoading}
                className="flex items-center justify-center gap-2 w-full text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors rounded-xl py-2.5 px-4"
              >
                <Send className="w-4 h-4" />
                {requestLoading ? "Sending..." : "Request from Teacher"}
              </button>
            )}
            <p className="text-[11px] text-muted-foreground mt-1 text-center">
              Can't find this book? Ask your teacher for help!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
