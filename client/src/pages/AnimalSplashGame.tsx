import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, PawPrint, RotateCcw, Sparkles, Volume2, Waves } from "lucide-react";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { speakCharacterAI } from "@/lib/tts";

type Animal = { id:string; name:string; accepted:string[]; image:string; credit:string };
type GameStatus = "choose"|"splash"|"asking"|"listening"|"correct"|"wrong"|"finished";

const commonsImage=(file:string,width=760)=>`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=${width}`;

const ANIMALS:Animal[]=[
 {id:"duck",name:"duck",accepted:["duck","a duck","white duck"],image:commonsImage("White domesticated duck, stretching.jpg"),credit:"Wikimedia Commons · White domesticated duck"},
 {id:"turtle",name:"turtle",accepted:["turtle","a turtle","sea turtle","green turtle"],image:commonsImage("Green turtle swimming in Kona May 2010.jpg"),credit:"Wikimedia Commons · Green turtle"},
 {id:"frog",name:"frog",accepted:["frog","a frog","dwarf frog"],image:commonsImage("African dwarf frog.jpg"),credit:"Wikimedia Commons · African dwarf frog"},
 {id:"hippo",name:"hippo",accepted:["hippo","a hippo","hippopotamus","a hippopotamus"],image:commonsImage("Portrait Hippopotamus in the water.jpg"),credit:"Wikimedia Commons · Hippopotamus"},
 {id:"penguin",name:"penguin",accepted:["penguin","a penguin","emperor penguin"],image:commonsImage("Emperor Penguin Manchot empereur.jpg"),credit:"Wikimedia Commons · Emperor penguin"},
 {id:"seal",name:"seal",accepted:["seal","a seal","monk seal"],image:commonsImage("Hawaiian monk seal close-up (Neomonachus schauinslandi).jpg"),credit:"Wikimedia Commons · Hawaiian monk seal"},
 {id:"elephant",name:"elephant",accepted:["elephant","an elephant","african elephant"],image:commonsImage("African Bush Elephants.jpg"),credit:"Wikimedia Commons · African bush elephants"},
 {id:"lion",name:"lion",accepted:["lion","a lion","male lion"],image:commonsImage("Male Lion on Rock.jpg"),credit:"Wikimedia Commons · Male lion"},
 {id:"dolphin",name:"dolphin",accepted:["dolphin","a dolphin","bottlenose dolphin"],image:commonsImage("Bottlenose Dolphin.jpg"),credit:"Wikimedia Commons · Bottlenose dolphin"},
 {id:"otter",name:"otter",accepted:["otter","an otter","river otter"],image:commonsImage("River otter.jpg"),credit:"Wikimedia Commons · River otter"},
 {id:"crocodile",name:"crocodile",accepted:["crocodile","a crocodile","croc"],image:commonsImage("Crocodile --.jpg"),credit:"Wikimedia Commons · Crocodile"},
 {id:"flamingo",name:"flamingo",accepted:["flamingo","a flamingo","greater flamingo"],image:commonsImage("Flamingo .jpg"),credit:"Wikimedia Commons · Greater flamingo"},
 {id:"polar-bear",name:"polar bear",accepted:["polar bear","a polar bear","bear"],image:commonsImage("PolarBear.jpg"),credit:"Wikimedia Commons · Polar bear"},
 {id:"beaver",name:"beaver",accepted:["beaver","a beaver"],image:commonsImage("Beaver.jpg"),credit:"Wikimedia Commons · Beaver"},
 {id:"shark",name:"shark",accepted:["shark","a shark","great white shark"],image:commonsImage("Great White Shark (Carcharodon carcharias) (32096717593).jpg"),credit:"Wikimedia Commons · Great white shark"},
 {id:"whale",name:"whale",accepted:["whale","a whale"],image:commonsImage("A Whale.jpg"),credit:"Wikimedia Commons · Whale"},
];

const SPLASH_AUDIO="https://commons.wikimedia.org/wiki/Special:Redirect/file/Water%20sloshing%20in%20a%20small%20bottle.ogg";

function normalizeSpeech(value:string){return value.toLowerCase().replace(/[^a-z\s]/g," ").replace(/\b(it is|it's|thats|that's|this is|i think|the animal is)\b/g," ").replace(/\s+/g," ").trim();}
function isCorrectAnswer(transcript:string,animal:Animal){const normalized=normalizeSpeech(transcript);return animal.accepted.some(answer=>{const clean=normalizeSpeech(answer);return normalized===clean||normalized.includes(clean);});}
function speak(text:string,onEnd?:()=>void){let fallback=false;void speakCharacterAI(text,{calmMode:false,onEnd:()=>{if(!fallback)onEnd?.()},onFallback:()=>{fallback=true;try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.pitch=1.08;u.onend=()=>onEnd?.();window.speechSynthesis.speak(u)}catch{onEnd?.()}}});}
function playRealSplash(){try{const audio=new Audio(SPLASH_AUDIO);audio.volume=.95;audio.preload="auto";audio.play().then(()=>window.setTimeout(()=>{try{audio.pause();audio.currentTime=0}catch{}},1400)).catch(()=>{})}catch{}}

function BalloonParty({visible}:{visible:boolean}){
 if(!visible)return null;
 return <div className="pointer-events-none fixed inset-0 z-[260] overflow-hidden" aria-hidden="true">
  {Array.from({length:20}).map((_,i)=><span key={i} className="animal-party-balloon absolute bottom-[-110px] block h-16 w-12 rounded-[50%_50%_46%_46%] shadow-xl" style={{left:`${3+((i*17)%94)}%`,animationDelay:`${(i%7)*.09}s`,animationDuration:`${2.6+(i%5)*.2}s`,background:["#f43f5e","#f59e0b","#22c55e","#38bdf8","#8b5cf6","#ec4899"][i%6]}}><i className="absolute left-1/2 top-full h-24 w-px bg-white/70"/></span>)}
  {Array.from({length:50}).map((_,i)=><span key={`confetti-${i}`} className="animal-party-confetti absolute -top-8 h-4 w-2 rounded-sm" style={{left:`${(i*29)%100}%`,animationDelay:`${(i%11)*.06}s`,animationDuration:`${1.9+(i%6)*.18}s`,background:["#fde047","#fb7185","#34d399","#60a5fa","#c084fc"][i%5],transform:`rotate(${i*31}deg)`}}/>)}
  <div className="animal-party-burst absolute left-1/2 top-[14%] -translate-x-1/2 rounded-[2rem] border-4 border-white bg-gradient-to-br from-amber-300 via-pink-300 to-sky-300 px-8 py-5 text-center text-slate-950 shadow-2xl"><div className="text-4xl font-black sm:text-6xl">HOORAY!</div><div className="mt-1 text-base font-black sm:text-xl">You got it!</div></div>
 </div>;
}

export default function AnimalSplashGame({onBack}:{onBack:()=>void}){
 const [remaining,setRemaining]=useState(()=>ANIMALS.map(a=>a.id));
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [activeAnimal,setActiveAnimal]=useState<Animal|null>(null);
 const [status,setStatus]=useState<GameStatus>("choose");
 const [message,setMessage]=useState("Pick an animal. Then put it in the water.");
 const [heard,setHeard]=useState("");
 const [party,setParty]=useState(false);
 const [micAvailable,setMicAvailable]=useState(true);
 const [drag,setDrag]=useState<{id:string;x:number;y:number}|null>(null);
 const recognitionRef=useRef<any>(null),listenTimeoutRef=useRef<number|null>(null),dwellRef=useRef<number|null>(null);
 const poolRef=useRef<HTMLButtonElement>(null),statusRef=useRef<GameStatus>("choose");
 statusRef.current=status;

 const animals=useMemo(()=>ANIMALS.filter(a=>remaining.includes(a.id)),[remaining]);
 const selected=ANIMALS.find(a=>a.id===selectedId)||null;
 const completed=ANIMALS.length-remaining.length;
 const progress=Math.round(completed/ANIMALS.length*100);
 const answerChoices=useMemo(()=>{if(!activeAnimal)return[];const idx=ANIMALS.findIndex(a=>a.id===activeAnimal.id);return [activeAnimal.name,ANIMALS[(idx+5)%ANIMALS.length].name,ANIMALS[(idx+9)%ANIMALS.length].name];},[activeAnimal]);

 const clearListening=()=>{if(listenTimeoutRef.current)window.clearTimeout(listenTimeoutRef.current);listenTimeoutRef.current=null;try{recognitionRef.current?.stop?.()}catch{}recognitionRef.current=null;};
 useEffect(()=>()=>{clearListening();if(dwellRef.current)window.clearTimeout(dwellRef.current)},[]);

 const nextAnimal=(animalId:string)=>{clearListening();setParty(false);setHeard("");setActiveAnimal(null);setSelectedId(null);setRemaining(current=>{const next=current.filter(id=>id!==animalId);if(!next.length){window.setTimeout(()=>{setStatus("finished");setMessage("You helped every animal into the water!");speak("Amazing! You named every animal. Hooray!");celebrateEyeGaze(false);setParty(true)},250)}else{setStatus("choose");setMessage("Great job. Pick another animal.")}return next;});};

 const listenForAnswer=(animal:Animal)=>{
  const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  if(!Recognition){setMicAvailable(false);setStatus("asking");setMessage("Say the animal name out loud. If your browser cannot hear you, use a big answer button.");return;}
  clearListening();setMicAvailable(true);setStatus("listening");setMessage("I'm listening… What animal is it?");setHeard("");
  try{
   const recognition:any=new Recognition();recognition.lang="en-US";recognition.interimResults=false;recognition.continuous=false;recognition.maxAlternatives=4;recognitionRef.current=recognition;
   recognition.onresult=(event:any)=>{const transcripts:string[]=[];for(let i=0;i<event.results.length;i++)for(let j=0;j<event.results[i].length;j++)transcripts.push(String(event.results[i][j].transcript||""));const best=transcripts[0]||"";setHeard(best);const correct=transcripts.some(t=>isCorrectAnswer(t,animal));clearListening();if(correct){setStatus("correct");setMessage(`Yes! It's a ${animal.name}!`);setParty(true);celebrateEyeGaze(false);speak(`Hooray! Yes! That's a ${animal.name}! Great talking!`,()=>window.setTimeout(()=>nextAnimal(animal.id),800));}else{setStatus("wrong");setMessage(`Good try. This animal is a ${animal.name}.`);speak(`Good try. This animal is a ${animal.name}. Say ${animal.name}.`,()=>window.setTimeout(()=>nextAnimal(animal.id),1100));}};
   recognition.onerror=(event:any)=>{if(event?.error==="not-allowed"||event?.error==="service-not-allowed"){setMicAvailable(false);setStatus("asking");setMessage("Microphone access is off. You can still answer with the big buttons.");}else{setStatus("asking");setMessage("I didn't catch that. Say it again, or use a big answer button.");}};
   recognition.onend=()=>{recognitionRef.current=null};recognition.start();listenTimeoutRef.current=window.setTimeout(()=>{try{recognition.stop()}catch{}recognitionRef.current=null;setStatus("asking");setMessage("I didn't hear an answer yet. Say it again, or use a big answer button.");},7000);
  }catch{setMicAvailable(false);setStatus("asking");setMessage("I couldn't start the microphone. You can still answer with the big buttons.");}
 };

 const askAnimal=(animal:Animal)=>{setStatus("asking");setMessage("What animal is it?");speak("What animal is it?",()=>window.setTimeout(()=>listenForAnswer(animal),250));};
 const dropAnimal=(animal:Animal)=>{if(!remaining.includes(animal.id)||statusRef.current!=="choose")return;clearListening();setSelectedId(animal.id);setActiveAnimal(animal);setStatus("splash");setMessage("SPLASH!");playRealSplash();window.setTimeout(()=>askAnimal(animal),950);};
 const selectAnimal=(animal:Animal)=>{if(statusRef.current!=="choose")return;setSelectedId(animal.id);setMessage(`You picked the ${animal.name}. Put it in the water.`);};
 const chooseAnswer=(name:string)=>{if(!activeAnimal||!["asking","listening"].includes(statusRef.current))return;clearListening();setHeard(name);if(isCorrectAnswer(name,activeAnimal)){setStatus("correct");setMessage(`Yes! It's a ${activeAnimal.name}!`);setParty(true);celebrateEyeGaze(false);speak(`Hooray! Yes! That's a ${activeAnimal.name}!`,()=>window.setTimeout(()=>nextAnimal(activeAnimal.id),800));}else{setStatus("wrong");setMessage(`Good try. This animal is a ${activeAnimal.name}.`);speak(`Good try. This animal is a ${activeAnimal.name}.`,()=>window.setTimeout(()=>nextAnimal(activeAnimal.id),1000));}};

 const startPoolDwell=()=>{if(!selected||statusRef.current!=="choose")return;if(dwellRef.current)window.clearTimeout(dwellRef.current);dwellRef.current=window.setTimeout(()=>dropAnimal(selected),1050);};
 const stopDwell=()=>{if(dwellRef.current)window.clearTimeout(dwellRef.current);dwellRef.current=null;};

 const beginDrag=(event:React.PointerEvent,animal:Animal)=>{if(statusRef.current!=="choose")return;event.preventDefault();event.stopPropagation();selectAnimal(animal);try{(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)}catch{}setDrag({id:animal.id,x:event.clientX,y:event.clientY});};

 useEffect(()=>{
  if(!drag)return;
  const oldOverflow=document.body.style.overflow,oldTouch=(document.body.style as any).touchAction;
  document.body.style.overflow="hidden";(document.body.style as any).touchAction="none";
  const move=(event:PointerEvent)=>{event.preventDefault();setDrag(current=>current?{...current,x:event.clientX,y:event.clientY}:null);};
  const finish=(event:PointerEvent)=>{event.preventDefault();const current=drag;setDrag(null);const animal=ANIMALS.find(a=>a.id===current.id);const pool=poolRef.current?.getBoundingClientRect();if(animal&&pool){const pad=70;const inside=event.clientX>=pool.left-pad&&event.clientX<=pool.right+pad&&event.clientY>=pool.top-pad&&event.clientY<=pool.bottom+pad;if(inside)dropAnimal(animal);}};
  const cancel=()=>setDrag(null);
  window.addEventListener("pointermove",move,{passive:false});window.addEventListener("pointerup",finish,{passive:false});window.addEventListener("pointercancel",cancel,{passive:false});
  return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",cancel);document.body.style.overflow=oldOverflow;(document.body.style as any).touchAction=oldTouch;};
 },[drag?.id]);

 const reset=()=>{clearListening();setDrag(null);setRemaining(ANIMALS.map(a=>a.id));setSelectedId(null);setActiveAnimal(null);setStatus("choose");setMessage("Pick an animal. Then put it in the water.");setHeard("");setParty(false);};

 return <main className="animal-splash-game min-h-[calc(100dvh-4rem)] overflow-x-hidden bg-[radial-gradient(circle_at_15%_5%,rgba(255,255,255,.75),transparent_24%),linear-gradient(180deg,#bdeeff_0%,#eefbff_30%,#dcf7df_30%,#9fdc98_100%)] text-slate-950" style={{overscrollBehavior:"contain"}}>
  <BalloonParty visible={party}/>
  {drag&&<div className="pointer-events-none fixed inset-0 z-[219]"><div className="absolute inset-x-[12%] bottom-5 rounded-[2rem] border-4 border-dashed border-sky-300 bg-sky-500/15 py-5 text-center text-xl font-black text-sky-950 backdrop-blur-sm">DROP IN THE WATER</div><img src={ANIMALS.find(a=>a.id===drag.id)?.image} alt="" className="fixed z-[220] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border-[6px] border-white object-cover shadow-[0_20px_55px_rgba(2,132,199,.45)]" style={{left:drag.x,top:drag.y}}/></div>}

  <header className="sticky top-0 z-40 border-b border-white/60 bg-white/88 px-3 py-3 shadow-lg backdrop-blur-xl sm:px-5">
   <div className="mx-auto flex max-w-[1500px] items-center gap-3">
    <button type="button" onClick={onBack} className="min-h-12 rounded-2xl border-2 border-slate-200 bg-white px-4 font-black shadow-sm"><ArrowLeft className="mr-2 inline h-5 w-5"/> Games</button>
    <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-sky-700">A.R.I.S.E. 2.0 · Eye Gazer Voice Play</p><h1 className="truncate text-xl font-black sm:text-2xl">Animal Splash 2.0</h1></div>
    <div className="hidden min-w-[210px] sm:block"><div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500"><span>{completed} of {ANIMALS.length}</span><span>{progress}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all" style={{width:`${progress}%`}}/></div></div>
    <button type="button" onClick={reset} className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-slate-200 bg-white shadow-sm" aria-label="Start over"><RotateCcw className="h-5 w-5"/></button>
   </div>
  </header>

  <section className="mx-auto grid w-full max-w-[1500px] gap-4 p-3 sm:p-4 md:grid-cols-[1.05fr_.95fr] xl:grid-cols-[1.12fr_.88fr]">
   <div className="min-w-0 rounded-[2.25rem] border-4 border-white/90 bg-white/88 p-3 shadow-2xl backdrop-blur-xl sm:p-5">
    <div className="mb-3 overflow-hidden rounded-[1.6rem] border-4 border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-3 text-center shadow-inner" aria-live="polite">
     <div className="flex items-center justify-center gap-2 text-sky-900">{status==="listening"?<Mic className="h-6 w-6 animate-pulse"/>:status==="asking"&&!micAvailable?<MicOff className="h-6 w-6"/>:<Volume2 className="h-6 w-6"/>}<p className="text-lg font-black sm:text-xl xl:text-2xl">{message}</p></div>
     {heard&&<p className="mt-1 text-sm font-bold text-slate-600">I heard: “{heard}”</p>}
    </div>

    {status!=="finished"?<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
     {animals.map(animal=>{const selectedNow=selectedId===animal.id;return <button key={animal.id} type="button" onClick={()=>selectAnimal(animal)} onPointerDown={e=>beginDrag(e,animal)} onMouseEnter={()=>{if(statusRef.current!=="choose")return;if(dwellRef.current)window.clearTimeout(dwellRef.current);dwellRef.current=window.setTimeout(()=>selectAnimal(animal),900)}} onMouseLeave={stopDwell} disabled={status!=="choose"} style={{touchAction:"none",WebkitUserSelect:"none",userSelect:"none"}} className={`group relative min-h-[150px] overflow-hidden rounded-[1.45rem] border-4 bg-white shadow-lg transition focus:outline-none focus:ring-8 focus:ring-sky-300 sm:min-h-[165px] xl:min-h-[190px] ${selectedNow?"scale-[1.02] border-amber-400 ring-4 ring-amber-200":"border-white hover:border-sky-400"} disabled:opacity-55`} aria-label={`Choose the ${animal.name}`}>
      <img src={animal.image} alt={`Real ${animal.name}`} className="pointer-events-none absolute inset-0 h-full w-full object-cover" draggable={false}/>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-3 pb-3 pt-10 text-left text-white"><p className="text-lg font-black capitalize sm:text-xl">{animal.name}</p><p className="text-[9px] font-black uppercase tracking-wider text-white/75">gaze · tap · drag</p></div>
      {selectedNow&&<div className="absolute right-2 top-2 rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black text-slate-950 shadow">READY</div>}
     </button>})}
    </div>:<div className="grid min-h-[430px] place-items-center rounded-[2rem] border-4 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-8 text-center"><div><Sparkles className="mx-auto h-16 w-16 text-amber-500"/><h2 className="mt-3 text-4xl font-black">All {ANIMALS.length} animals!</h2><p className="mt-2 text-lg font-bold text-slate-600">You listened, talked, and named the whole Animal Splash crew.</p><button type="button" onClick={reset} className="mt-6 min-h-16 rounded-2xl bg-emerald-600 px-8 text-xl font-black text-white shadow-lg">Play Again</button></div></div>}
   </div>

   <div className="relative min-h-[520px] overflow-hidden rounded-[2.6rem] border-4 border-white bg-[linear-gradient(180deg,#80d7ff_0%,#dff7ff_34%,#8edb78_34%,#74c766_46%,#276c68_46%,#06466b_100%)] shadow-2xl sm:min-h-[620px]">
    <div className="absolute inset-x-0 top-0 h-[34%]"><span className="absolute left-[8%] top-[12%] h-14 w-28 rounded-full bg-white/70 blur-[1px]"/><span className="absolute right-[10%] top-[24%] h-11 w-24 rounded-full bg-white/60 blur-[1px]"/><div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-700/35 to-transparent"/></div>
    <div className="absolute inset-x-0 bottom-0 h-[54%] bg-[radial-gradient(ellipse_at_50%_0%,rgba(154,236,255,.75),transparent_40%),linear-gradient(180deg,#26b7dc_0%,#0882b8_35%,#04618e_68%,#033f66_100%)]"/>
    <div className="animal-caustics absolute inset-x-0 bottom-0 h-[54%] opacity-35"/>
    {Array.from({length:12}).map((_,i)=><span key={i} className="animal-bubble absolute bottom-[8%] h-3 w-3 rounded-full border-2 border-white/50 bg-white/10" style={{left:`${8+(i*7)%84}%`,animationDelay:`${-(i%6)*.7}s`,animationDuration:`${4+(i%4)*.8}s`}}/>)}

    <button ref={poolRef} type="button" data-water-zone onClick={()=>selected&&dropAnimal(selected)} onMouseEnter={startPoolDwell} onMouseLeave={stopDwell} disabled={!selected||status!=="choose"} style={{touchAction:"none"}} className={`absolute inset-x-[3%] bottom-[3%] h-[55%] overflow-hidden rounded-[44%_44%_20%_20%/18%_18%_10%_10%] border-[7px] border-white/75 bg-transparent shadow-[inset_0_8px_30px_rgba(255,255,255,.24),0_20px_55px_rgba(3,105,161,.36)] focus:outline-none focus:ring-8 focus:ring-amber-300 disabled:cursor-default ${drag?"ring-8 ring-sky-200/80":""}`} aria-label={selected?`Put the ${selected.name} in the water`:"Water"}>
      <div className="animal-water-surface absolute inset-x-[-8%] top-[1%] h-12 rounded-[50%] border-t-[5px] border-white/65 bg-gradient-to-b from-white/45 via-cyan-100/25 to-transparent"/>
      <div className="animal-water-wave absolute inset-x-[-5%] top-[9%] h-7 rounded-[50%] border-t-4 border-white/35"/>
      <div className="animal-water-wave animal-water-wave-2 absolute inset-x-[5%] top-[21%] h-6 rounded-[50%] border-t-4 border-cyan-50/25"/>
      {!activeAnimal&&<div className="absolute inset-0 grid place-items-center p-5"><div className="rounded-[1.7rem] border-2 border-white/75 bg-white/88 px-5 py-4 text-center text-sky-950 shadow-xl backdrop-blur"><Waves className="mx-auto h-11 w-11"/><p className="mt-1 text-xl font-black sm:text-2xl">{selected?`Put the ${selected.name} in!`:"Pick an animal first"}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wider">Drag here · tap water · or gaze</p></div></div>}
      {activeAnimal&&<div className={`animal-in-water absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 ${status==="splash"?"animal-splash-enter":""}`}><img src={activeAnimal.image} alt={`Real ${activeAnimal.name} in the water`} className="h-44 w-44 rounded-[2rem] border-4 border-white object-cover shadow-2xl sm:h-52 sm:w-52"/><div className="animal-ripple absolute inset-x-[-42px] bottom-[-15px] h-10 rounded-[50%] border-4 border-white/55 bg-white/14"/></div>}
      {status==="splash"&&<><div className="animal-splash-ring absolute left-1/2 top-[55%] h-24 w-52 -translate-x-1/2 rounded-[50%] border-[9px] border-white/80"/>{Array.from({length:14}).map((_,i)=><span key={i} className="animal-droplet absolute left-1/2 top-[48%] h-3 w-3 rounded-full bg-white/90" style={{transform:`rotate(${i*25.7}deg) translateY(-70px)`}}/>)}</>}
    </button>

    {activeAnimal&&["asking","listening"].includes(status)&&<div className="absolute inset-x-3 top-3 z-20 rounded-[1.8rem] border-4 border-white bg-white/96 p-4 text-center shadow-2xl sm:inset-x-5 sm:top-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-sky-700">Say it out loud</p><h2 className="mt-1 text-3xl font-black">What animal is it?</h2><div className="mt-3 grid grid-cols-3 gap-2">{answerChoices.map(answer=><button key={answer} type="button" onClick={()=>chooseAnswer(answer)} className="min-h-16 rounded-2xl border-4 border-slate-200 bg-slate-50 px-2 text-base font-black capitalize focus:ring-8 focus:ring-sky-300 sm:text-lg">{answer}</button>)}</div>{!micAvailable&&<p className="mt-2 text-xs font-bold text-slate-500">Voice listening is unavailable in this browser, so the big buttons stay available.</p>}</div>}
   </div>
  </section>

  <details className="mx-auto mb-6 max-w-[1500px] px-4 text-xs text-slate-600"><summary className="cursor-pointer font-bold">Photo & sound sources</summary><div className="mt-2 rounded-xl bg-white/80 p-3"><p>Real animal photographs are served from Wikimedia Commons. Splash audio uses the public-domain water recording from Wikimedia Commons/PDSounds.</p><ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{ANIMALS.map(a=><li key={a.id}>{a.credit}</li>)}</ul></div></details>

  <style>{`
   .animal-caustics{background:repeating-radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.28) 0 1px,transparent 2px 26px);animation:animalCaustics 9s linear infinite}
   .animal-water-surface{animation:animalSurface 2.6s ease-in-out infinite alternate}
   .animal-water-wave{animation:animalWave 2.1s ease-in-out infinite alternate}.animal-water-wave-2{animation-delay:-1.1s;animation-duration:2.8s}
   .animal-bubble{animation:animalBubble linear infinite}.animal-ripple{animation:animalRipple 2s ease-out infinite}
   .animal-splash-enter{animation:animalDrop .82s cubic-bezier(.2,.85,.2,1) both}.animal-splash-ring{animation:animalRing .95s ease-out both}.animal-droplet{animation:animalDroplet .72s ease-out both}
   .animal-party-balloon{animation:animalBalloon linear forwards}.animal-party-confetti{animation:animalConfetti linear forwards}.animal-party-burst{animation:animalBurst .5s cubic-bezier(.2,1.2,.3,1) both}
   @keyframes animalSurface{from{transform:translateX(-3%) scaleX(.95)}to{transform:translateX(3%) scaleX(1.05)}}
   @keyframes animalWave{from{transform:translateX(-5%) scaleX(.94)}to{transform:translateX(5%) scaleX(1.08)}}
   @keyframes animalCaustics{from{background-position:0 0}to{background-position:180px 120px}}
   @keyframes animalBubble{0%{transform:translateY(25px) scale(.55);opacity:0}15%{opacity:.7}100%{transform:translateY(-270px) scale(1.15);opacity:0}}
   @keyframes animalRipple{0%{transform:scale(.55);opacity:.85}100%{transform:scale(1.65);opacity:0}}
   @keyframes animalDrop{0%{transform:translate(-50%,-145%) scale(.72) rotate(-7deg);opacity:.35}58%{transform:translate(-50%,-37%) scale(1.08) rotate(3deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}}
   @keyframes animalRing{0%{transform:translateX(-50%) scale(.25);opacity:1}100%{transform:translateX(-50%) scale(1.9);opacity:0}}
   @keyframes animalDroplet{0%{opacity:1;margin-top:0}100%{opacity:0;margin-top:-90px}}
   @keyframes animalBalloon{0%{transform:translateY(0) rotate(-5deg)}100%{transform:translateY(-120vh) rotate(9deg)}}
   @keyframes animalConfetti{0%{transform:translateY(-30px) rotate(0)}100%{transform:translateY(115vh) rotate(760deg)}}
   @keyframes animalBurst{0%{transform:translate(-50%,-25px) scale(.2) rotate(-4deg);opacity:0}75%{transform:translate(-50%,0) scale(1.1) rotate(2deg);opacity:1}100%{transform:translate(-50%,0) scale(1) rotate(0)}}
   @media(max-width:820px){.animal-splash-game{touch-action:pan-y}.animal-splash-game button[style*="touch-action"]{touch-action:none!important}.animal-splash-game section{align-items:start}}
   @media(prefers-reduced-motion:reduce){.animal-caustics,.animal-water-surface,.animal-water-wave,.animal-bubble,.animal-ripple,.animal-splash-enter,.animal-splash-ring,.animal-droplet,.animal-party-balloon,.animal-party-confetti,.animal-party-burst{animation:none!important}}
  `}</style>
 </main>;
}
