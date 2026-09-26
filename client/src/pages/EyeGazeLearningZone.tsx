import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { preloadCharacterAI } from "@/lib/tts";

type Picture = { icon: string; caption: string };
type Lesson = { word: string; icon: string; first: string; sounds: string; syllables: string; pictures: Picture[]; phrases: string[]; choices: string[] };

const lessons: Lesson[] = [
  { word: "Milk", icon: "🥛", first: "mmm", sounds: "m · i · l · k", syllables: "milk", pictures: [{ icon: "🥛", caption: "A glass of milk" }, { icon: "🐄🥛", caption: "Milk from a cow" }, { icon: "🧊🥛", caption: "Cold milk" }], phrases: ["I want milk.", "The milk is cold.", "Please pour the milk."], choices: ["Milk", "Water", "Apple"] },
  { word: "Apple", icon: "🍎", first: "aah", sounds: "a · pp · le", syllables: "ap · ple", pictures: [{ icon: "🍎", caption: "A red apple" }, { icon: "🍏", caption: "A green apple" }, { icon: "🌳🍎", caption: "An apple on a tree" }], phrases: ["I want an apple.", "The apple is red.", "I can eat an apple."], choices: ["Banana", "Apple", "Milk"] },
  { word: "Lion", icon: "🦁", first: "lll", sounds: "l · i · o · n", syllables: "li · on", pictures: [{ icon: "🦁", caption: "A lion" }, { icon: "🦁🌿", caption: "A lion in the grass" }, { icon: "🦁👶", caption: "A lion and cub" }], phrases: ["I see a lion.", "The lion is big.", "The lion can roar."], choices: ["Lion", "Monkey", "Elephant"] },
  { word: "Water", icon: "💧", first: "wuh", sounds: "w · a · t · er", syllables: "wa · ter", pictures: [{ icon: "💧", caption: "A drop of water" }, { icon: "🚰💧", caption: "Water from a tap" }, { icon: "🥤💧", caption: "A cup of water" }], phrases: ["I want water.", "I drink water.", "The water is cold."], choices: ["Milk", "Water", "Apple"] },
  { word: "Banana", icon: "🍌", first: "buh", sounds: "b · a · n · a · n · a", syllables: "ba · na · na", pictures: [{ icon: "🍌", caption: "A banana" }, { icon: "🍌🍌", caption: "Two bananas" }, { icon: "🐒🍌", caption: "A monkey and banana" }], phrases: ["I want a banana.", "The banana is yellow.", "I can peel a banana."], choices: ["Banana", "Apple", "Cup"] },
  { word: "Cup", icon: "🥤", first: "kuh", sounds: "c · u · p", syllables: "cup", pictures: [{ icon: "🥤", caption: "A cup" }, { icon: "☕", caption: "Another cup" }, { icon: "🥤💧", caption: "Water in a cup" }], phrases: ["This is my cup.", "I want my cup.", "Pour water in the cup."], choices: ["Spoon", "Cup", "Book"] },
  { word: "Ball", icon: "⚽", first: "buh", sounds: "b · a · ll", syllables: "ball", pictures: [{ icon: "⚽", caption: "A soccer ball" }, { icon: "🏀", caption: "A basketball" }, { icon: "🎾", caption: "A tennis ball" }], phrases: ["I want the ball.", "The ball can roll.", "Throw me the ball."], choices: ["Ball", "Car", "Book"] },
  { word: "Car", icon: "🚗", first: "kuh", sounds: "c · ar", syllables: "car", pictures: [{ icon: "🚗", caption: "A red car" }, { icon: "🚙", caption: "A blue car" }, { icon: "🚕", caption: "A yellow car" }], phrases: ["I want the car.", "The car can go.", "I see a car."], choices: ["Ball", "Car", "Book"] },
  { word: "Book", icon: "📖", first: "buh", sounds: "b · oo · k", syllables: "book", pictures: [{ icon: "📖", caption: "An open book" }, { icon: "📚", caption: "Many books" }, { icon: "🧒📖", caption: "Reading a book" }], phrases: ["Read a book with me.", "I like this book.", "Open the book."], choices: ["Book", "Ball", "Cup"] },
  { word: "Elephant", icon: "🐘", first: "eh", sounds: "e · l · e · ph · a · n · t", syllables: "el · e · phant", pictures: [{ icon: "🐘", caption: "An elephant" }, { icon: "🐘💦", caption: "An elephant splashing" }, { icon: "🐘🌿", caption: "An elephant outside" }], phrases: ["I see an elephant.", "The elephant is big.", "The elephant has a trunk."], choices: ["Giraffe", "Elephant", "Lion"] },
  { word: "Giraffe", icon: "🦒", first: "juh", sounds: "g · i · r · a · ff · e", syllables: "gi · raffe", pictures: [{ icon: "🦒", caption: "A giraffe" }, { icon: "🦒🌳", caption: "A giraffe by a tree" }, { icon: "🦒🍃", caption: "A giraffe eating leaves" }], phrases: ["I see a giraffe.", "The giraffe is tall.", "The giraffe has a long neck."], choices: ["Giraffe", "Lion", "Monkey"] },
  { word: "Monkey", icon: "🐒", first: "mmm", sounds: "m · o · n · k · ey", syllables: "mon · key", pictures: [{ icon: "🐒", caption: "A monkey" }, { icon: "🐒🌳", caption: "A monkey in a tree" }, { icon: "🐒🍌", caption: "A monkey with food" }], phrases: ["I see a monkey.", "The monkey can climb.", "The monkey is in the tree."], choices: ["Lion", "Monkey", "Penguin"] },
  { word: "Penguin", icon: "🐧", first: "puh", sounds: "p · e · n · g · u · i · n", syllables: "pen · guin", pictures: [{ icon: "🐧", caption: "A penguin" }, { icon: "🐧❄️", caption: "A penguin on ice" }, { icon: "🐧🐧", caption: "Two penguins" }], phrases: ["I see a penguin.", "The penguin can swim.", "The penguin walks on ice."], choices: ["Tiger", "Penguin", "Elephant"] },
  { word: "Tiger", icon: "🐯", first: "tuh", sounds: "t · i · g · er", syllables: "ti · ger", pictures: [{ icon: "🐯", caption: "A tiger" }, { icon: "🐯🌿", caption: "A tiger in the grass" }, { icon: "🐯🐾", caption: "A tiger and its paws" }], phrases: ["I see a tiger.", "The tiger has stripes.", "The tiger can growl."], choices: ["Lion", "Tiger", "Monkey"] },
  { word: "Sun", icon: "☀️", first: "sss", sounds: "s · u · n", syllables: "sun", pictures: [{ icon: "☀️", caption: "The sun" }, { icon: "🌅", caption: "The sun coming up" }, { icon: "🌞", caption: "A bright sun" }], phrases: ["I see the sun.", "The sun is bright.", "It is sunny outside."], choices: ["Tree", "Sun", "Rain"] },
  { word: "Tree", icon: "🌳", first: "tuh", sounds: "t · r · ee", syllables: "tree", pictures: [{ icon: "🌳", caption: "A green tree" }, { icon: "🌲", caption: "A tall tree" }, { icon: "🌴", caption: "A palm tree" }], phrases: ["I see a tree.", "The tree has leaves.", "The tree is tall."], choices: ["Tree", "Sun", "Park"] },
  { word: "Help", icon: "🤝", first: "huh", sounds: "h · e · l · p", syllables: "help", pictures: [{ icon: "🤝", caption: "Helping hands" }, { icon: "🙋", caption: "Asking for help" }, { icon: "🧑‍🤝‍🧑", caption: "Helping a friend" }], phrases: ["I need help.", "Help me, please.", "Can you help me?"], choices: ["Help", "Stop", "More"] },
  { word: "Stop", icon: "✋", first: "sss", sounds: "s · t · o · p", syllables: "stop", pictures: [{ icon: "✋", caption: "A hand saying stop" }, { icon: "🛑", caption: "A stop sign" }, { icon: "🚫", caption: "Time to stop" }], phrases: ["Please stop.", "I want to stop.", "Stop, please."], choices: ["More", "Help", "Stop"] },
];

type Props = { say: (text: string, onEnd?: () => void) => void; onBack: () => void };

export default function EyeGazeLearningZone({ say, onBack }: Props) {
  const { token } = useAuth();
  const [word, setWord] = useState(() => localStorage.getItem("eye-gaze-learning-word") || "Milk");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [heard, setHeard] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const practiceId = useRef(0);
  const alive = useRef(true);
  const practiceActive = useRef(false);
  const lesson = lessons.find(item => item.word === word) || lessons[0];

  useEffect(() => {
    localStorage.setItem("eye-gaze-learning-word", lesson.word);
    practiceActive.current = false;
    practiceId.current++;
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    void audioContext.current?.close();
    setBusy(false); setAnswer(null); setFeedback(""); setHeard("");
    const lines = [lesson.word, `Can you say ${lesson.word}?`, `I heard ${lesson.word}!`,
      `Let's try ${lesson.word}. Start with ${lesson.first}. ${lesson.word}.`,
      ...lesson.phrases, ...lesson.pictures.map(picture => picture.caption),
      `${lesson.word} begins with the sound ${lesson.first}. Listen: ${lesson.word}.`,
      `${lesson.syllables.replaceAll(" · ", ". ")}. ${lesson.word}.`];
    let cancelled = false;
    void (async () => {
      for (let i = 0; i < lines.length && !cancelled; i += 3) {
        await Promise.all(lines.slice(i, i + 3).map(line => preloadCharacterAI(line).catch(() => null)));
      }
    })();
    return () => { cancelled = true; };
  }, [lesson.word]);
  useEffect(() => () => {
    alive.current = false;
    practiceActive.current = false;
    practiceId.current++;
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    void audioContext.current?.close();
  }, []);

  const startListening = (media: MediaStream, type: string, id: number, practiced: Lesson) => {
    if (!alive.current || id !== practiceId.current || !practiceActive.current) { media.getTracks().forEach(track => track.stop()); return; }
    try {
      const chunks: BlobPart[] = [];
      let heardVoice = false;
      const active = new MediaRecorder(media, { mimeType: type });
      recorder.current = active;
      active.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      active.onstop = async () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        void audioContext.current?.close();
        audioContext.current = null;
        media.getTracks().forEach(track => track.stop());
        stream.current = null;
        if (!alive.current || id !== practiceId.current || !practiceActive.current) return;
        if (!heardVoice) { setBusy(false); setFeedback("I didn't catch a voice. Try again when you're ready."); return; }
        const audio = new Blob(chunks, { type });
        if (audio.size < 500) { setBusy(false); setFeedback("I couldn't hear that time. Try again when you're ready."); return; }
        setFeedback("Checking what I heard…");
        try {
          const response = await fetch(`${API_BASE}/api/eye-gaze/listen`, { method: "POST", headers: { "Content-Type": type, Authorization: `Bearer ${token}` }, body: audio, cache: "no-store" });
          const result = await response.json();
          if (!alive.current || id !== practiceId.current) return;
          if (!response.ok) throw new Error(result.message || "I couldn't listen that time.");
          const transcript = String(result.heard || "").trim();
          setHeard(transcript);
          if (!transcript) { setFeedback("I couldn't hear a word. Let's listen and try again."); setBusy(false); return; }
          const matched = transcript.toLowerCase().split(/[^a-z]+/).includes(practiced.word.toLowerCase());
          const message = matched ? `I heard ${practiced.word}! Let's say it together.` : `I heard “${transcript}.” Listen to ${practiced.word}. Start with ${practiced.first}, then try again.`;
          setFeedback(message);
          setBusy(false);
          say(matched ? `I heard ${practiced.word}!` : `Let's try ${practiced.word}. Start with ${practiced.first}. ${practiced.word}.`);
        } catch (error: any) { if (id === practiceId.current) { setBusy(false); setFeedback(error?.message || "I couldn't listen that time. Try again."); } }
      };
      active.start();
      setFeedback("I'm listening. Say the word now.");

      // Stop as soon as speech ends; a generous timeout also helps quieter kids.
      const context = audioContext.current || new AudioContext();
      audioContext.current = context;
      void context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const source = context.createMediaStreamSource(media);
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const started = performance.now();
      let speakingSince = 0;
      let lastVoiceAt = 0;
      let noiseFloor = 0.004;
      const poll = () => {
        if (active.state !== "recording" || id !== practiceId.current) return;
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) energy += samples[sampleIndex] * samples[sampleIndex];
        const rms = Math.sqrt(energy / samples.length);
        const now = performance.now();
        if (now - started < 250) noiseFloor = Math.max(noiseFloor, rms);
        const voice = rms > Math.max(0.009, noiseFloor * 2.2);
        if (voice) {
          if (!speakingSince) speakingSince = now;
          if (now - speakingSince > 140) heardVoice = true;
          lastVoiceAt = now;
        } else speakingSince = 0;
        if ((heardVoice && now - lastVoiceAt > 700 && now - started > 800) || now - started > 6500) {
          active.stop();
        } else timer.current = setTimeout(poll, 60);
      };
      timer.current = setTimeout(poll, 60);
    } catch { if (recorder.current?.state === "recording") recorder.current.stop(); media.getTracks().forEach(track => track.stop()); setFeedback("The microphone couldn't start. You can still listen and use pictures."); setBusy(false); }
  };

  const ask = async () => {
    if (busy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setFeedback("This browser cannot use the microphone here. You can still listen and use pictures."); return; }
    const type = ["audio/webm", "audio/mp4", "audio/ogg"].find(candidate => MediaRecorder.isTypeSupported(candidate));
    if (!type) { setFeedback("This microphone format isn't supported. You can still listen and use pictures."); return; }
    const id = ++practiceId.current;
    setBusy(true);
    setFeedback(""); setHeard("");
    practiceActive.current = true;
    try {
      audioContext.current = new AudioContext();
      void audioContext.current.resume();
      // Request permission on the initial tap, before the AI speaks. Only
      // record after the prompt ends, so its own voice cannot be transcribed.
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || id !== practiceId.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      setFeedback(`Listen, then say ${lesson.word}. The microphone starts by itself.`);
      say(`Can you say ${lesson.word}?`, () => startListening(media, type, id, lesson));
    } catch { if (id === practiceId.current) { void audioContext.current?.close(); audioContext.current = null; setBusy(false); setFeedback("Microphone permission wasn't available. You can still listen and use pictures."); } }
  };

  return (
    <div className="max-w-[1450px] mx-auto space-y-5 pb-8">
      <header className="flex flex-wrap gap-3 items-center justify-between py-3"><div><p className="text-sm tracking-widest font-black text-teal-700">LEARNING ZONE</p><h2 className="text-3xl sm:text-4xl font-black">Let's learn a word!</h2></div><button data-talker-dwell type="button" onClick={() => { practiceActive.current = false; onBack(); }} className="relative min-h-14 rounded-2xl bg-white border-2 border-sky-100 px-5 font-black">← Back to talker</button></header>

      <section className="bg-white rounded-3xl p-4 sm:p-6 border-2 border-teal-100"><p className="font-black text-[#477586] mb-3">TRY THESE WORDS</p><div className="grid grid-cols-3 gap-2 sm:gap-3">{lessons.slice(0, 3).map(item => <button data-talker-dwell type="button" key={item.word} onClick={() => setWord(item.word)} className={`relative rounded-3xl min-h-28 border-4 flex flex-col items-center justify-center font-black text-lg ${lesson.word === item.word ? "border-teal-500 bg-teal-50" : "border-slate-100"}`}><span className="text-5xl" aria-hidden="true">{item.icon}</span>{item.word}</button>)}</div><label htmlFor="choose-learning-word" className="block font-black mt-5 mb-2">Grown-up: choose another word</label><select id="choose-learning-word" value={lesson.word} onChange={event => setWord(event.target.value)} className="w-full sm:w-72 min-h-14 bg-white border-2 border-teal-200 rounded-2xl px-4 font-bold">{lessons.map(item => <option key={item.word} value={item.word}>{item.word}</option>)}</select></section>

      <section className="rounded-3xl bg-gradient-to-r from-teal-100 to-sky-100 p-5 sm:p-8 flex flex-col sm:flex-row gap-5 items-center"><div className="w-36 h-36 rounded-3xl bg-white grid place-items-center text-8xl" role="img" aria-label={lesson.word}>{lesson.icon}</div><div className="text-center sm:text-left flex-1"><h3 className="font-black text-4xl sm:text-5xl">{lesson.word}</h3><p className="text-xl font-bold text-[#315772]">Tap to hear the whole word.</p><button data-talker-dwell type="button" onClick={() => say(lesson.word)} className="relative min-h-16 rounded-2xl bg-[#137f96] text-white px-7 mt-3 font-black text-xl">🔊 Hear {lesson.word}</button></div></section>

      <section aria-label="Pictures of the word" className="rounded-3xl bg-white p-5 sm:p-6"><h3 className="text-2xl font-black mb-3">Look at the pictures</h3><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{lesson.pictures.map((picture, index) => <button data-talker-dwell key={index} type="button" onClick={() => say(picture.caption)} className="relative min-h-44 rounded-3xl bg-[#eff8f8] border-2 border-teal-100 hover:border-teal-500 flex flex-col items-center justify-center gap-2 p-3"><span className="text-6xl" aria-hidden="true">{picture.icon}</span><span className="font-black text-lg">{picture.caption}</span></button>)}</div></section>

      <section className="grid md:grid-cols-2 gap-4"><div className="rounded-3xl bg-[#fff1c8] p-5 sm:p-6"><h3 className="text-2xl font-black">Hear the sounds</h3><p className="text-lg font-bold mt-2">{lesson.sounds}</p><p className="font-bold mt-3">First sound: <strong>{lesson.first}</strong></p><button data-talker-dwell type="button" onClick={() => say(`${lesson.word} begins with the sound ${lesson.first}. Listen: ${lesson.word}.`)} className="relative min-h-16 bg-white rounded-2xl px-5 mt-4 font-black">🔊 Hear first sound</button></div><div className="rounded-3xl bg-[#eee8fa] p-5 sm:p-6"><h3 className="text-2xl font-black">Clap the word</h3><p className="text-2xl font-black mt-3">{lesson.syllables}</p><button data-talker-dwell type="button" onClick={() => say(`${lesson.syllables.replaceAll(" · ", ". ")}. ${lesson.word}.`)} className="relative min-h-16 bg-white rounded-2xl px-5 mt-4 font-black">👏 Hear the parts</button></div></section>

      <section className="rounded-3xl bg-white p-5 sm:p-6"><h3 className="text-2xl font-black mb-3">Say it in a sentence</h3><div className="grid sm:grid-cols-3 gap-3">{lesson.phrases.map(phrase => <button data-talker-dwell key={phrase} type="button" onClick={() => say(phrase)} className="relative min-h-28 rounded-2xl border-2 border-sky-100 hover:border-sky-500 bg-sky-50 p-4 text-lg font-black text-left">🔊 {phrase}</button>)}</div></section>

      <section className="rounded-3xl bg-[#e0f3e7] p-5 sm:p-6"><h3 className="text-2xl font-black">Find {lesson.word}</h3><button data-talker-dwell type="button" onClick={() => say(`Can you find ${lesson.word}?`)} className="relative rounded-2xl bg-white min-h-14 px-4 mt-2 font-black">🔊 Hear the question</button><div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">{lesson.choices.map(choice => <button data-talker-dwell type="button" key={choice} onClick={() => { setAnswer(choice); say(choice === lesson.word ? `Yes! You found ${lesson.word}.` : `Good try. Let's find ${lesson.word}.`); }} className={`relative rounded-3xl min-h-32 sm:min-h-40 border-4 ${answer === choice ? (choice === lesson.word ? "border-emerald-500" : "border-amber-400") : "border-white"} bg-white flex flex-col items-center justify-center p-2`}><span className="text-5xl" aria-hidden="true">{lessons.find(item => item.word === choice)?.icon || "❔"}</span><span className="font-black text-lg">{choice}</span></button>)}</div>{answer && <p role="status" className="font-black mt-3 text-xl">{answer === lesson.word ? `You found ${lesson.word}!` : `Let's look for ${lesson.word}.`}</p>}</section>

      <section className="rounded-3xl bg-[#e3eefa] p-5 sm:p-6"><h3 className="text-2xl font-black">Your turn to talk</h3><p className="font-bold mt-2">The AI asks, then listens automatically. Say the word and pause; feedback follows without another button.</p><div className="flex flex-wrap gap-3 mt-4"><button data-talker-dwell type="button" onClick={() => void ask()} disabled={busy} className="relative min-h-16 rounded-2xl bg-[#137f96] text-white px-6 font-black disabled:opacity-50">🎙️ Ask me to say {lesson.word}</button><button data-talker-dwell type="button" onClick={() => say(lesson.word)} disabled={busy} className="relative min-h-16 rounded-2xl bg-white px-6 font-black disabled:opacity-50">🔊 Hear it again</button></div>{feedback && <p role="status" className="text-lg font-black mt-4">{feedback}</p>}{heard && <p className="font-bold">The microphone heard: “{heard}”</p>}<p className="text-sm font-bold text-[#4c687b] mt-4">A grown-up can allow microphone access. Short recordings are sent for transcription and are not saved by this app. Speech recognition may mishear children's voices; it is practice, not a speech assessment.</p></section>
    </div>
  );
}
