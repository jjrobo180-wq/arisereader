import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CATEGORIES, GAMES, GAME_INFO, type CategoryId, type GameInfo } from "@shared/arcade/catalog";
import type { Lobby, LobbyTable, StartOptions } from "./api";
import { IconBack, IconBot, IconSearch, IconUsers } from "./icons";
import GameArt from "./covers/Art";
import { CoverTile, TitleLogo } from "./covers/Cover";
import { logoFor } from "./covers/styles";
import { Shelf } from "./LibraryShelf";
import "./library.css";

export type Reader = { userId: number; name: string };
type Props = {
  onClose: () => void;
  onStart: (gameId: string, opts: StartOptions) => void;
  onDeclineInvite: (table: LobbyTable) => void;
  onOpenChess?: () => void;
  lobby: Lobby;
  readers: Reader[];
  busy: boolean;
  error: string;
  locked?: string | null; // why games are unavailable right now
  initialCategory?: CategoryId | "all";
  /** Open straight to this game's page (picked on the Worlds page). */
  initialGame?: string | null;
  challenge?: Reader | null; // set when the student picked "Challenge" on a reader
  onClearChallenge?: () => void;
  /** Games this student played most recently, newest first. */
  recent?: string[];
};

type Entry = GameInfo & { chess?: boolean };

const CHESS: Entry = {
  id: "chess", name: "Chess", title: "Ultimate Chess", tagline: "The arena of kings.", emoji: "♛", category: "board",
  color: "#d9b44a", minutes: 15, blurb: "Real chess against readers or the computer.", chess: true,
  how: ["Play real chess against a reader or the computer.", "Choose a clock and how strong the computer plays.", "Win by checkmate, or when your opponent's clock runs out."],
};

const SHELVES: { id: CategoryId; title: string; note: string }[] = [
  { id: "board", title: "Strategy classics", note: "Timeless games of planning and position" },
  { id: "brain", title: "Mind games", note: "Outthink your opponent" },
  { id: "quick", title: "Quick matches", note: "Done in a few minutes" },
  { id: "cards", title: "Cards and dice", note: "Luck meets good choices" },
  { id: "words", title: "Word arena", note: "Spelling, meaning and grammar duels" },
  { id: "learn", title: "Math, science and the world", note: "Fast facts and numbers" },
];
const shelfTitle = (c: CategoryId) => SHELVES.find((s) => s.id === c)?.title || CATEGORIES.find((x) => x.id === c)?.name || "";

/** Spotlight games, rotated daily. */
const FEATURED = ["chess", "seabattle", "four", "ultimate", "sentence_fix", "gofish", "reversi", "tictactoe", "fifteen", "geography", "spelling", "codebreaker"];
const LEVELS = [{ id: 1, name: "Easy" }, { id: 2, name: "Medium" }, { id: 3, name: "Hard" }];

function useSavedLevel() {
  const [level, setLevel] = useState<number>(() => { try { return Number(localStorage.getItem("arcade_level")) || 2; } catch { return 2; } });
  useEffect(() => { try { localStorage.setItem("arcade_level", String(level)); } catch { /* ignore */ } }, [level]);
  return [level, setLevel] as const;
}

export default function GameRoom({ onClose, onStart, onDeclineInvite, onOpenChess, lobby, readers, busy, error, locked, initialCategory = "all", initialGame, challenge, onClearChallenge, recent = [] }: Props) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Entry | null>(null);
  const [level, setLevel] = useSavedLevel();
  const [scrolled, setScrolled] = useState(false);
  const shelfRefs = useRef<Partial<Record<CategoryId, HTMLElement | null>>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  const withChess = !!onOpenChess && !challenge;
  const byId = (id: string): Entry | undefined => (id === "chess" ? (withChess ? CHESS : undefined) : GAME_INFO[id]);
  const all: Entry[] = withChess ? [CHESS, ...GAMES] : GAMES;

  const featured = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    const pool = FEATURED.filter((id) => byId(id));
    return Array.from({ length: 5 }, (_, i) => byId(pool[(day + i * 2) % pool.length])!).filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withChess]);
  const [spot, setSpot] = useState(0);
  const hero = featured[Math.min(spot, featured.length - 1)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (picked) setPicked(null);
      else if (query) setQuery("");
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, query, onClose]);

  // Picked on the Games page: open that game's page right away.
  useEffect(() => {
    const e = initialGame ? GAME_INFO[initialGame] : undefined;
    if (e) setPicked(e);
  }, [initialGame]);

  // Opened from a category button in the lounge: go straight to that shelf.
  useEffect(() => {
    if (initialCategory === "all") return;
    const t = window.setTimeout(() => shelfRefs.current[initialCategory]?.scrollIntoView({ block: "start", behavior: "smooth" }), 120);
    return () => window.clearTimeout(t);
  }, [initialCategory]);

  const waitingFor = (id: string) => lobby.tables.filter((t) => t.gameId === id).length;
  const q = query.trim().toLowerCase();
  const results = q ? all.filter((g) => `${g.title} ${g.name} ${g.blurb} ${shelfTitle(g.category)}`.toLowerCase().includes(q)) : [];
  const recentGames = recent.map(byId).filter((e): e is Entry => !!e).slice(0, 10);
  const live = challenge ? [] : [...lobby.invites.map((t) => ({ ...t, invite: true })), ...lobby.tables.map((t) => ({ ...t, invite: false }))];
  const open = (e: Entry) => setPicked(e);
  const tile = (e: Entry) => <CoverTile key={e.id} id={e.id} title={e.title} name={e.name} art={<GameArt gameId={e.id} />} waiting={waitingFor(e.id)} onOpen={() => open(e)} />;

  return (
    <section className="ax-root axl" aria-label="Games">
      <header className={"axl-top" + (scrolled ? " solid" : "")}>
        <button type="button" className="axl-icon" onClick={onClose} aria-label="Back to the Games page"><IconBack /></button>
        <div className="axl-brand">
          <b>Games</b>
          <span>{challenge ? `Pick a game to challenge ${challenge.name}` : `${all.length} games · play readers or the computer`}</span>
        </div>
        {challenge && <button type="button" className="axl-btn axl-btn-ghost axl-btn-sm" onClick={onClearChallenge}>Cancel challenge</button>}
        <label className="axl-search">
          <IconSearch />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games" aria-label="Search games" />
        </label>
      </header>

      <div className="axl-scroll" onScroll={(e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > 24)}>
        {q ? (
          <div className="axl-results">
            <h2 className="axl-h2">{results.length ? `Results for “${query.trim()}”` : `No games match “${query.trim()}”`}</h2>
            {results.length ? <div className="axl-grid">{results.map(tile)}</div> : <p className="axl-empty">Try a game's name, like Checkers or Spelling.</p>}
          </div>
        ) : (
          <>
            {hero && (
              <Spotlight
                entry={hero}
                items={featured}
                index={spot}
                onPick={setSpot}
                onOpen={() => open(hero)}
                onQuickPlay={hero.chess ? onOpenChess : () => onStart(hero.id, { computer: true, level })}
                quickLabel={hero.chess ? "Enter the arena" : `Quick play vs computer`}
                disabled={busy || !!locked}
                challenge={challenge}
              />
            )}

            <div className="axl-notes">
              {locked && <div className="axl-alert" role="status">{locked}</div>}
              {error && <div className="axl-alert bad" role="alert">{error}</div>}
            </div>

            {live.length > 0 && (
              <Shelf id="live" title="Readers waiting to play" note="Join a table to start right away">
                {live.map((t) => {
                  const g = GAME_INFO[t.gameId];
                  return (
                    <div key={t.matchId} className={"axl-table" + (t.invite ? " invite" : "")} style={{ "--accent": logoFor(t.gameId).accent } as CSSProperties}>
                      <span className="axl-table-art"><GameArt gameId={t.gameId} /></span>
                      <span className="axl-table-text">
                        <b>{t.invite ? `${t.hostName} challenged you` : `${t.hostName} is waiting`}</b>
                        <span>{g ? `${g.title} · ${g.name}` : t.gameName}</span>
                      </span>
                      <span className="axl-table-actions">
                        {t.invite && <button type="button" className="axl-btn axl-btn-ghost axl-btn-sm" onClick={() => onDeclineInvite(t)}>No thanks</button>}
                        <button type="button" className="axl-btn axl-btn-play axl-btn-sm" disabled={busy || !!locked} onClick={() => onStart(t.gameId, { matchId: t.matchId })}>{t.invite ? "Accept" : "Join"}</button>
                      </span>
                    </div>
                  );
                })}
              </Shelf>
            )}

            {recentGames.length > 0 && <Shelf id="recent" title="Jump back in">{recentGames.map(tile)}</Shelf>}

            {SHELVES.map((s) => {
              const list = all.filter((g) => g.category === s.id);
              return (
                <Shelf key={s.id} id={s.id} title={s.title} note={s.note} refCb={(el) => { shelfRefs.current[s.id] = el; }}>
                  {list.map(tile)}
                </Shelf>
              );
            })}
            <p className="axl-foot">Every game works against the computer or another reader. Wins earn game rewards.</p>
          </>
        )}
      </div>

      {picked && (
        <GamePage
          entry={picked}
          onClose={() => setPicked(null)}
          onStart={onStart}
          onOpenChess={onOpenChess}
          tables={lobby.tables.filter((t) => t.gameId === picked.id)}
          readers={readers}
          busy={busy}
          locked={locked}
          level={level}
          setLevel={setLevel}
          challenge={challenge}
        />
      )}
    </section>
  );
}

function Meta({ entry }: { entry: Entry }) {
  return (
    <ul className="axl-meta">
      <li>{shelfTitle(entry.category)}</li>
      <li>2 players</li>
      <li>About {entry.minutes} min</li>
      <li>{entry.chess ? "Readers or the computer" : "Computer or a reader"}</li>
    </ul>
  );
}

/** Painted backdrop: a blurred wash of the art plus the full scene on the right. */
function Backdrop({ id }: { id: string }) {
  return (
    <div className="axl-backdrop" key={id} aria-hidden="true">
      <GameArt gameId={id} className="axl-backdrop-wash" />
      <GameArt gameId={id} fit="wide" className="axl-backdrop-scene" />
      <span className="axl-backdrop-shade" />
    </div>
  );
}

function Spotlight({ entry, items, index, onPick, onOpen, onQuickPlay, quickLabel, disabled, challenge }: {
  entry: Entry; items: Entry[]; index: number; onPick: (i: number) => void; onOpen: () => void;
  onQuickPlay?: () => void; quickLabel: string; disabled: boolean; challenge?: Reader | null;
}) {
  return (
    <section className="axl-hero" style={{ "--accent": logoFor(entry.id).accent } as CSSProperties} aria-label={`Spotlight: ${entry.title}`}>
      <Backdrop id={entry.id} />
      <div className="axl-hero-copy" key={entry.id}>
        <div className="axl-hero-logo"><TitleLogo id={entry.id} title={entry.title} classic={entry.name} max={entry.title.length > 9 ? 17 : 21} /></div>
        <p className="axl-tagline">{entry.tagline}</p>
        <Meta entry={entry} />
        <div className="axl-actions">
          <button type="button" className="axl-btn axl-btn-play" onClick={onOpen} data-testid="spotlight-play">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg> {challenge ? "Choose this game" : "Play"}
          </button>
          {onQuickPlay && !challenge && (
            <button type="button" className="axl-btn axl-btn-ghost" disabled={disabled && !entry.chess} onClick={onQuickPlay}>{quickLabel}</button>
          )}
        </div>
      </div>
      {items.length > 1 && (
        <div className="axl-picker" role="group" aria-label="Spotlight games">
          {items.map((it, i) => (
            <button key={it.id} type="button" className="axl-picker-item" aria-current={i === index} aria-label={`Show ${it.title}`} onClick={() => onPick(i)}>
              <GameArt gameId={it.id} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function GamePage({ entry, onClose, onStart, onOpenChess, tables, readers, busy, locked, level, setLevel, challenge }: {
  entry: Entry; onClose: () => void; onStart: (id: string, opts: StartOptions) => void; onOpenChess?: () => void;
  tables: LobbyTable[]; readers: Reader[]; busy: boolean; locked?: string | null; level: number; setLevel: (n: number) => void; challenge?: Reader | null;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, [entry.id]);
  const off = busy || !!locked;
  return (
    <div className="axl-page" role="dialog" aria-modal="true" aria-label={`${entry.title}, ${entry.name}`} style={{ "--accent": logoFor(entry.id).accent } as CSSProperties}>
      <div className="axl-page-scroll">
        <header className="axl-page-hero">
          <Backdrop id={entry.id} />
          <button ref={closeRef} type="button" className="axl-icon axl-page-back" onClick={onClose} aria-label="Back to all games"><IconBack /></button>
          <div className="axl-page-copy">
            <div className="axl-hero-logo"><TitleLogo id={entry.id} title={entry.title} classic={entry.name} max={entry.title.length > 9 ? 17 : 21} /></div>
            <p className="axl-tagline">{entry.tagline}</p>
            <Meta entry={entry} />
          </div>
        </header>

        <div className="axl-page-body">
          <section className="axl-card axl-how">
            <h3>How to play</h3>
            <ol>{entry.how.map((h) => <li key={h}>{h}</li>)}</ol>
            <p className="axl-small">{entry.blurb}</p>
          </section>

          <section className="axl-card axl-play" aria-label="Play">
            {locked && <div className="axl-alert" role="status">{locked}</div>}
            {entry.chess ? (
              <>
                <h3>Play</h3>
                <p className="axl-small">Ultimate Chess has its own arena with clocks, coaching and rated games.</p>
                <button type="button" className="axl-btn axl-btn-play axl-wide" onClick={onOpenChess}>Enter the chess arena</button>
              </>
            ) : challenge ? (
              <>
                <h3>Challenge {challenge.name}</h3>
                <p className="axl-small">{challenge.name} gets an invite, and the game starts when they accept.</p>
                <button type="button" className="axl-btn axl-btn-play axl-wide" disabled={off} onClick={() => onStart(entry.id, { inviteUserId: challenge.userId })} data-testid="button-send-challenge">Send challenge</button>
              </>
            ) : (
              <>
                <h3>Play the computer</h3>
                <div className="axl-levels" role="group" aria-label="Computer level">
                  {LEVELS.map((l) => <button key={l.id} type="button" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>{l.name}</button>)}
                </div>
                <button type="button" className="axl-btn axl-btn-play axl-wide" disabled={off} onClick={() => onStart(entry.id, { computer: true, level })} data-testid="button-play-computer">
                  <IconBot /> Play the computer
                </button>

                <h3 className="axl-gap">Play a reader</h3>
                {tables.map((t) => (
                  <div key={t.matchId} className="axl-reader">
                    <b><i className="axl-dot" />{t.hostName} is waiting</b>
                    <button type="button" className="axl-btn axl-btn-play axl-btn-sm" disabled={off} onClick={() => onStart(entry.id, { matchId: t.matchId })}>Join</button>
                  </div>
                ))}
                <button type="button" className="axl-btn axl-btn-ghost axl-wide" disabled={off} onClick={() => onStart(entry.id, {})}>
                  <IconUsers /> {tables.length ? "Join the next open table" : "Find a reader"}
                </button>
                {readers.length > 0 ? (
                  <div className="axl-readers">
                    <p className="axl-small">Or challenge someone online:</p>
                    {readers.slice(0, 8).map((r) => (
                      <div key={r.userId} className="axl-reader">
                        <b>{r.name}</b>
                        <button type="button" className="axl-btn axl-btn-ghost axl-btn-sm" disabled={off} onClick={() => onStart(entry.id, { inviteUserId: r.userId })}>Challenge</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="axl-small">Your table shows up for everyone in the Game Room. You can play the computer while you wait.</p>}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
