import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import GameHub from "@/arcade/GameHub";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";
import SceneArt from "@/arcade/covers/Scene";
import { WORLD_SCENES } from "@/arcade/covers/scenesWorlds";
import { CoverTile, TitleLogo } from "@/arcade/covers/Cover";
import type { LogoStyle } from "@/arcade/covers/styles";
import { Shelf } from "@/arcade/LibraryShelf";
import { IconBack } from "@/arcade/icons";
import { GAMES, type CategoryId } from "@shared/arcade/catalog";
import { STUDY_WORLD_PATH, STUDY_WORLD_TITLE } from "@shared/study/sets";
import GameArt from "@/arcade/covers/Art";
import ClashStrip from "@/components/chess/ClashStrip";
import { logoFor } from "@/arcade/covers/styles";
import "@/arcade/library.css";
import "./worlds.css";

type WorldId = "city" | "study" | "theater" | "laser" | "board" | "halloread" | "chess" | "space" | "racetrack" | "twinlight" | "aoren";
type World = {
  id: WorldId;
  /** The cover title. */
  title: string;
  /** The name students already know, shown under the title. */
  name: string;
  tag: string;
  tagline: string;
  highlights: string[];
  facts: string[];
  path: string;
  look: LogoStyle;
};

const WORLDS: World[] = [
  {
    id: "study", title: STUDY_WORLD_TITLE, name: "Study hall", tag: "Study games", tagline: "Sit down with friends. Quiz off. Know it cold.",
    highlights: ["Walk into the study hall and sit at a table with friends", "Four games on any study set: Lightning Round, Last One Standing, Tug of War and Summit Race", "Make your own sets, ask AI to write one, or play the ones your teacher shares", "Flip through any set as flashcards", "Earn Reader Coins and climb the weekly board"],
    facts: ["Study games", "Play with readers", "Make your own sets"], path: STUDY_WORLD_PATH,
    look: { family: "strike", metal: ["#fffdf2", "#ffe08a", "#ffc53d"], glow: "rgba(255,197,61,.5)", accent: "#ffc53d" },
  },
  {
    id: "chess", title: "Ultimate Chess", name: "Chess arena", tag: "Strategy", tagline: "The arena of kings.",
    highlights: ["A cinematic chess arena", "Challenge the computer", "Battle another reader live"],
    facts: ["Strategy", "Readers or the computer", "Live matches"], path: "/ultimate-chess",
    look: { family: "legend", metal: ["#fff6d8", "#ffcf55", "#9a5a06"], glow: "rgba(255,200,110,.5)", accent: "#ffd27a" },
  },
  {
    id: "city", title: "Haven City", name: "The Block + Cinema", tag: "Open world", tagline: "Drive, hang out and race with your crew.",
    highlights: ["Drive around the city in your own car (everyone gets a free one)", "Walk your pet and visit your house", "Walk into Starlight Cinema to watch movies together", "Race at Haven Speedway", "Shop for cars and pets with Reader Coins"],
    facts: ["Open world", "Play with readers", "Free starter car"], path: "/city",
    look: { family: "strike", metal: ["#ffffff", "#bff8ff", "#3ee6ff"], glow: "rgba(62,230,255,.55)", accent: "#7ff0ff" },
  },
  {
    id: "theater", title: "Starlight Cinema", name: "A.R.I.S.E. Cinema", tag: "Movies", tagline: "Grab some popcorn. The show never stops.",
    highlights: ["Sit with friends", "Grab popcorn", "Watch the always-on Club movie channel"],
    facts: ["Movies", "Watch with friends", "Always on"], path: "/club-arise/theater",
    look: { family: "legend", metal: ["#fff6dc", "#ffd27a", "#d9461f"], glow: "rgba(255,150,80,.55)", accent: "#ffcf6e" },
  },
  {
    id: "board", title: "Board Quest", name: "Team board game", tag: "Team game", tagline: "Roll the dice. Answer bold. Win together.",
    highlights: ["Roll the dice and race around the board", "Answer learning questions", "Grab power-ups, points and shields", "Settle battles with Rock Paper Scissors"],
    facts: ["Team game", "Multiplayer", "Learning questions"], path: "/board-game-world",
    look: { family: "legend", metal: ["#ffffff", "#bff6ff", "#22a6c9"], glow: "rgba(34,211,238,.55)", accent: "#6eeaff" },
  },
  {
    id: "halloread", title: "Midnight Mystery", name: "Halloread", tag: "Mystery", tagline: "The school after dark is full of secrets.",
    highlights: ["Watch the security cameras", "Follow the clues", "Stay clear of the roaming mascot robots", "Team up with other readers"],
    facts: ["Mystery", "Team up", "Spooky, zero gore"], path: "/halloread-mystery",
    look: { family: "legend", metal: ["#fff1d6", "#ffb04d", "#e0541a"], glow: "rgba(249,115,22,.6)", accent: "#ffa04d" },
  },
  {
    id: "laser", title: "Prism Paintball", name: "Paintball arena", tag: "Action", tagline: "Five on five. Every color counts.",
    highlights: ["5v5 third-person paintball", "Three paint markers", "Forts and inflatable bunkers", "Smart bots and live multiplayer"],
    facts: ["Action", "5v5 battles", "Smart bots"], path: "/paintball-arena",
    look: { family: "strike", metal: ["#ffffff", "#9ff3ff", "#ff4fd8"], glow: "rgba(34,211,238,.55)", accent: "#7ff0ff" },
  },
  {
    id: "space", title: "Skybound Sprint", name: "Sky adventure", tag: "Adventure", tagline: "Run the sky. Topple the Storm King.",
    highlights: ["Cross 8 sky worlds", "Run, jump, glide and ground-pound", "Collect Star Shards", "Defeat the Storm King"],
    facts: ["Adventure", "8 sky worlds", "Boss battle"], path: "/skybound-sprint",
    look: { family: "strike", metal: ["#ffffff", "#ddd0ff", "#8b5cf6"], glow: "rgba(167,139,250,.6)", accent: "#cdbdff" },
  },
  {
    id: "racetrack", title: "Aurora Racers", name: "Kart racing", tag: "Racing", tagline: "Drift under the northern lights.",
    highlights: ["Race 4 wild tracks", "Drift for mini-turbos", "Throw paint bombs", "Win the Grand Prix and upgrade your kart"],
    facts: ["Racing", "4 tracks", "Grand Prix"], path: "/aurora-rally",
    look: { family: "strike", metal: ["#ffffff", "#c8ffe6", "#ff5470"], glow: "rgba(93,255,176,.5)", accent: "#8affc8" },
  },
  {
    id: "twinlight", title: "Twinlight Run", name: "Sky road runner", tag: "Runner", tagline: "One road, two worlds. Flip and run straight through.",
    highlights: ["Run a sky road that exists by day and by night at the same time", "Flip worlds to pass through gold walls and violet walls", "Jump, slide and switch lanes as the road speeds up", "Collect sun and moon orbs to fill the Eclipse bar, then smash through everything", "Beat your own best score"],
    facts: ["Endless runner", "One player", "Day and night"], path: "/twinlight-run",
    look: { family: "strike", metal: ["#ffffff", "#ffe9a8", "#9a97ff"], glow: "rgba(154,151,255,.55)", accent: "#ffc23d" },
  },
  {
    id: "aoren", title: "Chime of Aoren", name: "Anime adventure", tag: "Story", tagline: "A great bell went silent. One apprentice heard it.",
    highlights: ["Play a three-chapter anime story with Rin, Kaito and Pip", "Fight the Hushed with your bell-mallet", "Learn the Tones: Ember, Gale and the Firestorm Chord", "Duel a rival and face the Silent Conductor", "Level up as you go; your chapter is saved"],
    facts: ["Story adventure", "One player", "3 chapters"], path: "/chime-of-aoren",
    look: { family: "legend", metal: ["#fff6e6", "#ffcf7a", "#e0516f"], glow: "rgba(240,100,126,.5)", accent: "#ffcf7a" },
  },
];
const BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w])) as Record<WorldId, World>;

const TOP_GAMES: WorldId[] = ["twinlight", "aoren", "city", "study", "laser", "racetrack", "space", "board"];

const SHELVES: { id: string; title: string; note: string; worlds: WorldId[] }[] = [
  { id: "together", title: "Play with readers", note: "Meet up, team up and face off", worlds: ["city", "study", "board", "chess", "theater"] },
  { id: "action", title: "Action and adventure", note: "Race, battle and explore", worlds: ["twinlight", "aoren", "laser", "racetrack", "space", "halloread"] },
];

/** Starts downloading a world while the student is looking at it. */
const WARM: Record<WorldId, () => Promise<unknown>> = {
  city: () => import("./AriseCity"),
  study: () => import("./study/StudySquad"),
  theater: () => import("./ClubTheater"),
  board: () => import("./BoardGameWorld"),
  halloread: () => import("./MidnightMystery"),
  chess: () => import("./UltimateChess"),
  laser: () => import("./PaintballArena"),
  space: () => import("./SkyboundSprint"),
  racetrack: () => import("./AuroraRally"),
  twinlight: () => import("./StandaloneGame"),
  aoren: () => import("./StandaloneGame"),
};
const warm = (id: WorldId) => { void WARM[id]().catch(() => {}); };

/** Multiplayer mini-games now live directly on the Games page. */
const GAME_SHELVES: { id: CategoryId; title: string; note: string }[] = [
  { id: "board", title: "Strategy classics", note: "Timeless games of planning and position" },
  { id: "brain", title: "Mind games", note: "Outthink your opponent" },
  { id: "quick", title: "Quick matches", note: "Done in a few minutes" },
  { id: "cards", title: "Cards and dice", note: "Luck meets good choices" },
  { id: "words", title: "Word arena", note: "Word-building, reading, spelling, vocabulary and grammar" },
  { id: "learn", title: "Math, science and social studies", note: "Skills practice that still feels like a game" },
];

const NEW_LEARNING = ["letter_forge", "reading_detective", "context_clues", "figurative_language", "fraction_frenzy", "multiplication_mayhem", "decimal_dash", "geometry_grid", "money_math", "science_lab", "states_capitals", "history_hustle"];

const SAVED_KEY = "games_selected";
const ROTATION: WorldId[] = ["city", "study", "twinlight", "aoren", "space", "laser", "racetrack", "board", "chess", "theater", "halloread"];

function readSaved(): WorldId | null {
  try {
    const saved = localStorage.getItem(SAVED_KEY) as WorldId | null;
    return saved && BY_ID[saved] ? saved : null;
  } catch {
    return null;
  }
}

function Art({ id, fit, className }: { id: WorldId; fit?: "cover" | "wide"; className?: string }) {
  return <SceneArt paint={WORLD_SCENES[id]} fit={fit} className={className} />;
}

function Backdrop({ id }: { id: WorldId }) {
  return (
    <div className="axl-backdrop" key={id} aria-hidden="true">
      <Art id={id} className="axl-backdrop-wash" />
      <Art id={id} fit="wide" className="axl-backdrop-scene" />
      <span className="axl-backdrop-shade" />
    </div>
  );
}

function Facts({ world }: { world: World }) {
  return <ul className="axl-meta">{world.facts.map((f) => <li key={f}>{f}</li>)}</ul>;
}

/** Reads ?name= from the hash route (or the page URL). */
function hashParam(name: string) {
  const h = window.location.hash, i = h.indexOf("?");
  return (i >= 0 ? new URLSearchParams(h.slice(i + 1)).get(name) : null) ?? new URLSearchParams(window.location.search).get(name);
}

const logoMax = (w: World) => (w.title.length > 9 ? 17 : 21);
const PlayIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>;

/**
 * Avatar World is where a reader changes their character and spends Reader Coins.
 * It is not a game, so it stays out of the shelves and the spotlight: this button
 * lives in the top bar instead, where it is always in reach.
 */
function AvatarWorldButton({ token, onOpen }: { token: string | null; onOpen: () => void }) {
  const [coins, setCoins] = useState<number | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch(API_BASE + "/api/avatar-world", { headers: { Authorization: "Bearer " + token }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const wallet = d?.economy?.wallet; if (alive && typeof wallet === "number") setCoins(wallet); })
      .catch(() => { /* the button works without the coin count */ });
    return () => { alive = false; };
  }, [token]);
  const warmUp = () => { void import("./AvatarWorld").catch(() => {}); };
  return (
    <button type="button" className="worlds-avatar" onClick={onOpen} onPointerEnter={warmUp} onFocus={warmUp} data-testid="button-games-avatar-world">
      <span className="worlds-avatar-face" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="4.2" fill="currentColor" /><path d="M3.8 21.5a8.2 8.2 0 0116.4 0z" fill="currentColor" /></svg>
      </span>
      <span className="worlds-avatar-text">
        <b>Avatar World</b>
        <span className="worlds-avatar-sub">Build or view your avatar</span>
      </span>
      {coins !== null && (
        <span className="worlds-avatar-coins" aria-label={`${coins.toLocaleString()} Reader Coins`}>
          {coins.toLocaleString()} coins
        </span>
      )}
    </button>
  );
}

export default function Games() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [travel, setTravel] = useState<{ path: string; label: string } | null>(null);
  const [picked, setPicked] = useState<World | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [gameRoomOpen, setGameRoomOpen] = useState(false);
  const [launchGame, setLaunchGame] = useState<string | null>(null);
  // opened from a machine in Haven City's Neon Arcade: start that game, and head back when it closes
  const [fromArcade] = useState(() => hashParam("from") === "arcade");

  // Spotlight: Haven City first, then the world the student was last in and the day's picks.
  const featured = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    const rotated = ROTATION.map((_, i) => ROTATION[(day + i) % ROTATION.length]);
    const order = ["city" as WorldId, "study" as WorldId, readSaved(), ...rotated].filter((id): id is WorldId => !!id);
    return [...new Set(order)].slice(0, 5).map((id) => BY_ID[id]);
  }, []);
  const [spot, setSpot] = useState(0);
  const hero = featured[Math.min(spot, featured.length - 1)];

  const enter = (w: World) => {
    try { localStorage.setItem(SAVED_KEY, w.id); } catch { /* private mode */ }
    setTravel({ path: w.path, label: `Entering ${w.title}…` });
  };
  const open = (w: World) => { warm(w.id); setPicked(w); };
  const playGame = (gameId: string) => {
    setLaunchGame(gameId);
    setGameRoomOpen(true);
  };

  useEffect(() => { warm(hero.id); }, [hero.id]);
  useEffect(() => {
    const g = hashParam("game");
    if (g && GAMES.some((x) => x.id === g)) playGame(g);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!travel) return;
    const timer = window.setTimeout(() => navigate(travel.path), 450);
    return () => window.clearTimeout(timer);
  }, [travel, navigate]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && picked) setPicked(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);

  return (
    <main className="club-world-root worlds-root axl axl-solo" aria-label="Games">
      <header className={"axl-top" + (scrolled ? " solid" : "")}>
        <button type="button" className="axl-icon" onClick={() => setTravel({ path: "/library", label: "Returning to the library…" })} aria-label="Back to the library"><IconBack /></button>
        <div className="axl-brand">
          <b>Games</b>
          <span>{WORLDS.length} game worlds and {GAMES.length} multiplayer games</span>
        </div>
        <AvatarWorldButton token={token} onOpen={() => setTravel({ path: "/avatar-world", label: "Opening Avatar World…" })} />
      </header>

      <div className="axl-scroll" onScroll={(e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > 24)}>
        <section className="axl-hero" style={{ "--accent": hero.look.accent } as CSSProperties} aria-label={`Spotlight: ${hero.title}`}>
          <Backdrop id={hero.id} />
          <div className="axl-hero-copy" key={hero.id}>
            <div className="axl-hero-logo"><TitleLogo id={hero.id} title={hero.title} classic={hero.name} look={hero.look} max={logoMax(hero)} /></div>
            <p className="axl-tagline">{hero.tagline}</p>
            <Facts world={hero} />
            <div className="axl-actions">
              <button type="button" className="axl-btn axl-btn-play" onClick={() => enter(hero)} data-testid="spotlight-enter"><PlayIcon /> Enter {hero.title}</button>
              <button type="button" className="axl-btn axl-btn-ghost" onClick={() => open(hero)}>About this world</button>
            </div>
          </div>
          {featured.length > 1 && (
            <div className="axl-picker" role="group" aria-label="Spotlight game worlds">
              {featured.map((w, i) => (
                <button key={w.id} type="button" className="axl-picker-item" aria-current={i === spot} aria-label={`Show ${w.title}`} onClick={() => setSpot(i)}>
                  <Art id={w.id} />
                </button>
              ))}
            </div>
          )}
        </section>

        <ClashStrip onOpen={() => enter(BY_ID.chess)} />

        <Shelf id="top-games" title="TOP Games" note="Featured favorites">
          {TOP_GAMES.map((id) => {
            const w = BY_ID[id];
            return (
              <span key={id} className="worlds-cover" onPointerEnter={() => warm(id)} onFocus={() => warm(id)}>
                <CoverTile id={id} title={w.title} name={w.name} look={w.look} art={<Art id={id} />} onOpen={() => open(w)} testId={`top-game-${id}`} />
              </span>
            );
          })}
        </Shelf>

        {SHELVES.map((s) => (
          <Shelf key={s.id} id={s.id} title={s.title} note={s.note}>
            {s.worlds.map((id) => {
              const w = BY_ID[id];
              return (
                <span key={id} className="worlds-cover" onPointerEnter={() => warm(id)} onFocus={() => warm(id)}>
                  <CoverTile id={id} title={w.title} name={w.name} look={w.look} art={<Art id={id} />} onOpen={() => open(w)} testId={`world-${id}`} />
                </span>
              );
            })}
          </Shelf>
        ))}
        <Shelf id="new-learning" title="NEW Learning Games" note="Fresh games for reading, words, math, science and social studies">
          {NEW_LEARNING.map((id) => {
            const g = GAMES.find((game) => game.id === id);
            return g ? (
              <span key={g.id} className="worlds-cover">
                <CoverTile id={g.id} title={g.title} name={g.name} look={logoFor(g.id)} art={<GameArt gameId={g.id} />} onOpen={() => playGame(g.id)} testId={`new-game-${g.id}`} />
              </span>
            ) : null;
          })}
        </Shelf>

        {GAME_SHELVES.map((s) => (
          <Shelf key={s.id} id={`games-${s.id}`} title={s.title} note={s.note}>
            {GAMES.filter((g) => g.category === s.id).map((g) => (
              <span key={g.id} className="worlds-cover" >
                <CoverTile id={g.id} title={g.title} name={g.name} look={logoFor(g.id)} art={<GameArt gameId={g.id} />} onOpen={() => playGame(g.id)} testId={`game-${g.id}`} />
              </span>
            ))}
          </Shelf>
        ))}
        <p className="axl-foot">Choose a game world, or open any multiplayer game directly from this page.</p>
      </div>

      {picked && <WorldPage world={picked} onClose={() => setPicked(null)} onEnter={() => enter(picked)} />}
      <GameHub
        token={token}
        open={gameRoomOpen}
        onOpen={() => setGameRoomOpen(true)}
        onClose={() => { setGameRoomOpen(false); setLaunchGame(null); if (fromArcade) setTravel({ path: "/city", label: "Back to the Neon Arcade…" }); }}
        initialGame={launchGame}
        readers={[]}
        locked={null}
        onOpenChess={() => navigate("/ultimate-chess")}
      />
      {travel && <WorldLoadingOverlay tone="universe" label={travel.label} />}
    </main>
  );
}

function WorldPage({ world, onClose, onEnter }: { world: World; onClose: () => void; onEnter: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, [world.id]);
  return (
    <div className="axl-page" role="dialog" aria-modal="true" aria-label={`${world.title}, ${world.name}`} style={{ "--accent": world.look.accent } as CSSProperties}>
      <div className="axl-page-scroll">
        <header className="axl-page-hero">
          <Backdrop id={world.id} />
          <button ref={closeRef} type="button" className="axl-icon axl-page-back" onClick={onClose} aria-label="Back to all games"><IconBack /></button>
          <div className="axl-page-copy">
            <div className="axl-hero-logo"><TitleLogo id={world.id} title={world.title} classic={world.name} look={world.look} max={logoMax(world)} /></div>
            <p className="axl-tagline">{world.tagline}</p>
            <Facts world={world} />
            <div className="axl-actions">
              <button type="button" className="axl-btn axl-btn-play" onClick={onEnter} data-testid="button-enter-world"><PlayIcon /> Enter {world.title}</button>
            </div>
          </div>
        </header>
        <div className="axl-page-body worlds-body">
          <section className="axl-card">
            <h3>What you can do</h3>
            <ul className="worlds-list">{world.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
          </section>
        </div>
      </div>
    </div>
  );
}
