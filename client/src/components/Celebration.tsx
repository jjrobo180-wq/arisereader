import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

export type CelebrationStyle = "confetti" | "balloons" | "stars" | "fireworks" | "emoji" | "random";

const STYLE_LABELS: Record<CelebrationStyle, string> = {
  confetti: "Confetti Burst",
  balloons: "Floating Balloons",
  stars: "Star Burst",
  fireworks: "Fireworks",
  emoji: "Happy Emoji Rain",
  random: "Surprise Me (Random)",
};

export const CELEBRATION_OPTIONS = Object.entries(STYLE_LABELS).map(([value, label]) => ({ value, label }));

const EMOJIS = ["🎉", "⭐", "✨", "🎊", "🎈", "👍", "😊", "🏆", "💪", "🌟"];

// Fire confetti from a specific element's position
function fireConfettiFromElement(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x, y },
    colors: ["#f97316", "#fbbf24", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"],
    scalar: 1.2,
    disableForReducedMotion: true,
  });

  // Second burst slightly delayed
  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: Math.max(0, x - 0.1), y },
      colors: ["#f97316", "#fbbf24", "#22c55e"],
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: Math.min(1, x + 0.1), y },
      colors: ["#3b82f6", "#a855f7", "#ec4899"],
      disableForReducedMotion: true,
    });
  }, 200);
}

function fireFireworks() {
  const duration = 2000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: Math.random() * 0.3, y: Math.random() * 0.5 + 0.1 },
      colors: ["#f97316", "#fbbf24", "#22c55e"],
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: Math.random() * 0.3 + 0.7, y: Math.random() * 0.5 + 0.1 },
      colors: ["#3b82f6", "#a855f7", "#ec4899"],
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

function fireStars(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  confetti({
    particleCount: 60,
    spread: 360,
    startVelocity: 25,
    origin: { x, y },
    shapes: ["star"],
    colors: ["#fbbf24", "#f97316", "#fde68a", "#ffffff"],
    scalar: 1.5,
    disableForReducedMotion: true,
  });
}

interface BalloonProps {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
}

function Balloon({ emoji, left, delay, duration }: BalloonProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "-60px",
        left: `${left}%`,
        fontSize: "2.5rem",
        animation: `balloon-rise ${duration}s ease-in ${delay}ms forwards`,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {emoji}
    </div>
  );
}

interface EmojiRainProps {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
}

function EmojiRainItem({ emoji, left, delay, duration }: EmojiRainProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: "-50px",
        left: `${left}%`,
        fontSize: "2rem",
        animation: `emoji-fall ${duration}s ease-in ${delay}ms forwards`,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {emoji}
    </div>
  );
}

interface CelebrationProps {
  style: CelebrationStyle;
  trigger: number; // increment to fire
  targetRef?: React.RefObject<HTMLElement>;
}

export default function Celebration({ style, trigger, targetRef }: CelebrationProps) {
  const [balloons, setBalloons] = useState<BalloonProps[]>([]);
  const [emojis, setEmojis] = useState<EmojiRainProps[]>([]);
  const prevTrigger = useRef(0);

  useEffect(() => {
    if (trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    if (trigger === 0) return;

    let actualStyle = style;
    if (style === "random") {
      const styles: CelebrationStyle[] = ["confetti", "balloons", "stars", "fireworks", "emoji"];
      actualStyle = styles[Math.floor(Math.random() * styles.length)];
    }

    const el = targetRef?.current;

    if (actualStyle === "confetti") {
      if (el) {
        fireConfettiFromElement(el);
      } else {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#f97316", "#fbbf24", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"],
          disableForReducedMotion: true,
        });
      }
    } else if (actualStyle === "fireworks") {
      fireFireworks();
    } else if (actualStyle === "stars") {
      if (el) {
        fireStars(el);
      } else {
        confetti({
          particleCount: 80,
          spread: 360,
          startVelocity: 30,
          origin: { x: 0.5, y: 0.5 },
          shapes: ["star"],
          colors: ["#fbbf24", "#f97316", "#fde68a", "#ffffff"],
          scalar: 1.5,
          disableForReducedMotion: true,
        });
      }
    } else if (actualStyle === "balloons") {
      const newBalloons: BalloonProps[] = [];
      for (let i = 0; i < 12; i++) {
        newBalloons.push({
          id: Date.now() + i,
          emoji: ["🎈", "🎉", "⭐", "🎊"][Math.floor(Math.random() * 4)],
          left: Math.random() * 90 + 5,
          delay: i * 100,
          duration: 2.5 + Math.random() * 1.5,
        });
      }
      setBalloons((prev) => [...prev, ...newBalloons]);
      setTimeout(() => {
        setBalloons((prev) => prev.filter((b) => !newBalloons.includes(b)));
      }, 5000);
    } else if (actualStyle === "emoji") {
      const newEmojis: EmojiRainProps[] = [];
      for (let i = 0; i < 20; i++) {
        newEmojis.push({
          id: Date.now() + i,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          left: Math.random() * 90 + 5,
          delay: i * 80,
          duration: 2 + Math.random() * 2,
        });
      }
      setEmojis((prev) => [...prev, ...newEmojis]);
      setTimeout(() => {
        setEmojis((prev) => prev.filter((e) => !newEmojis.includes(e)));
      }, 5000);
    }
  }, [trigger, style, targetRef]);

  return (
    <>
      <style>{`
        @keyframes balloon-rise {
          0% { bottom: -60px; opacity: 1; }
          100% { bottom: 110vh; opacity: 0.8; }
        }
        @keyframes emoji-fall {
          0% { top: -50px; opacity: 1; transform: rotate(0deg); }
          100% { top: 110vh; opacity: 0.8; transform: rotate(360deg); }
        }
      `}</style>
      {balloons.map((b) => (
        <Balloon key={b.id} {...b} />
      ))}
      {emojis.map((e) => (
        <EmojiRainItem key={e.id} {...e} />
      ))}
    </>
  );
}

export { STYLE_LABELS };
