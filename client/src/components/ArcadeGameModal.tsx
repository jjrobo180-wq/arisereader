import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";

type Match = { id: string; game_type: string; status: string; player1_id: number; player2_id: number | null; state: any; winner_id: number | null };

const NAMES: Record<string, { name: string; emoji: string; how: string }> = {
  four: { name: "Four in a Row", emoji: "🔵", how: "Drop pieces. Get four in a line across, down, or diagonally." },
  word_tiles: { name: "Word Tiles", emoji: "🔤", how: "One tile is a real word, two are scrambled. Real words score 2 points per letter." },
  word_rescue: { name: "Word Rescue", emoji: "🛟", how: "Guess letters. A right letter gives you another turn. Solve the word to win." },
  math_duel: { name: "Math Duel", emoji: "➗", how: "Answer fast and right. Streaks add bonus points." },
  synonym_sprint: { name: "Synonym Sprint", emoji: "📚", how: "Find the word that matches. Streaks add bonus points." },
  pattern_power: { name: "Pattern Power", emoji: "🧩", how: "Find what comes next. Streaks add bonus points." },
  sentence_fix: { name: "Sentence Fix", emoji: "✏️", how: "Pick the sentence with perfect grammar. Streaks add bonus points." },
  fact_dash: { name: "Fact Dash", emoji: "⚡", how: "Science and world facts. Streaks add bonus points." },
};
const CHOICE = new Set(["math_duel", "synonym_sprint", "pattern_power", "sentence_fix", "fact_dash"]);

let audio: AudioContext | null = null;
function beep(kind: "good" | "bad" | "drop" | "win" | "lose") {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    const notes = kind === "good" ? [660, 880] : kind === "bad" ? [220, 160] : kind === "drop" ? [420] : kind === "win" ? [523, 659, 784, 1046] : [392, 330, 262];
    notes.forEach((f, i) => {
      const o = audio!.createOscillator(), g = audio!.createGain(), t = audio!.currentTime + i * 0.11;
      o.type = kind === "bad" || kind === "lose" ? "sawtooth" : "triangle";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(audio!.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch { /* sound is optional */ }
}

function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => i);
  const colors = ["#f59e0b", "#22d3ee", "#a855f7", "#ef4444", "#22c55e", "#ec4899"];
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <style>{`@keyframes arcade-confetti{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}`}</style>
    {pieces.map(i => <span key={i} style={{ position: "absolute", left: (i * 37) % 100 + "%", top: -10, width: 8, height: 14, borderRadius: 2, background: colors[i % colors.length], animation: `arcade-confetti ${1.6 + (i % 7) * 0.25}s linear ${(i % 10) * 0.08}s forwards` }} />)}
  </div>;
}

export default function ArcadeGameModal({ match, myIndex, yourTurn, opponent, onAction, onQuit, onClose, onRematch }: {
  match: Match; myIndex: number; yourTurn: boolean; opponent: string;
  onAction: (body: any) => void; onQuit: () => void; onClose: () => void; onRematch: () => void;
}) {
  const s = match.state || {};
  const info = NAMES[match.game_type] || { name: "Arcade", emoji: "🎮", how: "" };
  const finished = match.status === "finished";
  const computer = !!s.computer;
  const won = computer ? Number(s.winner) === 1 : finished && Number(s.winner) === myIndex;
  const tie = finished && Number(s.winner) === 0;
  const mine = s.scores?.[myIndex - 1] || 0, theirs = s.scores?.[myIndex === 1 ? 1 : 0] || 0;
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const lastKey = useRef("");
  const endPlayed = useRef(false);

  // Feedback on the latest answer (yours or the opponent's).
  useEffect(() => {
    const last = s.last;
    if (!last) return;
    const key = JSON.stringify(last);
    if (key === lastKey.current) return;
    lastKey.current = key;
    const me = last.player === myIndex;
    let text = "";
    if (match.game_type === "word_rescue") text = (me ? "You" : opponent) + (last.correct ? ` found ${last.choice}! ` + (me ? "Go again!" : "") : ` missed with ${last.choice}.`);
    else if (last.correct) text = (me ? "Correct! " : opponent + " got it! ") + "+" + last.points + (me && (s.streaks?.[myIndex - 1] || 0) >= 2 ? ` 🔥 ${s.streaks[myIndex - 1]} streak` : "");
    else text = (me ? "Not quite — " : opponent + " missed — ") + "answer: " + last.answer;
    setFlash({ text, good: !!last.correct });
    if (me) beep(last.correct ? "good" : "bad");
    const t = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(t);
  }, [JSON.stringify(s.last)]);

  useEffect(() => {
    if (match.game_type === "four" && s.lastMove) beep("drop");
  }, [JSON.stringify(s.lastMove)]);

  useEffect(() => {
    if (!finished || endPlayed.current) return;
    endPlayed.current = true;
    beep(won ? "win" : "lose");
  }, [finished, won]);

  const status = match.status === "waiting" ? "Waiting for another reader to join…" : finished ? "Game complete" : yourTurn ? "Your turn!" : "Waiting for " + opponent + "…";
  const total = s.questions?.length || s.choices?.length || 0;

  return <div className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-sm">
    {finished && won && <Confetti />}
    <section className="relative max-h-[94dvh] w-[min(760px,96vw)] overflow-auto rounded-[2rem] bg-gradient-to-b from-white to-slate-100 p-4 text-slate-950 shadow-2xl sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-2xl">{info.emoji}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{computer ? "A.R.I.S.E Arcade · vs Computer" : "A.R.I.S.E Arcade · 2 players"}</p>
          <h2 className="text-xl font-black sm:text-2xl">{info.name}</h2>
          <p className={"mt-0.5 text-sm font-black " + (yourTurn && !finished ? "text-emerald-600" : "text-slate-500")}>{status}</p>
        </div>
        <button onClick={onQuit} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-200" aria-label="Quit game"><X /></button>
      </div>
      {!finished && <p className="mt-2 rounded-xl bg-slate-950/5 px-3 py-2 text-xs font-bold text-slate-600">{info.how}</p>}

      {(CHOICE.has(match.game_type) || match.game_type === "word_tiles") && <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-slate-950 p-3 text-white">
        <div><p className="text-[10px] font-black uppercase text-cyan-300">You</p><p className="text-3xl font-black">{mine}</p></div>
        <p className="text-center text-xs font-black text-white/50">{total ? `Round ${Math.min(total, (s.round || 0) + 1)} / ${total}` : ""}</p>
        <div className="text-right"><p className="truncate text-[10px] font-black uppercase text-rose-300">{opponent}</p><p className="text-3xl font-black">{theirs}</p></div>
      </div>}

      {flash && <div className={"mt-3 rounded-xl px-3 py-2 text-center text-sm font-black " + (flash.good ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>{flash.text}</div>}

      {match.game_type === "four" && <div className="mx-auto mt-4 max-w-[460px]">
        <div className="mb-1 grid grid-cols-7 gap-1">{Array.from({ length: 7 }, (_, c) => <button key={c} disabled={!yourTurn || match.status !== "active" || !!(s.board?.[0]?.[c])} onClick={() => onAction({ column: c })} className="h-9 rounded-lg bg-amber-300 text-lg font-black disabled:opacity-25" aria-label={"Drop in column " + (c + 1)}>▼</button>)}</div>
        <div className="grid grid-cols-7 gap-1 rounded-2xl bg-blue-600 p-2 shadow-inner">
          {(s.board || []).flatMap((row: any[], r: number) => row.map((cell: any, c: number) => {
            const last = s.lastMove && s.lastMove.row === r && s.lastMove.column === c;
            return <button key={r + "-" + c} disabled={!yourTurn || match.status !== "active"} onClick={() => onAction({ column: c })}
              className={"aspect-square rounded-full border-4 border-blue-800 transition-all " + (cell === 1 ? "bg-amber-400" : cell === 2 ? "bg-rose-500" : "bg-white/95") + (last ? " ring-4 ring-white" : "")} aria-label={"Column " + (c + 1)} />;
          }))}
        </div>
        <div className="mt-2 flex justify-between text-xs font-black"><span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-amber-400" />{myIndex === 1 ? "You" : opponent}</span><span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-rose-500" />{myIndex === 2 ? "You" : opponent}</span></div>
      </div>}

      {match.game_type === "word_rescue" && <div className="mt-4">
        <div className="rounded-2xl bg-emerald-50 p-4 text-center">
          <p className="text-sm font-bold text-emerald-700">Clue: {s.hint}</p>
          <div className="mt-3 break-all text-3xl font-black tracking-[.25em] sm:text-4xl">{String(s.word || "").split("").map((ch: string) => s.guessed?.includes(ch) ? ch : "_").join(" ")}</div>
          <div className="mt-3 flex justify-center gap-1">{Array.from({ length: Number(s.maxMisses || 8) }, (_, i) => <span key={i} className={"h-3 w-5 rounded-full " + (i < (s.misses || 0) ? "bg-rose-500" : "bg-emerald-300")} />)}</div>
          <p className="mt-1 text-[11px] font-bold text-slate-500">{Number(s.maxMisses || 8) - (s.misses || 0)} misses left</p>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 sm:grid-cols-9">{"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => {
          const used = s.guessed?.includes(letter); const hit = used && String(s.word || "").includes(letter);
          return <button key={letter} disabled={!yourTurn || used || match.status !== "active"} onClick={() => onAction({ letter })}
            className={"aspect-square rounded-xl text-lg font-black " + (used ? (hit ? "bg-emerald-400 text-white" : "bg-slate-300 text-slate-500") : "bg-white shadow disabled:opacity-40")}>{letter}</button>;
        })}</div>
      </div>}

      {match.game_type === "word_tiles" && !finished && <div className="mt-4">
        <p className="text-center font-black">Which tile is a real word?</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{(s.choices?.[s.round] || []).map((w: string) => <button key={w} disabled={!yourTurn || match.status !== "active"} onClick={() => onAction({ choice: w })} className="min-h-20 rounded-2xl bg-violet-600 text-2xl font-black tracking-widest text-white shadow-lg transition active:scale-95 disabled:opacity-40">{w}</button>)}</div>
      </div>}

      {CHOICE.has(match.game_type) && !finished && <div className="mt-4">
        <div className="rounded-2xl bg-white p-5 text-center shadow">
          <h3 className="text-xl font-black sm:text-2xl">{s.questions?.[s.round]?.q || "Round complete"}</h3>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">{(s.questions?.[s.round]?.options || []).map((choice: string) => <button key={choice} disabled={!yourTurn || match.status !== "active"} onClick={() => onAction({ choice })} className="min-h-16 rounded-2xl bg-slate-950 px-3 text-base font-black text-white shadow-lg transition active:scale-95 disabled:opacity-40 sm:min-h-20 sm:text-lg">{choice}</button>)}</div>
      </div>}

      {finished && <div className={"mt-4 rounded-2xl p-5 text-center " + (won ? "bg-amber-100" : tie ? "bg-slate-200" : "bg-sky-100")}>
        <div className="text-5xl">{won ? "🏆" : tie ? "🤝" : "💪"}</div>
        <h3 className="mt-1 text-2xl font-black">{won ? "You won!" : tie ? "Tie game!" : computer ? "Computer won — try again!" : "Good game!"}</h3>
        {match.game_type === "word_rescue" && <p className="mt-1 font-black text-slate-600">The word was {s.word}</p>}
        <p className="mt-1 text-sm font-bold text-slate-600">{won ? "+10 Reader Coins for playing · +20 win bonus · +10 leaderboard points" : "+10 Reader Coins for playing"}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={onRematch} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 font-black text-white"><RotateCcw className="h-5 w-5" /> Play again</button>
          <button onClick={onClose} className="min-h-12 rounded-2xl bg-slate-950 px-5 font-black text-white">Back to Arcade</button>
        </div>
      </div>}
    </section>
  </div>;
}
