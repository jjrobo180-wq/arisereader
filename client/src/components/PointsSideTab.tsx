import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Trophy } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function PointsSideTab() {
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [show, setShow] = useState(false);
  const [points, setPoints] = useState(user?.totalPoints ?? 0);
  const [rank, setRank] = useState<number | null>(null);
  const [totalInBand, setTotalInBand] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!user) { setShow(false); return; }
    if (user.isAdmin || user.role === 'teacher' || user.role === 'parent') {
      setShow(false);
      return;
    }
    setShow(true);

    const fetchPoints = async () => {
      try {
        const token = document.cookie.split(';').find(c => c.trim().startsWith('arise_session'));
        if (!token) return;
        const raw = token.trim().substring('arise_session='.length);
        const session = JSON.parse(atob(raw));
        if (!session.token) return;
        const res = await fetch(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.totalPoints != null) setPoints(data.totalPoints);
        }
      } catch {}
    };
    fetchPoints();

    const fetchRank = async () => {
      try {
        const token = document.cookie.split(';').find(c => c.trim().startsWith('arise_session'));
        if (!token) return;
        const raw = token.trim().substring('arise_session='.length);
        const session = JSON.parse(atob(raw));
        if (!session.token) return;
        const res = await fetch(`${API_BASE}/api/leaderboard/my-standing`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.rank != null) setRank(data.rank);
          if (data.totalInBand != null) setTotalInBand(data.totalInBand);
        }
      } catch {}
    };
    fetchRank();

    const onHashChange = () => { fetchPoints(); fetchRank(); };
    const onPointsUpdated = () => { fetchPoints(); fetchRank(); };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('arise:points-updated', onPointsUpdated);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('arise:points-updated', onPointsUpdated);
    };
  }, [user]);

  if (!show) return null;

  // Higher position on both mobile and desktop so it doesn't block FYP like buttons
  const topPosition = isMobile ? "140px" : "120px";

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: topPosition,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Expanded panel */}
      {hovered && (
        <div
          style={{
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRight: "none",
            borderRadius: "12px 0 0 12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
            marginRight: "-2px",
          }}
        >
          <Trophy size={18} style={{ color: "#fbbf24" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
                {points}
              </span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600 }}>
                pts
              </span>
            </div>
            {rank != null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 13, lineHeight: 1 }}>
                  #{rank}
                </span>
                {totalInBand != null && (
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 600 }}>
                    of {totalInBand}
                  </span>
                )}
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 600 }}>
                  in band
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab handle */}
      <div
        style={{
          width: 44,
          height: rank != null ? 88 : 72,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          borderRight: "none",
          borderRadius: "12px 0 0 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          cursor: "pointer",
          boxShadow: "-2px 0 12px rgba(0,0,0,0.2)",
          transition: "all 0.2s",
        }}
      >
        <Trophy
          size={18}
          style={{ color: "#fbbf24" }}
        />
        <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 800 }}>
          {points}
        </span>
        {rank != null && (
          <span style={{ color: "#60a5fa", fontSize: 9, fontWeight: 700 }}>
            #{rank}
          </span>
        )}
      </div>
    </div>
  );
}
