import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface StandingData {
  show: boolean;
  rank: number;
  totalInBand: number;
  myPoints: number;
  band: string | null;
  personAbove: { name: string; points: number } | null;
  pointsBehind: number;
  availableQuizzes: number;
  eggAvailable: boolean;
  recommendations: string[];
}

// Inject popup styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes lbBounce {
      0% { transform: scale(0.3); opacity: 0; }
      50% { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes lbFadeIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .lb-overlay {
      position: fixed; inset: 0; z-index: 95;
      display: flex; align-items: center; justify-content: center; padding: 16px;
      background: rgba(0,0,0,0.88); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      animation: lbFadeIn 0.3s ease;
    }
    .lb-card {
      border-radius: 24px; max-width: 440px; width: 100%; overflow: hidden; position: relative;
      background: linear-gradient(160deg, hsl(0 0% 7%), hsl(0 0% 10%));
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      animation: lbFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .lb-bar { height: 6px; width: 100%; }
    .lb-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 8px; }
    .lb-header-label { display: flex; align-items: center; gap: 8px; }
    .lb-header-label span { font-size: 11px; font-weight: 900; letter-spacing: 0.1em; color: rgba(255,255,255,0.4); }
    .lb-close { color: rgba(255,255,255,0.3); cursor: pointer; border: none; background: none; padding: 4px; }
    .lb-close:hover { color: white; }
    .lb-progress-wrap { padding: 0 20px 12px; }
    .lb-progress-track { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); overflow: hidden; }
    .lb-progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
    .lb-content { padding: 0 20px 20px; text-align: center; }
    .lb-emoji { font-size: 48px; margin-bottom: 8px; animation: lbBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .lb-title { font-size: 24px; font-weight: 900; margin: 0 0 4px; letter-spacing: -0.02em; }
    .lb-subtitle { font-size: 14px; color: rgba(255,255,255,0.6); margin: 0 0 16px; }
    .lb-points-box { border-radius: 16px; padding: 16px; margin-bottom: 16px; }
    .lb-points-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px; }
    .lb-points-num { font-size: 30px; font-weight: 900; }
    .lb-points-label { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.4); }
    .lb-band { font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; }
    .lb-above { border-radius: 12px; padding: 12px; margin-bottom: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
    .lb-above-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .lb-above-name { font-size: 14px; color: rgba(255,255,255,0.7); }
    .lb-above-name b { color: white; }
    .lb-above-hint { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; }
    .lb-badges { display: flex; gap: 8px; justify-content: center; }
    .lb-badge { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; }
    .lb-nav { display: flex; align-items: center; gap: 8px; margin-top: 20px; }
    .lb-skip { padding: 10px 12px; font-size: 14px; color: rgba(255,255,255,0.4); cursor: pointer; background: none; border: none; font-weight: 600; }
    .lb-skip:hover { color: rgba(255,255,255,0.7); }
    .lb-next { padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 900; border: none; cursor: pointer; color: #000; display: flex; align-items: center; gap: 8px; transition: transform 0.15s; }
    .lb-next:hover { transform: scale(1.05); }
    .lb-next:active { transform: scale(0.95); }
    .lb-cta { width: 100%; padding: 12px; border-radius: 16px; font-size: 14px; font-weight: 900; border: none; cursor: pointer; color: #000; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.15s; }
    .lb-cta:hover { transform: scale(1.02); }
    .lb-dots { padding: 0 20px 20px; display: flex; justify-content: center; gap: 8px; }
    .lb-dot { border: none; cursor: pointer; border-radius: 9999px; transition: all 0.3s; height: 8px; }
  `;
  document.head.appendChild(style);
}

export default function LeaderboardPopup({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, token: authToken } = useAuth();
  const fetched = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const healIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    if (!user) return;

    // Use token from AuthContext, fall back to cookie
    let token = authToken;
    if (!token) {
      const cookie = document.cookie.split(";").find(c => c.trim().startsWith("arise_session"));
      if (cookie) {
        try {
          const raw = cookie.trim().substring("arise_session=".length);
          const session = JSON.parse(atob(raw));
          token = session.token;
        } catch {}
      }
    }

    const loginCount = user.loginCount || 0;
    const isAdmin = user.isAdmin;
    const role = user.role;

    if (!token || isAdmin || role === "teacher" || role === "parent" || loginCount < 2) return;

    fetched.current = true;

    const doFetch = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard/my-standing`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: StandingData = await res.json();
        if (!data.show) return;

          // Wait for tutorial to finish
          setTimeout(() => {
            injectStyles();
            renderPopup(data);
            
            // Self-heal: if popup gets removed by React re-renders, re-add it
            // BUT only if it hasn't been dismissed by the user
            healIntervalRef.current = setInterval(() => {
              if (dismissedRef.current) return;
              const existing = document.getElementById('lb-popup-root');
              if (!existing) {
                renderPopup(data);
              }
            }, 500);
            // Stop healing after 30 seconds
            setTimeout(() => clearInterval(healIntervalRef.current), 30000);
          }, 2000);
        } catch {}
      };
      doFetch();
  }, [user, authToken]);

  function getRankInfo(rank: number, total: number) {
    if (rank === 1) return { title: "You're #1!", subtitle: "The champion of your band. Defend your throne.", emoji: "👑", color: "#fbbf24" };
    if (rank <= 3) return { title: `Rank #${rank} — Top 3!`, subtitle: "You're on the podium! Keep climbing.", emoji: "🏆", color: "#f59e0b" };
    if (rank <= 10) return { title: `Rank #${rank} of ${total}`, subtitle: "You're in the top 10! The summit is within reach.", emoji: "🔥", color: "#f97316" };
    if (rank <= total / 2) return { title: `Rank #${rank} of ${total}`, subtitle: "You're climbing! Every quiz pushes you higher.", emoji: "📈", color: "#3b82f6" };
    return { title: `Rank #${rank} of ${total}`, subtitle: "Your journey starts here. Let's climb!", emoji: "🚀", color: "#8b5cf6" };
  }

  function renderPopup(data: StandingData) {
    // Remove any existing popup
    const existing = document.getElementById("lb-popup-root");
    if (existing) existing.remove();

    let step = 0;
    const totalSteps = (data.recommendations.length || 0) + 1;

    const rankInfo = getRankInfo(data.rank, data.totalInBand);

    const overlay = document.createElement("div");
    overlay.id = "lb-popup-root";
    overlay.className = "lb-overlay";
    overlayRef.current = overlay;

    const card = document.createElement("div");
    card.className = "lb-card";
    card.style.border = `1px solid ${rankInfo.color}40`;
    card.style.boxShadow = `0 0 60px ${rankInfo.color}15, 0 20px 60px rgba(0,0,0,0.6)`;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function renderStep() {
      const isFirst = step === 0;
      const isLast = step >= data.recommendations.length;
      const currentRec = !isFirst && !isLast ? data.recommendations[step - 1] : null;
      const progress = ((step + 1) / totalSteps) * 100;

      card.innerHTML = "";

      // Top bar
      const bar = document.createElement("div");
      bar.className = "lb-bar";
      bar.style.background = `linear-gradient(90deg, ${rankInfo.color}, ${rankInfo.color}aa)`;
      card.appendChild(bar);

      // Header
      const header = document.createElement("div");
      header.className = "lb-header";
      header.innerHTML = `
        <div class="lb-header-label">
          <span style="color: ${rankInfo.color}">★</span>
          <span>YOUR STANDING</span>
        </div>
      `;
      const closeBtn = document.createElement("button");
      closeBtn.className = "lb-close";
      closeBtn.innerHTML = "✕";
      closeBtn.onclick = close;
      header.appendChild(closeBtn);
      card.appendChild(header);

      // Progress
      const progWrap = document.createElement("div");
      progWrap.className = "lb-progress-wrap";
      progWrap.innerHTML = `<div class="lb-progress-track"><div class="lb-progress-fill" style="width: ${progress}%; background: linear-gradient(90deg, ${rankInfo.color}, ${rankInfo.color}aa)"></div></div>`;
      card.appendChild(progWrap);

      // Content
      const content = document.createElement("div");
      content.className = "lb-content";

      if (isFirst) {
        content.innerHTML = `
          <div class="lb-emoji">${rankInfo.emoji}</div>
          <h2 class="lb-title" style="color: ${rankInfo.color}">${rankInfo.title}</h2>
          <p class="lb-subtitle">${rankInfo.subtitle}</p>
          <div class="lb-points-box" style="background: linear-gradient(135deg, ${rankInfo.color}12, transparent); border: 1px solid ${rankInfo.color}20;">
            <div class="lb-points-row">
              <span style="color: ${rankInfo.color}">🔥</span>
              <span class="lb-points-num" style="color: ${rankInfo.color}">${data.myPoints}</span>
              <span class="lb-points-label">points</span>
            </div>
            ${data.band ? `<p class="lb-band">${data.band} Band</p>` : ""}
          </div>
          ${data.personAbove ? `
            <div class="lb-above">
              <div class="lb-above-row">
                <span>👑</span>
                <span class="lb-above-name"><b>${data.personAbove.name}</b> is #${data.rank - 1}</span>
              </div>
              ${data.pointsBehind > 0 ? `<p class="lb-above-hint">Just ${data.pointsBehind} point${data.pointsBehind > 1 ? "s" : ""} away from passing them!</p>` : ""}
            </div>
          ` : ""}
          <div class="lb-badges">
            ${data.availableQuizzes > 0 ? `<div class="lb-badge" style="background: #3b82f612; border: 1px solid #3b82f625; color: #60a5fa;">📖 ${data.availableQuizzes} quizzes</div>` : ""}
            ${data.eggAvailable ? `<div class="lb-badge" style="background: #f59e0b12; border: 1px solid #f59e0b25; color: #fbbf24;">🎁 Easter Egg</div>` : ""}
          </div>
        `;
      } else if (!isLast && currentRec) {
        let recColor = "#8b5cf6";
        let recIcon = "🎯";
        if (currentRec.includes("quiz")) { recColor = "#3b82f6"; recIcon = "📖"; }
        else if (currentRec.includes("Easter Egg") || currentRec.includes("egg")) { recColor = "#f59e0b"; recIcon = "🎁"; }
        else if (currentRec.includes("behind") || currentRec.includes("climb")) { recColor = "#10b981"; recIcon = "📈"; }

        content.innerHTML = `
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 16px; margin-bottom: 16px; background: linear-gradient(135deg, ${recColor}25, ${recColor}08); border: 1px solid ${recColor}30; font-size: 30px;">${recIcon}</div>
          <h3 style="font-size: 18px; font-weight: 900; color: white; margin: 0 0 8px;">Here's how to climb</h3>
          <p style="font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.5; margin: 0;">${currentRec}</p>
        `;
      } else {
        content.innerHTML = `
          <div style="font-size: 40px; margin-bottom: 8px;">📚</div>
          <h3 style="font-size: 20px; font-weight: 900; color: white; margin: 0 0 8px;">Ready to read and rise?</h3>
          <p style="font-size: 14px; color: rgba(255,255,255,0.5); margin: 0;">Every book you read and every quiz you pass brings you closer to the top.</p>
        `;
      }
      card.appendChild(content);

      // Nav
      const nav = document.createElement("div");
      nav.className = "lb-nav";
      if (!isLast) {
        const spacer = document.createElement("div");
        spacer.style.flex = "1";
        nav.appendChild(spacer);

        const skip = document.createElement("button");
        skip.className = "lb-skip";
        skip.textContent = "Skip";
        skip.onclick = close;
        nav.appendChild(skip);

        const next = document.createElement("button");
        next.className = "lb-next";
        next.style.background = `linear-gradient(135deg, ${rankInfo.color}, ${rankInfo.color}dd)`;
        next.style.boxShadow = `0 4px 20px ${rankInfo.color}30`;
        next.innerHTML = isFirst ? "See How →" : "Next →";
        next.onclick = () => { step++; renderStep(); };
        nav.appendChild(next);
      } else {
        const cta = document.createElement("button");
        cta.className = "lb-cta";
        cta.style.background = `linear-gradient(135deg, ${rankInfo.color}, ${rankInfo.color}dd)`;
        cta.style.boxShadow = `0 4px 24px ${rankInfo.color}30`;
        cta.innerHTML = "📖 Let's Read";
        cta.onclick = () => { close(); onNavigate("/library"); };
        nav.appendChild(cta);
      }
      card.appendChild(nav);

      // Dots
      const dots = document.createElement("div");
      dots.className = "lb-dots";
      for (let i = 0; i < totalSteps; i++) {
        const dot = document.createElement("button");
        dot.className = "lb-dot";
        dot.style.width = i === step ? "24px" : "8px";
        dot.style.background = i === step ? rankInfo.color : i < step ? rankInfo.color + "50" : "rgba(255,255,255,0.15)";
        dot.onclick = () => { step = i; renderStep(); };
        dots.appendChild(dot);
      }
      card.appendChild(dots);
    }

    function close() {
      dismissedRef.current = true;
      if (healIntervalRef.current) {
        clearInterval(healIntervalRef.current);
        healIntervalRef.current = null;
      }
      overlay.remove();
      overlayRef.current = null;
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    renderStep();
  }

  // Cleanup on unmount - but DON'T remove the popup (it should survive re-renders)
  useEffect(() => {
    return () => {
      // Only remove if the popup was dismissed, not on unmount
      // The popup manages its own lifecycle via close button
    };
  }, []);

  return null;
}
