// The "Read on Arise" and "Games" cards at the top of the library.
// A student sees both, each half the width, side by side on one line. Everyone
// else has no Games card, so Read on Arise keeps the full line.
import { BookOpen, Gamepad2 } from "lucide-react";

type Props = {
  /** Show the Games card beside Read on Arise. */
  games: boolean;
  /** Cover images for the little stack of books on wide screens. */
  covers: string[];
  books: number;
  poems: number;
  articles: number;
  onReads: () => void;
  onGames: () => void;
};

export default function ReadGamesRow({ games: half, covers, books, poems, articles, onReads, onGames }: Props) {
  const readsLong = `${books} full books, ${poems} poems, iARISE lessons + ${articles} articles you can read right here · then take the quiz`;
  const gamesLong = "All game worlds + multiplayer games · 10 minutes daily · Pass quizzes for more time";
  const pad = half ? "gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3" : "gap-4 px-4 py-3";
  const icon = half ? "h-9 w-9 sm:h-11 sm:w-11" : "h-11 w-11";
  const glyph = half ? "h-5 w-5 sm:h-6 sm:w-6" : "h-6 w-6";
  const title = half ? "text-sm sm:text-lg" : "text-lg";

  return (
    <div className={half ? "mb-4 grid grid-cols-2 gap-2.5 sm:gap-4" : "mb-4"} data-testid="read-games-row">
      <button
        type="button"
        onClick={onReads}
        data-tour="reads"
        className={`group flex h-full w-full items-center overflow-hidden rounded-2xl bg-white text-left text-[#17143b] shadow-lg ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl ${pad}`}
      >
        <span className={`relative hidden h-16 w-28 shrink-0 ${half ? "xl:block" : "sm:block"}`} aria-hidden="true">
          {covers.map((src, i) => <img key={src} src={src} alt="" className="absolute top-0 h-16 w-11 rounded-md object-cover shadow-md ring-2 ring-white" style={{ left: i * 30, transform: `rotate(${(i - 1) * 6}deg)` }} />)}
        </span>
        <span className={`grid shrink-0 place-items-center rounded-xl bg-[#17143b] text-white ${icon} ${half ? "xl:hidden" : "sm:hidden"}`}><BookOpen className={glyph} /></span>
        <span className="min-w-0 flex-1">
          <span className={`flex flex-wrap items-center gap-x-2 font-black leading-tight ${title}`}>Read on Arise<span className={`rounded-full bg-[#7048e8] px-2 py-0.5 text-[10px] font-black text-white ${half ? "hidden sm:inline" : ""}`}>NEW</span></span>
          {half && <span className="mt-0.5 block text-[11px] font-bold leading-snug text-[#5d5a7a] sm:hidden">Books, poems &amp; articles</span>}
          <span className={`text-xs font-bold text-[#5d5a7a] ${half ? "hidden sm:block" : "block sm:text-sm"}`}>{readsLong}</span>
        </span>
        {!half && <span className="hidden rounded-full bg-[#17143b] px-4 py-2 text-xs font-black text-white sm:inline">START READING</span>}
      </button>

      {half && (
        <button
          type="button"
          onClick={onGames}
          data-testid="button-games"
          className={`club-entry-glow flex h-full w-full items-center rounded-2xl border border-indigo-300/30 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-left text-white shadow-lg transition hover:brightness-110 ${pad}`}
        >
          <span className={`grid shrink-0 place-items-center rounded-xl bg-white/15 ${icon}`}><Gamepad2 className={glyph} /></span>
          <span className="min-w-0 flex-1">
            <span className={`flex flex-wrap items-center gap-x-2 font-black leading-tight ${title}`}>Games<span className="hidden rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black tracking-wide text-slate-950 shadow-[0_0_16px_rgba(253,224,71,.45)] sm:inline">NEW</span></span>
            <span className="mt-0.5 block text-[11px] font-bold leading-snug text-white/80 sm:hidden">10 min a day · more with quizzes</span>
            <span className="hidden text-xs font-bold text-white/75 sm:block">{gamesLong}</span>
          </span>
        </button>
      )}
    </div>
  );
}
