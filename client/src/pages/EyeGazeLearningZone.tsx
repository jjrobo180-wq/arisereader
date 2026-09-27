import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { preloadCharacterAI } from "@/lib/tts";
import { talkerRequest } from "@/lib/talkerState";

type Picture = { icon: string; caption: string };
type Lesson = { word: string; icon: string; first: string; sounds: string; syllables: string; pictures: Picture[]; phrases: string[]; choices: string[] };

export const lessons: Lesson[] = [
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

const STEPS = ["Choose", "Hear", "See", "Sounds", "Sentence", "Find", "Say"] as const;

export default function EyeGazeLearningZone({ say, onBack }: Props) {
  const { token } = useAuth();
  const [word, setWord] = useState(() => localStorage.getItem("eye-gaze-learning-word") || "Milk");
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [heard, setHeard] = useState("");
  const [micReady, setMicReady] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const activeStream = useRef<MediaStream | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const practiceId = useRef(0);
  const alive = useRef(true);
  const lesson = lessons.find(item => item.word === word) || lessons[0];

  useEffect(() => {
    localStorage.setItem("eye-gaze-learning-word", lesson.word);
    const lines = [
      lesson.word,
      "Can you say " + lesson.word + "?",
      "I heard " + lesson.word + "!",
      "Let's try " + lesson.word + ". Start with " + lesson.first + ". " + lesson.word + ".",
      ...lesson.phrases,
      ...lesson.pictures.map(picture => picture.caption),
      lesson.word + " begins with the sound " + lesson.first + ". Listen: " + lesson.word + ".",
    ];
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
    practiceId.current++;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    activeStream.current?.getTracks().forEach(track => track.stop());
  }, []);

  const stopPractice = () => {
    practiceId.current++;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    activeStream.current?.getTracks().forEach(track => track.stop());
    activeStream.current = null;
    setBusy(false);
  };

  const sayWithMouth = (text: string, onEnd?: () => void) => {
    say(text, onEnd);
  };

  const prepareMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return false;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      media.getTracks().forEach(track => track.stop());
      setMicReady(true);
      return true;
    } catch {
      setMicReady(false);
      return false;
    }
  };

  const selectLesson = async (nextWord: string) => {
    stopPractice();
    setWord(nextWord);
    setStep(1);
    setAnswer(null);
    setFeedback("");
    setHeard("");
    void prepareMicrophone();
  };

  const advanceAfterSpeech = (text: string, nextStep: number) => {
    setBusy(true);
    sayWithMouth(text, () => {
      if (!alive.current) return;
      setBusy(false);
      setStep(nextStep);
    });
  };

  const scheduleRetry = (id: number, practiced: Lesson, reason: string) => {
    if (!alive.current || id !== practiceId.current) return;
    setFeedback(reason);
    setBusy(true);
    sayWithMouth("Let's try " + practiced.word + " again. Start with " + practiced.first + ". " + practiced.word + ".", () => {
      if (!alive.current || id !== practiceId.current) return;
      retryTimer.current = setTimeout(() => void beginSpeechAttempt(id, practiced, false), 350);
    });
  };

  const beginSpeechAttempt = async (existingId?: number, practiced: Lesson = lesson, announce = true) => {
    if (!alive.current) return;
    const id = existingId ?? ++practiceId.current;
    if (existingId === undefined) {
      setFeedback("");
      setHeard("");
    }
    setBusy(true);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setBusy(false);
      setFeedback("This browser cannot use the microphone here. Tap Try microphone again after microphone access is available.");
      return;
    }

    const type = ["audio/webm", "audio/mp4", "audio/ogg"].find(candidate => MediaRecorder.isTypeSupported(candidate));
    if (!type) {
      setBusy(false);
      setFeedback("This microphone format is not supported on this device.");
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || id !== practiceId.current) {
        media.getTracks().forEach(track => track.stop());
        return;
      }
      setMicReady(true);
      activeStream.current = media;

      const listenNow = () => {
        if (!alive.current || id !== practiceId.current) {
          media.getTracks().forEach(track => track.stop());
          return;
        }
        const chunks: BlobPart[] = [];
        const active = new MediaRecorder(media, { mimeType: type });
        recorder.current = active;
        let heardVoice = false;
        let audioContext: AudioContext | null = null;
        let pollTimer: ReturnType<typeof setTimeout> | null = null;

        active.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        active.onstop = async () => {
          if (pollTimer) clearTimeout(pollTimer);
          void audioContext?.close();
          media.getTracks().forEach(track => track.stop());
          activeStream.current = null;
          if (!alive.current || id !== practiceId.current) return;

          if (!heardVoice) {
            scheduleRetry(id, practiced, "I didn't hear a voice yet. Let's say it again.");
            return;
          }

          const audio = new Blob(chunks, { type });
          if (audio.size < 450) {
            scheduleRetry(id, practiced, "I couldn't hear that clearly. Let's try again.");
            return;
          }

          setFeedback("Checking what I heard…");
          try {
            const response = await fetch(API_BASE + "/api/eye-gaze/listen", {
              method: "POST",
              headers: { "Content-Type": type, Authorization: "Bearer " + token },
              body: audio,
              cache: "no-store",
            });
            const result = await response.json();
            if (!alive.current || id !== practiceId.current) return;
            if (!response.ok) throw new Error(result.message || "I couldn't listen that time.");

            const transcript = String(result.heard || "").trim();
            setHeard(transcript);
            const pieces = transcript.toLowerCase().split(/[^a-z]+/).filter(Boolean);
            const matched = pieces.includes(practiced.word.toLowerCase());

            void talkerRequest(token, "/practice", "POST", {
              word: practiced.word,
              outcome: matched ? "correct" : "retry",
              prompt: 2,
            }).catch(() => {});

            if (matched) {
              setFeedback("I heard " + practiced.word + "! Great talking!");
              setBusy(true);
              sayWithMouth("I heard " + practiced.word + "! Great talking!", () => {
                if (!alive.current || id !== practiceId.current) return;
                setBusy(false);
                setStep(7);
              });
            } else {
              scheduleRetry(id, practiced, transcript
                ? "I heard “" + transcript + ".” Let's try " + practiced.word + " again."
                : "I didn't catch the word. Let's try again.");
            }
          } catch (error: any) {
            setBusy(false);
            setFeedback(error?.message || "I couldn't check that recording. Tap Try microphone again.");
          }
        };

        active.start();
        setFeedback("🎙️ I'm listening. Say " + practiced.word + ".");

        try {
          audioContext = new AudioContext();
          void audioContext.resume();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024;
          const source = audioContext.createMediaStreamSource(media);
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
            for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
            const rms = Math.sqrt(energy / samples.length);
            const now = performance.now();
            if (now - started < 250) noiseFloor = Math.max(noiseFloor, rms);
            const voice = rms > Math.max(0.009, noiseFloor * 2.0);
            if (voice) {
              if (!speakingSince) speakingSince = now;
              if (now - speakingSince > 120) heardVoice = true;
              lastVoiceAt = now;
            } else {
              speakingSince = 0;
            }
            if ((heardVoice && now - lastVoiceAt > 700 && now - started > 800) || now - started > 6000) {
              if (active.state === "recording") active.stop();
            } else {
              pollTimer = setTimeout(poll, 60);
            }
          };
          pollTimer = setTimeout(poll, 60);
        } catch {
          retryTimer.current = setTimeout(() => {
            if (active.state === "recording") active.stop();
          }, 5000);
        }
      };

      if (announce) {
        sayWithMouth("Your turn. Say " + practiced.word + ".", listenNow);
      } else {
        listenNow();
      }
    } catch {
      setMicReady(false);
      setBusy(false);
      setFeedback("Microphone access is not available yet. Tap Try microphone again.");
    }
  };

  useEffect(() => {
    if (step !== 6) return;
    const id = ++practiceId.current;
    retryTimer.current = setTimeout(() => void beginSpeechAttempt(id, lesson, true), 450);
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [step, lesson.word]);

  const chooseAnswer = (choice: string) => {
    setAnswer(choice);
    const correct = choice === lesson.word;
    void talkerRequest(token, "/practice", "POST", {
      word: lesson.word,
      outcome: correct ? "correct" : "retry",
      prompt: 1,
    }).catch(() => {});

    if (correct) {
      setFeedback("You found " + lesson.word + "!");
      setBusy(true);
      sayWithMouth("Yes! You found " + lesson.word + ".", () => {
        setBusy(false);
        setStep(6);
      });
    } else {
      setFeedback("Good try. Find " + lesson.word + ".");
      say("Good try. Find " + lesson.word + ".");
    }
  };

  const restart = () => {
    stopPractice();
    setStep(0);
    setAnswer(null);
    setFeedback("");
    setHeard("");
  };

  return (
    <div className="max-w-[1100px] mx-auto pb-8">
      <header className="flex flex-wrap gap-3 items-center justify-between py-3">
        <div>
          <p className="text-sm tracking-widest font-black text-teal-700">MY TALKER • LEARN</p>
          <h2 className="text-3xl sm:text-4xl font-black">{step === 0 ? "Pick a word to learn" : "Let's learn " + lesson.word}</h2>
        </div>
        <div className="flex gap-2">
          {step > 0 && <button data-talker-dwell type="button" onClick={restart} className="relative min-h-12 rounded-2xl bg-white border-2 border-sky-100 px-4 font-black">↺ New word</button>}
          <button data-talker-dwell type="button" onClick={() => { stopPractice(); onBack(); }} className="relative min-h-16 rounded-3xl bg-[#ffd766] border-4 border-[#193d57] px-5 text-lg sm:text-xl font-black shadow-sm">⬅ BACK TO TALKER</button>
        </div>
      </header>

      {step > 0 && (
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-5">
          {STEPS.map((label, index) => (
            <div key={label} className={"rounded-xl p-2 text-center text-[10px] sm:text-xs font-black " + (index === step ? "bg-teal-600 text-white" : index < step ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-400")}>
              <span className="block text-base sm:text-lg">{index < step ? "✓" : index + 1}</span>{label}
            </div>
          ))}
        </div>
      )}

      {step === 0 && (
        <section className="rounded-3xl bg-white p-5 sm:p-6 border-2 border-teal-100">
          <div className="mb-4">
            <p className="font-black text-[#477586]">TRY THESE WORDS</p>
            <p className="text-sm font-bold text-slate-500">Pick one word. You will hear it, see it, use it in a sentence, find it, and practice saying it.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {lessons.map(item => (
              <button data-talker-dwell type="button" key={item.word} onClick={() => void selectLesson(item.word)} className="relative rounded-3xl min-h-32 border-4 border-slate-100 hover:border-teal-500 flex flex-col items-center justify-center font-black text-lg">
                <span className="text-5xl" aria-hidden="true">{item.icon}</span>{item.word}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="rounded-[2rem] bg-gradient-to-br from-teal-100 to-sky-100 p-6 sm:p-10 text-center">
          <div className="text-8xl sm:text-9xl">{lesson.icon}</div>
          <h3 className="text-4xl sm:text-6xl font-black mt-4">{lesson.word}</h3>
          <p className="text-xl font-bold text-[#315772] mt-3">Tap to hear the whole word.</p>
          <button data-talker-dwell type="button" disabled={busy} onClick={() => advanceAfterSpeech(lesson.word, 2)} className="relative mt-5 w-full min-h-20 rounded-3xl bg-[#137f96] text-white text-2xl font-black disabled:opacity-50">🔊 Hear {lesson.word}</button>
        </section>
      )}

      {step === 2 && (
        <section className="rounded-[2rem] bg-white p-5 sm:p-8 text-center">
          <h3 className="text-3xl font-black">Look at {lesson.word}</h3>
          <p className="font-bold text-slate-500 mt-1">Tap a picture to hear what you see.</p>
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            {lesson.pictures.map((picture, index) => (
              <button data-talker-dwell key={index} type="button" onClick={() => say(picture.caption)} className="relative min-h-48 rounded-3xl bg-[#eff8f8] border-2 border-teal-100 flex flex-col items-center justify-center gap-3 p-3">
                <span className="text-7xl">{picture.icon}</span><span className="font-black text-lg">{picture.caption}</span>
              </button>
            ))}
          </div>
          <button data-talker-dwell type="button" onClick={() => setStep(3)} className="relative mt-5 w-full min-h-16 rounded-2xl bg-teal-600 text-white font-black text-xl">Next: hear the sounds →</button>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-[2rem] bg-[#fff1c8] p-6 sm:p-10 text-center">
          <h3 className="text-3xl font-black">Hear the sounds</h3>
          <div className="text-3xl sm:text-5xl font-black mt-5">{lesson.sounds}</div>
          <p className="text-xl font-bold mt-4">First sound: <strong>{lesson.first}</strong></p>
          <button data-talker-dwell type="button" disabled={busy} onClick={() => advanceAfterSpeech(lesson.word + " begins with the sound " + lesson.first + ". Listen: " + lesson.word + ".", 4)} className="relative mt-6 w-full min-h-20 rounded-3xl bg-white font-black text-xl disabled:opacity-50">🔊 Hear the sounds</button>
        </section>
      )}

      {step === 4 && (
        <section className="rounded-[2rem] bg-sky-50 p-6 sm:p-10 text-center">
          <h3 className="text-3xl font-black">Hear {lesson.word} in a sentence</h3>
          <div className="grid gap-3 mt-5">
            {lesson.phrases.map((phrase, index) => (
              <button data-talker-dwell key={phrase} type="button" disabled={busy} onClick={() => advanceAfterSpeech(phrase, index === 0 ? 5 : 4)} className="relative min-h-20 rounded-3xl bg-white border-2 border-sky-100 p-4 text-xl font-black disabled:opacity-50">
                🔊 {phrase}
                {index === 0 && <span className="block text-xs text-sky-700 mt-1">Tap this one to continue</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="rounded-[2rem] bg-[#e0f3e7] p-6 sm:p-10 text-center">
          <h3 className="text-3xl font-black">Find {lesson.word}</h3>
          <p className="font-bold text-slate-600 mt-2">Choose the right picture. A correct answer moves straight to speaking practice.</p>
          <button data-talker-dwell type="button" onClick={() => say("Can you find " + lesson.word + "?")} className="relative rounded-2xl bg-white min-h-14 px-4 mt-4 font-black">🔊 Hear the question</button>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5">
            {lesson.choices.map(choice => (
              <button data-talker-dwell type="button" key={choice} disabled={busy} onClick={() => chooseAnswer(choice)} className={"relative rounded-3xl min-h-40 border-4 bg-white flex flex-col items-center justify-center p-2 " + (answer === choice ? (choice === lesson.word ? "border-emerald-500" : "border-amber-400") : "border-white")}>
                <span className="text-6xl">{lessons.find(item => item.word === choice)?.icon || "❔"}</span><span className="font-black text-lg mt-2">{choice}</span>
              </button>
            ))}
          </div>
          {feedback && <p className="text-xl font-black mt-4">{feedback}</p>}
        </section>
      )}

      {step === 6 && (
        <section className="rounded-[2rem] bg-gradient-to-br from-violet-100 to-sky-100 p-6 sm:p-10 text-center">
          <div className="text-8xl">{lesson.icon}</div>
          <h3 className="text-4xl font-black mt-3">Say “{lesson.word}”</h3>
          <p className="text-lg font-bold text-slate-600 mt-2">{micReady ? "The microphone starts by itself. Say the word, then pause." : "The microphone will try to start automatically."}</p>
          <div className={"mt-5 rounded-3xl p-5 font-black text-xl " + (busy ? "bg-rose-100 text-rose-800" : "bg-white")}>{feedback || "Getting ready to listen…"}</div>
          {heard && <p className="font-bold mt-3">I heard: “{heard}”</p>}
          {!busy && feedback.includes("microphone") && <button type="button" onClick={() => void beginSpeechAttempt(undefined, lesson, true)} className="mt-4 min-h-14 rounded-2xl bg-violet-600 text-white px-5 font-black">🎙️ Try microphone again</button>}
          <p className="text-xs font-bold text-[#547886] mt-5">Speech recognition can mishear children's voices. This is supportive practice, not a speech assessment. Recordings are sent for transcription and are not saved by this app.</p>
        </section>
      )}

      {step === 7 && (
        <section className="rounded-[2rem] bg-gradient-to-br from-emerald-100 to-amber-100 p-7 sm:p-12 text-center">
          <div className="text-8xl">🌟</div>
          <h3 className="text-4xl sm:text-5xl font-black mt-3">You said {lesson.word}!</h3>
          <p className="text-xl font-bold text-slate-600 mt-2">Great work listening, finding, and talking.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <button data-talker-dwell type="button" onClick={() => { setStep(1); setFeedback(""); setHeard(""); }} className="relative min-h-16 rounded-2xl bg-white font-black">Practice {lesson.word} again</button>
            <button data-talker-dwell type="button" onClick={restart} className="relative min-h-16 rounded-2xl bg-emerald-600 text-white font-black">Learn another word →</button>
          </div>
        </section>
      )}
    </div>
  );
}
