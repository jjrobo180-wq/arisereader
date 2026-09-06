import { useState, useEffect } from "react";
import { BookOpen, TrendingUp, Heart, Share2, ChevronDown } from "lucide-react";

interface ShareData {
  bookId: number;
  title: string;
  author: string;
  coverUrl: string;
  readUrl: string;
  pointsValue: number;
  hookText: string;
  shortSummary: string;
  expandedSummary: string;
  tags: string[];
  mood: string;
}

export default function FypSharePage({ token }: { token: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/fyp/share/${token}`);
        if (!res.ok) throw new Error("Share link not found");
        const d = await res.json();
        setData(d);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a", color: "white" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>Loading shared book...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a", color: "white", padding: "20px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>Book not found</div>
          <div style={{ opacity: 0.6, fontSize: "0.9rem" }}>This share link may have expired.</div>
          <a href="/" style={{ display: "inline-block", marginTop: "20px", padding: "10px 24px", background: "#f59e0b", borderRadius: "8px", color: "white", textDecoration: "none", fontWeight: 600 }}>
            Go to A.R.I.S.E Reader
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: "500px", width: "100%", textAlign: "center" }}>
        {data.coverUrl && (
          <img
            src={data.coverUrl}
            alt={data.title}
            style={{ width: "180px", height: "270px", objectFit: "cover", borderRadius: "8px", marginBottom: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
          />
        )}

        <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px" }}>{data.title}</h1>
        <p style={{ fontSize: "1rem", opacity: 0.6, marginBottom: "20px" }}>by {data.author}</p>

        <p style={{ fontSize: "1.1rem", fontWeight: 500, marginBottom: "12px" }}>{data.hookText}</p>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, opacity: 0.85, marginBottom: "16px" }}>{data.shortSummary}</p>

        {data.tags.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginBottom: "16px" }}>
            {data.tags.map((tag) => (
              <span key={tag} style={{ padding: "4px 12px", background: "rgba(255,255,255,0.1)", borderRadius: "16px", fontSize: "0.8rem" }}>{tag}</span>
            ))}
          </div>
        )}

        {data.pointsValue > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 14px", background: "#f59e0b", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 600, marginBottom: "20px" }}>
            <TrendingUp size={16} />
            {data.pointsValue} points
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "8px 20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", color: "white", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {expanded ? "Show less" : "Read more"}
            <ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
          </button>
        </div>

        {expanded && (
          <p style={{ fontSize: "0.95rem", lineHeight: 1.7, opacity: 0.9, marginBottom: "24px", textAlign: "left" }}>
            {data.expandedSummary}
          </p>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          {data.readUrl && (
            <a href={data.readUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 24px", background: "#f59e0b", borderRadius: "8px", color: "white", textDecoration: "none", fontWeight: 600 }}>
              <BookOpen size={18} />
              Read Book
            </a>
          )}
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 24px", background: "rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", textDecoration: "none", fontWeight: 600 }}>
            Join A.R.I.S.E Reader
          </a>
        </div>

        <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <p style={{ fontSize: "0.8rem", opacity: 0.4 }}>
            Shared via A.R.I.S.E F.Y.P — personalized book discovery for students
          </p>
        </div>
      </div>
    </div>
  );
}
