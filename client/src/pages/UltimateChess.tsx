import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Bot, ChevronDown, Crown, Flag, Lightbulb, RotateCcw, Sparkles, Trophy, Undo2, Users, Volume2, VolumeX, X, Zap } from "lucide-react";
import "./ultimate-chess.css";

type Move = { from: string; to: string; promotion?: "q" | "r" | "b" | "n"; capture?: boolean };
type State = {
  board: (string | null)[][]; turn: 1 | 2; winner: 0 | 1 | 2 | null; result: string | null; check: boolean;
  legalMoves: Move[]; lastMove: Move | null; moveHistory: string[]; captured: string[];
  computer?: boolean; computerLevel?: number; clocks: [number, number]; hintsLeft?: number; undosLeft?: number;
};
type Match = {
  id: string; status: "waiting" | "active" | "finished" | "cancelled"; player1_id: number; player2_id: number | null;
  state: State; youAre: 1 | 2; statusText?: string; players: Array<{ user_id: number; display_name: string }>;
  reward?: { coins: boolean; points: boolean } | null; interim?: State; hint?: { from: string; to: string };
};
type Rank = { userId: number; displayName: string; wins: number; draws: number; losses: number; games: number; points: number; winRate: number; rank: number };

const NAMES: Record<string, string> = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight", P: "Pawn" };
const VALUES: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
const FILES = "abcdefgh";
const LEVELS = [["Rookie", "Relaxed"], ["Challenger", "Tactical"], ["Master", "Plans ahead"], ["Titan", "Maximum"]];
const TIMES = [[300, "5 min"], [600, "10 min"], [900, "15 min"], [1800, "30 min"]] as const;
const THINK_MS = 650;

function clock(ms: number) { const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function sq(r: number, c: number) { return FILES[c] + (8 - r); }
function winner(match: Match, self: number | undefined) {
  if (match.state.winner === 0) return ["Draw!", "Evenly matched. Great game."];
  const won = (match.state.winner === 1 && match.player1_id === self) || (match.state.winner === 2 && match.player2_id === self);
  const why = match.state.result === "checkmate" ? "Checkmate." : match.state.result === "timeout" ? "Time ran out." : match.state.result === "resignation" ? "Resignation." : "Match complete.";
  return won ? ["Victory!", why + " You ruled the board."] : ["Good game!", why + " Ready for a rematch?"];
}

// ─── Pieces: an original rounded set, drawn on a 100×100 grid ───────────────
const BASE = <path className="body" d="M24 88h52a4 4 0 0 0 4-4v-3a4 4 0 0 0-4-4H24a4 4 0 0 0-4 4v3a4 4 0 0 0 4 4z" />;
const SHAPES: Record<string, ReactElement> = {
  P: <>{BASE}<path className="body" d="M34 77C36 66 40 60 44 56C39 53 37 48 37 43C37 35 43 29 50 29C57 29 63 35 63 43C63 48 61 53 56 56C60 60 64 66 66 77Z" /></>,
  R: <>{BASE}<path className="body" d="M31 77L35 70V44L30 39V22H39V29H45.5V22H54.5V29H61V22H70V39L65 44V70L69 77Z" /><path className="detail" d="M35 44H65M35 70H65" /></>,
  N: <>{BASE}<path className="body" d="M30 77C31 66 36 59 44 53C46 51.5 46 49 44 48.5C39 48 35 50.5 32 53.5C28 57 22 55 22 50C22 45 27 40 32 35C36 31 38 26 41 22L43 15L48 21C60 22 70 31 73 45C76 58 72 69 70 77Z" /><circle className="eye" cx="43" cy="32" r="2.6" /><path className="detail" d="M52 26C60 30 66 38 68 50" /></>,
  B: <>{BASE}<path className="body" d="M35 77C37 70 41 66 44 63H56C59 66 63 70 65 77Z" /><path className="body" d="M50 15C42 22 36 31 36 41C36 50 42 57 50 59C58 57 64 50 64 41C64 31 58 22 50 15Z" /><circle className="body" cx="50" cy="12" r="4.5" /><path className="detail" d="M55 30L46 42M42 63H58" /></>,
  Q: <>{BASE}<path className="body" d="M33 77C35 68 37 62 38 57H62C63 62 65 68 67 77Z" /><path className="body" d="M38 57L27 30L40 44L44 24L50 42L56 24L60 44L73 30L62 57Z" /><circle className="body" cx="27" cy="27" r="4.5" /><circle className="body" cx="44" cy="20" r="4.5" /><circle className="body" cx="56" cy="20" r="4.5" /><circle className="body" cx="73" cy="27" r="4.5" /><path className="detail" d="M38 57H62" /></>,
  K: <>{BASE}<path className="body" d="M33 77C35 68 37 62 38 57H62C63 62 65 68 67 77Z" /><path className="body" d="M38 57C30 50 27 42 31 36C35 30 44 31 50 40C56 31 65 30 69 36C73 42 70 50 62 57Z" /><path className="body" d="M46.5 8H53.5V15H60V22H53.5V33H46.5V22H40V15H46.5Z" /><path className="detail" d="M38 57H62M50 40V56" /></>,
};
function Piece({ code, className = "" }: { code: string; className?: string }) {
  return <svg viewBox="0 0 100 100" className={"uc-svgpiece " + (code[0] === "w" ? "w" : "b") + (className ? " " + className : "")} aria-hidden="true">{SHAPES[code[1]]}</svg>;
}

function atmosphere(el: HTMLDivElement) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05040b); scene.fog = new THREE.FogExp2(0x080716, .025);
  const camera = new THREE.PerspectiveCamera(52, 1, .1, 100); camera.position.set(0, 8.5, 17);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; el.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0x9ac8ff, 0x1b1026, 1.5));
  const gold = new THREE.PointLight(0xfbbf24, 18, 28, 2); gold.position.set(7, 7, -3); scene.add(gold);
  const violet = new THREE.PointLight(0x7c3aed, 26, 34, 2); violet.position.set(-8, 5, 1); scene.add(violet);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 80), new THREE.MeshStandardMaterial({ color: 0x090817, metalness: .5, roughness: .4 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.2; scene.add(floor);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8, .8, 64), new THREE.MeshStandardMaterial({ color: 0x16112a, metalness: .5, roughness: .35 })); dais.position.y = -.78; scene.add(dais);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.5, .06, 10, 100), new THREE.MeshStandardMaterial({ color: 0xf6c453, emissive: 0xf6c453, emissiveIntensity: 3 })); ring.rotation.x = Math.PI / 2; ring.position.y = -.35; scene.add(ring);
  const stars = new THREE.BufferGeometry(), a = new Float32Array(420 * 3); for (let i = 0; i < 420; i++) { a[i * 3] = (Math.random() - .5) * 45; a[i * 3 + 1] = Math.random() * 20; a[i * 3 + 2] = (Math.random() - .5) * 35 - 7; } stars.setAttribute("position", new THREE.BufferAttribute(a, 3)); const field = new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xc4b5fd, size: .06 })); scene.add(field);
  for (const x of [-9, -7, 7, 9]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(.38, .5, 7, 24), new THREE.MeshStandardMaterial({ color: 0x19162b, roughness: .7 })); col.position.set(x, 2, -7); scene.add(col); }
  const resize = () => { const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); camera.position.z = w < 700 ? 21 : 17; }; resize(); addEventListener("resize", resize);
  let raf = 0; const animate = () => { field.rotation.y += .00015; ring.rotation.z += .0007; renderer.render(scene, camera); raf = requestAnimationFrame(animate); }; animate();
  return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); renderer.dispose(); scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement); };
}

export default function UltimateChess() {
  const { token } = useAuth(); const [, go] = useLocation(); const bg = useRef<HTMLDivElement>(null); const audio = useRef<AudioContext | null>(null); const last = useRef("");
  const [boot, setBoot] = useState<any>(null), [match, setMatchState] = useState<Match | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"computer" | "multiplayer">("computer"), [level, setLevel] = useState(2), [time, setTime] = useState(600), [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string; choices: string[] } | null>(null), [sound, setSound] = useState(true), [message, setMessage] = useState(""), [intro, setIntro] = useState(false);
  const [ranks, setRanks] = useState<Rank[]>([]), [showRanks, setShowRanks] = useState(false), [movesOpen, setMovesOpen] = useState(false);
  const [thinking, setThinking] = useState(false), [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const [drag, setDrag] = useState<{ from: string; x: number; y: number } | null>(null);
  const [, setTick] = useState(0);
  const receivedAt = useRef(Date.now());
  const reveal = useRef<number | null>(null);
  const dragRef = useRef<{ from: string; pointerId: number; x0: number; y0: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const headers = useMemo(() => ({ Authorization: "Bearer " + token, "Content-Type": "application/json" }), [token]);

  /** Every match update goes through here so the clocks count down from the moment it arrived. */
  const setMatch = useCallback((next: Match | null) => { receivedAt.current = Date.now(); setMatchState(next); }, []);

  useEffect(() => { if (bg.current) return atmosphere(bg.current); }, []);
  useEffect(() => { if (!token) return; let live = true; (async () => { try { const r = await fetch(API_BASE + "/api/chess/bootstrap", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.message); if (live) setBoot(d); } catch (e: any) { if (live) setMessage(e.message || "Could not enter Chess."); } finally { if (live) setLoading(false); } })(); return () => { live = false; }; }, [token]);

  const poll = useCallback(async () => {
    if (!match || !token) return;
    try {
      const r = await fetch(API_BASE + "/api/chess/matches/" + match.id, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      const d = await r.json();
      if (r.ok && !reveal.current) setMatch(d);
    } catch { /* keep the last board */ }
  }, [match?.id, token, setMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live games refresh often; computer games only need to catch a clock running out.
  useEffect(() => {
    if (!match || !["waiting", "active"].includes(match.status) || !token) return;
    const id = setInterval(poll, match.state.computer ? 5000 : 850);
    return () => clearInterval(id);
  }, [match?.id, match?.status, match?.state.computer, token, poll]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = match?.status === "active" && match.state.winner === null;
  useEffect(() => { if (!live) return; const id = setInterval(() => setTick((t) => t + 1), 250); return () => clearInterval(id); }, [live]);
  useEffect(() => () => { if (reveal.current) window.clearTimeout(reveal.current); }, []);

  const beep = (kind: "move" | "hit" | "check" | "start" | "win") => { if (!sound) return; try { const AC = window.AudioContext || (window as any).webkitAudioContext; let ctx = audio.current; if (!ctx || ctx.state === "closed") { ctx = new AC(); audio.current = ctx; } if (ctx.state === "suspended") void ctx.resume(); const plan = kind === "move" ? [190, 145] : kind === "hit" ? [120, 82] : kind === "check" ? [330, 440, 660] : kind === "win" ? [392, 523, 659, 784] : [110, 220, 330]; plan.forEach((f, i) => { const o = ctx!.createOscillator(), g = ctx!.createGain(), t = ctx!.currentTime + i * .07; o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f; g.gain.setValueAtTime(.055, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12); o.connect(g); g.connect(ctx!.destination); o.start(t); o.stop(t + .14); }); } catch { /* sound is optional */ } };
  useEffect(() => { const m = match?.state?.lastMove; if (!m) return; const key = m.from + m.to + (m.promotion || "") + (match?.state.moveHistory.length || 0); if (key === last.current) return; last.current = key; beep(match?.state.check ? "check" : m.capture ? "hit" : "move"); }, [match?.state?.lastMove?.from, match?.state?.lastMove?.to, match?.state?.moveHistory.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => { if (!boot?.access?.allowed) { setMessage(boot?.access?.locked ? "Your teacher has locked game play." : "You need another available game play."); return; } try { setBusy(true); setMessage(""); beep("start"); const r = await fetch(API_BASE + "/api/chess/matches/join", { method: "POST", headers, body: JSON.stringify({ computer: mode === "computer", computerLevel: level, timeControlSec: time }) }); const d = await r.json(); if (!r.ok) throw new Error(d.message); setMatch(d); setSelected(null); setHint(null); if (d.status === "active") { setIntro(true); setTimeout(() => setIntro(false), 2300); } } catch (e: any) { setMessage(e.message || "Could not start Chess."); } finally { setBusy(false); } };
  useEffect(() => { if (match?.status === "active" && !intro && match.state.moveHistory.length === 0 && mode === "multiplayer") { setIntro(true); beep("start"); const t = setTimeout(() => setIntro(false), 2300); return () => clearTimeout(t); } }, [match?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Applies a server reply. Against the computer, your move shows first and its answer a moment later. */
  const receive = useCallback((d: Match) => {
    if (reveal.current) { window.clearTimeout(reveal.current); reveal.current = null; }
    if (d.interim) {
      setMatch({ ...d, status: "active", state: d.interim });
      setThinking(true);
      reveal.current = window.setTimeout(() => { reveal.current = null; setThinking(false); setMatch(d); if (d.status === "finished") beep("win"); }, THINK_MS);
    } else {
      setThinking(false);
      setMatch(d);
      if (d.status === "finished") beep("win");
    }
  }, [setMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (path: string, body?: unknown) => {
    if (!match) return null;
    const r = await fetch(API_BASE + "/api/chess/matches/" + match.id + path, { method: "POST", headers, body: JSON.stringify(body || {}) });
    const d = await r.json();
    if (r.status === 409 && d.match) { setMatch(d.match); throw new Error(d.message); }
    if (!r.ok) throw new Error(d.message);
    return d as Match;
  };
  const play = async (from: string, to: string, promotion?: string) => { if (!match || busy) return; try { setBusy(true); setSelected(null); setPromo(null); setHint(null); const d = await post("/action", { from, to, promotion }); if (d) receive(d); } catch (e: any) { setMessage(e.message || "That move is not available."); } finally { setBusy(false); } };
  const askHint = async () => { try { setBusy(true); const d = await post("/hint"); if (d) { setMatch(d); if (d.hint) { setHint(d.hint); setSelected(d.hint.from); } } } catch (e: any) { setMessage(e.message || "No hint right now."); } finally { setBusy(false); } };
  const takeBack = async () => { try { setBusy(true); setHint(null); setSelected(null); const d = await post("/undo"); if (d) setMatch(d); } catch (e: any) { setMessage(e.message || "Could not take that back."); } finally { setBusy(false); } };
  const resign = async () => { if (!match) return; const r = await fetch(API_BASE + "/api/chess/matches/" + match.id + "/resign", { method: "POST", headers }); const d = await r.json(); if (r.ok) setMatch(d); };
  const cancel = async () => { if (match) try { await fetch(API_BASE + "/api/chess/matches/" + match.id + "/leave", { method: "POST", headers }); } catch { /* best effort */ } setMatch(null); setSelected(null); };
  const leaderboard = async () => { setShowRanks(true); try { const r = await fetch(API_BASE + "/api/chess/leaderboard", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }); const d = await r.json(); if (r.ok) setRanks(d); } catch { /* keep the old list */ } };

  const state = match?.state, myTurn = !!match && match.status === "active" && state?.winner === null && state?.turn === match.youAre && !thinking;
  const legalFrom = useMemo(() => new Set((state?.legalMoves || []).map(m => m.from)), [state?.legalMoves]);
  const targets = useMemo(() => new Map((state?.legalMoves || []).filter(m => m.from === selected).map(m => [m.to, m])), [state?.legalMoves, selected]);
  const rows = match?.youAre === 2 ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7], cols = match?.youAre === 2 ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  // Hints and selections belong to one position; drop them when the board changes.
  useEffect(() => { setHint(null); setSelected(null); }, [state?.moveHistory.length]);

  /** Tries from→to. Returns false when it is not a legal move. */
  const tryMove = (from: string, to: string) => {
    if (!state || !myTurn || busy) return false;
    const choices = state.legalMoves.filter(m => m.from === from && m.to === to);
    if (!choices.length) return false;
    const promotions = choices.map(m => m.promotion).filter(Boolean) as string[];
    if (promotions.length > 1) { setPromo({ from, to, choices: [...new Set(promotions)] }); return true; }
    void play(from, to, promotions[0]);
    return true;
  };
  const tryMoveRef = useRef(tryMove); tryMoveRef.current = tryMove;

  const onSquare = (r: number, c: number) => {
    if (suppressClick.current || !state || !myTurn || busy) return;
    const s = sq(r, c);
    if (selected && selected !== s && tryMove(selected, s)) return;
    const piece = state.board[r][c];
    const mine = piece && (match!.youAre === 1 ? piece[0] === "w" : piece[0] === "b");
    setSelected(mine && legalFrom.has(s) ? s : null);
  };

  // Drag a piece to move it (mouse or touch). A short tap falls through to the click handler.
  const startDrag = (e: ReactPointerEvent, r: number, c: number) => {
    if (!myTurn || busy || (e.pointerType === "mouse" && e.button !== 0)) return;
    const s = sq(r, c);
    if (!legalFrom.has(s)) return;
    dragRef.current = { from: s, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, active: false };
    setSelected(s);
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
      d.active = true;
      setDrag({ from: d.from, x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      if (!d.active) return;
      setDrag(null);
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-sq]") as HTMLElement | null;
      const to = el?.dataset.sq;
      if (to && to !== d.from) tryMoveRef.current(d.from, to);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);

  // Clocks: the side to move counts down between server updates.
  const clockFor = (seat: 1 | 2) => {
    const base = state?.clocks[seat - 1] || 0;
    return live && state?.turn === seat ? Math.max(0, base - (Date.now() - receivedAt.current)) : base;
  };
  const flagged = live && !thinking && state ? clockFor(state.turn) <= 0 : false;
  useEffect(() => { if (flagged) void poll(); }, [flagged, poll]);

  const checkSquare = useMemo(() => {
    if (!state?.check) return null;
    const king = (state.turn === 1 ? "w" : "b") + "K";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (state.board[r][c] === king) return sq(r, c);
    return null;
  }, [state?.check, state?.turn, state?.board]);
  const material = useMemo(() => {
    let w = 0, b = 0;
    for (const row of state?.board || []) for (const p of row) if (p) { if (p[0] === "w") w += VALUES[p[1]]; else b += VALUES[p[1]]; }
    return w - b;
  }, [state?.board]);

  const turnText = !match || !state ? "" : match.status === "finished" ? match.statusText
    : thinking ? "Computer is thinking…"
    : state.check ? (myTurn ? "Your king is in check!" : "Check!")
    : myTurn ? "Your move" : state.computer ? "Computer is thinking…" : "Opponent is thinking…";

  if (loading) return <main className="uc"><div ref={bg} className="uc-bg" /><div className="uc-load"><Crown /><h1>Opening Ultimate Chess…</h1></div></main>;
  const mine = (match?.youAre || 1) as 1 | 2, theirs = (mine === 1 ? 2 : 1) as 1 | 2;
  const capturedBy = (seat: 1 | 2) => (state?.captured || []).filter(p => p[0] === (seat === 1 ? "b" : "w")).sort((a, b) => VALUES[b[1]] - VALUES[a[1]]);
  const lead = (seat: 1 | 2) => { const m = seat === 1 ? material : -material; return m > 0 ? m : 0; };
  const assists = !!state?.computer && match?.status === "active";

  return <main className="uc"><div ref={bg} className="uc-bg" /><div className="uc-shade" />
    <header className="uc-top"><button onClick={() => go("/worlds")}><ArrowLeft /><span>Worlds</span></button><div className="uc-logo"><b>♛</b><div><small>A.R.I.S.E. ARENA</small><strong>ULTIMATE CHESS</strong></div></div><div><button onClick={() => setSound(v => !v)} aria-label={sound ? "Turn sound off" : "Turn sound on"}>{sound ? <Volume2 /> : <VolumeX />}</button><button onClick={() => void leaderboard()}><Trophy /><span>Ranks</span></button></div></header>
    {!match && <section className="uc-lobby"><div className="uc-card"><div className="uc-kicker"><Sparkles /> THE BOARD IS WAITING</div><h1>Enter the <em>Ultimate Chess</em> competition.</h1><p>Challenge another A.R.I.S.E. reader live or face the computer. Against the computer you get 3 hints and 3 take-backs every game.</p>
      <div className="uc-modes"><button className={mode === "computer" ? "active" : ""} onClick={() => setMode("computer")}><Bot /><b>Play Computer</b><span>Instant match, 4 levels</span></button><button className={mode === "multiplayer" ? "active" : ""} onClick={() => setMode("multiplayer")}><Users /><b>Live Multiplayer</b><span>Match another reader</span></button></div>
      {mode === "computer" && <div className="uc-setting"><label>Computer strength <b>{LEVELS[level - 1][0]}</b></label><div className="uc-levels">{LEVELS.map((l, i) => <button key={i} className={level === i + 1 ? "active" : ""} onClick={() => setLevel(i + 1)}><b>{l[0]}</b><span>{l[1]}</span></button>)}</div></div>}
      <div className="uc-setting"><label>Match clock <b>{TIMES.find(t => t[0] === time)?.[1]} each</b></label><div className="uc-times">{TIMES.map(t => <button key={t[0]} className={time === t[0] ? "active" : ""} onClick={() => setTime(t[0])}>{t[1]}</button>)}</div></div>
      {!boot?.access?.allowed && <p className="uc-lock">{boot?.access?.locked ? "Your teacher has locked game play." : "You need another available game play."}</p>}{message && <p className="uc-msg">{message}</p>}
      <button className="uc-enter" disabled={busy || !boot?.access?.allowed} onClick={() => void start()}><Zap />{busy ? "Opening arena…" : mode === "computer" ? "ENTER VS COMPUTER" : "FIND A CHALLENGER"}</button><button className="uc-ranklink" onClick={() => void leaderboard()}><Trophy /> View Chess leaderboard</button>
    </div><div className="uc-hero"><Piece code="wK" className="uc-hero-king" /><b>CHECKMATE</b><small>Protect the king. Claim the crown.</small></div></section>}
    {match?.status === "waiting" && <section className="uc-wait"><div className="uc-orbit"><span><Piece code="wK" /></span><i /><i /></div><small>LIVE MULTIPLAYER</small><h2>Searching for your challenger…</h2><p>The match begins automatically when another reader joins.</p><button onClick={() => void cancel()}>Cancel search</button></section>}
    {match && state && match.status !== "waiting" && <section className="uc-game">
      <PlayerBar name={match.players[theirs - 1]?.display_name || "Opponent"} side={theirs === 1 ? "WHITE" : "BLACK"} king={theirs === 1 ? "wK" : "bK"} time={clockFor(theirs)} active={live && state.turn === theirs} captured={capturedBy(theirs)} lead={lead(theirs)} />
      <div className="uc-main"><div className="uc-boardwrap"><div className={"uc-turn " + (state.check && match.status === "active" ? "check" : "") + (myTurn ? " mine" : "")} aria-live="polite">{turnText}</div>
        <div ref={boardRef} className={"uc-board" + (drag ? " dragging" : "")}>
          {rows.flatMap((r, ri) => cols.map((c, ci) => {
            const s = sq(r, c), piece = state.board[r]?.[c], target = targets.get(s);
            const lastMove = state.lastMove && (state.lastMove.from === s || state.lastMove.to === s);
            const cls = "uc-square " + ((r + c) % 2 ? "dark" : "light") + (selected === s ? " sel" : "") + (target ? " target" : "") + (target?.capture ? " capture" : "") + (lastMove ? " last" : "") + (checkSquare === s ? " incheck" : "") + (hint?.from === s ? " hint-from" : "") + (hint?.to === s ? " hint-to" : "");
            return <button key={s} data-sq={s} aria-label={s + " " + (piece ? (piece[0] === "w" ? "White " : "Black ") + (NAMES[piece[1]] || "piece") : "empty")} disabled={match.status !== "active" || busy}
              onPointerDown={(e) => startDrag(e, r, c)} onClick={() => onSquare(r, c)} className={cls}>
              {ci === 0 && <small className="rank">{8 - r}</small>}{ri === 7 && <small className="file">{FILES[c]}</small>}
              {target && !target.capture && <i className="dot" />}{target?.capture && <i className="ring" />}
              {piece && <Piece code={piece} className={(drag?.from === s ? "lifted" : "") + (state.lastMove?.to === s ? " landed" : "")} />}
            </button>;
          }))}
        </div>
        {drag && state.board && (() => { const [f, rk] = [FILES.indexOf(drag.from[0]), 8 - Number(drag.from[1])]; const p = state.board[rk]?.[f]; const size = (boardRef.current?.clientWidth || 480) / 8; return p ? <div className="uc-drag" style={{ left: drag.x, top: drag.y, width: size, height: size }}><Piece code={p} /></div> : null; })()}
      </div>
      <aside className={movesOpen ? "open" : ""}><div className="uc-asidehead"><div><small>MATCH CONTROL</small><b>{state.computer ? "VS AI · " + LEVELS[(state.computerLevel || 2) - 1][0] : "LIVE READER MATCH"}</b></div><button onClick={() => setMovesOpen(v => !v)} aria-label="Show moves"><ChevronDown /></button></div>
        {assists && <div className="uc-assist">
          <button onClick={() => void askHint()} disabled={!myTurn || busy || !state.hintsLeft}><Lightbulb /><span>Hint</span><b>{state.hintsLeft || 0}</b></button>
          <button onClick={() => void takeBack()} disabled={!myTurn || busy || !state.undosLeft || state.moveHistory.length < 2}><Undo2 /><span>Take back</span><b>{state.undosLeft || 0}</b></button>
        </div>}
        <div className="uc-history"><label>MOVE HISTORY <b>{state.moveHistory.length || 0}</b></label>{!state.moveHistory.length ? <p>No moves yet.</p> : Array.from({ length: Math.ceil(state.moveHistory.length / 2) }, (_, i) => <div key={i}><span>{i + 1}.</span><b>{state.moveHistory[i * 2] || ""}</b><b>{state.moveHistory[i * 2 + 1] || ""}</b></div>)}</div>{match.status === "active" && <button className="uc-resign" onClick={() => void resign()}><Flag /> Resign</button>}<button className="uc-side-rank" onClick={() => void leaderboard()}><Trophy /> Standings</button></aside>
      </div>
      <PlayerBar name={boot?.self?.displayName || "Reader"} side={(mine === 1 ? "WHITE" : "BLACK") + " · YOU"} king={mine === 1 ? "wK" : "bK"} time={clockFor(mine)} active={live && state.turn === mine} captured={capturedBy(mine)} lead={lead(mine)}>
        {assists && <div className="uc-assist-mini">
          <button onClick={() => void askHint()} disabled={!myTurn || busy || !state.hintsLeft} aria-label={`Hint, ${state.hintsLeft || 0} left`}><Lightbulb /><b>{state.hintsLeft || 0}</b></button>
          <button onClick={() => void takeBack()} disabled={!myTurn || busy || !state.undosLeft || state.moveHistory.length < 2} aria-label={`Take back, ${state.undosLeft || 0} left`}><Undo2 /><b>{state.undosLeft || 0}</b></button>
        </div>}
      </PlayerBar>
      {message && <button className="uc-toast" onClick={() => setMessage("")}>{message}<X /></button>}</section>}
    {promo && <div className="uc-modal"><div className="uc-promote"><small>PAWN PROMOTION</small><h2>Choose your new piece</h2><div>{promo.choices.map(x => <button key={x} onClick={() => void play(promo.from, promo.to, x)}><span><Piece code={(match?.youAre === 1 ? "w" : "b") + x.toUpperCase()} /></span><b>{NAMES[x.toUpperCase()]}</b></button>)}</div><button onClick={() => setPromo(null)}>Cancel</button></div></div>}
    {match?.status === "finished" && !thinking && <div className="uc-modal"><div className="uc-result"><div>♛</div><small>ULTIMATE CHESS</small><h2>{winner(match, boot?.self?.userId)[0]}</h2><p>{winner(match, boot?.self?.userId)[1]}</p>
      {match.reward && <div className="uc-rewards">{match.reward.coins ? <><span>+10 Reader Coins</span>{state?.winner === match.youAre && <span>+20 win bonus</span>}</> : <span className="off">Daily coin limit reached</span>}{state?.winner === match.youAre && (match.reward.points ? <span>+10 leaderboard points</span> : <span className="off">Leaderboard points are done for today</span>)}</div>}
      <section><span><b>{state?.moveHistory.length || 0}</b>moves</span><span><b>{clock(state?.clocks[match.youAre - 1] || 0)}</b>time left</span><span><b>{state?.computer ? LEVELS[(state.computerLevel || 2) - 1][0] : "Live"}</b>opponent</span></section><footer><button onClick={() => { setMatch(null); setTimeout(() => void start(), 30); }}><RotateCcw /> Rematch</button><button onClick={() => setMatch(null)}>Change match</button><button onClick={() => void leaderboard()}><Trophy /> Rankings</button></footer></div></div>}
    {intro && <div className="uc-intro"><small>A.R.I.S.E. PRESENTS</small><h2>ULTIMATE <em>CHESS</em></h2><div><strong>{match?.players[0].display_name}</strong><span>VS</span><strong>{match?.players[1].display_name}</strong></div><p>Protect the king. Control the board. Claim the crown.</p></div>}
    {showRanks && <div className="uc-modal"><section className="uc-leaders"><header><div><small>♛ CHESS-ONLY STANDINGS</small><h2>Ultimate Chess Leaderboard</h2><p>3 points per win, 1 per draw</p></div><button onClick={() => setShowRanks(false)} aria-label="Close standings"><X /></button></header>{ranks.length === 0 ? <div className="uc-empty"><Trophy /><h3>No ranked games yet.</h3><p>Finish the first match and take #1.</p></div> : <div className="uc-list">{ranks.slice(0, 50).map(r => <div key={r.userId} className={(r.userId === boot?.self?.userId ? "me " : "") + (r.rank <= 3 ? "podium" : "")}><b>{r.rank === 1 ? "👑" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : "#" + r.rank}</b><strong>{r.displayName}</strong><span>{r.wins}W {r.draws}D {r.losses}L</span><em>{r.points} pts</em><small>{r.winRate}%</small></div>)}</div>}</section></div>}
  </main>;
}

function PlayerBar({ name, side, king, time, active, captured, lead, children }: { name: string; side: string; king: string; time: number; active: boolean; captured: string[]; lead: number; children?: ReactNode }) {
  return <div className={"uc-player" + (active ? " active" : "")}>
    <div><span><Piece code={king} /></span><section><small>{side}</small><b>{name}</b>
      <em className="uc-caps" aria-label={captured.length ? `Captured ${captured.length} pieces` : undefined}>{captured.map((p, i) => <Piece key={i} code={p} />)}{lead > 0 && <i>+{lead}</i>}</em>
    </section></div>
    {children}
    <time className={active ? "active" : ""} aria-label={`${name} clock`}>{clock(time)}</time>
  </div>;
}
