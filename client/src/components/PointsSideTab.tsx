import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Trophy } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function PointsSideTab() {
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [show, setShow] = useState(false);
  const [points, setPoints] = useState(user?.totalPoints ?? 0);

  useEffect(() => {
    if (!user) { setShow(false); return; }
    if (user.isAdmin || user.role === 'teacher' || user.role === 'parent') {
      setShow(false);
      return;
    }
    setShow(true);

    // Fetch fresh points from server
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

    // Refresh points when returning to any page (e.g. after claiming an egg)
    const onHashChange = () => fetchPoints();
    const onPointsUpdated = () => fetchPoints();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('arise:points-updated', onPointsUpdated);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('arise:points-updated', onPointsUpdated);
    };
  }, [user]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
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
            gap: 8,
            boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
            marginRight: "-2px",
          }}
        >
          <Trophy size={18} style={{ color: "#fbbf24" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
              {points}
            </span>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 600 }}>
              Points
            </span>
          </div>
        </div>
      )}

      {/* Tab handle */}
      <div
        style={{
          width: 44,
          height: 72,
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
      </div>
    </div>
  );
}
