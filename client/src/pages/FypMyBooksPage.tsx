import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Bookmark, Heart, BookOpen, TrendingUp } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface MyBook {
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
}

export default function FypMyBooksPage() {
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"saved" | "liked">("saved");
  const [savedBooks, setSavedBooks] = useState<MyBook[]>([]);
  const [likedBooks, setLikedBooks] = useState<MyBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchMyBooks = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/fyp/my-books`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setSavedBooks(data.savedBooks || []);
        setLikedBooks(data.likedBooks || []);
      } catch {}
      setLoading(false);
    };
    fetchMyBooks();
  }, []);

  const books = activeTab === "saved" ? savedBooks : likedBooks;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a", color: "white" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p>Loading your books...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <button
          onClick={() => navigate("/fyp")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "white", display: "flex", alignItems: "center" }}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, flex: 1 }}>My F.Y.P Books</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px" }}>
        <button
          onClick={() => setActiveTab("saved")}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: activeTab === "saved" ? "#f59e0b" : "rgba(255,255,255,0.1)",
            color: activeTab === "saved" ? "#000" : "white",
            fontWeight: 600,
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Bookmark size={16} />
          Saved ({savedBooks.length})
        </button>
        <button
          onClick={() => setActiveTab("liked")}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: activeTab === "liked" ? "#f59e0b" : "rgba(255,255,255,0.1)",
            color: activeTab === "liked" ? "#000" : "white",
            fontWeight: 600,
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Heart size={16} />
          Liked ({likedBooks.length})
        </button>
      </div>

      {/* Books grid */}
      {books.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.5)" }}>
          <Bookmark size={48} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
          <p style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 4px" }}>
            {activeTab === "saved" ? "No saved books yet" : "No liked books yet"}
          </p>
          <p style={{ fontSize: "0.85rem" }}>
            {activeTab === "saved"
              ? "Swipe through F.Y.P and tap the bookmark to save books for later"
              : "Swipe through F.Y.P and tap the heart to like books"}
          </p>
          <button
            onClick={() => navigate("/fyp")}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#f59e0b",
              color: "#000",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Browse F.Y.P
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
          padding: "0 16px",
        }}>
          {books.map((book) => (
            <div
              key={book.bookId}
              onClick={() => setExpandedId(expandedId === book.bookId ? null : book.bookId)}
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: 12,
                overflow: "hidden",
                cursor: "pointer",
                transition: "transform 0.2s",
              }}
            >
              {/* Cover */}
              {book.coverUrl && (
                <div style={{
                  width: "100%",
                  aspectRatio: "2/3",
                  backgroundImage: `url(${book.coverUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }} />
              )}
              {/* Info */}
              <div style={{ padding: "8px 10px" }}>
                <h3 style={{ fontSize: "0.8rem", fontWeight: 700, margin: "0 0 2px", lineHeight: 1.2 }}>
                  {book.title}
                </h3>
                <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  {book.author}
                </p>
                {book.pointsValue > 0 && (
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 6,
                    padding: "2px 8px",
                    background: "rgba(245,158,11,0.2)",
                    borderRadius: 100,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "#f59e0b",
                  }}>
                    <TrendingUp size={10} />
                    {book.pointsValue} pts
                  </div>
                )}
              </div>
              {/* Expanded summary */}
              {expandedId === book.bookId && (
                <div style={{ padding: "0 10px 10px" }}>
                  <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>
                    {book.expandedSummary || book.shortSummary || book.hookText}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {book.tags.map((tag) => (
                      <span key={tag} style={{
                        padding: "2px 8px",
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: 100,
                        fontSize: "0.65rem",
                        color: "rgba(255,255,255,0.7)",
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {book.readUrl && (
                      <a
                        href={book.readUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "6px 12px",
                          background: "#f59e0b",
                          color: "#000",
                          borderRadius: 8,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        <BookOpen size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
                        Read
                      </a>
                    )}
                    {book.pointsValue > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/quiz/${book.bookId}`);
                        }}
                        style={{
                          flex: 1,
                          padding: "6px 12px",
                          background: "rgba(255,255,255,0.15)",
                          color: "white",
                          borderRadius: 8,
                          border: "none",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Quiz
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
