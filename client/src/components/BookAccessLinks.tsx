import { useState } from "react";
import { Book, ExternalLink, Headphones, BookOpen, Bell, Check } from "lucide-react";
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
}

/**
 * Shows links to read/find the book on Amazon, Learning Ally (free via Clever),
 * and Hoopla (free via public library). Includes a button to request Learning Ally
 * access if not available on Clever.
 */
export default function BookAccessLinks({ bookTitle, author, readUrl }: BookAccessLinksProps) {
  const [requested, setRequested] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

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

  return (
    <div className="mt-2">
      <button
        onClick={(e) => { e.stopPropagation(); setShowLinks(!showLinks); }}
        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <Book className="w-3.5 h-3.5" />
        {showLinks ? "Hide ways to read" : "Ways to read this book"}
      </button>

      {showLinks && (
        <div className="mt-2 space-y-2 p-3 rounded-lg bg-muted/20 border border-border" onClick={(e) => e.stopPropagation()}>
          {/* Direct read link if available */}
          {readUrl && (
            <a
              href={readUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
            >
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
              Read Online
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Amazon */}
          <a
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-orange-500" />
            Find on Amazon
          </a>

          {/* Learning Ally */}
          <div className="space-y-1">
            <a
              href={learningAllyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors"
            >
              <Headphones className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
              Learning Ally (audiobook)
              <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-[10px] text-muted-foreground ml-5">
              Free for students through Clever. Log in with your school account.
            </p>
            {requested ? (
              <div className="flex items-center gap-1.5 ml-5 text-[10px] text-green-500 font-medium">
                <Check className="w-3 h-3" /> Request sent! We'll add it to Clever soon.
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleRequestClever(); }}
                className="flex items-center gap-1 ml-5 text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
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
              className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0 text-purple-500" />
              Hoopla (eBook/audiobook)
              <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-[10px] text-muted-foreground ml-5">
              Free through your public library or Libby app. You just need a library card.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
