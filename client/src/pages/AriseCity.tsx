import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowUp, Car, Check, DoorOpen, Flag, Gamepad2, Heart, LogOut, MapPin, Megaphone, MessageCircle, Navigation, PawPrint, Star, Timer, Trophy, Utensils, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { openPetCare, PET_PERSONALITIES } from "@/lib/pets";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";
import { CityGame, type CityHome, type CityHud, type CityPlayer, type CitySelf, type StarFound } from "@/game/city/game";
import { CARS, SHOP_CARS, carFor, type CarId } from "@shared/city/drive";
import { formatTime } from "@shared/city/race";
import { BOOTHS, BUILD, CINEMA, DESTINATIONS, FOOD_STANDS, LOTS, RESTAURANTS, SMASH, STARS, type Destination } from "@shared/city/layout";
import FairBooth from "./FairGames";
import { hashParam } from "@/lib/worldAvatar";
import "./ariseCity.css";

type Overlay = "dealer" | "petshop" | "race" | "phrases" | "help" | "stars" | "menu" | "places" | `booth-${number}` | null;
type World = { economy: { wallet: number }; state: { purchased: string[]; equipped: { car?: string; pet?: string }; lostPets?: string[] } };

const PETS: { id: string; name: string; price: number }[] = [
  { id: "pet-dog", name: "Club Pup", price: 450 }, { id: "pet-cat", name: "Club Cat", price: 450 }, { id: "pet-pig", name: "Puddle Pig", price: 500 },
  { id: "pet-penguin", name: "Pip Penguin", price: 550 }, { id: "pet-koala", name: "Kiki Koala", price: 600 }, { id: "pet-bunny", name: "Club Bunny", price: 650 },
  { id: "pet-parrot", name: "Rio Parrot", price: 650 }, { id: "pet-deer", name: "Daisy Deer", price: 650 }, { id: "pet-fox", name: "Fable Fox", price: 700 },
  { id: "pet-panda", name: "Poppy Panda", price: 750 }, { id: "pet-elephant", name: "Ellie Elephant", price: 800 }, { id: "pet-lion", name: "Leo Lion", price: 900 },
];

const HELP_KEY = "city_help_seen";
/** Set when a reader leaves for an arcade game, so they come back to the Neon Arcade. */
const RETURN_KEY = "city_return";
const MENU_NOTES: Record<string, string> = {
  "Cheese Slice": "Classic New York style, folded in half", "Pepperoni Slice": "Crispy cups of pepperoni", "Veggie Slice": "Peppers, onions and olives", "Garlic Knots": "Warm, buttery, four to a basket",
  "Ramen Bowl": "Rich broth, noodles and a soft egg", "Dumplings": "Six pan-fried dumplings", "Fried Rice": "Wok-tossed with veggies", "Spring Rolls": "Crunchy, with sweet chili sauce",
  "Street Tacos": "Three tacos with lime and cilantro", "Burrito": "Rice, beans and salsa, wrapped tight", "Nachos": "Loaded with cheese and pico", "Churros": "Cinnamon sugar and chocolate dip",
  "Pancake Stack": "Three fluffy pancakes and syrup", "Burger & Fries": "The diner classic", "Grilled Cheese": "Golden and melty", "Milkshake": "Vanilla, thick enough for a spoon",
};

/** Phones and tablets get on-screen controls; a touch on a laptop screen switches them on too. */
function useTouchControls() {
  const [touch, setTouch] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && window.innerWidth < 1100)));
  useEffect(() => {
    if (touch) return;
    const on = (e: PointerEvent) => { if (e.pointerType === "touch") setTouch(true); };
    window.addEventListener("pointerdown", on);
    return () => window.removeEventListener("pointerdown", on);
  }, [touch]);
  return touch;
}

export default function AriseCity() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<CityGame | null>(null);
  const selfRef = useRef<CitySelf | null>(null);
  const phraseRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<CityHud | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [players, setPlayers] = useState(0);
  const [homes, setHomes] = useState<CityHome[]>([]);
  const [notice, setNotice] = useState("");
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem("city_muted") === "1"; } catch { return false; } });
  const [travel, setTravel] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const touch = useTouchControls();

  const headers = useCallback(() => ({ Authorization: "Bearer " + token, "Content-Type": "application/json" }), [token]);
  const flash = useCallback((text: string) => { setNotice(text); window.setTimeout(() => setNotice((n) => (n === text ? "" : n)), 3500); }, []);

  // ── Enter the city ──
  useEffect(() => {
    if (!token || !hostRef.current) return;
    let alive = true;
    setError("");
    (async () => {
      try {
        const [boot, homeRes] = await Promise.all([
          fetch(API_BASE + "/api/city/bootstrap", { headers: headers(), cache: "no-store" }),
          fetch(API_BASE + "/api/homes/neighborhood", { headers: headers(), cache: "no-store" }).catch(() => null),
        ]);
        const d = await boot.json();
        if (!boot.ok) throw new Error(d.message || "Could not enter Haven City.");
        const h = homeRes && homeRes.ok ? await homeRes.json() : { homes: [] };
        if (!alive || !hostRef.current) return;
        selfRef.current = d.self;
        setPhrases(d.safePhrases || []);
        const game = new CityGame(hostRef.current, d.self, {
          onHud: setHud,
          onNote: flash,
          onStar: (s: StarFound) => {
            setFound(gameRef.current?.foundStars ?? []);
            const hint = STARS.find((x) => x.id === s.id)?.hint;
            flash(s.found === s.total ? `You found every star in Haven City!` : `Star found${hint ? ` ${hint}` : ""}! ${s.found} of ${s.total}`);
          },
        });
        gameRef.current = game;
        setFound(game.foundStars);
        game.setMuted(muted);
        game.attachMinimap(mapRef.current);
        const list: CityHome[] = (h.homes || []).map((x: any) => ({ ownerId: x.ownerId, displayName: x.displayName, homeId: x.homeId, unlocked: !!x.unlocked, lot: Number(x.lot) }));
        setHomes(list);
        game.setHomes(list, d.self.userId);
        // coming out of a house: stand on its front path, facing the street
        const from = Number(hashParam("from"));
        const lot = list.find((x) => x.ownerId === from)?.lot;
        const l = lot !== undefined ? LOTS[lot] : null;
        if (l) game.teleport(l.doorX, l.doorZ + (l.facing === 0 ? 2 : -2), l.facing);
        // coming out of the cinema: stand on the red carpet, facing the street
        if (hashParam("from") === "cinema") game.teleport(CINEMA.door.x - 5, CINEMA.door.z, -Math.PI / 2);
        // back from the Smash Room or the Build Zone: on the sidewalk outside its door
        if (hashParam("from") === "smash") game.teleport(SMASH.door.x, SMASH.door.z + 4, 0);
        if (hashParam("from") === "build") game.teleport(BUILD.door.x, BUILD.door.z + 4, 0);
        // back from an arcade game: you're still standing in the Neon Arcade
        try {
          const back = JSON.parse(sessionStorage.getItem(RETURN_KEY) || "null");
          sessionStorage.removeItem(RETURN_KEY);
          if (back?.venue && Date.now() - back.at < 3 * 3600_000) game.enterVenue(back.venue);
        } catch { /* start outside */ }
        game.setPlayers(d.players || []);
        setPlayers((d.players || []).length);
        setReady(true);
        try { if (!localStorage.getItem(HELP_KEY)) setOverlay("help"); } catch { /* ignore */ }
      } catch (e: any) {
        if (alive) setError(e?.message || "Could not enter Haven City.");
      }
    })();
    return () => {
      alive = false;
      gameRef.current?.dispose(); gameRef.current = null;
      void fetch(API_BASE + "/api/city/leave", { method: "POST", headers: headers(), keepalive: true }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, retry]);

  // ── Live presence ──
  useEffect(() => {
    if (!ready || !token) return;
    let busy = false;
    const tick = async () => {
      const game = gameRef.current; if (!game || busy) return;
      busy = true;
      try {
        const pose = game.getPose();
        const phrase = phraseRef.current; phraseRef.current = null;
        const r = await fetch(API_BASE + "/api/city/presence", { method: "POST", headers: headers(), body: JSON.stringify({ ...pose, phrase }) });
        if (r.status === 409) { await fetch(API_BASE + "/api/city/bootstrap", { headers: headers(), cache: "no-store" }); return; }
        const d = await r.json();
        if (r.ok && Array.isArray(d.players)) { game.setPlayers(d.players as CityPlayer[]); setPlayers(d.players.length); }
      } catch { /* try again next tick */ } finally { busy = false; }
    };
    const id = window.setInterval(tick, 600);
    const leave = () => { void fetch(API_BASE + "/api/city/leave", { method: "POST", headers: headers(), keepalive: true }).catch(() => {}); };
    window.addEventListener("pagehide", leave);
    return () => { window.clearInterval(id); window.removeEventListener("pagehide", leave); };
  }, [ready, token, headers]);

  useEffect(() => { gameRef.current?.setPaused(!!overlay && overlay !== "phrases"); }, [overlay]);
  useEffect(() => { gameRef.current?.setMuted(muted); try { localStorage.setItem("city_muted", muted ? "1" : "0"); } catch { /* ignore */ } }, [muted]);
  useEffect(() => { if (travel) { const t = window.setTimeout(() => navigate(travel), 450); return () => window.clearTimeout(t); } }, [travel, navigate]);

  // ── Places ──
  const interact = useCallback(() => {
    const spot = hud?.spot; const game = gameRef.current;
    if (!spot || !game) return;
    if (spot.kind === "venue") { if (hud?.driving) { flash(`Get out of your car (E) to go into ${spot.label}.`); return; } game.enterVenue(spot.venue!); }
    else if (spot.kind === "exit") game.leaveVenue();
    else if (spot.kind === "order") setOverlay("menu");
    else if (spot.kind === "seat") { if (!hud?.meal) flash("Order something at the counter first."); else game.sit(spot.id); }
    else if (spot.kind === "cabinet") {
      try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ venue: "arcade", at: Date.now() })); } catch { /* ignore */ }
      setTravel(`/games?game=${spot.game}&from=arcade`);
    }
    else if (spot.kind === "ride") { if (hud?.driving) flash("Get out of your car (E) to go on the ride."); else game.ride(spot.ride!); }
    else if (spot.kind === "bumper") { if (hud?.driving) flash("Get out of your car (E) to ride the bumper cars."); else game.startBumper(); }
    else if (spot.kind === "booth") { if (hud?.driving) flash("Get out of your car (E) to play."); else setOverlay(`booth-${spot.booth!}`); }
    else if (spot.kind === "treat") { const f = FOOD_STANDS[Number(spot.id.split("-")[1])]; if (f) game.eatTreat(f.name); }
    else if (spot.kind === "smash" || spot.kind === "build") { if (hud?.driving) flash(`Get out of your car (E) to go into the ${spot.label}.`); else setTravel(spot.kind === "smash" ? "/city/smash" : "/city/build"); }
    else if (spot.kind === "cinema") { if (hud?.driving) { flash("Get out of your car (E) to go into the cinema."); return; } setTravel("/club-arise/theater"); }
    else if (spot.kind === "library") { if (hud?.driving) { flash("Get out of your car to go into the library."); return; } setTravel("/library"); }
    else if (spot.kind === "dealer") setOverlay("dealer");
    else if (spot.kind === "petshop") setOverlay("petshop");
    else if (spot.kind === "speedway") { if (hud?.driving) setOverlay("race"); else flash("Get in your car (E) to race."); }
    else if (spot.kind === "home") {
      const home = homes.find((h) => h.lot === spot.lot);
      if (!home) { flash("This lot is open. Homes appear here as readers move in."); return; }
      if (hud?.driving) { flash("Get out of your car (E) to go inside."); return; }
      const mine = home.ownerId === selfRef.current?.userId;
      if (!mine && !home.unlocked) { flash(`${home.displayName}'s door is locked.`); return; }
      setTravel("/my-home?owner=" + home.ownerId);
    }
  }, [hud, homes, flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      if (e.key === "Escape") { if (gameRef.current && hud?.ride) gameRef.current.stopRide(); if (gameRef.current && hud?.bumper) gameRef.current.stopBumper(); setOverlay(null); return; }
      if (overlay) return;
      if (e.key.toLowerCase() === "f" && !e.repeat) interact();
      if (e.key.toLowerCase() === "t" && !e.repeat) setOverlay("phrases");
      if (e.key.toLowerCase() === "g" && !e.repeat) setOverlay("places");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact, overlay, hud?.ride, hud?.bumper]);

  const say = (text: string) => { phraseRef.current = text; gameRef.current?.say(text); setOverlay(null); };
  const refreshSelf = async () => {
    try {
      const r = await fetch(API_BASE + "/api/city/bootstrap", { headers: headers(), cache: "no-store" });
      const d = await r.json();
      if (r.ok) { selfRef.current = d.self; gameRef.current?.setCar(d.self.carId); gameRef.current?.setPet(d.self.petId); }
    } catch { /* ignore */ }
  };

  const spotLabel = (() => {
    const s = hud?.spot; if (!s) return null;
    if (s.kind === "home") {
      const home = homes.find((h) => h.lot === s.lot);
      if (!home) return "Open lot";
      return home.ownerId === selfRef.current?.userId ? "Go inside your home" : home.unlocked ? `Visit ${home.displayName}'s home` : `${home.displayName}'s home (locked)`;
    }
    if (s.kind === "library") return "Find a book at the A.R.I.S.E. Library";
    if (s.kind === "speedway") return hud?.driving ? "Race at Haven Speedway" : "Haven Speedway: get in your car to race";
    if (s.kind === "venue") return `Go into ${s.label}`;
    if (s.kind === "exit") return "Head back outside";
    if (s.kind === "order") return hud?.meal ? `Order again (you have a ${hud.meal})` : "Order food";
    if (s.kind === "seat") return hud?.meal ? `Sit down and eat your ${hud.meal}` : "Grab a table (order first)";
    if (s.kind === "cabinet" || s.kind === "ride" || s.kind === "bumper" || s.kind === "booth" || s.kind === "treat") return s.label;
    if (s.kind === "smash") return "Go into the Smash Room";
    if (s.kind === "build") return "Go into the Build Zone";
    return `Enter ${s.label}`;
  })();

  const race = hud?.race;
  const restaurant = hud?.room?.kind === "restaurant" ? RESTAURANTS.find((r) => r.id === hud.room!.id) ?? null : null;
  const busy = !!hud?.ride || hud?.eating != null;
  const bumping = !!hud?.bumper;
  const myHome = homes.find((h) => h.ownerId === selfRef.current?.userId);
  const goTo = (d: { name: string; x: number; z: number } | null) => { gameRef.current?.navigateTo(d); setOverlay(null); if (d) flash(`Directions to ${d.name}: follow the glowing arrows.`); };
  const nav = hud?.nav;
  const press = (key: string) => (on: boolean) => gameRef.current?.press(key, on);
  const showControls = ready && touch && !overlay && !(race?.phase === "finished") && !busy;
  const boothIndex = overlay?.startsWith("booth-") ? Number(overlay.slice(6)) : null;

  return (
    <main className={"club-world-root city-root" + (touch ? " city-touch" : "")}>
      <div ref={hostRef} className="city-canvas" />

      {/* top bar */}
      <header className="city-top">
        <button type="button" className="city-chip" onClick={() => setTravel("/worlds")} aria-label="Back to Worlds"><ArrowLeft /> <span>Worlds</span></button>
        <div className="city-place">
          <b>{hud?.area ?? "Haven City"}</b>
          <span>{players} {players === 1 ? "reader" : "readers"} here · {hud?.driving ? hud.carName : "on foot"}</span>
        </div>
        {ready && !!hud?.energy && <span className="city-chip city-energy" role="status" aria-label={`Energy: ${hud.energy} seconds left`}><Zap /> <b>{Math.floor(hud.energy / 60)}:{String(hud.energy % 60).padStart(2, "0")}</b></span>}
        {ready && <button type="button" className="city-chip city-stars" onClick={() => setOverlay("stars")} aria-label={`Hidden stars: ${found.length} of ${STARS.length} found`}><Star /> <b>{found.length}/{STARS.length}</b></button>}
      </header>
      <canvas ref={mapRef} className={"city-map" + (hud?.room || hud?.ride ? " hidden" : "")} width={170} height={170} aria-label="City map" />

      {/* on a ride */}
      {hud?.ride && (
        <div className="city-ride" role="status">
          <span>Riding <b>{hud.ride.name}</b></span>
          <span className="city-ride-time">{hud.ride.left}s</span>
          <button type="button" onClick={() => gameRef.current?.stopRide()}><LogOut /> Get off</button>
        </div>
      )}
      {/* bumper cars */}
      {hud?.bumper && (
        <div className="city-ride" role="status">
          <span>Bumper cars · <b>{hud.bumper.bumps} bumps</b></span>
          <span className="city-ride-time">{hud.bumper.left}s</span>
          <button type="button" onClick={() => gameRef.current?.stopBumper()}><LogOut /> Get out</button>
        </div>
      )}
      {/* directions */}
      {nav && !race && (
        <div className="city-nav" role="status" aria-live="polite">
          <span className="city-nav-arrow" style={{ transform: `rotate(${nav.arrow}deg)` }} aria-hidden="true"><ArrowUp /></span>
          <span className="city-nav-text">
            <b>{hud?.room ? "Head outside first" : nav.turn === "arrive" || nav.left <= nav.toCorner + 5 ? `${nav.name} is ahead` : nav.turn === "straight" ? `Keep going ${nav.toCorner} m` : `Turn ${nav.turn} in ${nav.toCorner} m`}</b>
            <span>{nav.name} · {nav.left >= 1000 ? `${(nav.left / 1000).toFixed(1)} km` : `${nav.left} m`}</span>
          </span>
          <button type="button" onClick={() => goTo(null)} aria-label="Stop directions"><X /></button>
        </div>
      )}
      {/* eating */}
      {hud?.eating != null && (
        <div className="city-eat" role="status" aria-label="Eating">
          <Utensils /><span>Eating your {hud.meal}…</span>
          <i><b style={{ width: `${Math.round(hud.eating * 100)}%` }} /></i>
        </div>
      )}

      {/* race HUD */}
      {race && race.phase !== "finished" && (
        <div className="city-race" role="status">
          {race.phase === "countdown" ? <b className="city-count">{race.countdown || "GO!"}</b> : (
            <>
              <span><Flag /> Lap {race.lap}/{race.laps}</span>
              {race.mode === "race" && <span><Trophy /> {race.position}/{race.racers}</span>}
              <span><Timer /> {formatTime(race.timeMs)}</span>
              <button type="button" onClick={() => gameRef.current?.endRace()}>Quit</button>
            </>
          )}
        </div>
      )}
      {race?.phase === "finished" && race.results && (
        <div className="city-modal" role="dialog" aria-label="Race results">
          <div className="city-card">
            <h2>{race.mode === "trial" ? "Time trial done" : race.results[0]?.you ? "You won!" : `You finished ${ordinal(race.results.findIndex((r) => r.you) + 1)}`}</h2>
            <ol className="city-results">{race.results.map((r) => <li key={r.name} className={r.you ? "you" : ""}><span>{r.name}</span><b>{r.timeMs ? formatTime(r.timeMs) : "—"}</b></li>)}</ol>
            {race.best && <p className="city-small">Your best with the {hud?.carName}: {formatTime(race.best)}</p>}
            <div className="city-row">
              <button type="button" className="city-btn" onClick={() => gameRef.current?.startRace(race.mode)}>Race again</button>
              <button type="button" className="city-btn ghost" onClick={() => gameRef.current?.endRace()}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* prompt */}
      {ready && !race && spotLabel && !overlay && !busy && !bumping && (
        <button type="button" className="city-prompt" onClick={interact}>
          {!touch && <kbd>F</kbd>}
          {hud?.spot?.kind === "venue" || hud?.spot?.kind === "exit" ? <DoorOpen /> : hud?.spot?.kind === "order" || hud?.spot?.kind === "seat" ? <Utensils /> : hud?.spot?.kind === "cabinet" ? <Gamepad2 /> : null}
          {spotLabel}
        </button>
      )}
      {ready && !race && !spotLabel && !overlay && !busy && !hud?.room && !hud?.driving && hud?.nearCar && (touch
        ? <button type="button" className="city-prompt" onClick={() => gameRef.current?.toggleCar()}><Car /> Get in your {hud.carName}</button>
        : <div className="city-hint"><kbd>E</kbd> Get in your {hud.carName}</div>)}
      {notice && <div className="city-notice" role="status">{notice}</div>}

      {/* speedometer */}
      {hud?.driving && <div className="city-speed" aria-label={`${hud.speed} miles per hour`}><b>{hud.speed}</b><span>mph</span></div>}

      {/* action buttons */}
      {ready && !busy && !bumping && (
        <div className="city-actions">
          <button type="button" onClick={() => setOverlay("places")} aria-label="Get directions to a place"><Navigation /><span>Go to</span></button>
          {hud?.room
            ? <button type="button" onClick={() => gameRef.current?.leaveVenue()} aria-label="Head back outside"><DoorOpen /><span>Leave</span></button>
            : <button type="button" onClick={() => gameRef.current?.toggleCar()} aria-label={hud?.driving ? "Get out of the car" : "Get in your car"}><Car /><span>{hud?.driving ? "Get out" : "Drive"}</span></button>}
          {hud?.driving && <button type="button" onClick={() => gameRef.current?.horn()} aria-label="Honk the horn"><Megaphone /><span>Horn</span></button>}
          <button type="button" onClick={() => setOverlay("phrases")} aria-label="Say something"><MessageCircle /><span>Say</span></button>
          <button type="button" onClick={() => openPetCare()} aria-label="Pet care"><Heart /><span>Pet</span></button>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? <VolumeX /> : <Volume2 />}</button>
        </div>
      )}

      {/* touch controls: a stick for walking; steering, gas, brake and drift for driving */}
      {showControls && !hud?.driving && <WalkStick game={gameRef} />}
      {ready && touch && bumping && !overlay && <WalkStick game={gameRef} />}
      {showControls && hud?.driving && (
        <>
          <SteerPad game={gameRef} />
          <div className="city-pedals">
            <HoldButton className="city-pedal drift" label="Drift (handbrake)" onHold={press(" ")}>Drift</HoldButton>
            <HoldButton className="city-pedal brake" label="Brake and reverse" onHold={press("s")}>Brake</HoldButton>
            <HoldButton className="city-pedal gas" label="Gas" onHold={press("w")}>Gas</HoldButton>
          </div>
        </>
      )}

      {/* overlays */}
      {overlay === "places" && (
        <Sheet title="Where do you want to go?" onClose={() => setOverlay(null)} wide>
          <p className="city-small">Pick a place and glowing arrows will lead you there along the streets. It works on foot or in your car.</p>
          {nav && <button type="button" className="city-btn ghost" style={{ marginBottom: 10 }} onClick={() => goTo(null)}><X /> Stop directions to {nav.name}</button>}
          {myHome && LOTS[myHome.lot] && (
            <div className="city-places-group"><h3>Home</h3><div className="city-places">
              <button type="button" onClick={() => goTo({ name: "My home", x: LOTS[myHome.lot].doorX, z: LOTS[myHome.lot].doorZ + (LOTS[myHome.lot].facing === 0 ? 3 : -3) })}><MapPin /> My home</button>
            </div></div>
          )}
          {(["Food & fun", "Fair", "Shops & places", "Outdoors"] as Destination["group"][]).map((g) => (
            <div key={g} className="city-places-group"><h3>{g}</h3><div className="city-places">
              {DESTINATIONS.filter((d) => d.group === g).map((d) => <button key={d.id} type="button" onClick={() => goTo(d)}><MapPin /> {d.name}</button>)}
            </div></div>
          ))}
        </Sheet>
      )}
      {boothIndex !== null && BOOTHS[boothIndex] && (
        <FairBooth
          name={BOOTHS[boothIndex].name} color={"#" + BOOTHS[boothIndex].color.toString(16).padStart(6, "0")} userId={selfRef.current?.userId}
          onClose={() => setOverlay(null)} onWin={(prize) => flash(`You won a ${prize}!`)}
        />
      )}
      {overlay === "menu" && restaurant && (
        <Sheet title={restaurant.name} onClose={() => setOverlay(null)}>
          <p className="city-small">Pick something, then sit at any table to eat it. A good meal gives you energy: you'll walk and drive faster for 2 minutes.</p>
          <div className="city-menu">
            {restaurant.menu.map((item) => (
              <button key={item} type="button" onClick={() => { gameRef.current?.order(item); setOverlay(null); flash(`${item} ordered. Find a table to eat.`); }}>
                <b>{item}</b><span>{MENU_NOTES[item] ?? ""}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {overlay === "phrases" && (
        <Sheet title="Say something" onClose={() => setOverlay(null)}>
          <div className="city-phrases">{phrases.map((p) => <button key={p} type="button" onClick={() => say(p)}>{p}</button>)}</div>
        </Sheet>
      )}
      {overlay === "help" && (
        <Sheet title="Welcome to Haven City" onClose={() => { setOverlay(null); try { localStorage.setItem(HELP_KEY, "1"); } catch { /* ignore */ } }}>
          {touch ? (
            <ul className="city-help">
              <li>Use the stick to walk. Push it all the way to run. Drag anywhere else to look around</li>
              <li>Tap <b>Drive</b> to get in your car. Everyone gets a free City Cruiser</li>
              <li>In the car, slide your left thumb to steer and hold <b>Gas</b> or <b>Brake</b> on the right. Hold Brake when stopped to reverse</li>
              <li>Tap the yellow button to go into places: your home, Starlight Cinema, Velocity Motors, Paws &amp; Pals, the library, the plaza restaurants and the Neon Arcade on the boardwalk</li>
              <li>Order food in a restaurant and sit down to eat it for a burst of energy</li>
              <li>Tap <b>Go to</b> to pick a place, then follow the glowing arrows there</li>
              <li>At Haven Fair, ride the Big Wheel, the carousel, the Sky Drop and the bumper cars, and play the game booths for prizes</li>
              <li>Smash things in the Smash Room and build anything in the Build Zone, both in North Haven</li>
              <li>Head west to the beach and pier, east past Lakeside Park to Haven Fair for the Big Wheel, the carousel and the Sky Drop, north to the library, mall and skate park, south to the speedway, the farm and the off-road trail</li>
              <li>Find all {STARS.length} hidden stars. Some are only reachable with a big jump</li>
            </ul>
          ) : (
            <ul className="city-help">
              <li><kbd>W A S D</kbd> or arrows to walk and drive (drag the screen to look around)</li>
              <li><kbd>E</kbd> get in or out of your car. Everyone gets a free City Cruiser</li>
              <li><kbd>F</kbd> go into places: your home, Starlight Cinema, Velocity Motors, Paws &amp; Pals, the library, the plaza restaurants and the Neon Arcade on the boardwalk</li>
              <li>Order food in a restaurant and sit down to eat it for a burst of energy</li>
              <li><kbd>G</kbd> or <b>Go to</b>: pick a place, then follow the glowing arrows there</li>
              <li>At Haven Fair, ride the Big Wheel, the carousel, the Sky Drop and the bumper cars, and play the game booths for prizes</li>
              <li>Smash things in the Smash Room and build anything in the Build Zone, both in North Haven</li>
              <li><kbd>Space</kbd> drift, <kbd>H</kbd> horn, <kbd>Shift</kbd> run, <kbd>T</kbd> say something</li>
              <li>Head west to the beach and pier, east past Lakeside Park to Haven Fair for the Big Wheel, the carousel and the Sky Drop, north to the library, mall and skate park, south to the speedway, the farm and the off-road trail</li>
              <li>Find all {STARS.length} hidden stars. Some are only reachable with a big jump</li>
            </ul>
          )}
        </Sheet>
      )}
      {overlay === "stars" && (
        <Sheet title={`Hidden stars: ${found.length} of ${STARS.length}`} onClose={() => setOverlay(null)}>
          <p className="city-small">Stars glow with a beam of light. Walk or drive through one to collect it.</p>
          <ul className="city-starlist">
            {STARS.map((s) => {
              const got = found.includes(s.id);
              return <li key={s.id} className={got ? "got" : ""}>{got ? <Check /> : <Star />}<span>{got ? `Found ${s.hint}` : `Somewhere ${s.hint}`}</span></li>;
            })}
          </ul>
        </Sheet>
      )}
      {overlay === "dealer" && <Dealer headers={headers} onClose={() => setOverlay(null)} onChanged={refreshSelf} />}
      {overlay === "petshop" && <PetShop headers={headers} onClose={() => setOverlay(null)} onChanged={refreshSelf} />}
      {overlay === "race" && (
        <Sheet title="Haven Speedway" onClose={() => setOverlay(null)}>
          <p className="city-small">You're driving the {hud?.carName}. Faster cars from Velocity Motors give you a better shot at first place.</p>
          <div className="city-race-pick">
            <button type="button" onClick={() => { setOverlay(null); gameRef.current?.startRace("race"); }}><Trophy /><b>Race</b><span>3 laps against Comet, Blaze and Nimbus</span></button>
            <button type="button" onClick={() => { setOverlay(null); gameRef.current?.startRace("trial"); }}><Timer /><b>Time trial</b><span>1 lap, beat your best time</span></button>
          </div>
        </Sheet>
      )}

      {!ready && !error && <WorldLoadingOverlay tone="block" label="Driving into Haven City…" />}
      {error && (
        <div className="city-modal"><div className="city-card">
          <h2>Haven City couldn't open</h2><p className="city-small">{error}</p>
          <div className="city-row"><button type="button" className="city-btn" onClick={() => setRetry((n) => n + 1)}>Try again</button><button type="button" className="city-btn ghost" onClick={() => navigate("/worlds")}>Back to Worlds</button></div>
        </div></div>
      )}
      {travel && <WorldLoadingOverlay tone="block" label={travel.startsWith("/my-home") ? "Heading inside…" : travel.startsWith("/club-arise/theater") ? "Finding a seat at Starlight Cinema…" : travel === "/library" ? "Opening the library…" : travel.startsWith("/games") ? "Starting the machine…" : travel === "/city/smash" ? "Heading into the Smash Room…" : travel === "/city/build" ? "Opening the Build Zone…" : "Leaving Haven City…"} />}
    </main>
  );
}

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="city-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"city-card" + (wide ? " wide" : "")}>
        <div className="city-card-head"><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close"><X /></button></div>
        {children}
      </div>
    </div>
  );
}

function useWorld(headers: () => Record<string, string>) {
  const [world, setWorld] = useState<World | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch(API_BASE + "/api/avatar-world", { headers: headers(), cache: "no-store" }).then(async (r) => { const d = await r.json(); if (r.ok) setWorld(d); else setMsg(d.message || "Could not load the shop."); }).catch(() => setMsg("Could not load the shop."));
  }, [headers]);
  const post = async (path: string, body: object, done: string) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(API_BASE + path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "That didn't work.");
      setWorld(d); setMsg(done); return true;
    } catch (e: any) { setMsg(e?.message || "That didn't work."); return false; } finally { setBusy(false); }
  };
  return { world, busy, msg, post };
}

function Dealer({ headers, onClose, onChanged }: { headers: () => Record<string, string>; onClose: () => void; onChanged: () => void }) {
  const { world, busy, msg, post } = useWorld(headers);
  const owned = new Set(world?.state.purchased ?? []);
  const current = carFor(world?.state.equipped.car);
  const list: CarId[] = ["car-starter", ...SHOP_CARS];
  return (
    <Sheet title="Velocity Motors" onClose={onClose} wide>
      <p className="city-small">Buy cars with Reader Coins you earn by reading. You have <b className="city-coins">{world ? world.economy.wallet : "…"} coins</b>.</p>
      <div className="city-grid">
        {list.map((id) => {
          const c = CARS[id];
          const mine = id === "car-starter" || owned.has(id);
          const using = current === id;
          return (
            <div key={id} className={"city-item" + (using ? " on" : "")}>
              <Car /><b>{c.name}</b>
              <span className="city-small">{c.blurb}</span>
              <span className="city-stats">Top speed {Math.round(c.top * 2.24)} mph · Acceleration {"●".repeat(Math.round(c.accel / 3))}</span>
              {using ? <span className="city-tag">Driving this</span>
                : mine ? <button type="button" className="city-btn" disabled={busy} onClick={async () => { if (await post("/api/avatar-world/customize", { action: "equip", slot: "car", itemId: id === "car-starter" ? "car-none" : id }, `Now driving the ${c.name}.`)) onChanged(); }}>Drive this</button>
                  : <button type="button" className="city-btn" disabled={busy || !world || world.economy.wallet < c.price} onClick={async () => { if (await post("/api/avatar-world/purchase", { itemId: id }, `You bought the ${c.name}!`)) onChanged(); }}>Buy · {c.price} coins</button>}
            </div>
          );
        })}
      </div>
      {msg && <p className="city-msg" role="status">{msg}</p>}
    </Sheet>
  );
}

function PetShop({ headers, onClose, onChanged }: { headers: () => Record<string, string>; onClose: () => void; onChanged: () => void }) {
  const { world, busy, msg, post } = useWorld(headers);
  const owned = new Set(world?.state.purchased ?? []);
  const lost = new Set(world?.state.lostPets ?? []);
  const current = world?.state.equipped.pet;
  return (
    <Sheet title="Paws & Pals" onClose={onClose} wide>
      <p className="city-small">Adopt a pet to walk with you around the city. Keep it happy with food, treats and walks. You have <b className="city-coins">{world ? world.economy.wallet : "…"} coins</b>.</p>
      <div className="city-row" style={{ marginBottom: 12 }}><button type="button" className="city-btn ghost" onClick={() => { onClose(); openPetCare(); }}><Heart /> Care for my pet</button></div>
      <div className="city-grid pets">
        {PETS.map((p) => {
          const info = PET_PERSONALITIES[p.id];
          const has = owned.has(p.id) && !lost.has(p.id);
          const using = current === p.id;
          return (
            <div key={p.id} className={"city-item" + (using ? " on" : "")}>
              <span className="city-emoji" aria-hidden="true">{info?.emoji ?? "🐾"}</span><b>{p.name}</b>
              <span className="city-small">{info?.trait}</span>
              {using ? <span className="city-tag">With you</span>
                : has ? <button type="button" className="city-btn" disabled={busy} onClick={async () => { if (await post("/api/avatar-world/customize", { action: "equip", slot: "pet", itemId: p.id }, `${p.name} is walking with you.`)) onChanged(); }}>Walk with me</button>
                  : <button type="button" className="city-btn" disabled={busy || !world} onClick={async () => { if (await post("/api/avatar-world/purchase", { itemId: p.id }, `Welcome home, ${p.name}!`)) onChanged(); }}>{lost.has(p.id) ? "Bring back" : `Adopt · ${p.price}`}</button>}
            </div>
          );
        })}
      </div>
      {msg && <p className="city-msg" role="status">{msg}</p>}
      <p className="city-small"><PawPrint className="inline h-4 w-4" /> Pets that are left unhappy for too long run away, so check in on yours.</p>
    </Sheet>
  );
}

type GameRef = { current: CityGame | null };

/** A button that stays pressed while a finger is on it, even if the finger slides a little. */
function HoldButton({ onHold, className, label, children }: { onHold: (on: boolean) => void; className: string; label: string; children: ReactNode }) {
  const [down, setDown] = useState(false);
  const downRef = useRef(false);
  const set = (on: boolean) => { if (downRef.current === on) return; downRef.current = on; setDown(on); onHold(on); };
  // let go if the button disappears mid-press
  useEffect(() => () => { if (downRef.current) onHold(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button
      type="button" aria-label={label} className={className + (down ? " down" : "")}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); set(true); }}
      onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >{children}</button>
  );
}

/** Analog walking stick: the further you push, the more you lean in; all the way out runs. */
function WalkStick({ game }: { game: GameRef }) {
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const id = useRef<number | null>(null);
  useEffect(() => () => game.current?.setStick(null), [game]);
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), radius = r.width * 0.36;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx *= radius / len; dy *= radius / len; }
    setKnob({ x: dx, y: dy });
    game.current?.setStick({ x: dx / radius, y: -dy / radius });
  };
  const end = () => { id.current = null; setKnob(null); game.current?.setStick(null); };
  return (
    <div
      className={"city-stick" + (knob ? " down" : "")} role="application" aria-label="Walk: push the stick the way you want to go"
      onPointerDown={(e) => { if (id.current !== null) return; id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (e.pointerId === id.current) move(e); }}
      onPointerUp={(e) => { if (e.pointerId === id.current) end(); }} onPointerCancel={end} onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="city-stick-knob" style={{ transform: `translate(${knob?.x ?? 0}px, ${knob?.y ?? 0}px)` }} />
    </div>
  );
}

/** Steering: slide a thumb left or right along the pad. The further from the middle, the harder the turn. */
function SteerPad({ game }: { game: GameRef }) {
  const [pos, setPos] = useState<number | null>(null);
  const id = useRef<number | null>(null);
  const origin = useRef(0);
  useEffect(() => () => game.current?.setSteer(null), [game]);
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // steer from where the thumb landed, so a tap anywhere starts straight; the pad edges give full lock
    const half = r.width * 0.32;
    const v = Math.max(-1, Math.min(1, (e.clientX - origin.current) / half));
    setPos(v); game.current?.setSteer(Math.abs(v) < 0.08 ? 0 : v);
  };
  const end = () => { id.current = null; setPos(null); game.current?.setSteer(null); };
  return (
    <div
      className={"city-steer" + (pos !== null ? " down" : "")} role="application" aria-label="Steer: slide left or right"
      onPointerDown={(e) => {
        if (id.current !== null) return;
        id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId);
        const r = e.currentTarget.getBoundingClientRect(), mid = r.left + r.width / 2;
        // a tap on the left or right third steers that way straight away
        const third = r.width / 3;
        origin.current = e.clientX < r.left + third ? e.clientX + r.width * 0.32 : e.clientX > r.right - third ? e.clientX - r.width * 0.32 : mid;
        move(e);
      }}
      onPointerMove={(e) => { if (e.pointerId === id.current) move(e); }}
      onPointerUp={(e) => { if (e.pointerId === id.current) end(); }} onPointerCancel={end} onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="city-steer-arrow left" aria-hidden="true">◀</span>
      <span className="city-steer-knob" style={{ transform: `translateX(calc(-50% + ${(pos ?? 0) * 46}px))` }} />
      <span className="city-steer-arrow right" aria-hidden="true">▶</span>
    </div>
  );
}
