// Arise LifeHub · Sleep: help falling asleep tonight, in the moment. Pick what's keeping you up
// and get the few tools most likely to help, in order; or browse sounds, breathing, quiet-mind
// games, body relaxations, stories, Scripture and prayer, journaling and videos. Everything can
// be heard with your eyes closed, the screen can go fully black, and nothing shows a clock.
// The morning check-in learns which tools actually work for you.
//
// Replaces the old Sleep log, which lives on as the Sleep log tab (same data: family.sleep).
import "./sleep.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Settings2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cleanSleepApp, recordUse, type JournalKind, type SleepApp as SleepAppData, type SoundId, SOUND_IDS } from "@shared/sleepApp";
import {
  ALPHABET_CATEGORIES, SLEEP_TABS, alphabetScript, blessingsScript, breathById, countdownScript, namesScript, shuffleScript, toolById, type SleepTab,
} from "@shared/sleepContent";
import { displayRef, passageById, passageScript, scriptById, type ScriptLine } from "@shared/sleepScripts";
import type { SectionProps } from "../ui";
import { SleepCtx, type SleepContext } from "./context";
import { narrator } from "./narrator";
import { sleepSounds } from "./soundEngine";
import { useLateNight, useNarrator, useSounds, useWakeLock } from "./hooks";
import { BreathStage, Dock, LightsOut, ReadStage, type BreathMode } from "./stages";
import { liveVerses, loadPassage } from "./passages";
import { SettingsSheet } from "./SettingsSheet";
import { TonightTab } from "./TonightTab";
import { BodyTab, BreatheTab, MindTab } from "./CalmTabs";
import { SoundsTab, StoriesTab, WatchTab } from "./ListenTabs";
import { PrayTab } from "./PrayTab";
import { JournalTab } from "./JournalTab";
import { LearnTab, LogTab, PlanTab } from "./PlanTabs";

type Stage = { kind: "read" } | { kind: "breath"; mode: BreathMode; minutes: number };

export default function SleepApp({ family, setFamily, today, makeId, say }: SectionProps) {
  const { token, user } = useAuth();
  const app = useMemo(() => cleanSleepApp(family.sleepApp), [family.sleepApp]);
  const update = useCallback((change: (a: SleepAppData) => SleepAppData) => setFamily((f) => ({ ...f, sleepApp: change(cleanSleepApp(f.sleepApp)) })), [setFamily]);
  const [tab, setTab] = useState<SleepTab>("tonight");
  const [stage, setStage] = useState<Stage | null>(null);
  const [lightsOut, setLightsOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [journalKind, setJournalKind] = useState<JournalKind>("dump");
  const [parkFocus, setParkFocus] = useState(0);
  const [alphabetCategory, setAlphabetCategory] = useState(ALPHABET_CATEGORIES[0].id);
  const sounds = useSounds();
  const voice = useNarrator();
  const late = useLateNight();
  const faith = app.settings.faith;
  const topRef = useRef<HTMLDivElement>(null);

  useWakeLock(sounds.playing || voice.state !== "idle" || !!stage || lightsOut);
  useEffect(() => { sleepSounds.setVolume(app.settings.volume); }, [app.settings.volume]);
  // Reading stops when you leave the Sleep app (its controls would be gone); sounds keep playing.
  useEffect(() => () => narrator.stop(), []);
  // The Pray tab only exists with faith content on.
  useEffect(() => { if (!faith && tab === "pray") setTab("tonight"); }, [faith, tab]);

  // Remember the sound mix, so it comes back the same next time.
  const levels = sounds.levels;
  useEffect(() => {
    const ids = Object.keys(levels);
    if (!ids.length) return;
    const t = setTimeout(() => {
      update((a) => {
        const same = SOUND_IDS.every((id) => (a.settings.mix[id] ?? 0) === (levels[id] ?? 0));
        return same ? a : { ...a, settings: { ...a.settings, mix: { ...levels } } };
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [levels, update]);

  const record = useCallback((toolId: string) => update((a) => recordUse(a, toolId, makeId)), [update, makeId]);
  // Lights out counts as a tool tried tonight, wherever it's switched on from.
  const goDark = useCallback(() => { record("screen:lights-out"); setLightsOut(true); }, [record]);
  const timerOn = useCallback(() => { if (app.settings.timer && !sleepSounds.timerEndsAt) sleepSounds.startTimer(app.settings.timer); }, [app.settings.timer]);

  const read = useCallback((title: string, lines: readonly ScriptLine[], toolId?: string) => {
    narrator.play(lines, { title, voice: "ai", aiVoice: app.settings.aiVoice, deviceVoice: app.settings.deviceVoice, pace: app.settings.pace, token });
    if (toolId) record(toolId);
    timerOn();
    setStage({ kind: "read" });
  }, [app.settings, token, record, timerOn]);

  const breathe = useCallback((mode: BreathMode, minutes: number, toolId?: string) => {
    narrator.stop();
    if (toolId) record(toolId);
    setStage({ kind: "breath", mode, minutes });
  }, [record]);

  const setSound = useCallback((id: SoundId, level: number) => {
    if (level > 0 && !sleepSounds.levels()[id]) { record(`sound:${id}`); sleepSounds.setVolume(app.settings.volume); timerOn(); }
    sleepSounds.setLevel(id, level);
  }, [record, timerOn, app.settings.volume]);

  const playMix = useCallback((mix: Partial<Record<SoundId, number>>) => {
    sleepSounds.setVolume(app.settings.volume);
    sleepSounds.setMix(mix);
    for (const id of Object.keys(mix)) record(`sound:${id}`);
    timerOn();
  }, [record, timerOn, app.settings.volume]);

  const goTab = useCallback((t: SleepTab) => { setTab(t); topRef.current?.scrollIntoView({ block: "start" }); }, []);

  const launch = useCallback((toolId: string) => {
    const [kind, item] = toolId.split(":");
    if (!toolById(toolId) || !item) return;
    switch (kind) {
      case "sound": {
        const id = item as SoundId;
        setSound(id, sleepSounds.levels()[id] ? 0 : app.settings.mix[id] ?? 0.7);
        return;
      }
      case "breathe": { const p = breathById(item); if (p) breathe({ kind: "pattern", pattern: p }, 5, toolId); return; }
      case "script": { const s = scriptById(item); if (s) read(s.title, s.lines, toolId); return; }
      case "passage": {
        const p = passageById(item);
        if (!p) return;
        read(displayRef(p.ref), passageScript(liveVerses(p.ref) ?? p.verses), toolId);
        void loadPassage(p.ref, token); // the live text is ready for next time
        return;
      }
      case "mind": {
        if (item === "shuffle") read("Cognitive shuffle", shuffleScript(), toolId);
        else if (item === "countdown") read("Counting backward by threes", countdownScript(), toolId);
        else if (item === "alphabet") { const c = ALPHABET_CATEGORIES.find((x) => x.id === alphabetCategory) ?? ALPHABET_CATEGORIES[0]; read(`The alphabet game: ${c.name}`, alphabetScript(c.name), toolId); }
        else if (item === "breathcount") breathe({ kind: "count" }, 10, toolId);
        else if (item === "the") breathe({ kind: "the" }, 5, toolId);
        else if (item === "park") { goTab("mind"); setParkFocus((n) => n + 1); }
        return;
      }
      case "pray": {
        if (item === "names") read("Names of God, A to Z", namesScript(), toolId);
        else if (item === "blessings") read("Count your blessings", blessingsScript(), toolId);
        return;
      }
      case "journal": setJournalKind(item as JournalKind); goTab("journal"); return;
      case "screen": goDark(); return;
    }
  }, [app.settings.mix, alphabetCategory, breathe, goDark, goTab, read, record, setSound, token]);

  const ctx: SleepContext = {
    family, setFamily, today, makeId, say, token, firstName: (user?.displayName || "").trim().split(/\s+/)[0] || "",
    app, update, faith, launch, read, breathe, playMix, setSound, goTab,
    isFav: (id) => app.favorites.includes(id),
    toggleFav: (id) => update((a) => ({ ...a, favorites: a.favorites.includes(id) ? a.favorites.filter((x) => x !== id) : [...a.favorites, id] })),
    journalKind, setJournalKind, parkFocus, alphabetCategory, setAlphabetCategory,
  };

  const tabs = SLEEP_TABS.filter((t) => faith || !t.faith);
  const playing = sounds.playing || voice.state !== "idle";

  return <SleepCtx.Provider value={ctx}>
    <div ref={topRef} className={`sleep-app -mx-3 -mt-4 min-h-[100dvh] px-4 pb-32 pt-4 sm:mx-0 sm:mt-0 sm:min-h-0 sm:rounded-[28px] sm:px-8 sm:pt-6 ${late ? "sleep-late" : ""}`} data-testid="sleep-app">
      <header className="flex items-center justify-between gap-3">
        <p className="sleep-serif flex items-center gap-2 text-[1.0625rem] text-[var(--sl-parchment)]"><Moon size={18} className="text-[var(--sl-ember)]" aria-hidden /> Sleep</p>
        <button type="button" onClick={() => setSettingsOpen(true)} className="sl-btn sl-ghost -mr-2"><Settings2 size={18} aria-hidden /> Settings</button>
      </header>
      <nav className="sl-tabs mt-3 border-b border-[var(--sl-veil)] pb-1" aria-label="Sleep app">
        {tabs.map((t) => <button key={t.id} type="button" onClick={() => goTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className="sl-tab" data-testid={`sleep-tab-${t.id}`}>{t.label}</button>)}
      </nav>
      <div className="mx-auto max-w-4xl">
        {tab === "tonight" && <TonightTab />}
        {tab === "sounds" && <SoundsTab onLightsOut={goDark} />}
        {tab === "breathe" && <BreatheTab />}
        {tab === "mind" && <MindTab />}
        {tab === "body" && <BodyTab />}
        {tab === "stories" && <StoriesTab />}
        {tab === "pray" && faith && <PrayTab />}
        {tab === "journal" && <JournalTab />}
        {tab === "watch" && <WatchTab />}
        {tab === "plan" && <PlanTab />}
        {tab === "learn" && <LearnTab />}
        {tab === "log" && <LogTab />}
      </div>
      {playing && !stage && !lightsOut && <Dock onOpenReading={() => setStage({ kind: "read" })} onLightsOut={goDark} />}
      {stage?.kind === "read" && <ReadStage onClose={() => setStage(null)} onLightsOut={goDark} />}
      {stage?.kind === "breath" && <BreathStage mode={stage.mode} minutes={stage.minutes} onClose={() => setStage(null)} onLightsOut={goDark} />}
      {lightsOut && <LightsOut onExit={() => setLightsOut(false)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  </SleepCtx.Provider>;
}
