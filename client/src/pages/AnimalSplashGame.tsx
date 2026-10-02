import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, PawPrint, RotateCcw, Volume2, Waves } from "lucide-react";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { speakCharacterAI } from "@/lib/tts";

type Animal = {
  id: string;
  name: string;
  accepted: string[];
  image: string;
  credit: string;
};

const commonsImage = (file: string, width = 760) =>
  `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=${width}`;

const ANIMALS: Animal[] = [
  {
    id: "duck",
    name: "duck",
    accepted: ["duck", "a duck", "white duck"],
    image: commonsImage("White domesticated duck, stretching.jpg"),
    credit: "Wikimedia Commons · White domesticated duck, stretching",
  },
  {
    id: "turtle",
    name: "turtle",
    accepted: ["turtle", "a turtle", "sea turtle", "green turtle"],
    image: commonsImage("Green turtle swimming in Kona May 2010.jpg"),
    credit: "Wikimedia Commons · Green turtle swimming in Kona",
  },
  {
    id: "frog",
    name: "frog",
    accepted: ["frog", "a frog", "dwarf frog"],
    image: commonsImage("African dwarf frog.jpg"),
    credit: "Wikimedia Commons · African dwarf frog",
  },
  {
    id: "hippo",
    name: "hippo",
    accepted: ["hippo", "a hippo", "hippopotamus", "a hippopotamus"],
    image: commonsImage("Portrait Hippopotamus in the water.jpg"),
    credit: "Wikimedia Commons · Hippopotamus",
  },
  {
    id: "penguin",
    name: "penguin",
    accepted: ["penguin", "a penguin", "emperor penguin"],
    image: commonsImage("Emperor Penguin Manchot empereur.jpg"),
    credit: "Wikimedia Commons · Emperor penguin",
  },
  {
    id: "seal",
    name: "seal",
    accepted: ["seal", "a seal", "monk seal"],
    image: commonsImage("Hawaiian monk seal close-up (Neomonachus schauinslandi).jpg"),
    credit: "Wikimedia Commons · Hawaiian monk seal",
  },
  {
    id: "elephant",
    name: "elephant",
    accepted: ["elephant", "an elephant", "african elephant"],
    image: commonsImage("African Bush Elephants.jpg"),
    credit: "Wikimedia Commons · African bush elephants",
  },
  {
    id: "lion",
    name: "lion",
    accepted: ["lion", "a lion", "male lion"],
    image: commonsImage("Male Lion on Rock.jpg"),
    credit: "Wikimedia Commons · Male lion",
  },
];

const SPLASH_AUDIO =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/Water%20sloshing%20in%20a%20small%20bottle.ogg";

function normalizeSpeech(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(it is|it's|thats|that's|this is|i think|the animal is)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrectAnswer(transcript: string, animal: Animal) {
  const normalized = normalizeSpeech(transcript);
  return animal.accepted.some(answer => {
    const clean = normalizeSpeech(answer);
    return normalized === clean || normalized.includes(clean);
  });
}

function speak(text: string, onEnd?: () => void) {
  let fallbackUsed = false;
  void speakCharacterAI(text, {
    calmMode: false,
    onEnd: () => {
      if (!fallbackUsed) onEnd?.();
    },
    onFallback: () => {
      fallbackUsed = true;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        utterance.pitch = 1.08;
        utterance.onend = () => onEnd?.();
        window.speechSynthesis.speak(utterance);
      } catch {
        onEnd?.();
      }
    },
  });
}

function playRealSplash() {
  try {
    const audio = new Audio(SPLASH_AUDIO);
    audio.volume = 0.92;
    audio.preload = "auto";
    const stop = () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    };
    audio.play().then(() => window.setTimeout(stop, 1200)).catch(() => {});
  } catch {}
}

function BalloonParty({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[260] overflow-hidden" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="animal-party-balloon absolute bottom-[-110px] block h-16 w-12 rounded-[50%_50%_46%_46%] shadow-xl"
          style={{
            left: `${3 + ((i * 17) % 94)}%`,
            animationDelay: `${(i % 7) * 0.09}s`,
            animationDuration: `${2.6 + (i % 5) * 0.2}s`,
            background: ["#f43f5e", "#f59e0b", "#22c55e", "#38bdf8", "#8b5cf6", "#ec4899"][i % 6],
          }}
        >
          <i className="absolute left-1/2 top-full h-24 w-px bg-white/70" />
        </span>
      ))}
      {Array.from({ length: 44 }).map((_, i) => (
        <span
          key={`confetti-${i}`}
          className="animal-party-confetti absolute -top-8 h-4 w-2 rounded-sm"
          style={{
            left: `${(i * 29) % 100}%`,
            animationDelay: `${(i % 11) * 0.06}s`,
            animationDuration: `${1.9 + (i % 6) * 0.18}s`,
            background: ["#fde047", "#fb7185", "#34d399", "#60a5fa", "#c084fc"][i % 5],
            transform: `rotate(${i * 31}deg)`,
          }}
        />
      ))}
      <div className="animal-party-burst absolute left-1/2 top-[16%] -translate-x-1/2 rounded-[2rem] border-4 border-white bg-gradient-to-br from-amber-300 via-pink-300 to-sky-300 px-8 py-5 text-center text-slate-950 shadow-2xl">
        <div className="text-4xl font-black sm:text-6xl">HOORAY!</div>
        <div className="mt-1 text-base font-black sm:text-xl">You got it!</div>
      </div>
    </div>
  );
}

export default function AnimalSplashGame({ onBack }: { onBack: () => void }) {
  const [remaining, setRemaining] = useState(() => ANIMALS.map(a => a.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeAnimal, setActiveAnimal] = useState<Animal | null>(null);
  const [status, setStatus] = useState<"choose" | "splash" | "asking" | "listening" | "correct" | "wrong" | "finished">("choose");
  const [message, setMessage] = useState("Pick an animal. Then put it in the water.");
  const [heard, setHeard] = useState("");
  const [party, setParty] = useState(false);
  const [micAvailable, setMicAvailable] = useState(true);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const recognitionRef = useRef<any>(null);
  const listenTimeoutRef = useRef<number | null>(null);
  const dwellRef = useRef<number | null>(null);
  const poolRef = useRef<HTMLButtonElement>(null);

  const animals = useMemo(
    () => ANIMALS.filter(animal => remaining.includes(animal.id)),
    [remaining],
  );
  const selected = ANIMALS.find(animal => animal.id === selectedId) || null;

  const clearListening = () => {
    if (listenTimeoutRef.current) window.clearTimeout(listenTimeoutRef.current);
    listenTimeoutRef.current = null;
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    recognitionRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearListening();
      if (dwellRef.current) window.clearTimeout(dwellRef.current);
    };
  }, []);

  const nextAnimal = (animalId: string) => {
    clearListening();
    setParty(false);
    setHeard("");
    setActiveAnimal(null);
    setSelectedId(null);
    setRemaining(current => {
      const next = current.filter(id => id !== animalId);
      if (!next.length) {
        window.setTimeout(() => {
          setStatus("finished");
          setMessage("You helped every animal into the water!");
          speak("Amazing! You helped every animal. Hooray!");
          celebrateEyeGaze(false);
          setParty(true);
        }, 250);
      } else {
        setStatus("choose");
        setMessage("Great job. Pick another animal.");
      }
      return next;
    });
  };

  const listenForAnswer = (animal: Animal) => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setMicAvailable(false);
      setStatus("asking");
      setMessage(`Say the animal name out loud. If your browser cannot hear you, use one of the big answer buttons.`);
      return;
    }

    clearListening();
    setMicAvailable(true);
    setStatus("listening");
    setMessage("I'm listening… What animal is it?");
    setHeard("");

    try {
      const recognition: any = new Recognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 4;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        const transcripts: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          for (let j = 0; j < event.results[i].length; j++) {
            transcripts.push(String(event.results[i][j].transcript || ""));
          }
        }
        const best = transcripts[0] || "";
        setHeard(best);
        const correct = transcripts.some(text => isCorrectAnswer(text, animal));
        clearListening();

        if (correct) {
          setStatus("correct");
          setMessage(`Yes! It's a ${animal.name}!`);
          setParty(true);
          celebrateEyeGaze(false);
          speak(`Hooray! Yes! That's a ${animal.name}! Great talking!`, () => {
            window.setTimeout(() => nextAnimal(animal.id), 800);
          });
        } else {
          setStatus("wrong");
          setMessage(`Good try. This animal is a ${animal.name}.`);
          speak(`Good try. This animal is a ${animal.name}. Say ${animal.name}.`, () => {
            window.setTimeout(() => nextAnimal(animal.id), 1100);
          });
        }
      };

      recognition.onerror = (event: any) => {
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          setMicAvailable(false);
          setStatus("asking");
          setMessage("Microphone access is off. You can still answer with the big buttons.");
        } else {
          setStatus("asking");
          setMessage("I didn't catch that. Say it again, or use a big answer button.");
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
      };

      recognition.start();
      listenTimeoutRef.current = window.setTimeout(() => {
        try {
          recognition.stop();
        } catch {}
        recognitionRef.current = null;
        setStatus("asking");
        setMessage("I didn't hear an answer yet. Say it again, or use a big answer button.");
      }, 7000);
    } catch {
      setMicAvailable(false);
      setStatus("asking");
      setMessage("I couldn't start the microphone. You can still answer with the big buttons.");
    }
  };

  const askAnimal = (animal: Animal) => {
    setStatus("asking");
    setMessage("What animal is it?");
    speak("What animal is it?", () => {
      window.setTimeout(() => listenForAnswer(animal), 250);
    });
  };

  const dropAnimal = (animal: Animal) => {
    if (!remaining.includes(animal.id) || status === "splash" || status === "listening") return;
    clearListening();
    setSelectedId(animal.id);
    setActiveAnimal(animal);
    setStatus("splash");
    setMessage("Splash!");
    playRealSplash();
    window.setTimeout(() => askAnimal(animal), 900);
  };

  const selectAnimal = (animal: Animal) => {
    if (status !== "choose") return;
    setSelectedId(animal.id);
    setMessage(`You picked the ${animal.name}. Put it in the water.`);
  };

  const chooseAnswer = (name: string) => {
    if (!activeAnimal || !["asking", "listening"].includes(status)) return;
    clearListening();
    setHeard(name);
    if (normalizeSpeech(name) === normalizeSpeech(activeAnimal.name)) {
      setStatus("correct");
      setMessage(`Yes! It's a ${activeAnimal.name}!`);
      setParty(true);
      celebrateEyeGaze(false);
      speak(`Hooray! Yes! That's a ${activeAnimal.name}!`, () => window.setTimeout(() => nextAnimal(activeAnimal.id), 800));
    } else {
      setStatus("wrong");
      setMessage(`Good try. This animal is a ${activeAnimal.name}.`);
      speak(`Good try. This animal is a ${activeAnimal.name}.`, () => window.setTimeout(() => nextAnimal(activeAnimal.id), 1000));
    }
  };

  const startPoolDwell = () => {
    if (!selected || status !== "choose") return;
    if (dwellRef.current) window.clearTimeout(dwellRef.current);
    dwellRef.current = window.setTimeout(() => dropAnimal(selected), 1050);
  };

  const stopPoolDwell = () => {
    if (dwellRef.current) window.clearTimeout(dwellRef.current);
    dwellRef.current = null;
  };

  const onAnimalPointerDown = (event: React.PointerEvent, animal: Animal) => {
    if (status !== "choose") return;
    selectAnimal(animal);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    setDrag({ id: animal.id, x: event.clientX, y: event.clientY });
  };

  const onAnimalPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    setDrag(current => current ? { ...current, x: event.clientX, y: event.clientY } : null);
  };

  const onAnimalPointerUp = (event: React.PointerEvent, animal: Animal) => {
    if (!drag) return;
    setDrag(null);
    const pool = poolRef.current?.getBoundingClientRect();
    if (
      pool &&
      event.clientX >= pool.left &&
      event.clientX <= pool.right &&
      event.clientY >= pool.top &&
      event.clientY <= pool.bottom
    ) {
      dropAnimal(animal);
    }
  };

  const reset = () => {
    clearListening();
    setRemaining(ANIMALS.map(a => a.id));
    setSelectedId(null);
    setActiveAnimal(null);
    setStatus("choose");
    setMessage("Pick an animal. Then put it in the water.");
    setHeard("");
    setParty(false);
  };

  return (
    <main className="animal-splash-game min-h-[calc(100dvh-4rem)] overflow-hidden bg-[linear-gradient(#dff7ff_0%,#f6fdff_38%,#c9f0ca_38%,#9cdb8a_100%)] text-slate-950">
      <BalloonParty visible={party} />
      {drag && (
        <img
          src={ANIMALS.find(a => a.id === drag.id)?.image}
          alt=""
          className="pointer-events-none fixed z-[220] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border-4 border-white object-cover shadow-2xl sm:h-40 sm:w-40"
          style={{ left: drag.x, top: drag.y }}
        />
      )}

      <header className="sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b-2 border-sky-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur sm:px-5">
        <button type="button" onClick={onBack} className="min-h-12 rounded-2xl border-2 border-slate-200 bg-white px-4 font-black">
          <ArrowLeft className="mr-2 inline h-5 w-5" /> Games
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-sky-700">Eye Gazer only · Real animal photos</p>
          <h1 className="truncate text-xl font-black sm:text-2xl">Animal Splash!</h1>
        </div>
        <button type="button" onClick={reset} className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-slate-200 bg-white" aria-label="Start over">
          <RotateCcw className="h-5 w-5" />
        </button>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-4 p-3 sm:p-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-[2.2rem] border-4 border-white/90 bg-white/90 p-4 shadow-2xl backdrop-blur sm:p-6">
          <div className="mb-4 rounded-[1.6rem] border-4 border-sky-200 bg-sky-50 p-4 text-center shadow-inner" aria-live="polite">
            <div className="flex items-center justify-center gap-2 text-sky-800">
              {status === "listening" ? <Mic className="h-6 w-6 animate-pulse" /> : status === "asking" && !micAvailable ? <MicOff className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              <p className="text-xl font-black sm:text-2xl">{message}</p>
            </div>
            {heard && <p className="mt-2 text-sm font-bold text-slate-600">I heard: “{heard}”</p>}
          </div>

          {status !== "finished" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {animals.map(animal => {
                const selectedNow = selectedId === animal.id;
                return (
                  <button
                    key={animal.id}
                    type="button"
                    onClick={() => selectAnimal(animal)}
                    onPointerDown={event => onAnimalPointerDown(event, animal)}
                    onPointerMove={onAnimalPointerMove}
                    onPointerUp={event => onAnimalPointerUp(event, animal)}
                    onMouseEnter={() => {
                      if (status !== "choose") return;
                      if (dwellRef.current) window.clearTimeout(dwellRef.current);
                      dwellRef.current = window.setTimeout(() => selectAnimal(animal), 950);
                    }}
                    onMouseLeave={stopPoolDwell}
                    disabled={status !== "choose"}
                    className={`group relative min-h-[180px] overflow-hidden rounded-[1.7rem] border-4 bg-white shadow-xl transition focus:outline-none focus:ring-8 focus:ring-sky-300 sm:min-h-[220px] ${selectedNow ? "scale-[1.02] border-amber-400 ring-8 ring-amber-200" : "border-white hover:border-sky-400"} disabled:opacity-55`}
                    aria-label={`Choose the ${animal.name}`}
                  >
                    <img src={animal.image} alt={`Real ${animal.name}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-10 text-left text-white">
                      <p className="text-xl font-black capitalize sm:text-2xl">{animal.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">gaze · tap · or drag</p>
                    </div>
                    {selectedNow && <div className="absolute right-2 top-2 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">SELECTED</div>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-[420px] place-items-center rounded-[2rem] border-4 border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-8 text-center">
              <div>
                <PawPrint className="mx-auto h-20 w-20 text-emerald-600" />
                <h2 className="mt-4 text-4xl font-black">All animals splashed!</h2>
                <p className="mt-2 text-lg font-bold text-slate-600">You listened, talked, and named every animal.</p>
                <button type="button" onClick={reset} className="mt-6 min-h-16 rounded-2xl bg-emerald-600 px-8 text-xl font-black text-white shadow-lg">
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative min-h-[520px] overflow-hidden rounded-[2.5rem] border-4 border-white bg-gradient-to-b from-sky-300 via-sky-200 to-emerald-100 shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-[42%] bg-[linear-gradient(#8fd8ff,#d7f5ff)]">
            <span className="absolute left-[10%] top-[16%] h-14 w-24 rounded-full bg-white/80 blur-[1px]" />
            <span className="absolute right-[12%] top-[26%] h-10 w-20 rounded-full bg-white/70 blur-[1px]" />
          </div>
          <div className="absolute bottom-[39%] left-0 right-0 h-16 bg-emerald-300/80" />

          <button
            ref={poolRef}
            type="button"
            data-water-zone
            onClick={() => selected && dropAnimal(selected)}
            onMouseEnter={startPoolDwell}
            onMouseLeave={stopPoolDwell}
            disabled={!selected || status !== "choose"}
            className="absolute inset-x-[5%] bottom-[5%] h-[48%] overflow-hidden rounded-[48%_48%_32%_32%/32%_32%_22%_22%] border-[8px] border-white/85 bg-[radial-gradient(circle_at_50%_15%,#9eeaff_0%,#43c7ee_35%,#168ecc_78%,#0b659d_100%)] shadow-[inset_0_12px_30px_rgba(255,255,255,.45),0_20px_50px_rgba(14,116,144,.3)] focus:outline-none focus:ring-8 focus:ring-amber-300 disabled:cursor-default"
            aria-label={selected ? `Put the ${selected.name} in the water` : "Water"}
          >
            <div className="animal-water-wave absolute inset-x-0 top-[8%] h-5 rounded-[50%] bg-white/35" />
            <div className="animal-water-wave animal-water-wave-2 absolute inset-x-[10%] top-[22%] h-4 rounded-[50%] bg-white/25" />
            <div className="absolute inset-0 grid place-items-center">
              {!activeAnimal && (
                <div className="rounded-[1.5rem] border-2 border-white/70 bg-white/80 px-5 py-4 text-center text-sky-900 shadow-lg backdrop-blur">
                  <Waves className="mx-auto h-10 w-10" />
                  <p className="mt-1 text-xl font-black">{selected ? `Put the ${selected.name} here!` : "Pick an animal first"}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-wider">gaze at water · tap · or drag here</p>
                </div>
              )}
            </div>

            {activeAnimal && (
              <div className={`animal-in-water absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 ${status === "splash" ? "animal-splash-enter" : ""}`}>
                <img src={activeAnimal.image} alt={`Real ${activeAnimal.name} in the water`} className="h-40 w-40 rounded-[2rem] border-4 border-white object-cover shadow-2xl sm:h-52 sm:w-52" />
                <div className="absolute inset-x-[-30px] bottom-[-12px] h-9 rounded-[50%] bg-white/45 blur-[1px]" />
              </div>
            )}

            {status === "splash" && (
              <div className="animal-splash-ring absolute left-1/2 top-[57%] h-24 w-52 -translate-x-1/2 rounded-[50%] border-[10px] border-white/80" />
            )}
          </button>

          {activeAnimal && ["asking", "listening"].includes(status) && (
            <div className="absolute inset-x-3 top-3 z-20 rounded-[1.8rem] border-4 border-white bg-white/95 p-4 text-center shadow-2xl sm:inset-x-6 sm:top-6">
              <p className="text-xs font-black uppercase tracking-[.18em] text-sky-700">Say it out loud</p>
              <h2 className="mt-1 text-3xl font-black">What animal is it?</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[activeAnimal.name, activeAnimal.id === "hippo" ? "duck" : "hippo"].map(answer => (
                  <button key={answer} type="button" onClick={() => chooseAnswer(answer)} className="min-h-16 rounded-2xl border-4 border-slate-200 bg-slate-50 text-xl font-black capitalize focus:ring-8 focus:ring-sky-300">
                    {answer}
                  </button>
                ))}
              </div>
              {!micAvailable && <p className="mt-2 text-xs font-bold text-slate-500">Voice listening is unavailable in this browser, so the big buttons stay available.</p>}
            </div>
          )}
        </div>
      </section>

      <details className="mx-auto mb-6 max-w-7xl px-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-bold">Photo & sound sources</summary>
        <div className="mt-2 rounded-xl bg-white/80 p-3">
          <p>Animal photographs are served from Wikimedia Commons. Splash audio uses the public-domain “Water sloshing in a small bottle” recording from Wikimedia Commons/PDSounds.</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {ANIMALS.map(animal => <li key={animal.id}>{animal.credit}</li>)}
          </ul>
        </div>
      </details>

      <style>{`
        .animal-water-wave{animation:animalWave 2.1s ease-in-out infinite alternate}
        .animal-water-wave-2{animation-delay:-1.1s;animation-duration:2.8s}
        .animal-splash-enter{animation:animalDrop .82s cubic-bezier(.2,.85,.2,1) both}
        .animal-splash-ring{animation:animalRing .95s ease-out both}
        .animal-party-balloon{animation:animalBalloon linear forwards}
        .animal-party-confetti{animation:animalConfetti linear forwards}
        .animal-party-burst{animation:animalBurst .5s cubic-bezier(.2,1.2,.3,1) both}
        @keyframes animalWave{from{transform:translateX(-4%) scaleX(.94)}to{transform:translateX(4%) scaleX(1.05)}}
        @keyframes animalDrop{0%{transform:translate(-50%,-145%) scale(.72) rotate(-7deg);opacity:.35}58%{transform:translate(-50%,-37%) scale(1.08) rotate(3deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}}
        @keyframes animalRing{0%{transform:translateX(-50%) scale(.25);opacity:1}100%{transform:translateX(-50%) scale(1.9);opacity:0}}
        @keyframes animalBalloon{0%{transform:translateY(0) rotate(-5deg)}100%{transform:translateY(-120vh) rotate(9deg)}}
        @keyframes animalConfetti{0%{transform:translateY(-30px) rotate(0)}100%{transform:translateY(115vh) rotate(760deg)}}
        @keyframes animalBurst{0%{transform:translate(-50%,-25px) scale(.2) rotate(-4deg);opacity:0}75%{transform:translate(-50%,0) scale(1.1) rotate(2deg);opacity:1}100%{transform:translate(-50%,0) scale(1) rotate(0)}}
        @media(prefers-reduced-motion:reduce){.animal-water-wave,.animal-splash-enter,.animal-splash-ring,.animal-party-balloon,.animal-party-confetti,.animal-party-burst{animation:none!important}}
      `}</style>
    </main>
  );
}
