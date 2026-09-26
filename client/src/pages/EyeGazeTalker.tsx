import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";
import EyeGazeLearningZone from "./EyeGazeLearningZone";

type Word = { label: string; picture: string; sentence: string };
type Place = { id: string; label: string; picture: string; hint: string; color: string; words: Word[] };

const needs: Word[] = [
  { label: "I want", picture: "🙋", sentence: "I want something." },
  { label: "More", picture: "➕", sentence: "I want more." },
  { label: "Help", picture: "🤝", sentence: "I need help." },
  { label: "Stop", picture: "✋", sentence: "Please stop." },
  { label: "Yes", picture: "👍", sentence: "Yes, please." },
  { label: "No", picture: "👎", sentence: "No, thank you." },
  { label: "Bathroom", picture: "🚽", sentence: "I need the bathroom." },
  { label: "Break", picture: "🧘", sentence: "I need a break." },
];

const places: Place[] = [
  { id: "kitchen", label: "Kitchen", picture: "🥛", hint: "Food and drinks", color: "#ffede1", words: [
    { label: "Milk", picture: "🥛", sentence: "I want milk." }, { label: "Water", picture: "💧", sentence: "I want water." },
    { label: "Apple", picture: "🍎", sentence: "I want an apple." }, { label: "Banana", picture: "🍌", sentence: "I want a banana." },
    { label: "Fridge", picture: "🧊", sentence: "Open the fridge." }, { label: "Cup", picture: "🥤", sentence: "This is my cup." },
    { label: "Spoon", picture: "🥄", sentence: "I need a spoon." }, { label: "Eat", picture: "🍽️", sentence: "I want to eat." },
  ] },
  { id: "store", label: "Store", picture: "🛒", hint: "Find and buy things", color: "#e9f4d7", words: [
    { label: "Cart", picture: "🛒", sentence: "I want a cart." }, { label: "Milk", picture: "🥛", sentence: "Let's find the milk." },
    { label: "Bread", picture: "🍞", sentence: "I need bread." }, { label: "Apple", picture: "🍎", sentence: "I see apples." },
    { label: "Banana", picture: "🍌", sentence: "I want bananas." }, { label: "Cookie", picture: "🍪", sentence: "I want a cookie." },
    { label: "Bag", picture: "🛍️", sentence: "Put it in the bag." }, { label: "Pay", picture: "💳", sentence: "Let's pay for our things." },
    { label: "Checkout", picture: "🧾", sentence: "Let's go to checkout." }, { label: "Help", picture: "🤝", sentence: "I need help at the store." },
  ] },
  { id: "bedroom", label: "Bedroom", picture: "🛏️", hint: "Rest and getting ready", color: "#e3eefa", words: [
    { label: "Bed", picture: "🛏️", sentence: "I want my bed." }, { label: "Sleep", picture: "😴", sentence: "I want to sleep." },
    { label: "Blanket", picture: "🧶", sentence: "I want my blanket." }, { label: "Pillow", picture: "🛌", sentence: "I need my pillow." },
    { label: "Light", picture: "💡", sentence: "Turn on the light." }, { label: "Book", picture: "📖", sentence: "Read a book with me." },
  ] },
  { id: "bathroom", label: "Bathroom", picture: "🫧", hint: "Wash and get clean", color: "#ddf5f4", words: [
    { label: "Toilet", picture: "🚽", sentence: "I need the toilet." }, { label: "Wash", picture: "🧼", sentence: "I want to wash my hands." },
    { label: "Bath", picture: "🛁", sentence: "It is bath time." }, { label: "Towel", picture: "🧺", sentence: "I need a towel." },
    { label: "Soap", picture: "🧴", sentence: "I need soap." }, { label: "Brush teeth", picture: "🪥", sentence: "I will brush my teeth." },
  ] },
  { id: "playroom", label: "Playroom", picture: "🧸", hint: "Toys and play", color: "#fff1c8", words: [
    { label: "Ball", picture: "⚽", sentence: "I want the ball." }, { label: "Blocks", picture: "🧱", sentence: "Let us build with blocks." },
    { label: "Teddy bear", picture: "🧸", sentence: "I want my teddy bear." }, { label: "Car", picture: "🚗", sentence: "I want the toy car." },
    { label: "Play", picture: "🎨", sentence: "I want to play." }, { label: "Again", picture: "🔁", sentence: "Let us do it again." },
  ] },
  { id: "school", label: "School", picture: "🎒", hint: "My classroom", color: "#eee8fa", words: [
    { label: "Teacher", picture: "👩‍🏫", sentence: "I need my teacher." }, { label: "Friend", picture: "🧒", sentence: "I want to play with my friend." },
    { label: "Book", picture: "📚", sentence: "I want a book." }, { label: "Pencil", picture: "✏️", sentence: "I need a pencil." },
    { label: "Outside", picture: "🌳", sentence: "I want to go outside." }, { label: "Lunch", picture: "🥪", sentence: "It is time for lunch." },
  ] },
  { id: "zoo", label: "Zoo", picture: "🦒", hint: "Animals to see", color: "#e0f3e7", words: [
    { label: "Lion", picture: "🦁", sentence: "I see a lion." }, { label: "Elephant", picture: "🐘", sentence: "I see an elephant." },
    { label: "Giraffe", picture: "🦒", sentence: "I see a giraffe." }, { label: "Monkey", picture: "🐒", sentence: "I see a monkey." },
    { label: "Penguin", picture: "🐧", sentence: "I see a penguin." }, { label: "Tiger", picture: "🐯", sentence: "I see a tiger." },
    { label: "More", picture: "➕", sentence: "I want to see more." }, { label: "Go", picture: "🚶", sentence: "Let us go." },
  ] },
  { id: "outside", label: "Outside", picture: "🌈", hint: "The world around me", color: "#e0f3fa", words: [
    { label: "Park", picture: "🛝", sentence: "I want to go to the park." }, { label: "Tree", picture: "🌳", sentence: "I see a tree." },
    { label: "Sun", picture: "☀️", sentence: "I see the sun." }, { label: "Rain", picture: "🌧️", sentence: "It is raining." },
    { label: "Swing", picture: "🛝", sentence: "I want to swing." }, { label: "Walk", picture: "🚶", sentence: "Let us go for a walk." },
  ] },
];

export default function EyeGazeTalker() {
  const [, navigate] = useLocation();
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [view, setView] = useState<"talk" | "learn">("talk");
  const [selected, setSelected] = useState<Word | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [dwell, setDwell] = useState(() => localStorage.getItem("eye-gaze-talker-dwell") !== "off");
  const [dwellMs, setDwellMs] = useState(() => Number(localStorage.getItem("eye-gaze-talker-time")) || 1800);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"ai" | "device" | "checking">("checking");
  const [notice, setNotice] = useState("");
  const wordDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellTarget = useRef<HTMLButtonElement | null>(null);
  const animalAudio = useRef<HTMLAudioElement | null>(null);
  const place = places.find(item => item.id === placeId);

  useEffect(() => {
    fetch("/api/eye-gaze/tts/status").then(r => r.json()).then(data => setVoiceStatus(data.configured ? "ai" : "device")).catch(() => setVoiceStatus("device"));
    return () => { stopSpeaking(); animalAudio.current?.pause(); };
  }, []);

  useEffect(() => {
    if (selected) wordDialog.current?.showModal();
  }, [selected]);

  useEffect(() => {
    if (settingsOpen) settingsDialog.current?.showModal();
  }, [settingsOpen]);

  useEffect(() => {
    localStorage.setItem("eye-gaze-talker-dwell", dwell ? "on" : "off");
    localStorage.setItem("eye-gaze-talker-time", String(dwellMs));
  }, [dwell, dwellMs]);

  useEffect(() => {
    const cancel = () => {
      if (dwellTimer.current) clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
      dwellTarget.current?.classList.remove("talker-dwelling");
      dwellTarget.current = null;
    };
    const enter = (event: PointerEvent) => {
      if (!dwell || event.pointerType !== "mouse") return;
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-talker-dwell]");
      if (!button || button.disabled || button === dwellTarget.current) return;
      cancel();
      dwellTarget.current = button;
      button.style.setProperty("--talker-wait", `${dwellMs}ms`);
      button.classList.add("talker-dwelling");
      dwellTimer.current = setTimeout(() => { cancel(); if (button.isConnected) button.click(); }, dwellMs);
    };
    const leave = (event: PointerEvent) => {
      if (dwellTarget.current && !dwellTarget.current.contains(event.relatedTarget as Node)) cancel();
    };
    document.addEventListener("pointerover", enter);
    document.addEventListener("pointerout", leave);
    document.addEventListener("pointerdown", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("pointerdown", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [dwell, dwellMs]);

  const deviceVoice = (text: string, onEnd?: () => void) => {
    if (!("speechSynthesis" in window)) { setNotice("Speech is unavailable on this device."); return; }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";
    speech.rate = 0.85;
    speech.onend = () => onEnd?.();
    window.speechSynthesis.speak(speech);
  };

  const playAnimal = (word: string) => {
    const sounds: Record<string, string> = { Lion: "lion", Elephant: "elephant", Giraffe: "giraffe", Monkey: "monkey", Penguin: "penguin", Tiger: "tiger" };
    if (!sounds[word]) return;
    animalAudio.current?.pause();
    const audio = new Audio(`/animal-sounds/${sounds[word]}.mp3`);
    animalAudio.current = audio;
    audio.volume = 0.85;
    void audio.play().catch(() => setNotice("Tap Hear animal to play the sound."));
  };

  const say = (text: string, onEnd?: () => void) => {
    setNotice("");
    animalAudio.current?.pause();
    window.speechSynthesis?.cancel();
    if (voiceStatus === "device") { deviceVoice(text, onEnd); return; }
    let fallbackStarted = false;
    void speakCharacterAI(text, { calmMode: true,
      onEnd: () => { if (!fallbackStarted) onEnd?.(); },
      onFallback: () => { fallbackStarted = true; setVoiceStatus("device"); setNotice("Using the device voice for now."); deviceVoice(text, onEnd); },
    });
  };

  const choose = (word: Word) => {
    setSelected(word);
    say(word.label, placeId === "zoo" ? () => playAnimal(word.label) : undefined);
  };

  const closeWord = () => { wordDialog.current?.close(); setSelected(null); };
  const closeSettings = () => { settingsDialog.current?.close(); setSettingsOpen(false); };

  if (view === "learn") return (
    <div className="talker-page min-h-screen bg-[#f3f8fa] text-[#193d57] px-3 sm:px-6 pb-10">
      <style>{`.talker-page button:focus-visible { outline: 4px solid #255bd5; outline-offset: 3px; } .talker-page button.talker-dwelling { outline: 4px solid #255bd5; outline-offset: 3px; overflow: hidden; } .talker-page button.talker-dwelling::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: #2676e236; transform-origin: left; animation: talker-fill var(--talker-wait) linear forwards; } @keyframes talker-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
      <EyeGazeLearningZone say={say} onBack={() => { stopSpeaking(); setView("talk"); }} />
    </div>
  );

  return (
    <div className="talker-page min-h-screen bg-[#f3f8fa] text-[#193d57] px-3 sm:px-6 pb-10">
      <style>{`
        .talker-page button { touch-action: manipulation; }
        .talker-page button:focus-visible { outline: 4px solid #255bd5; outline-offset: 3px; }
        .talker-page button.talker-dwelling { outline: 4px solid #255bd5; outline-offset: 3px; overflow: hidden; }
        .talker-page button.talker-dwelling::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: #2676e236; transform-origin: left; animation: talker-fill var(--talker-wait) linear forwards; }
        @keyframes talker-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      `}</style>
      <div className="max-w-[1450px] mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 py-4 sm:py-5">
          <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-[#193d57] text-[#ffd766] grid place-items-center text-2xl" aria-hidden="true">✦</span><h1 className="font-black text-2xl sm:text-3xl tracking-tight">My World <span className="text-[#137f96]">Talker</span></h1></div>
          <div className="flex gap-2">
            <button data-talker-dwell type="button" onClick={() => navigate("/profile")} className="relative min-h-12 px-4 rounded-2xl bg-white border-2 border-slate-200 font-black">← My profile</button>
            <button data-talker-dwell type="button" onClick={() => setSettingsOpen(true)} className="relative min-h-12 px-4 rounded-2xl bg-white border-2 border-slate-200 font-black">⚙ Settings</button>
            <button data-talker-dwell type="button" onClick={() => setView("learn")} className="relative min-h-12 px-4 rounded-2xl bg-teal-600 text-white font-black">📚 Learning Zone</button>
          </div>
        </header>

        <section aria-label="My words" className="rounded-[1.5rem] bg-[#193d57] p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 text-white">
          <div className="font-black tracking-wider text-sm lg:w-28">MY WORDS</div>
          <div className="min-h-16 flex-1 rounded-2xl bg-white text-[#193d57] p-3 flex flex-wrap items-center gap-2 font-black text-lg" aria-live="polite">
            {words.length ? words.map((word, i) => <span key={`${word}-${i}`} className="bg-[#e0f3f0] rounded-xl px-3 py-1">{word}</span>) : <span className="text-slate-500">Pick pictures to make a sentence</span>}
          </div>
          <div className="flex gap-2">
            <button data-talker-dwell type="button" disabled={!words.length} onClick={() => say(words.join(" ") + ".")} className="relative flex-1 lg:flex-none min-h-14 px-5 rounded-2xl bg-[#ffd766] text-[#193d57] font-black disabled:opacity-50">▶ Say it</button>
            <button data-talker-dwell type="button" disabled={!words.length} onClick={() => setWords([])} className="relative min-h-14 px-5 rounded-2xl bg-[#315772] text-white font-black disabled:opacity-50">Clear</button>
          </div>
        </section>

        <button data-talker-dwell type="button" onClick={() => setView("learn")} className="relative mt-6 w-full min-h-24 rounded-3xl bg-gradient-to-r from-[#ddf5f4] to-[#e3eefa] border-2 border-teal-200 p-4 flex items-center gap-4 text-left"><span className="text-5xl" aria-hidden="true">📚</span><span><strong className="block text-2xl font-black">Learning Zone</strong><span className="font-bold">Pictures, word sounds, sentences, and your turn to talk</span></span><span className="ml-auto text-2xl" aria-hidden="true">→</span></button>

        <section aria-label="Everyday words" className="mt-7">
          <p className="text-sm font-black tracking-widest text-[#477586] mb-3">ALWAYS HERE</p>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
            {needs.map(word => <button data-talker-dwell key={word.label} type="button" onClick={() => choose(word)} aria-label={`Say ${word.label}`} className="relative rounded-2xl bg-white border-2 border-sky-100 min-h-28 sm:min-h-32 px-1 py-3 flex flex-col justify-center items-center gap-1 shadow-sm hover:border-sky-500"><span className="text-4xl sm:text-5xl" aria-hidden="true">{word.picture}</span><span className="font-black text-base sm:text-lg leading-tight">{word.label}</span></button>)}
          </div>
        </section>

        <section className="mt-9" aria-labelledby="talker-place-title">
          <div className="flex flex-wrap justify-between items-end gap-3 mb-5"><div><p className="text-sm font-black tracking-widest text-[#477586]">{place ? "MY PLACES / " + place.label.toUpperCase() : "CHOOSE A PLACE"}</p><h2 id="talker-place-title" className="font-black text-3xl sm:text-4xl tracking-tight">{place ? place.label : "Where are we going?"}</h2><p className="text-[#547886] font-bold">{place ? "Choose a picture to hear a word." : "Pick a place or say what you need."}</p></div>{place && <button data-talker-dwell type="button" onClick={() => setPlaceId(null)} className="relative min-h-14 rounded-2xl bg-white border-2 border-sky-100 px-5 font-black">← All places</button>}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {place ? place.words.map(word => <button data-talker-dwell key={word.label} type="button" onClick={() => choose(word)} aria-label={`Say ${word.label}`} style={{ backgroundColor: place.color }} className="relative min-h-44 rounded-3xl border-2 border-transparent hover:border-sky-500 flex flex-col items-center justify-center gap-2 shadow-sm"><span className="text-7xl sm:text-8xl" aria-hidden="true">{word.picture}</span><span className="text-xl sm:text-2xl font-black">{word.label}</span></button>) : places.map(item => <button data-talker-dwell key={item.id} type="button" onClick={() => setPlaceId(item.id)} style={{ backgroundColor: item.color }} className="relative min-h-40 rounded-3xl border-2 border-transparent hover:border-sky-500 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 p-3 shadow-sm"><span className="text-6xl sm:text-7xl" aria-hidden="true">{item.picture}</span><span className="text-center sm:text-left"><strong className="block text-xl sm:text-2xl font-black">{item.label}</strong><small className="font-bold text-[#527483]">{item.hint}</small></span></button>)}
          </div>
        </section>
        <p className="text-center text-sm text-[#5c7c88] font-bold mt-8">Voice is AI-generated when available. Your device voice is the backup.</p>
        <p className="text-center mt-2"><a className="font-bold text-[#246779] underline" href="/animal-sounds/credits.html" target="_blank" rel="noopener noreferrer">Animal sound credits</a></p>
        {notice && <p role="status" className="text-center font-black text-[#315772] mt-2">{notice}</p>}
      </div>

      <dialog ref={wordDialog} onClose={() => setSelected(null)} aria-labelledby="talker-selected-word" className="rounded-[2rem] p-5 sm:p-7 w-[min(92vw,480px)] max-h-[94vh] overflow-y-auto text-center text-[#193d57] backdrop:bg-[#0b293bc2]">
        {selected && <><div className="flex justify-end"><button data-talker-dwell type="button" onClick={closeWord} aria-label="Close word card" className="relative w-14 h-14 rounded-full bg-[#eef4f6] text-3xl font-black">×</button></div><div className="h-44 sm:h-52 rounded-3xl bg-[#e0f3f0] grid place-items-center text-[7rem]" role="img" aria-label={`Picture for ${selected.label}`}>{selected.picture}</div><h2 id="talker-selected-word" className="text-4xl font-black mt-3">{selected.label}</h2><p className="text-xl font-bold text-[#3f687a] my-3">{selected.sentence}</p><div className="grid grid-cols-2 gap-2"><button data-talker-dwell type="button" onClick={() => say(selected.label)} className="relative min-h-16 rounded-2xl bg-[#e6f2f4] font-black">🔊 Say word</button><button data-talker-dwell type="button" onClick={() => say(selected.sentence)} className="relative min-h-16 rounded-2xl bg-[#137f96] text-white font-black">▶ Say full sentence</button></div>{["Lion", "Elephant", "Giraffe", "Monkey", "Penguin", "Tiger"].includes(selected.label) && <button data-talker-dwell type="button" onClick={() => { stopSpeaking(); playAnimal(selected.label); }} className="relative min-h-16 rounded-2xl w-full bg-[#e0f3e7] mt-3 font-black text-lg">🐾 Hear animal sound</button>}<button data-talker-dwell type="button" onClick={() => { setWords(previous => [...previous, selected.label]); closeWord(); }} className="relative min-h-14 mt-3 px-4 text-[#246779] font-black underline">+ Add to my words</button></>}
      </dialog>

      <dialog ref={settingsDialog} onClose={() => setSettingsOpen(false)} aria-labelledby="talker-settings-title" className="rounded-[2rem] p-6 w-[min(92vw,480px)] max-h-[90vh] overflow-y-auto text-[#193d57] backdrop:bg-[#0b293bc2]">
        <div className="flex justify-between items-center"><h2 id="talker-settings-title" className="text-3xl font-black">Settings</h2><button data-talker-dwell type="button" onClick={closeSettings} aria-label="Close settings" className="relative w-14 h-14 rounded-full bg-[#eef4f6] text-3xl font-black">×</button></div>
        <p className="font-bold mt-4">How do you choose a picture?</p>
        <div className="grid gap-2 mt-3"><button data-talker-dwell type="button" onClick={() => setDwell(true)} className={`relative min-h-16 rounded-2xl border-2 font-black ${dwell ? "border-[#137f96] bg-[#ddf5f4]" : "border-slate-200"}`}>👁 Look and wait</button><button data-talker-dwell type="button" onClick={() => setDwell(false)} className={`relative min-h-16 rounded-2xl border-2 font-black ${!dwell ? "border-[#137f96] bg-[#ddf5f4]" : "border-slate-200"}`}>☝ Tap or click</button></div>
        <label htmlFor="talker-wait-time" className="block font-black mt-5">Wait time</label><select id="talker-wait-time" value={dwellMs} onChange={event => setDwellMs(Number(event.target.value))} disabled={!dwell} className="w-full border-2 border-sky-200 rounded-xl p-3 mt-2 bg-white font-bold"><option value={1200}>1.2 seconds</option><option value={1800}>1.8 seconds</option><option value={2500}>2.5 seconds</option><option value={3500}>3.5 seconds</option></select>
        <p className="text-sm font-bold text-[#547886] mt-4">Eye gaze works when the device moves the on-screen pointer. Keep your gaze on a picture until the color fills. Touch and switch clicks also work.</p><button data-talker-dwell type="button" onClick={closeSettings} className="relative w-full min-h-16 rounded-2xl bg-[#137f96] text-white font-black mt-5">Done</button>
      </dialog>
    </div>
  );
}
