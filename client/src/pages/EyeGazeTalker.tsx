import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { preloadCharacterAI, speakCharacterAI, stopSpeaking } from "@/lib/tts";
import { useAuth } from "@/context/AuthContext";
import { defaultNeeds, talkerPicture, talkerRequest, type TalkerConfig, type TalkerState, type TalkerWord } from "@/lib/talkerState";
import EyeGazeLearningZone from "./EyeGazeLearningZone";

type Word = { label: string; picture: string; sentence: string; imageData?: string | null; baseLabel?: string };
type Place = { id: string; label: string; picture: string; hint: string; color: string; words: Word[] };

const animalSounds: Record<string, string> = {
  Lion: "lion", Elephant: "elephant", Giraffe: "giraffe", Monkey: "monkey",
  Penguin: "penguin", Tiger: "tiger", Bear: "bear", Owl: "owl", Frog: "frog",
  Cow: "cow", Dog: "dog", Cat: "cat", Sheep: "sheep", Duck: "duck", Rooster: "rooster",
};

export const places: Place[] = [
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
    { label: "Bear", picture: "🐻", sentence: "I see a bear." }, { label: "Owl", picture: "🦉", sentence: "I see an owl." },
    { label: "Frog", picture: "🐸", sentence: "I see a frog." },
    { label: "More", picture: "➕", sentence: "I want to see more." }, { label: "Go", picture: "🚶", sentence: "Let us go." },
  ] },
  { id: "farm", label: "Farm", picture: "🐮", hint: "Friendly animal sounds", color: "#fff1c8", words: [
    { label: "Cow", picture: "🐮", sentence: "The cow says moo." }, { label: "Dog", picture: "🐶", sentence: "The dog barks." },
    { label: "Cat", picture: "🐱", sentence: "The cat says meow." }, { label: "Sheep", picture: "🐑", sentence: "The sheep says baa." },
    { label: "Duck", picture: "🦆", sentence: "The duck quacks." }, { label: "Rooster", picture: "🐓", sentence: "The rooster crows." },
  ] },
  { id: "outside", label: "Outside", picture: "🌈", hint: "The world around me", color: "#e0f3fa", words: [
    { label: "Park", picture: "🛝", sentence: "I want to go to the park." }, { label: "Tree", picture: "🌳", sentence: "I see a tree." },
    { label: "Sun", picture: "☀️", sentence: "I see the sun." }, { label: "Rain", picture: "🌧️", sentence: "It is raining." },
    { label: "Swing", picture: "🛝", sentence: "I want to swing." }, { label: "Walk", picture: "🚶", sentence: "Let us go for a walk." },
  ] },
];

const emotionWords: Word[] = [
  { label: "Happy", picture: "😊", sentence: "I feel happy." },
  { label: "Sad", picture: "😢", sentence: "I feel sad." },
  { label: "Mad", picture: "😠", sentence: "I feel mad." },
  { label: "Scared", picture: "😨", sentence: "I feel scared." },
  { label: "Tired", picture: "🥱", sentence: "I feel tired." },
  { label: "Sick", picture: "🤒", sentence: "I feel sick." },
  { label: "Excited", picture: "🤩", sentence: "I feel excited." },
  { label: "Calm", picture: "😌", sentence: "I feel calm." },
];

const simpleWords: Word[] = [
  { label: "Yes", picture: "👍", sentence: "Yes." },
  { label: "No", picture: "👎", sentence: "No." },
  { label: "Help", picture: "🤝", sentence: "Help me." },
  { label: "More", picture: "➕", sentence: "More, please." },
  { label: "Stop", picture: "✋", sentence: "Stop, please." },
  { label: "Bathroom", picture: "🚽", sentence: "Bathroom, please." },
  { label: "Eat", picture: "🍽️", sentence: "I want to eat." },
  { label: "Drink", picture: "🥤", sentence: "I want a drink." },
];

export type TalkerCategory = { id: string; label: string; icon: string; hint: string; color: string; words: Word[] };
export const defaultTalkerPageOrder = ["people", "food", "needs", "actions", "emotions", "places", "school", "things"];

const peopleWords: Word[] = [
  { label: "Mom", picture: "👩", sentence: "I want Mom." },
  { label: "Dad", picture: "👨", sentence: "I want Dad." },
  { label: "Grandma", picture: "👵", sentence: "I want Grandma." },
  { label: "Grandpa", picture: "👴", sentence: "I want Grandpa." },
  { label: "Sister", picture: "👧", sentence: "I want my sister." },
  { label: "Brother", picture: "👦", sentence: "I want my brother." },
  { label: "Teacher", picture: "👩‍🏫", sentence: "I need my teacher." },
  { label: "Friend", picture: "🧒", sentence: "I want my friend." },
  { label: "Doctor", picture: "🧑‍⚕️", sentence: "I need the doctor." },
];

const foodWords: Word[] = [
  { label: "Water", picture: "💧", sentence: "I want water." },
  { label: "Milk", picture: "🥛", sentence: "I want milk." },
  { label: "Apple", picture: "🍎", sentence: "I want an apple." },
  { label: "Banana", picture: "🍌", sentence: "I want a banana." },
  { label: "Bread", picture: "🍞", sentence: "I want bread." },
  { label: "Snack", picture: "🍪", sentence: "I want a snack." },
  { label: "Pizza", picture: "🍕", sentence: "I want pizza." },
  { label: "Chicken", picture: "🍗", sentence: "I want chicken." },
  { label: "Breakfast", picture: "🥞", sentence: "I want breakfast." },
  { label: "Lunch", picture: "🥪", sentence: "I want lunch." },
];

const actionWords: Word[] = [
  { label: "Go", picture: "▶️", sentence: "I want to go." },
  { label: "Stop", picture: "✋", sentence: "Please stop." },
  { label: "Help", picture: "🤝", sentence: "I need help." },
  { label: "More", picture: "➕", sentence: "I want more." },
  { label: "Eat", picture: "🍽️", sentence: "I want to eat." },
  { label: "Drink", picture: "🥤", sentence: "I want a drink." },
  { label: "Play", picture: "🧸", sentence: "I want to play." },
  { label: "Read", picture: "📖", sentence: "I want to read." },
  { label: "Sleep", picture: "😴", sentence: "I want to sleep." },
  { label: "Wait", picture: "⏳", sentence: "Please wait." },
  { label: "Open", picture: "📂", sentence: "Please open it." },
  { label: "Close", picture: "📁", sentence: "Please close it." },
];

const placeWords: Word[] = [
  { label: "Home", picture: "🏠", sentence: "I want to go home." },
  { label: "School", picture: "🏫", sentence: "I am going to school." },
  { label: "Bathroom", picture: "🚽", sentence: "I need the bathroom." },
  { label: "Kitchen", picture: "🍽️", sentence: "I want to go to the kitchen." },
  { label: "Bedroom", picture: "🛏️", sentence: "I want my bedroom." },
  { label: "Store", picture: "🛒", sentence: "I want to go to the store." },
  { label: "Park", picture: "🛝", sentence: "I want to go to the park." },
  { label: "Outside", picture: "🌳", sentence: "I want to go outside." },
  { label: "Zoo", picture: "🦒", sentence: "I want to go to the zoo." },
];

const schoolWords: Word[] = [
  { label: "Teacher", picture: "👩‍🏫", sentence: "I need my teacher." },
  { label: "Friend", picture: "🧒", sentence: "I want my friend." },
  { label: "Book", picture: "📚", sentence: "I need my book." },
  { label: "Pencil", picture: "✏️", sentence: "I need a pencil." },
  { label: "Backpack", picture: "🎒", sentence: "I need my backpack." },
  { label: "Lunch", picture: "🥪", sentence: "It is time for lunch." },
  { label: "Break", picture: "🧘", sentence: "I need a break." },
  { label: "Bathroom", picture: "🚽", sentence: "I need the bathroom." },
];

const thingWords: Word[] = [
  { label: "Cup", picture: "🥤", sentence: "I need my cup." },
  { label: "Spoon", picture: "🥄", sentence: "I need a spoon." },
  { label: "Book", picture: "📖", sentence: "I want my book." },
  { label: "Ball", picture: "⚽", sentence: "I want the ball." },
  { label: "Car", picture: "🚗", sentence: "I want the car." },
  { label: "Blanket", picture: "🧶", sentence: "I want my blanket." },
  { label: "Shoes", picture: "👟", sentence: "I need my shoes." },
  { label: "Backpack", picture: "🎒", sentence: "I need my backpack." },
  { label: "Phone", picture: "📱", sentence: "I want the phone." },
  { label: "Toy", picture: "🧸", sentence: "I want my toy." },
];

export const talkerCategories: TalkerCategory[] = [
  { id: "people", label: "People", icon: "👨‍👩‍👧", hint: "Mom, Dad, family, helpers", color: "#fde8ef", words: peopleWords },
  { id: "food", label: "Food & Drink", icon: "🍎", hint: "Things I eat and drink", color: "#fff0da", words: foodWords },
  { id: "needs", label: "Needs", icon: "🙋", hint: "Help, more, yes, no", color: "#e7f3ff", words: simpleWords },
  { id: "actions", label: "Actions", icon: "▶️", hint: "Go, stop, play, eat", color: "#e9f8e4", words: actionWords },
  { id: "emotions", label: "Emotions", icon: "😊", hint: "How I feel", color: "#f3e9ff", words: emotionWords },
  { id: "places", label: "Places", icon: "📍", hint: "Home, school, park", color: "#e2f7f5", words: placeWords },
  { id: "school", label: "School", icon: "🎒", hint: "Classroom words", color: "#e8efff", words: schoolWords },
  { id: "things", label: "Things", icon: "🧸", hint: "Everyday objects", color: "#fff4c9", words: thingWords },
];


function uniqueByLabel(words: Word[]) {
  const seen = new Set<string>();
  return words.filter(word => {
    const key = word.label.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function learningGroup(selected: Word, currentPlace: Place | undefined, needs: TalkerWord[]) {
  const matchingPlace = currentPlace?.words.some(word => word.label.toLowerCase() === selected.label.toLowerCase())
    ? currentPlace
    : places.find(item => item.words.some(word => word.label.toLowerCase() === selected.label.toLowerCase()));

  const pool: Word[] = [
    selected,
    ...(matchingPlace?.words || []),
    ...needs,
    ...places.flatMap(item => item.words),
  ];

  return {
    place: matchingPlace,
    words: uniqueByLabel(pool),
  };
}

function rotateChoices(words: Word[], offset: number) {
  if (words.length < 2) return words;
  const amount = ((offset % words.length) + words.length) % words.length;
  return [...words.slice(amount), ...words.slice(0, amount)];
}

export default function EyeGazeTalker() {
  const [, navigate] = useLocation();
  const { token, user } = useAuth();
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [view, setView] = useState<"talk" | "learn">(() => {
    const openLearning = sessionStorage.getItem("eye-gaze-talker-open-learn") === "1";
    sessionStorage.removeItem("eye-gaze-talker-open-learn");
    return openLearning ? "learn" : "talk";
  });
  const [selected, setSelected] = useState<Word | null>(null);
  const [learningOpen, setLearningOpen] = useState(false);
  const [learningFeedback, setLearningFeedback] = useState("");
  const [learningRound, setLearningRound] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [dwell, setDwell] = useState(() => localStorage.getItem("eye-gaze-talker-dwell") !== "off");
  const [dwellMs, setDwellMs] = useState(() => Number(localStorage.getItem("eye-gaze-talker-time")) || 1800);
  const [voiceStatus, setVoiceStatus] = useState<"ai" | "device" | "checking">("checking");
  const [notice, setNotice] = useState("");
  const [familyConfig, setFamilyConfig] = useState<TalkerConfig>({ alwaysHere: null, pictures: {}, overrides: {}, recordings: {}, pageOrder: [], buttonOrder: {} });
  const [libraryMode, setLibraryMode] = useState<"places" | "categories" | "recent" | "all" | "simple">("categories");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [recentKeys, setRecentKeys] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("eye-gaze-talker-recent") || "[]").slice(0, 16); } catch { return []; }
  });
  const [grownupToken, setGrownupToken] = useState(() => sessionStorage.getItem("talker-grownup-token") || "");
  const [editOpen, setEditOpen] = useState(false);
  const [editWord, setEditWord] = useState<Word | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSentence, setEditSentence] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [challenge, setChallenge] = useState<{ challengeId: string; question: string } | null>(null);
  const [mathAnswer, setMathAnswer] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [recordingKind, setRecordingKind] = useState<"word" | "sentence" | null>(null);
  const [recordingDrafts, setRecordingDrafts] = useState<{ word?: string; sentence?: string }>({});
  const editDialog = useRef<HTMLDialogElement>(null);
  const gateDialog = useRef<HTMLDialogElement>(null);
  const parentRecorder = useRef<MediaRecorder | null>(null);
  const parentStream = useRef<MediaStream | null>(null);
  const wordDialog = useRef<HTMLDialogElement>(null);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellTarget = useRef<HTMLButtonElement | null>(null);
  const animalAudio = useRef<HTMLAudioElement | null>(null);
  const safeShowModal = (dialog: HTMLDialogElement | null) => {
    if (!dialog || dialog.open) return;
    try { dialog.showModal(); }
    catch {
      try { dialog.show(); } catch {}
    }
  };
  const place = places.find(item => item.id === placeId);
  const rawNeeds: TalkerWord[] = familyConfig.alwaysHere ?? defaultNeeds;
  const wordKey = (word: Word) => (word.baseLabel || word.label).trim().toLowerCase();
  const resolveWord = (word: Word): Word => {
    const baseLabel = word.baseLabel || word.label;
    const override = familyConfig.overrides?.[baseLabel.trim().toLowerCase()] || {};
    return { ...word, ...override, baseLabel };
  };
  const needs: TalkerWord[] = rawNeeds.map(word => resolveWord(word) as TalkerWord);
  const picture = (word: Word) => talkerPicture(resolveWord(word), familyConfig.pictures);
  const resolvedPlaces = places.map(item => ({ ...item, words: item.words.map(resolveWord) }));
  const currentPlace = resolvedPlaces.find(item => item.id === placeId);
  const orderedCategories = (() => {
    const configured = familyConfig.pageOrder?.length ? familyConfig.pageOrder : defaultTalkerPageOrder;
    const rank = new Map(configured.map((id, index) => [id, index]));
    return [...talkerCategories].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  })();
  const orderedCategoryWords = (category: TalkerCategory) => {
    const words = category.words.map(resolveWord);
    const configured = familyConfig.buttonOrder?.[category.id] || [];
    if (!configured.length) return words;
    const rank = new Map(configured.map((key, index) => [key, index]));
    return [...words].sort((a, b) => (rank.get(wordKey(a)) ?? 999) - (rank.get(wordKey(b)) ?? 999));
  };
  const allCategoryWords = orderedCategories.flatMap(category => orderedCategoryWords(category));
  const allLibraryWords = uniqueByLabel([...needs, ...allCategoryWords, ...resolvedPlaces.flatMap(item => item.words)]);
  const visibleSimpleWords = simpleWords.map(resolveWord);
  const activeCategoryData = orderedCategories.find(category => category.id === activeCategory) || null;
  const recentWords = recentKeys.map(key => allLibraryWords.find(word => wordKey(word) === key)).filter(Boolean) as Word[];

  useEffect(() => {
    let active = true;
    void talkerRequest<TalkerState>(token).then(state => {
      if (!active) return;
      setFamilyConfig({ alwaysHere: state.config?.alwaysHere ?? null, pictures: state.config?.pictures || {}, overrides: state.config?.overrides || {}, recordings: state.config?.recordings || {}, pageOrder: state.config?.pageOrder || [], buttonOrder: state.config?.buttonOrder || {} });
      const historyKeys = [...(state.progress?.history || [])].reverse().map(item => String(item.word || "").trim().toLowerCase()).filter(Boolean);
      setRecentKeys(previous => {
        const next = Array.from(new Set([...previous, ...historyKeys])).slice(0, 16);
        localStorage.setItem("eye-gaze-talker-recent", JSON.stringify(next));
        return next;
      });
    }).catch(() => { if (active) setNotice("Family pictures could not load. Try reopening the talker."); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (voiceStatus !== "ai") return;
    const lines = placeId
      ? resolvedPlaces.find(item => item.id === placeId)?.words.flatMap(word => [word.label, word.sentence]) || []
      : needs.flatMap(word => [word.label, word.sentence]);
    let cancelled = false;
    // Keep requests small and staggered so the first words are ready quickly.
    void (async () => {
      for (let i = 0; i < lines.length && !cancelled; i += 3) {
        await Promise.all(lines.slice(i, i + 3).map(line => preloadCharacterAI(line).catch(() => null)));
      }
    })();
    return () => { cancelled = true; };
  }, [placeId, voiceStatus, familyConfig.alwaysHere]);

  useEffect(() => {
    fetch("/api/eye-gaze/tts/status").then(r => r.json()).then(data => setVoiceStatus(data.configured ? "ai" : "device")).catch(() => setVoiceStatus("device"));
    return () => { stopSpeaking(); animalAudio.current?.pause(); };
  }, []);

  useEffect(() => {
    if (selected) {
      setLearningOpen(false);
      setLearningFeedback("");
      setLearningRound(0);
      safeShowModal(wordDialog.current);
    }
  }, [selected]);

  useEffect(() => {
    if (editOpen) safeShowModal(editDialog.current);
  }, [editOpen]);

  useEffect(() => {
    if (gateOpen) safeShowModal(gateDialog.current);
  }, [gateOpen]);

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
    if (!animalSounds[word]) return;
    animalAudio.current?.pause();
    const audio = new Audio(`/animal-sounds/${animalSounds[word]}.mp3`);
    animalAudio.current = audio;
    audio.volume = 0.38;
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

  const playFamilyRecording = (word: Word, kind: "word" | "sentence", fallback: () => void, onEnd?: () => void) => {
    const audioData = familyConfig.recordings?.[wordKey(word)]?.[kind];
    if (!audioData) { fallback(); return; }
    stopSpeaking();
    const audio = new Audio(audioData);
    audio.onended = () => onEnd?.();
    void audio.play().catch(fallback);
  };

  const sayWord = (word: Word, kind: "word" | "sentence" = "word", onEnd?: () => void) => {
    const resolved = resolveWord(word);
    const text = kind === "word" ? resolved.label : resolved.sentence;
    playFamilyRecording(resolved, kind, () => say(text, onEnd), onEnd);
  };

  const choose = (word: Word) => {
    const resolved = resolveWord(word);
    const key = wordKey(resolved);
    setRecentKeys(previous => {
      const next = [key, ...previous.filter(item => item !== key)].slice(0, 16);
      localStorage.setItem("eye-gaze-talker-recent", JSON.stringify(next));
      return next;
    });
    setSelected(resolved);
    if (voiceStatus === "ai") void preloadCharacterAI(resolved.sentence).catch(() => null);
    // A single tap speaks the button label once, then its full sentence once.
    // Animal sounds remain available as their own optional button in the word card.
    sayWord(resolved, "word", () => sayWord(resolved, "sentence"));
  };

  const recordLearning = (word: string, outcome: "correct" | "retry" | "practiced", prompt = 1) => {
    void talkerRequest(token, "/practice", "POST", { word, outcome, prompt }).catch(() => {});
  };

  const answerLearningQuestion = (choice: Word) => {
    if (!selected) return;
    const correct = choice.label.trim().toLowerCase() === selected.label.trim().toLowerCase();
    if (correct) {
      const feedback = `Yes! You found ${selected.label}! Great job!`;
      setLearningFeedback(feedback);
      recordLearning(selected.label, "correct", 1);
      say(feedback);
      window.setTimeout(() => {
        setLearningFeedback("");
        setLearningRound(round => round + 1);
      }, 1600);
    } else {
      const feedback = `Good try. Look again for ${selected.label}.`;
      setLearningFeedback(feedback);
      recordLearning(selected.label, "retry", 1);
      say(feedback);
    }
  };

  const closeWord = () => {
    wordDialog.current?.close();
    setSelected(null);
    setLearningOpen(false);
    setLearningFeedback("");
    setLearningRound(0);
  };
  const beginEdit = async (word: Word) => {
    const resolved = resolveWord(word);
    setEditWord(resolved);
    setEditLabel(resolved.label);
    setEditSentence(resolved.sentence);
    setRecordingDrafts({ ...(familyConfig.recordings?.[wordKey(resolved)] || {}) });
    setGateError("");
    if (user?.role === "parent" || grownupToken) {
      setEditOpen(true);
      return;
    }
    setGateLoading(true);
    setGateOpen(true);
    try {
      const result = await talkerRequest<{ challengeId: string; question: string }>(token, "/grownup-challenge");
      setChallenge(result);
      setMathAnswer("");
    } catch (error: any) {
      setGateError(error?.message || "Could not open the grown-up check.");
    } finally {
      setGateLoading(false);
    }
  };

  const submitTalkerGate = async () => {
    if (!challenge || !mathAnswer.trim()) return;
    setGateLoading(true);
    setGateError("");
    try {
      const result = await talkerRequest<{ grownupToken: string }>(token, "/grownup-challenge", "POST", {
        challengeId: challenge.challengeId,
        answer: Number(mathAnswer),
      });
      setGrownupToken(result.grownupToken);
      sessionStorage.setItem("talker-grownup-token", result.grownupToken);
      gateDialog.current?.close();
      setGateOpen(false);
      setChallenge(null);
      setMathAnswer("");
      setEditOpen(true);
      setNotice("Grown-up editing is unlocked for 30 minutes.");
    } catch (error: any) {
      setGateError(error?.message || "Not quite. Try a new question.");
      try {
        const next = await talkerRequest<{ challengeId: string; question: string }>(token, "/grownup-challenge");
        setChallenge(next);
        setMathAnswer("");
      } catch {}
    } finally {
      setGateLoading(false);
    }
  };

  const stopParentRecording = () => {
    if (parentRecorder.current?.state === "recording") parentRecorder.current.stop();
  };

  const startParentRecording = async (kind: "word" | "sentence") => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("Voice recording is unavailable in this browser.");
      return;
    }
    try {
      stopParentRecording();
      parentStream.current?.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      parentStream.current = stream;
      const supported = ["audio/webm", "audio/mp4", "audio/ogg"].find(type => MediaRecorder.isTypeSupported(type));
      if (!supported) throw new Error("This device does not support a Talker recording format.");
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: supported });
      parentRecorder.current = recorder;
      setRecordingKind(kind);
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        parentStream.current = null;
        setRecordingKind(null);
        const blob = new Blob(chunks, { type: supported });
        if (blob.size > 180_000) {
          setNotice("That recording was too long. Keep it short and try again.");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          setRecordingDrafts(previous => ({ ...previous, [kind]: String(reader.result || "") }));
          setNotice((kind === "word" ? "Word" : "Sentence") + " recording ready. Save the word to use it.");
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, kind === "word" ? 4500 : 8000);
    } catch (error: any) {
      setRecordingKind(null);
      setNotice(error?.message || "Could not start recording.");
    }
  };

  const previewRecording = (kind: "word" | "sentence") => {
    const data = recordingDrafts[kind];
    if (!data) return;
    stopSpeaking();
    const audio = new Audio(data);
    void audio.play();
  };

  const saveWordEdit = async () => {
    if (!editWord || !editLabel.trim() || !editSentence.trim()) return;
    const key = wordKey(editWord);
    const nextConfig: TalkerConfig = {
      alwaysHere: familyConfig.alwaysHere ?? defaultNeeds,
      pictures: familyConfig.pictures || {},
      overrides: {
        ...(familyConfig.overrides || {}),
        [key]: {
          label: editLabel.trim().slice(0, 40),
          sentence: editSentence.trim().slice(0, 180),
          picture: editWord.picture,
        },
      },
      recordings: {
        ...(familyConfig.recordings || {}),
        [key]: { ...recordingDrafts },
      },
      pageOrder: familyConfig.pageOrder || [],
      buttonOrder: familyConfig.buttonOrder || {},
    };
    try {
      const saved = await talkerRequest<{ config: TalkerConfig }>(
        token,
        "/config",
        "POST",
        nextConfig,
        grownupToken ? { "X-Talker-Grownup-Token": grownupToken } : {},
      );
      setFamilyConfig({
        alwaysHere: saved.config.alwaysHere ?? null,
        pictures: saved.config.pictures || {},
        overrides: saved.config.overrides || {},
        recordings: saved.config.recordings || {},
        pageOrder: saved.config.pageOrder || [],
        buttonOrder: saved.config.buttonOrder || {},
      });
      if (selected && wordKey(selected) === key) {
        setSelected({ ...selected, label: editLabel.trim(), sentence: editSentence.trim() });
      }
      editDialog.current?.close();
      setEditOpen(false);
      setNotice("Talker word updated.");
    } catch (error: any) {
      setNotice(error?.message || "Could not save this Talker word.");
    }
  };

  const closeEdit = () => {
    stopParentRecording();
    editDialog.current?.close();
    setEditOpen(false);
    setRecordingKind(null);
  };

  const renderWordTile = (word: Word, options: { compact?: boolean; color?: string } = {}) => {
    const resolved = resolveWord(word);
    const compact = !!options.compact;
    return (
      <div key={(resolved.baseLabel || resolved.label) + "-" + (options.color || "")} className="relative">
        <button
          data-talker-dwell
          type="button"
          onClick={() => choose(resolved)}
          aria-label={"Say " + resolved.label}
          style={options.color ? { backgroundColor: options.color } : undefined}
          className={`relative w-full ${compact ? "min-h-24 sm:min-h-32" : "min-h-36 sm:min-h-44"} rounded-3xl bg-white border-2 border-sky-100 hover:border-sky-500 px-2 py-3 flex flex-col items-center justify-center gap-2 shadow-sm`}
        >
          {picture(resolved)
            ? <img src={picture(resolved)!} alt="" className={compact ? "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover" : "w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover"} />
            : <span className={compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-7xl"} aria-hidden="true">{resolved.picture}</span>}
          <span className={compact ? "font-black text-base sm:text-lg leading-tight" : "text-xl sm:text-2xl font-black"}>{resolved.label}</span>
          <span className="text-[10px] font-black tracking-wider text-[#4c7788]">{compact ? "MORE →" : "KEEP LEARNING →"}</span>
        </button>
      </div>
    );
  };

  if (view === "learn") return (
    <div className="talker-page min-h-screen bg-[#f3f8fa] text-[#193d57] px-3 sm:px-6 pb-10">
      <style>{`.talker-page button:focus-visible { outline: 4px solid #255bd5; outline-offset: 3px; } .talker-page button.talker-dwelling { outline: 4px solid #255bd5; outline-offset: 3px; overflow: hidden; } .talker-page button.talker-dwelling::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: #2676e236; transform-origin: left; animation: talker-fill var(--talker-wait) linear forwards; } @keyframes talker-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
      <div className="max-w-[1100px] mx-auto pt-4">
        <div className="rounded-3xl bg-white border-2 border-teal-100 p-2 sm:p-3 flex flex-wrap items-center gap-2 mb-4">
          <button type="button" onClick={() => navigate("/eye-gaze-home")} className="min-h-12 rounded-2xl bg-slate-100 px-4 font-black">⌂ Home</button>
          <div className="flex-1 grid grid-cols-3 gap-2 min-w-[260px]" role="tablist" aria-label="Learning Zone">
            <button type="button" role="tab" aria-selected="false" onClick={() => { stopSpeaking(); setView("talk"); }} className="min-h-12 rounded-2xl bg-slate-100 font-black">🗣️ Talk</button>
            <button type="button" role="tab" aria-selected="true" className="min-h-12 rounded-2xl bg-teal-700 text-white font-black">📚 Learn</button>
            <button type="button" role="tab" aria-selected="false" onClick={() => navigate("/eye-gaze-parent")} className="min-h-12 rounded-2xl bg-amber-100 font-black">👨‍👩‍👧 Grown-up</button>
          </div>
        </div>
        <EyeGazeLearningZone say={say} onBack={() => { stopSpeaking(); setView("talk"); }} />
      </div>
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
        <header className="py-4 sm:py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 mr-auto"><span className="w-11 h-11 rounded-2xl bg-[#193d57] text-[#ffd766] grid place-items-center text-2xl" aria-hidden="true">✦</span><div><p className="text-xs font-black tracking-widest text-teal-700">A.R.I.S.E. READER</p><h1 className="font-black text-2xl sm:text-3xl tracking-tight">Learning Zone</h1></div></div>
            <button data-talker-dwell type="button" onClick={() => navigate("/eye-gaze-home")} className="relative min-h-12 px-4 rounded-2xl bg-white border-2 border-slate-200 font-black">⌂ Home</button>
            <button data-talker-dwell type="button" onClick={() => navigate(user?.role === "parent" ? "/parent-dashboard" : "/eye-gaze-account")} className="relative min-h-12 px-4 rounded-2xl bg-white border-2 border-slate-200 font-black">Profile</button>
          </div>
          <div className="mt-3 rounded-3xl bg-white border-2 border-teal-100 p-2 grid grid-cols-3 gap-2" role="tablist" aria-label="Learning Zone">
            <button type="button" role="tab" aria-selected="true" className="min-h-14 rounded-2xl bg-teal-700 text-white font-black">🗣️ Talk</button>
            <button type="button" role="tab" aria-selected="false" onClick={() => setView("learn")} className="min-h-14 rounded-2xl bg-slate-100 font-black">📚 Learn</button>
            <button type="button" role="tab" aria-selected="false" onClick={() => navigate("/eye-gaze-parent")} className="min-h-14 rounded-2xl bg-amber-100 font-black">👨‍👩‍👧 Grown-up</button>
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

        <section className="mt-7" aria-label="Talker library view">
          <div className="rounded-3xl bg-white border-2 border-sky-100 p-3 sm:p-4">
            <p className="text-xs font-black tracking-widest text-[#477586] mb-3">SHOW ME</p>
            <div className="flex sm:grid sm:grid-cols-5 gap-2 overflow-x-auto sm:overflow-visible pb-1">
              {([
                ["simple", "⚡", "Simple", "Just the basics"],
                ["categories", "🗂️", "Categories", "People, food, feelings…"],
                ["places", "📍", "Where we're going", "Words by place"],
                ["recent", "🕘", "Recent", "Buttons I just used"],
                ["all", "🧩", "All", "Whole library"],
              ] as const).map(([id, icon, label, hint]) => (
                <button
                  data-talker-dwell
                  key={id}
                  type="button"
                  onClick={() => {
                    setLibraryMode(id);
                    setPlaceId(null);
                    setLearningFeedback("");
                    if (id !== "categories") setActiveCategory(null);
                  }}
                  className={`relative min-w-[145px] sm:min-w-0 min-h-20 rounded-2xl border-2 p-3 text-left ${libraryMode === id ? "border-[#137f96] bg-[#ddf5f4]" : "border-slate-100 bg-white"}`}
                >
                  <span className="text-2xl mr-2">{icon}</span><strong className="font-black">{label}</strong>
                  <span className="block text-xs font-bold text-[#5c7c88] mt-1">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {libraryMode === "simple" && (
          <section className="mt-7" aria-label="Simplified Talker">
            <div className="mb-4"><p className="text-sm font-black tracking-widest text-[#477586]">SIMPLIFIED</p><h2 className="font-black text-3xl">Easy access</h2><p className="font-bold text-[#547886]">A smaller set of high-use buttons. Kids can switch views anytime.</p></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{visibleSimpleWords.map(word => renderWordTile(word))}</div>
          </section>
        )}

        {libraryMode === "categories" && (
          <section className="mt-7" aria-label="Talker categories">
            {!activeCategoryData ? (
              <>
                <div className="mb-4"><p className="text-sm font-black tracking-widest text-[#477586]">CATEGORIES</p><h2 className="font-black text-3xl">What do you want to say?</h2><p className="font-bold text-[#547886]">Pick a page. A grown-up can rearrange these pages and the buttons inside them.</p></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {orderedCategories.map(category => (
                    <button data-talker-dwell key={category.id} type="button" onClick={() => setActiveCategory(category.id)} style={{backgroundColor:category.color}} className="relative min-h-40 rounded-3xl border-2 border-white shadow-sm flex flex-col items-center justify-center p-4 text-center">
                      <span className="text-6xl" aria-hidden="true">{category.icon}</span>
                      <strong className="text-xl sm:text-2xl font-black mt-2">{category.label}</strong>
                      <small className="font-bold text-[#527483] mt-1">{category.hint}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                  <div><p className="text-sm font-black tracking-widest text-[#477586]">CATEGORY</p><h2 className="font-black text-3xl">{activeCategoryData.icon} {activeCategoryData.label}</h2><p className="font-bold text-[#547886]">{activeCategoryData.hint}</p></div>
                  <button data-talker-dwell type="button" onClick={() => setActiveCategory(null)} className="relative min-h-12 rounded-2xl bg-white border-2 border-sky-100 px-4 font-black">← Categories</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{orderedCategoryWords(activeCategoryData).map(word => renderWordTile(word, { color: activeCategoryData.color }))}</div>
              </>
            )}
          </section>
        )}

        {libraryMode === "recent" && (
          <section className="mt-7" aria-label="Recent Talker buttons">
            <div className="mb-4"><p className="text-sm font-black tracking-widest text-[#477586]">RECENT</p><h2 className="font-black text-3xl">Just used</h2><p className="font-bold text-[#547886]">The buttons used most recently on this device appear here automatically.</p></div>
            {recentWords.length ? <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{recentWords.map(word => renderWordTile(word))}</div> : <div className="rounded-3xl bg-white border-2 border-sky-100 p-8 text-center font-bold text-slate-500">Use a few Talker buttons and they will show up here.</div>}
          </section>
        )}

        {libraryMode === "all" && (
          <section className="mt-7" aria-label="All Talker words">
            <div className="mb-4"><p className="text-sm font-black tracking-widest text-[#477586]">ALL BUTTONS</p><h2 className="font-black text-3xl">Whole Talker library</h2></div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{allLibraryWords.map(word => renderWordTile(word))}</div>
          </section>
        )}

        {libraryMode === "places" && (
          <>
            <section aria-label="Everyday words" className="mt-7">
              <p className="text-sm font-black tracking-widest text-[#477586] mb-3">ALWAYS HERE</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">{needs.map(word => renderWordTile(word, { compact: true }))}</div>
            </section>

            <section className="mt-9" aria-labelledby="talker-place-title">
              <div className="flex flex-wrap justify-between items-end gap-3 mb-5">
                <div>
                  <p className="text-sm font-black tracking-widest text-[#477586]">{currentPlace ? "MY PLACES / " + currentPlace.label.toUpperCase() : "WHERE WE'RE GOING"}</p>
                  <h2 id="talker-place-title" className="font-black text-3xl sm:text-4xl tracking-tight">{currentPlace ? currentPlace.label : "Choose a place"}</h2>
                  <p className="text-[#547886] font-bold">{currentPlace ? "Choose a picture to hear a word." : "Tap where you are going to show just those words."}</p>
                </div>
                {currentPlace && <button data-talker-dwell type="button" onClick={() => setPlaceId(null)} className="relative min-h-14 rounded-2xl bg-white border-2 border-sky-100 px-5 font-black">← All places</button>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {currentPlace
                  ? currentPlace.words.map(word => renderWordTile(word, { color: currentPlace.color }))
                  : resolvedPlaces.map(item => (
                    <button data-talker-dwell key={item.id} type="button" onClick={() => setPlaceId(item.id)} style={{ backgroundColor: item.color }} className="relative min-h-40 rounded-3xl border-2 border-transparent hover:border-sky-500 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 p-3 shadow-sm">
                      <span className="text-6xl sm:text-7xl" aria-hidden="true">{item.picture}</span>
                      <span className="text-center sm:text-left"><strong className="block text-xl sm:text-2xl font-black">{item.label}</strong><small className="font-bold text-[#527483]">{item.hint}</small></span>
                    </button>
                  ))}
              </div>
            </section>
          </>
        )}
        <p className="text-center text-sm text-[#5c7c88] font-bold mt-8">Voice is AI-generated when available. Your device voice is the backup.</p>
        <p className="text-center mt-2"><a className="font-bold text-[#246779] underline" href="/animal-sounds/credits.html" target="_blank" rel="noopener noreferrer">Animal sound credits</a></p>
        {notice && <p role="status" className="text-center font-black text-[#315772] mt-2">{notice}</p>}
      </div>

      <dialog ref={wordDialog} onClose={() => { setSelected(null); setLearningOpen(false); setLearningFeedback(""); }} aria-labelledby="talker-selected-word" className="rounded-[2rem] p-4 sm:p-6 w-[min(96vw,760px)] max-h-[94vh] overflow-y-auto text-center text-[#193d57] backdrop:bg-[#0b293bc2]">
        {selected && (() => {
          const group = learningGroup(selected, place, needs);
          const related = group.words.filter(word => word.label.toLowerCase() !== selected.label.toLowerCase()).slice(0, 4);
          const quizBase = uniqueByLabel([selected, ...related]).slice(0, 3);
          const quizChoices = rotateChoices(quizBase, selected.label.length + learningRound);
          const where = group.place?.label || "your day";

          return (
            <>
              <div className="flex justify-between items-center gap-2">
                <button type="button" onClick={() => void beginEdit(selected)} className="min-h-11 rounded-2xl bg-amber-100 border-2 border-amber-300 px-4 font-black">✏️ Grown-up edit</button>
                <button data-talker-dwell type="button" onClick={closeWord} aria-label="Close word card" className="relative w-14 h-14 rounded-full bg-[#eef4f6] text-3xl font-black">×</button>
              </div>

              <div className={learningOpen ? "grid lg:grid-cols-[260px_1fr] gap-5 items-start text-left" : ""}>
                <div className={learningOpen ? "lg:sticky lg:top-0" : ""}>
                  <div className="h-44 sm:h-52 rounded-3xl bg-[#e0f3f0] grid place-items-center text-[7rem]" role="img" aria-label={`Picture for ${selected.label}`}>
                    {picture(selected) ? <img src={picture(selected)!} alt="" className="w-full h-full rounded-3xl object-contain" /> : selected.picture}
                  </div>
                  <h2 id="talker-selected-word" className="text-4xl font-black mt-3 text-center">{selected.label}</h2>
                  <p className="text-lg font-bold text-[#3f687a] my-3 text-center">{selected.sentence}</p>

                  <div className="grid grid-cols-2 gap-2">
                    <button data-talker-dwell type="button" onClick={() => { sayWord(selected, "word"); recordLearning(selected.label, "practiced"); }} className="relative min-h-16 rounded-2xl bg-[#e6f2f4] font-black">🔊 Say word</button>
                    <button data-talker-dwell type="button" onClick={() => { sayWord(selected, "sentence"); recordLearning(selected.label, "practiced"); }} className="relative min-h-16 rounded-2xl bg-[#137f96] text-white font-black">▶ Say sentence</button>
                  </div>

                  {animalSounds[selected.label] && (
                    <button data-talker-dwell type="button" onClick={() => { stopSpeaking(); playAnimal(selected.label); }} className="relative min-h-16 rounded-2xl w-full bg-[#e0f3e7] mt-3 font-black text-lg">🐾 Hear animal sound</button>
                  )}

                  <button data-talker-dwell type="button" onClick={() => { setWords(previous => [...previous, selected.label]); closeWord(); }} className="relative min-h-14 mt-2 px-4 w-full text-[#246779] font-black underline">+ Add to my words</button>

                  <button
                    data-talker-dwell
                    type="button"
                    onClick={() => {
                      setLearningOpen(open => !open);
                      setLearningFeedback("");
                      if (!learningOpen) {
                        say(`Let's keep learning about ${selected.label}. Find ${selected.label} in the pictures.`);
                        recordLearning(selected.label, "practiced");
                      }
                    }}
                    className={`relative w-full min-h-16 rounded-2xl mt-3 px-4 font-black text-lg ${learningOpen ? "bg-[#315772] text-white" : "bg-[#ffd766] text-[#193d57]"}`}
                  >
                    {learningOpen ? "← Back to word" : "✨ Keep Learning / More →"}
                  </button>
                </div>

                {learningOpen && (
                  <div className="space-y-4">
                    <section className="rounded-3xl bg-[#fff8d9] border-2 border-[#f2d876] p-4 sm:p-5">
                      <p className="text-xs font-black tracking-widest text-[#8a6c0b]">LOOK • LISTEN • FIND</p>
                      <h3 className="text-2xl sm:text-3xl font-black mt-1">Can you find {selected.label}?</h3>
                      <p className="font-bold text-[#5d6f77] mt-1">Look at the pictures. Choose {selected.label}.</p>
                      <button data-talker-dwell type="button" onClick={() => say(`Can you find ${selected.label}? Choose ${selected.label}.`)} className="relative mt-3 min-h-12 rounded-2xl bg-white border-2 border-amber-200 px-4 font-black">🔊 Hear the question</button>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
                        {quizChoices.map(choice => (
                          <button
                            data-talker-dwell
                            key={`quiz-${choice.label}`}
                            type="button"
                            onClick={() => answerLearningQuestion(choice)}
                            aria-label={`Choose ${choice.label}`}
                            className="relative min-h-32 sm:min-h-40 rounded-2xl bg-white border-2 border-amber-100 hover:border-blue-500 flex flex-col items-center justify-center gap-2 p-2"
                          >
                            {picture(choice) ? <img src={picture(choice)!} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover" /> : <span className="text-5xl sm:text-6xl" aria-hidden="true">{choice.picture}</span>}
                            <span className="font-black text-sm sm:text-lg leading-tight">{choice.label}</span>
                          </button>
                        ))}
                      </div>

                      {learningFeedback && (
                        <div role="status" className={`mt-4 rounded-2xl px-4 py-3 text-center font-black ${learningFeedback.startsWith("Yes") ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                          {learningFeedback}
                        </div>
                      )}
                    </section>

                    <section className="rounded-3xl bg-[#eaf5ff] border-2 border-sky-200 p-4 sm:p-5">
                      <p className="text-xs font-black tracking-widest text-[#246779]">SEE MORE</p>
                      <h3 className="text-2xl font-black mt-1">More pictures & words</h3>
                      <p className="font-bold text-[#5d6f77]">These words go with {selected.label} in {where}.</p>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-4">
                        {related.map(word => (
                          <button
                            data-talker-dwell
                            key={`related-${word.label}`}
                            type="button"
                            onClick={() => {
                              setLearningOpen(false);
                              setLearningFeedback("");
                              choose(word);
                            }}
                            className="relative min-h-28 rounded-2xl bg-white border-2 border-sky-100 hover:border-sky-500 flex items-center gap-3 p-3 text-left"
                          >
                            {picture(word) ? <img src={picture(word)!} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" /> : <span className="text-4xl flex-shrink-0" aria-hidden="true">{word.picture}</span>}
                            <span>
                              <strong className="block text-lg font-black">{word.label}</strong>
                              <small className="font-bold text-[#55717e]">Tap to learn this word</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-3xl bg-[#eef7e8] border-2 border-emerald-200 p-4 sm:p-5">
                      <p className="text-xs font-black tracking-widest text-emerald-700">USE THE WORD</p>
                      <h3 className="text-2xl font-black mt-1">Say it in a sentence</h3>
                      <div className="mt-3 rounded-2xl bg-white border-2 border-emerald-100 p-4 text-xl font-black">{selected.sentence}</div>
                      <div className="grid sm:grid-cols-2 gap-2 mt-3">
                        <button data-talker-dwell type="button" onClick={() => { sayWord(selected, "sentence"); recordLearning(selected.label, "practiced"); }} className="relative min-h-14 rounded-2xl bg-emerald-600 text-white font-black">▶ Hear sentence</button>
                        <button data-talker-dwell type="button" onClick={() => { setWords(previous => [...previous, selected.label]); say(`You added ${selected.label} to your words.`); }} className="relative min-h-14 rounded-2xl bg-white border-2 border-emerald-200 font-black">+ Use in My Words</button>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </dialog>

      <dialog ref={gateDialog} onClose={() => setGateOpen(false)} aria-labelledby="talker-gate-title" className="rounded-[2rem] p-6 w-[min(92vw,480px)] text-[#193d57] backdrop:bg-[#0b293bc2]">
        <div className="text-center">
          <div className="text-6xl" aria-hidden="true">🧑‍🧒</div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-700 mt-3">Grown-up check</p>
          <h2 id="talker-gate-title" className="text-3xl font-black mt-1">Quick edit unlock</h2>
          <p className="font-bold text-[#547886] mt-2">Answer one simple math question. No parent account is required.</p>
          <div className="mt-5 rounded-3xl bg-amber-50 border-2 border-amber-200 p-5">
            <div className="text-5xl font-black">{challenge?.question || (gateLoading ? "Loading…" : "Try again")}</div>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={mathAnswer}
              onChange={event => setMathAnswer(event.target.value.replace(/[^0-9-]/g, "").slice(0, 3))}
              onKeyDown={event => { if (event.key === "Enter") void submitTalkerGate(); }}
              placeholder="Answer"
              aria-label="Math answer"
              className="mt-4 w-full min-h-16 rounded-2xl border-2 border-amber-200 px-4 text-center text-3xl font-black"
            />
          </div>
          {gateError && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-3 font-bold text-rose-700">{gateError}</p>}
          <button type="button" disabled={gateLoading || !challenge || !mathAnswer.trim()} onClick={() => void submitTalkerGate()} className="mt-4 w-full min-h-14 rounded-2xl bg-amber-500 text-slate-950 font-black disabled:opacity-50">{gateLoading ? "Checking…" : "Unlock editing"}</button>
          <button type="button" onClick={() => { gateDialog.current?.close(); setGateOpen(false); }} className="mt-2 w-full min-h-12 rounded-2xl bg-slate-100 font-black">Cancel</button>
        </div>
      </dialog>

      <dialog ref={editDialog} onClose={() => setEditOpen(false)} aria-labelledby="talker-edit-title" className="rounded-[2rem] p-5 sm:p-6 w-[min(94vw,620px)] max-h-[92vh] overflow-y-auto text-[#193d57] backdrop:bg-[#0b293bc2]">
        {editWord && (
          <>
            <div className="flex justify-between items-center gap-3">
              <div><p className="text-xs font-black uppercase tracking-widest text-amber-700">Grown-up quick edit</p><h2 id="talker-edit-title" className="text-3xl font-black">Edit this Talker button</h2></div>
              <button type="button" onClick={closeEdit} className="w-12 h-12 rounded-full bg-[#eef4f6] text-2xl font-black">×</button>
            </div>

            <div className="grid gap-4 mt-5">
              <label className="font-black">Word / button label
                <input value={editLabel} maxLength={40} onChange={event => setEditLabel(event.target.value)} className="mt-2 w-full min-h-14 rounded-2xl border-2 border-sky-100 px-4 text-lg font-black" />
              </label>
              <label className="font-black">Sentence
                <textarea value={editSentence} maxLength={180} rows={3} onChange={event => setEditSentence(event.target.value)} className="mt-2 w-full rounded-2xl border-2 border-sky-100 p-4 text-lg font-bold resize-none" />
              </label>
            </div>

            <section className="mt-5 rounded-3xl bg-violet-50 border-2 border-violet-100 p-4">
              <h3 className="text-xl font-black">🎙️ Family voice for the word</h3>
              <p className="text-sm font-bold text-[#547886] mt-1">Record yourself saying just the word. This replaces the AI voice for this word only.</p>
              <div className="grid sm:grid-cols-3 gap-2 mt-3">
                <button type="button" onClick={() => recordingKind === "word" ? stopParentRecording() : void startParentRecording("word")} className={"min-h-12 rounded-2xl font-black " + (recordingKind === "word" ? "bg-rose-500 text-white" : "bg-violet-600 text-white")}>{recordingKind === "word" ? "■ Stop" : "● Record word"}</button>
                <button type="button" disabled={!recordingDrafts.word} onClick={() => previewRecording("word")} className="min-h-12 rounded-2xl bg-white border-2 border-violet-100 font-black disabled:opacity-40">▶ Preview</button>
                <button type="button" onClick={() => setRecordingDrafts(previous => ({ ...previous, word: undefined }))} className="min-h-12 rounded-2xl bg-white border-2 border-violet-100 font-black">✨ Use AI voice</button>
              </div>
              <p className="text-xs font-bold text-violet-700 mt-2">{recordingDrafts.word ? "Family recording selected." : "AI voice selected."}</p>
            </section>

            <section className="mt-4 rounded-3xl bg-teal-50 border-2 border-teal-100 p-4">
              <h3 className="text-xl font-black">🎙️ Family voice for the sentence</h3>
              <p className="text-sm font-bold text-[#547886] mt-1">You can separately record the full sentence. Otherwise the sentence keeps using AI.</p>
              <div className="grid sm:grid-cols-3 gap-2 mt-3">
                <button type="button" onClick={() => recordingKind === "sentence" ? stopParentRecording() : void startParentRecording("sentence")} className={"min-h-12 rounded-2xl font-black " + (recordingKind === "sentence" ? "bg-rose-500 text-white" : "bg-teal-600 text-white")}>{recordingKind === "sentence" ? "■ Stop" : "● Record sentence"}</button>
                <button type="button" disabled={!recordingDrafts.sentence} onClick={() => previewRecording("sentence")} className="min-h-12 rounded-2xl bg-white border-2 border-teal-100 font-black disabled:opacity-40">▶ Preview</button>
                <button type="button" onClick={() => setRecordingDrafts(previous => ({ ...previous, sentence: undefined }))} className="min-h-12 rounded-2xl bg-white border-2 border-teal-100 font-black">✨ Use AI voice</button>
              </div>
              <p className="text-xs font-bold text-teal-700 mt-2">{recordingDrafts.sentence ? "Family recording selected." : "AI voice selected."}</p>
            </section>

            <div className="grid sm:grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={closeEdit} className="min-h-14 rounded-2xl bg-slate-100 font-black">Cancel</button>
              <button type="button" disabled={!editLabel.trim() || !editSentence.trim() || !!recordingKind} onClick={() => void saveWordEdit()} className="min-h-14 rounded-2xl bg-[#137f96] text-white font-black disabled:opacity-50">Save this word</button>
            </div>
            <p className="text-xs font-bold text-[#547886] mt-3">Voice recordings stay in this student's private Talker settings. Tap “Use AI voice” at any time to remove the family recording for that part.</p>
          </>
        )}
      </dialog>

    </div>
  );
}
