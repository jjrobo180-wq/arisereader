import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";
import SceneArt from "@/arcade/covers/Scene";
import { WORLD_SCENES } from "@/arcade/covers/scenesWorlds";
import { CoverTile, TitleLogo } from "@/arcade/covers/Cover";
import type { LogoStyle } from "@/arcade/covers/styles";
import { Shelf } from "@/arcade/LibraryShelf";
import { IconBack } from "@/arcade/icons";
import { GAMES, type CategoryId } from "@shared/arcade/catalog";
import GameArt from "@/arcade/covers/Art";
import { logoFor } from "@/arcade/covers/styles";
import "@/arcade/library.css";
import "./worlds.css";

type WorldId = "club" | "theater" | "neighborhood" | "laser" | "board" | "halloread" | "chess" | "space" | "racetrack";
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
    id: "club", title: "Neon Arcade", name: "A.R.I.S.E Arcade", tag: "Arcade", tagline: "Where readers come to play.",
    highlights: ["Dance and hang out with other readers", "Hunt for hidden stars", `Play ${GAMES.length} arcade games with readers or the computer`],
    facts: ["Arcade", "Play with readers", `${GAMES.length} games`], path: "/arise-arcade",
    look: { family: "strike", metal: ["#ffffff", "#ffb3f2", "#d23fe0"], glow: "rgba(232,121,249,.6)", accent: "#f0a0ff" },
  },
  {
    id: "chess", title: "Ultimate Chess", name: "Chess arena", tag: "Strategy", tagline: "The arena of kings.",
    highlights: ["A cinematic chess arena", "Challenge the computer", "Battle another reader live"],
    facts: ["Strategy", "Readers or the computer", "Live matches"], path: "/ultimate-chess",
    look: { family: "legend", metal: ["#fff6d8", "#ffcf55", "#9a5a06"], glow: "rgba(255,200,110,.5)", accent: "#ffd27a" },
  },
  {
    id: "neighborhood", title: "Haven Heights", name: "The Block", tag: "Explore", tagline: "Your street. Your house. Your crew.",
    highlights: ["Walk your neighborhood", "Find your house", "See other readers around the block"],
    facts: ["Explore", "See other readers", "Your own house"], path: "/neighborhood",
    look: { family: "legend", metal: ["#fffbea", "#ffd9a3", "#e08a4a"], glow: "rgba(255,170,100,.5)", accent: "#ffc48a" },
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
];
const BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w])) as Record<WorldId, World>;

const SHELVES: { id: string; title: string; note: string; worlds: WorldId[] }[] = [
  { id: "together", title: "Play with readers", note: "Meet up, team up and face off", worlds: ["club", "board", "chess", "neighborhood", "theater"] },
  { id: "action", title: "Action and adventure", note: "Race, battle and explore", worlds: ["laser", "racetrack", "space", "halloread"] },
];

/** Starts downloading a world while the student is looking at it. */
const WARM: Record<WorldId, () => Promise<unknown>> = {
  club: () => import("./ClubArise"),
  theater: () => import("./ClubTheater"),
  neighborhood: () => import("./Neighborhood"),
  board: () => import("./BoardGameWorld"),
  halloread: () => import("./MidnightMystery"),
  chess: () => import("./UltimateChess"),
  laser: () => import("./PaintballArena"),
  space: () => import("./SkyboundSprint"),
  racetrack: () => import("./AuroraRally"),
};
const warm = (id: WorldId) => { void WARM[id]().catch(() => {}); };

/** Arcade games, shelved the same way as in the Game Room. Picking one opens the arcade straight to that game. */
const ARCADE_SHELVES: { id: CategoryId; title: string; note: string }[] = [
  { id: "board", title: "Arcade: strategy classics", note: "Timeless games of planning and position" },
  { id: "brain", title: "Arcade: mind games", note: "Outthink your opponent" },
  { id: "quick", title: "Arcade: quick matches", note: "Done in a few minutes" },
  { id: "cards", title: "Arcade: cards and dice", note: "Luck meets good choices" },
  { id: "words", title: "Arcade: word arena", note: "Spelling, meaning and grammar duels" },
  { id: "learn", title: "Arcade: math, science and the world", note: "Fast facts and numbers" },
];

const SAVED_KEY = "worlds_selected";
const ROTATION: WorldId[] = ["space", "laser", "club", "racetrack", "board", "chess", "neighborhood", "theater", "halloread"];
// Halloread is the October special (same dates as the Halloread events elsewhere).
const halloween = (() => { const d = new Date(); return d.getMonth() === 9 || (d.getMonth() === 10 && d.getDate() <= 2); })();

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

const logoMax = (w: World) => (w.title.length > 9 ? 17 : 21);
const PlayIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>;

export default function Worlds() {
  const [, navigate] = useLocation();
  const [travel, setTravel] = useState<{ path: string; label: string } | null>(null);
  const [picked, setPicked] = useState<World | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Spotlight: the world the student was last in, then the day's picks.
  const featured = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    const rotated = ROTATION.map((_, i) => ROTATION[(day + i) % ROTATION.length]);
    const order = [readSaved(), halloween ? "halloread" : null, ...rotated].filter((id): id is WorldId => !!id);
    return [...new Set(order)].slice(0, 5).map((id) => BY_ID[id]);
  }, []);
  const [spot, setSpot] = useState(0);
  const hero = featured[Math.min(spot, featured.length - 1)];

  const enter = (w: World) => {
    try { localStorage.setItem(SAVED_KEY, w.id); } catch { /* private mode */ }
    setTravel({ path: w.path, label: `Entering ${w.title}…` });
  };
  const open = (w: World) => { warm(w.id); setPicked(w); };
  const playArcade = (gameId: string, title: string) => {
    try { sessionStorage.setItem("arcade_launch", gameId); localStorage.setItem(SAVED_KEY, "club"); } catch { /* private mode */ }
    setTravel({ path: "/arise-arcade", label: `Opening ${title}…` });
  };

  useEffect(() => { warm(hero.id); }, [hero.id]);
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
    <main className="club-world-root worlds-root axl axl-solo" aria-label="Worlds">
      <header className={"axl-top" + (scrolled ? " solid" : "")}>
        <button type="button" className="axl-icon" onClick={() => setTravel({ path: "/library", label: "Returning to the library…" })} aria-label="Back to the library"><IconBack /></button>
        <div className="axl-brand">
          <b>Worlds</b>
          <span>{WORLDS.length} worlds and {GAMES.length} arcade games</span>
        </div>
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
            <div className="axl-picker" role="group" aria-label="Spotlight worlds">
              {featured.map((w, i) => (
                <button key={w.id} type="button" className="axl-picker-item" aria-current={i === spot} aria-label={`Show ${w.title}`} onClick={() => setSpot(i)}>
                  <Art id={w.id} />
                </button>
              ))}
            </div>
          )}
        </section>

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
        {ARCADE_SHELVES.map((s) => (
          <Shelf key={s.id} id={`arcade-${s.id}`} title={s.title} note={s.note}>
            {GAMES.filter((g) => g.category === s.id).map((g) => (
              <span key={g.id} className="worlds-cover" onPointerEnter={() => warm("club")} onFocus={() => warm("club")}>
                <CoverTile id={g.id} title={g.title} name={g.name} look={logoFor(g.id)} art={<GameArt gameId={g.id} />} onOpen={() => playArcade(g.id, g.title)} testId={`arcade-${g.id}`} />
              </span>
            ))}
          </Shelf>
        ))}
        <p className="axl-foot">Pick a world to see what you can do there, or pick an arcade game to jump straight to it.</p>
      </div>

      {picked && <WorldPage world={picked} onClose={() => setPicked(null)} onEnter={() => enter(picked)} />}
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
          <button ref={closeRef} type="button" className="axl-icon axl-page-back" onClick={onClose} aria-label="Back to all worlds"><IconBack /></button>
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
