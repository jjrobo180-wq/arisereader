import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Heart, ThumbsDown, Share2, BookOpen, ArrowLeft, X, TrendingUp, ChevronDown, Bookmark, Gift } from "lucide-react";

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

interface FeedItem {
  bookId: number;
  title: string;
  author: string;
  pointsValue: number;
  coverUrl: string;
  readUrl: string;
  hookText: string;
  shortSummary: string;
  expandedSummary: string;
  tags: string[];
  mood: string;
  likeCount: number;
  dislikeCount: number;
  userReaction: string | null;
  userSaved: boolean;
  shareCount: number;
}

export default function FypPage() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [feedSessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dwellTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const loggedView = useRef<Set<number>>(new Set());
  const [easterEgg, setEasterEgg] = useState<{ visible: boolean; claimed: boolean; points: number; message: string }>({ visible: false, claimed: false, points: 0, message: "" });
  const eggCheckDone = useRef(false);

  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      const token = getTokenFromCookie();
      if (!token) {
        navigate("/");
        return;
      }
      const res = await fetch(`${API_BASE}/api/fyp/feed?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load feed");
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setItems(data.items);
      } else {
        setError("No books found for your grade level. Ask your teacher to add books to your band!");
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Check for easter eggs
  useEffect(() => {
    if (eggCheckDone.current) return;
    eggCheckDone.current = true;
    const checkEasterEggs = async () => {
      try {
        const token = getTokenFromCookie();
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/easter-eggs/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.active && !data.alreadyClaimed && data.remaining > 0) {
          // Show easter egg after a random delay (3-8 seconds)
          const delay = Math.random() * 5000 + 3000;
          setTimeout(() => {
            setEasterEgg({ visible: true, claimed: false, points: 2, message: "You found an Easter Egg!" });
          }, delay);
        }
      } catch {}
    };
    checkEasterEggs();
  }, []);

  const claimEasterEgg = async () => {
    try {
      const token = getTokenFromCookie();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/easter-eggs/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEasterEgg({ visible: true, claimed: true, points: data.points, message: data.message });
        setTimeout(() => setEasterEgg({ visible: false, claimed: false, points: 0, message: "" }), 4000);
      } else {
        setEasterEgg({ visible: false, claimed: false, points: 0, message: "" });
      }
    } catch {
      setEasterEgg({ visible: false, claimed: false, points: 0, message: "" });
    }
  };

  // Track which card is in view using IntersectionObserver
  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.getAttribute("data-index") || "0");
            setCurrentIndex(idx);
            const bookId = items[idx]?.bookId;
            if (bookId && !loggedView.current.has(bookId)) {
              loggedView.current.add(bookId);
              logEvent(bookId, "view");
              // Start dwell timer
              dwellTimers.current[bookId] = setTimeout(() => {
                logEvent(bookId, "dwell", 5000);
              }, 5000);
            }
            // Clear previous dwell timer for other books
            Object.keys(dwellTimers.current).forEach((key) => {
              const bid = parseInt(key);
              if (bid !== bookId) {
                clearTimeout(dwellTimers.current[bid]);
                delete dwellTimers.current[bid];
              }
            });
          }
        });
      },
      { threshold: 0.6 }
    );
    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [items]);

  const logEvent = async (bookId: number, eventType: string, dwellMs?: number) => {
    try {
      const token = getTokenFromCookie();
      if (!token) return;
      await fetch(`${API_BASE}/api/fyp/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookId, eventType, dwellMs, feedSessionId }),
      });
    } catch {}
  };

  const handleReaction = async (bookId: number, reaction: "like" | "dislike") => {
    try {
      const token = getTokenFromCookie();
      if (!token) return;
      const currentItem = items.find((i) => i.bookId === bookId);
      const newReaction = currentItem?.userReaction === reaction ? null : reaction;

      // Optimistic update
      setItems((prev) =>
        prev.map((item) => {
          if (item.bookId !== bookId) return item;
          const oldReaction = item.userReaction;
          let likeCount = item.likeCount;
          let dislikeCount = item.dislikeCount;
          if (oldReaction === "like" && newReaction !== "like") likeCount--;
          if (oldReaction === "dislike" && newReaction !== "dislike") dislikeCount--;
          if (newReaction === "like" && oldReaction !== "like") likeCount++;
          if (newReaction === "dislike" && oldReaction !== "dislike") dislikeCount++;
          return { ...item, userReaction: newReaction, likeCount, dislikeCount };
        })
      );

      await fetch(`${API_BASE}/api/fyp/reaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookId, reaction: newReaction }),
      });

      // Log the event
      logEvent(bookId, newReaction || "skip");
    } catch {}
  };

  const handleShare = async (bookId: number) => {
    try {
      const token = getTokenFromCookie();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/fyp/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookId }),
      });
      const data = await res.json();
      setShareUrl(data.shareUrl);
      setShowShareMenu(true);
      logEvent(bookId, "share");

      // Try native share
      if (navigator.share) {
        try {
          await navigator.share({
            title: items.find((i) => i.bookId === bookId)?.title || "Check out this book!",
            text: items.find((i) => i.bookId === bookId)?.hookText || "",
            url: data.shareUrl,
          });
        } catch {}
      }
    } catch {}
  };

  const handleReadMore = (bookId: number) => {
    const idx = items.findIndex(i => i.bookId === bookId);
    if (idx >= 0) setCurrentIndex(idx);
    setExpanded(true);
    logEvent(bookId, "expand");
  };

  const handleReadBook = (bookId: number) => {
    logEvent(bookId, "read_click");
    navigate(`/read/${bookId}`);
  };

  const handleTakeQuiz = (bookId: number) => {
    logEvent(bookId, "quiz_click");
    navigate(`/quiz/${bookId}`);
  };

  const handleSave = async (bookId: number, saved: boolean) => {
    try {
      const token = getTokenFromCookie();
      if (!token) return;
      // Optimistic update
      setItems((prev) =>
        prev.map((item) =>
          item.bookId === bookId ? { ...item, userSaved: saved } : item
        )
      );
      await fetch(`${API_BASE}/api/fyp/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookId, saved }),
      });
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a", color: "white" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>A.R.I.S.E F.Y.P</div>
          <div style={{ marginTop: "12px", fontSize: "0.9rem", opacity: 0.6 }}>Loading your personalized book feed...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a", color: "white", padding: "20px" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "12px" }}>A.R.I.S.E F.Y.P</div>
          <div style={{ opacity: 0.7, fontSize: "0.9rem" }}>{error}</div>
          <button
            onClick={() => navigate("/library")}
            style={{
              marginTop: "20px",
              padding: "10px 24px",
              background: "var(--accent-color, #f59e0b)",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", overflow: "hidden" }}>
      {/* Top bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
        }}
      >
        <button
          onClick={() => navigate("/library")}
          style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: "4px" }}
        >
          <ArrowLeft size={24} />
        </button>
        <div style={{ color: "white", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
          A.R.I.S.E F.Y.P
        </div>
        <button
          onClick={() => { window.location.hash = '/saved'; }}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", cursor: "pointer", padding: "6px 12px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
        >
          <Bookmark size={16} fill="white" />
          My Books
        </button>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        style={{
          height: "100vh",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="fyp-scroll"
      >
        {items.map((item, idx) => (
          <FypBookCard
            key={item.bookId}
            item={item}
            index={idx}
            ref={(el) => (itemRefs.current[idx] = el)}
            onLike={() => handleReaction(item.bookId, "like")}
            onDislike={() => handleReaction(item.bookId, "dislike")}
            onShare={() => handleShare(item.bookId)}
            onReadMore={() => handleReadMore(item.bookId)}
            onReadBook={() => handleReadBook(item.bookId)}
            onTakeQuiz={() => handleTakeQuiz(item.bookId)}
            onSave={(saved) => handleSave(item.bookId, saved)}
          />
        ))}

        {/* End card */}
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            scrollSnapAlign: "start",
            color: "white",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>You're all caught up!</div>
            <div style={{ opacity: 0.6, fontSize: "0.9rem" }}>More books coming soon</div>
            <button
              onClick={() => fetchFeed()}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "#f59e0b",
                color: "black",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Refresh Feed
            </button>
          </div>
        </div>
      </div>

      {/* Easter Egg Popup */}
      {easterEgg.visible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fypFadeIn 0.3s ease",
          }}
          onClick={() => !easterEgg.claimed && claimEasterEgg()}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #1a1a2e, #16213e)",
              border: "2px solid #f59e0b",
              borderRadius: 20,
              padding: "40px",
              textAlign: "center",
              maxWidth: 360,
              boxShadow: "0 0 60px rgba(245, 158, 11, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!easterEgg.claimed ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🥚</div>
                <h2 style={{ color: "#f59e0b", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>You Found an Easter Egg!</h2>
                <p style={{ color: "#ccc", fontSize: 15, marginBottom: 20 }}>Tap to claim your +2 leaderboard points!</p>
                <button
                  onClick={claimEasterEgg}
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #f97316)",
                    color: "#000",
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 32px",
                    fontSize: 18,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Gift size={20} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Claim +2 Points
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <h2 style={{ color: "#f59e0b", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{easterEgg.message}</h2>
                <p style={{ color: "#4ade80", fontSize: 32, fontWeight: 800 }}>+{easterEgg.points}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Expanded summary modal */}
      {expanded && items[currentIndex] && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            animation: "fypFadeIn 0.3s ease",
          }}
          onClick={() => setExpanded(false)}
        >
          <button
            style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "white", cursor: "pointer" }}
            onClick={() => setExpanded(false)}
          >
            <X size={28} />
          </button>
          <div style={{ maxWidth: "600px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            {items[currentIndex].coverUrl && (
              <img
                src={items[currentIndex].coverUrl}
                alt={items[currentIndex].title}
                style={{ width: "160px", height: "240px", objectFit: "cover", borderRadius: "8px", marginBottom: "20px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
              />
            )}
            <h2 style={{ color: "white", fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>{items[currentIndex].title}</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", marginBottom: "20px" }}>by {items[currentIndex].author}</p>
            <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "1rem", lineHeight: 1.7, marginBottom: "20px" }}>
              {items[currentIndex].expandedSummary}
            </p>
            {items[currentIndex].tags.length > 0 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginBottom: "20px" }}>
                {items[currentIndex].tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "4px 12px",
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: "16px",
                      color: "rgba(255,255,255,0.8)",
                      fontSize: "0.8rem",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {items[currentIndex].pointsValue > 0 && (
              <div style={{ color: "var(--accent-color, #f59e0b)", fontWeight: 600, marginBottom: "16px" }}>
                Earn {items[currentIndex].pointsValue} points by taking the quiz!
              </div>
            )}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              {items[currentIndex].readUrl && (
                <button
                  onClick={() => handleReadBook(items[currentIndex].bookId)}
                  style={{
                    padding: "10px 24px",
                    background: "var(--accent-color, #f59e0b)",
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Read Book
                </button>
              )}
              <button
                onClick={() => handleTakeQuiz(items[currentIndex].bookId)}
                style={{
                  padding: "10px 24px",
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Take Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShareMenu && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
          onClick={() => setShowShareMenu(false)}
        >
          <div style={{ background: "#1a1a1a", borderRadius: "12px", padding: "24px", maxWidth: "400px", width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ color: "white", fontWeight: 700 }}>Share this book</span>
              <button style={{ background: "none", border: "none", color: "white", cursor: "pointer" }} onClick={() => setShowShareMenu(false)}>
                <X size={20} />
              </button>
            </div>
            <input
              type="text"
              value={shareUrl}
              readOnly
              style={{
                width: "100%",
                padding: "10px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                color: "white",
                fontSize: "0.85rem",
                marginBottom: "12px",
              }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
              }}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--accent-color, #f59e0b)",
                border: "none",
                borderRadius: "8px",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Copy Link
            </button>
          </div>
        </div>
      )}

      <style>{`
        .fyp-scroll::-webkit-scrollbar { display: none; }
        @keyframes fypFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

interface CardProps {
  item: FeedItem;
  index: number;
  onLike: () => void;
  onDislike: () => void;
  onShare: () => void;
  onReadMore: () => void;
  onReadBook: () => void;
  onTakeQuiz: () => void;
  onSave: (saved: boolean) => void;
}

const FypBookCard = ({ item, index, onLike, onDislike, onShare, onReadMore, onReadBook, onTakeQuiz, onSave }: CardProps & { ref?: (el: HTMLDivElement | null) => void }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      data-index={index}
      style={{
        height: "100vh",
        scrollSnapAlign: "start",
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Background: book cover or gradient */}
      {item.coverUrl ? (
        <img
          src={item.coverUrl}
          alt={item.title}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${getMoodColor(item.mood)}, #1a1a2e)`,
          }}
        />
      )}

      {/* Dark gradient overlay for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "0 20px 100px 20px",
          maxWidth: "500px",
          width: "100%",
          color: "white",
        }}
      >
        {/* Title and author */}
        <h2 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "4px", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
          {item.title}
        </h2>
        <p style={{ fontSize: "0.9rem", opacity: 0.7, marginBottom: "12px", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
          by {item.author}
        </p>

        {/* Hook text */}
        <p style={{ fontSize: "1.05rem", lineHeight: 1.5, marginBottom: "8px", fontWeight: 500, textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
          {item.hookText}
        </p>

        {/* Short summary */}
        <p style={{ fontSize: "0.95rem", lineHeight: 1.5, opacity: 0.9, marginBottom: "12px", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
          {item.shortSummary}
        </p>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
            {item.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "3px 10px",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  backdropFilter: "blur(8px)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Points badge */}
        {item.pointsValue > 0 && (
          <div style={{ marginBottom: "12px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 12px",
                background: "var(--accent-color, #f59e0b)",
                borderRadius: "12px",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              <TrendingUp size={14} />
              {item.pointsValue} pts
            </span>
          </div>
        )}

        {/* Read more button */}
        <button
          onClick={onReadMore}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 16px",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "8px",
            color: "white",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          Read more
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Action rail (right side) */}
      <div
        style={{
          position: "absolute",
          right: "12px",
          bottom: "100px",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          alignItems: "center",
        }}
      >
        {/* Like button */}
        <button
          onClick={onLike}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: item.userReaction === "like" ? "var(--accent-color, #f59e0b)" : "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
              transition: "all 0.2s",
            }}
          >
            <Heart size={24} fill={item.userReaction === "like" ? "white" : "none"} color={item.userReaction === "like" ? "white" : "white"} />
          </div>
          <span style={{ color: "white", fontSize: "0.75rem", fontWeight: 600 }}>{item.likeCount}</span>
        </button>

        {/* Dislike button */}
        <button
          onClick={onDislike}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: item.userReaction === "dislike" ? "rgba(239,68,68,0.8)" : "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
              transition: "all 0.2s",
            }}
          >
            <ThumbsDown size={22} color="white" fill={item.userReaction === "dislike" ? "white" : "none"} />
          </div>
          <span style={{ color: "white", fontSize: "0.75rem", fontWeight: 600 }}>{item.dislikeCount}</span>
        </button>

        {/* Share button */}
        <button
          onClick={onShare}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <Share2 size={22} color="white" />
          </div>
          <span style={{ color: "white", fontSize: "0.75rem", fontWeight: 600 }}>Share</span>
        </button>

        {/* Save for later button */}
        <button
          onClick={() => onSave(!item.userSaved)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: item.userSaved ? "var(--accent-color, #f59e0b)" : "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
              transition: "all 0.2s",
            }}
          >
            <Bookmark size={22} color="white" fill={item.userSaved ? "white" : "none"} />
          </div>
          <span style={{ color: "white", fontSize: "0.75rem", fontWeight: 600 }}>Save</span>
        </button>

        {/* Read book / Take quiz / Info */}
        <button
          onClick={() => {
            if (item.readUrl) onReadBook();
            else if (item.pointsValue > 0) onTakeQuiz();
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <BookOpen size={22} color="white" />
          </div>
          <span style={{ color: "white", fontSize: "0.75rem", fontWeight: 600 }}>{item.readUrl ? "Read" : item.pointsValue > 0 ? "Quiz" : "Info"}</span>
        </button>
      </div>
    </div>
  );
};

function getMoodColor(mood: string): string {
  const colors: Record<string, string> = {
    adventure: "#0d7377",
    mystery: "#2c2c54",
    funny: "#e67e22",
    animals: "#27ae60",
    fantasy: "#8e44ad",
    friendship: "#e84393",
    family: "#d35400",
    nature: "#16a085",
    history: "#34495e",
    scary: "#1a1a2e",
    inspiring: "#c0392b",
    school: "#2980b9",
    story: "#2c3e50",
    classic: "#34495e",
    holiday: "#c0392b",
  };
  return colors[mood] || "#2c3e50";
}
