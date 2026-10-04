// Haven Fair booth games: quick skill games (no luck involved) that win plush
// prizes. Each booth uses one of four games: timing, ducks, bottles or spin art.
import { useEffect, useRef, useState } from "react";

export type BoothGame = "timing" | "ducks" | "bottles" | "spin";
const BOOTH_GAMES: Record<string, { game: BoothGame; verb: string; prize: string; hint: string }> = {
  "Ring Toss": { game: "timing", verb: "Toss", prize: "Rainbow Ring Bear", hint: "Toss when the marker is in the green to land a ring on a bottle." },
  "Hoop Shot": { game: "timing", verb: "Shoot", prize: "Basketball Buddy", hint: "Shoot when the marker is in the green. The zone gets smaller each shot." },
  "Duck Pond": { game: "ducks", verb: "", prize: "Golden Duck", hint: "Tap the ducks with a star as they float by." },
  "Ball Throw": { game: "bottles", verb: "Throw", prize: "Big Blue Dino", hint: "Stop the aim, then the power. Knock down every bottle in 3 throws." },
  "Spin Art": { game: "spin", verb: "", prize: "Your spin art", hint: "Tap colors and drop paint on the spinning card." },
  "Skee Ball": { game: "timing", verb: "Roll", prize: "Skee Ball Penguin", hint: "Roll when the marker is in the green to sink it in the top ring." },
  "Frog Hop": { game: "timing", verb: "Launch", prize: "Leaping Frog", hint: "Launch the frog when the marker is in the green to land on a lily pad." },
  "Basket Toss": { game: "timing", verb: "Toss", prize: "Picnic Bunny", hint: "Toss when the marker is in the green to land it in the basket." },
  "Fishing Game": { game: "ducks", verb: "", prize: "Lucky Goldfish", hint: "Tap the fish with a star as they swim by." },
  "Milk Bottles": { game: "bottles", verb: "Throw", prize: "Cow Plush", hint: "Stop the aim, then the power. Knock down all the milk bottles in 3 throws." },
};
export const boothInfo = (name: string) => BOOTH_GAMES[name] ?? BOOTH_GAMES["Ring Toss"];

const prizesKey = (userId?: number) => `fair_prizes_${userId ?? "me"}`;
export function readPrizes(userId?: number): string[] {
  try { const v = JSON.parse(localStorage.getItem(prizesKey(userId)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function savePrize(userId: number | undefined, prize: string) {
  try { localStorage.setItem(prizesKey(userId), JSON.stringify([...readPrizes(userId), prize].slice(-60))); } catch { /* fine */ }
}

export default function FairBooth({ name, color, userId, onClose, onWin }: { name: string; color: string; userId?: number; onClose: () => void; onWin: (prize: string) => void }) {
  const info = boothInfo(name);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [round, setRound] = useState(0);
  const [prizes, setPrizes] = useState(() => readPrizes(userId));
  const finish = (won: boolean) => {
    setResult(won ? "win" : "lose");
    if (won) { savePrize(userId, info.prize); setPrizes(readPrizes(userId)); onWin(info.prize); }
  };
  const again = () => { setResult(null); setRound((r) => r + 1); };
  return (
    <div className="city-modal" role="dialog" aria-modal="true" aria-label={name} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="city-card fair-card" style={{ ["--booth" as any]: color }}>
        <div className="city-card-head"><h2>{name}</h2><button type="button" onClick={onClose} aria-label="Close">✕</button></div>
        <p className="city-small">{info.hint}</p>
        {result ? (
          <div className="fair-result">
            <b>{result === "win" ? `You won: ${info.prize}!` : "So close!"}</b>
            <span>{result === "win" ? "It's on your prize shelf." : "Give it another go."}</span>
            <div className="city-row"><button type="button" className="city-btn" onClick={again}>Play again</button><button type="button" className="city-btn ghost" onClick={onClose}>Done</button></div>
          </div>
        ) : info.game === "timing" ? <TimingGame key={round} verb={info.verb} onDone={finish} />
          : info.game === "ducks" ? <DuckGame key={round} fish={name === "Fishing Game"} onDone={finish} />
            : info.game === "bottles" ? <BottleGame key={round} onDone={finish} />
              : <SpinArt key={round} onDone={() => finish(true)} />}
        {prizes.length > 0 && <p className="fair-shelf" aria-label="Your prizes"><span>Prize shelf:</span> {prizes.slice(-8).join(" · ")}{prizes.length > 8 ? ` +${prizes.length - 8} more` : ""}</p>}
      </div>
    </div>
  );
}

/** Stop the sliding marker inside the green zone. 3 tries, 2 hits win; the zone shrinks and the marker speeds up. */
function TimingGame({ verb, onDone }: { verb: string; onDone: (won: boolean) => void }) {
  const [tries, setTries] = useState<boolean[]>([]);
  const [pos, setPos] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const t0 = useRef(performance.now());
  const zone = [0.36 - tries.length * 0.04, 0.64 + tries.length * -0.04];
  const speed = 1.1 + tries.length * 0.45;
  useEffect(() => {
    let raf = 0;
    const tick = () => { const t = (performance.now() - t0.current) / 1000; setPos((Math.sin(t * speed * Math.PI) + 1) / 2); raf = requestAnimationFrame(tick); };
    if (!flash) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed, flash]);
  const go = () => {
    if (flash) return;
    const hit = pos >= zone[0] && pos <= zone[1];
    setFlash(hit ? "hit" : "miss");
    window.setTimeout(() => {
      const next = [...tries, hit];
      setFlash(null); setTries(next); t0.current = performance.now();
      if (next.filter(Boolean).length >= 2) onDone(true);
      else if (next.length - next.filter(Boolean).length >= 2) onDone(false);
    }, 650);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); go(); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); });
  return (
    <div className="fair-game">
      <div className="fair-meter" aria-hidden="true">
        <i className="fair-zone" style={{ left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%` }} />
        <b className="fair-marker" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="fair-tries">{[0, 1, 2].map((i) => <span key={i} className={tries[i] === undefined ? "" : tries[i] ? "hit" : "miss"}>{tries[i] === undefined ? "○" : tries[i] ? "✓" : "✕"}</span>)}</div>
      {flash && <p className={`fair-flash ${flash}`} role="status">{flash === "hit" ? "Nice!" : "Missed"}</p>}
      <button type="button" className="city-btn fair-go" onClick={go}>{verb}!</button>
    </div>
  );
}

/** Ducks (or fish) float past; tap the ones with a star. 3 star hits win; tapping a plain one costs a try. */
function DuckGame({ fish, onDone }: { fish: boolean; onDone: (won: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ hits: 0, misses: 0, items: [] as { x: number; lane: number; star: boolean; hit: boolean; speed: number }[], t: 0, done: false });
  const [score, setScore] = useState({ hits: 0, misses: 0 });
  useEffect(() => {
    const c = ref.current!, g = c.getContext("2d")!;
    const W = c.width, H = c.height;
    const st = state.current;
    for (let i = 0; i < 9; i++) st.items.push({ x: W * 0.8 - i * 120, lane: i % 3, star: i % 3 === 1 || i === 4, hit: false, speed: 90 + (i % 3) * 25 });
    let raf = 0, last = performance.now();
    const draw = () => {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; st.t += dt;
      g.fillStyle = "#4dabf7"; g.fillRect(0, 0, W, H);
      for (let l = 0; l < 3; l++) { g.fillStyle = l % 2 ? "#339af0" : "#3d9ff5"; g.fillRect(0, 30 + l * 70, W, 70); }
      for (const it of st.items) {
        it.x += it.speed * dt * (1 + st.hits * 0.15);
        if (it.x > W + 60) { it.x -= 9 * 120; it.hit = false; it.star = Math.random() < 0.38; }
        if (it.hit) continue;
        const y = 65 + it.lane * 70 + Math.sin(st.t * 3 + it.x / 40) * 4;
        g.save(); g.translate(it.x, y);
        if (fish) { g.fillStyle = "#ff922b"; g.beginPath(); g.ellipse(0, 0, 26, 15, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(-22, 0); g.lineTo(-40, -14); g.lineTo(-40, 14); g.fill(); g.fillStyle = "#212529"; g.beginPath(); g.arc(12, -3, 3, 0, 7); g.fill(); }
        else { g.fillStyle = "#ffd43b"; g.beginPath(); g.ellipse(0, 6, 28, 16, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(16, -12, 13, 0, 7); g.fill(); g.fillStyle = "#f76707"; g.beginPath(); g.moveTo(28, -12); g.lineTo(40, -8); g.lineTo(28, -5); g.fill(); g.fillStyle = "#212529"; g.beginPath(); g.arc(20, -15, 2.6, 0, 7); g.fill(); }
        if (it.star) { g.fillStyle = "#fff"; g.font = "bold 22px system-ui"; g.textAlign = "center"; g.fillText("★", fish ? -2 : -4, fish ? 8 : 14); }
        g.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [fish]);
  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = state.current; if (st.done) return;
    const r = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * e.currentTarget.width, y = ((e.clientY - r.top) / r.height) * e.currentTarget.height;
    let best: (typeof st.items)[number] | null = null, bd = 44;
    for (const it of st.items) { if (it.hit) continue; const d = Math.hypot(it.x - x, 65 + it.lane * 70 - y); if (d < bd) { bd = d; best = it; } }
    if (!best) return;
    best.hit = true;
    if (best.star) st.hits++; else st.misses++;
    setScore({ hits: st.hits, misses: st.misses });
    if (st.hits >= 3) { st.done = true; window.setTimeout(() => onDone(true), 400); }
    else if (st.misses >= 3) { st.done = true; window.setTimeout(() => onDone(false), 400); }
  };
  return (
    <div className="fair-game">
      <canvas ref={ref} width={520} height={250} className="fair-canvas" onPointerDown={tap} aria-label={`Tap the ${fish ? "fish" : "ducks"} with stars`} />
      <div className="fair-tries"><span className="hit">★ {score.hits}/3</span><span className="miss">✕ {score.misses}/3</span></div>
    </div>
  );
}

/** Stop a sweeping aim, then a power meter; a good throw knocks down bottles near where it lands. */
function BottleGame({ onDone }: { onDone: (won: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ phase: "aim" as "aim" | "power" | "fly", aim: 0.5, power: 0, throws: 0, bottles: [true, true, true, true, true, true], ball: null as null | { t: number; x: number; hitX: number; strength: number }, t0: performance.now(), done: false, fall: [0, 0, 0, 0, 0, 0] });
  const [, force] = useState(0);
  const W = 520, H = 280;
  const spots = [[210, 200], [260, 200], [310, 200], [235, 150], [285, 150], [260, 100]];
  useEffect(() => {
    const c = ref.current!, g = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      const s = st.current, t = (performance.now() - s.t0) / 1000;
      if (s.phase === "aim") s.aim = (Math.sin(t * 2.4) + 1) / 2;
      if (s.phase === "power") s.power = (Math.sin(t * 3.4 - Math.PI / 2) + 1) / 2;
      g.fillStyle = "#fff4e6"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#b08968"; g.fillRect(120, 226, 280, 18);
      s.bottles.forEach((up, i) => {
        const [x, y] = spots[i];
        if (!up) s.fall[i] = Math.min(1, s.fall[i] + 0.06);
        g.save(); g.translate(x + s.fall[i] * 30 * (i % 2 ? 1 : -1), y + s.fall[i] * 60); g.rotate(s.fall[i] * (i % 2 ? 1.4 : -1.4));
        g.globalAlpha = 1 - s.fall[i] * 0.6;
        g.fillStyle = "#f8f9fa"; g.fillRect(-14, -24, 28, 48); g.fillRect(-7, -38, 14, 16);
        g.fillStyle = "#e03131"; g.fillRect(-14, -6, 28, 10);
        g.restore();
      });
      // aim line and power bar
      const ax = 120 + s.aim * 280;
      g.strokeStyle = "rgba(33,37,41,.5)"; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(ax, 270); g.lineTo(ax, 70); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#dee2e6"; g.fillRect(470, 40, 22, 200);
      g.fillStyle = "#8ce99a"; g.fillRect(470, 40 + 200 * 0.12, 22, 200 * 0.22);
      g.fillStyle = "#212529"; g.fillRect(464, 240 - s.power * 200 - 3, 34, 6);
      if (s.ball) {
        s.ball.t += 0.045;
        const p = Math.min(1, s.ball.t), bx = W / 2 + (s.ball.x - W / 2) * p, by = 270 - Math.sin(p * Math.PI) * 60 - p * 110;
        g.fillStyle = "#1c7ed6"; g.beginPath(); g.arc(bx, by, 12 - p * 4, 0, 7); g.fill();
        if (p >= 1 && !(s.ball as any).landed) {
          (s.ball as any).landed = true;
          s.bottles.forEach((up, i) => { if (up && Math.abs(spots[i][0] - s.ball!.hitX) < 30 + s.ball!.strength * 45 && (s.ball!.strength > 0.45 || spots[i][1] > 140)) s.bottles[i] = false; });
          window.setTimeout(() => {
            s.ball = null; s.throws++;
            if (s.bottles.every((b) => !b)) { s.done = true; onDone(true); }
            else if (s.throws >= 3) { s.done = true; onDone(false); }
            else { s.phase = "aim"; s.t0 = performance.now(); }
            force((n) => n + 1);
          }, 700);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);
  const tap = () => {
    const s = st.current; if (s.done) return;
    if (s.phase === "aim") { s.phase = "power"; s.t0 = performance.now(); }
    else if (s.phase === "power") {
      s.phase = "fly";
      const sweet = 1 - Math.min(1, Math.abs(s.power - 0.77) / 0.35); // the green band is near the top
      const x = 120 + s.aim * 280;
      s.ball = { t: 0, x, hitX: x, strength: sweet };
    }
    force((n) => n + 1);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); tap(); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); });
  const s = st.current;
  return (
    <div className="fair-game">
      <canvas ref={ref} width={W} height={H} className="fair-canvas" onPointerDown={tap} aria-label="Bottle throw" />
      <div className="fair-tries"><span>Throws left: {3 - s.throws}</span><span>{s.bottles.filter(Boolean).length} bottles standing</span></div>
      <button type="button" className="city-btn fair-go" onClick={tap} disabled={s.phase === "fly"}>{s.phase === "aim" ? "Lock aim" : s.phase === "power" ? "Throw!" : "…"}</button>
    </div>
  );
}

/** A spinning card: tap a color, then tap the card to drip paint. */
function SpinArt({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paint = useRef(document.createElement("canvas"));
  const [color, setColor] = useState("#e03131");
  const drops = useRef<{ r: number; a: number; color: string; size: number; life: number }[]>([]);
  useEffect(() => {
    const p = paint.current; p.width = p.height = 300;
    const pg = p.getContext("2d")!; pg.fillStyle = "#fff"; pg.beginPath(); pg.arc(150, 150, 146, 0, 7); pg.fill();
    const c = ref.current!, g = c.getContext("2d")!;
    let raf = 0, ang = 0;
    const draw = () => {
      ang += 0.12;
      // drops smear outward as the card spins, leaving swirls
      for (const d of drops.current) {
        if (d.life <= 0) continue;
        d.r = Math.min(140, d.r + 1.6); d.life -= 1;
        pg.fillStyle = d.color; pg.beginPath(); pg.arc(150 + Math.cos(d.a) * d.r, 150 + Math.sin(d.a) * d.r, d.size * (d.life / 70 + 0.3), 0, 7); pg.fill();
        d.a -= 0.035;
      }
      g.clearRect(0, 0, 300, 300);
      g.save(); g.translate(150, 150); g.rotate(ang); g.drawImage(p, -150, -150); g.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  const drip = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 300 - 150, y = ((e.clientY - r.top) / r.height) * 300 - 150;
    drops.current.push({ r: Math.min(130, Math.hypot(x, y)), a: Math.atan2(y, x), color, size: 7, life: 70 });
  };
  return (
    <div className="fair-game">
      <canvas ref={ref} width={300} height={300} className="fair-canvas spin" onPointerDown={drip} aria-label="Spinning card: tap to drop paint" />
      <div className="fair-colors" role="group" aria-label="Paint color">
        {["#e03131", "#f59f00", "#ffd43b", "#2f9e44", "#1c7ed6", "#7048e8", "#e64980", "#212529"].map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} style={{ background: c }} onClick={() => setColor(c)} />)}
      </div>
      <button type="button" className="city-btn fair-go" onClick={onDone}>Done, keep it!</button>
    </div>
  );
}
