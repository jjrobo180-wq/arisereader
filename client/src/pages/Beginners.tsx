import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent, type WheelEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Award, Bookmark, BookOpen, Check, ChevronRight,
  Compass, Gift, Headphones, Home, Loader2, Pause, Play, RotateCcw, Search,
  Sparkles, Star, Target, Trophy, Volume2, X
} from "lucide-react";

type Category = "Sports" | "Music" | "Creators" | "Gaming" | "Style" | "Culture";
type Slide = { heading: string; text: string; focus: string[]; instruction: string };
type Question = { prompt: string; choices: [string,string,string] };
type Lesson = {
  id: string; title: string; category: Category; skill: string; level: 1|2|3;
  points: number; duration: number; hook: string; subject: string; imageFile: string;
  accent: string; slides: Slide[]; questions: Question[];
};
type Attempt = { bestScore:number;lastScore:number;attempts:number;passedAt:string|null };
type State = {progress:Record<string,Attempt>;saved:string[];completed:number;beginnerPoints:number};
type Result = {passed:boolean;score:number;correct:number;total:number;firstPass:boolean;earned:number;review:{correct:number;wasCorrect:boolean;hint:string}[]}&Pick<State,"progress"|"completed"|"beginnerPoints">;
type Tab = "feed" | "explore" | "saved" | "rewards" | "progress";
const CATEGORIES: Array<"All"|Category> = ["All","Sports","Music","Creators","Gaming","Style","Culture"];
const NAV: { id:Tab; label:string;icon:any }[] = [
  {id:"feed",label:"For You",icon:Home},{id:"explore",label:"Explore",icon:Compass},
  {id:"saved",label:"Saved",icon:Bookmark},{id:"rewards",label:"Rewards",icon:Gift},
  {id:"progress",label:"My Progress",icon:Target}
];
const PHOTO = (name:string) => name
  ? "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + encodeURIComponent(name) + "?width=900"
  : "";
const EMPTY: State = {progress:{},saved:[],completed:0,beginnerPoints:0};
function LessonArt({lesson, className="", children}: {lesson:Lesson;className?:string;children?:ReactNode}) {
  const [broken,setBroken] = useState(false);
  useEffect(()=>setBroken(false),[lesson.id]);
  return <div className={"relative overflow-hidden bg-[#141625] " + className}
    style={{backgroundImage:"radial-gradient(ellipse at 55% 25%, " + lesson.accent + "88, #151526 55%, #070810 100%)"}}>
    {lesson.imageFile && !broken && <img alt={lesson.subject} src={PHOTO(lesson.imageFile)} onError={()=>setBroken(true)}
      className="absolute inset-0 h-full w-full object-cover opacity-90" loading="lazy"/>}
    <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-[#080911]"/>
    <div className="relative z-10 h-full">{children}</div>
  </div>;
}
function readAloud(text:string) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.rate = .78; speech.pitch = 1; window.speechSynthesis.speak(speech);
  return true;
}
function TextWithAudio({text}: {text:string}) {
  return <div className="space-y-4"><p className="text-xl sm:text-2xl leading-relaxed font-medium tracking-wide">{text}</p>
    <button type="button" onClick={()=>readAloud(text)}
      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
      <Volume2 size={17}/> Listen to the passage
    </button></div>;
}
export default function Beginners() {
  const [,navigate] = useLocation();
  const {user,token} = useAuth();
  const [lessons,setLessons] = useState<Lesson[]>([]);
  const [data,setData] = useState<State>(EMPTY);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState("");
  const [tab,setTab] = useState<Tab>("feed");
  const [category,setCategory] = useState<"All"|Category>("All");
  const [index,setIndex] = useState(0);
  const [search,setSearch] = useState("");
  const [active,setActive] = useState<Lesson|null>(null);
  const [step,setStep] = useState(0);
  const [choice,setChoice] = useState<number|null>(null);
  const [answers,setAnswers] = useState<number[]>([]);
  const [feedback,setFeedback] = useState("");
  const [result,setResult] = useState<Result|null>(null);
  const [submitting,setSubmitting] = useState(false);
  const [savedBusy,setSavedBusy] = useState(false);
  const [audioPlaying,setAudioPlaying] = useState(false);
  const lastMove = useRef(0);
  const touchY = useRef<number|null>(null);
  const speechStop = useCallback(()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();setAudioPlaying(false)},[]);
  const authHeaders = useMemo(()=>({Authorization:"Bearer " + (token||"")}),[token]);
  const load = useCallback(async()=>{
    if(!token)return;
    setLoading(true);setLoadError("");
    try{
      const responses = await Promise.all([
        fetch(API_BASE + "/api/beginners/catalog",{headers:authHeaders}),
        fetch(API_BASE + "/api/beginners/state",{headers:authHeaders})
      ]);
      if(responses.some(r=>!r.ok)) throw Error("We couldn't load your lessons. Please try again.");
      const [catalog,state] = await Promise.all(responses.map(r=>r.json()));
      setLessons(Array.isArray(catalog.lessons)?catalog.lessons:[]);
      setData(state);
    }catch(e:any){setLoadError(e?.message||"Couldn't load lessons.");}
    finally{setLoading(false)}
  },[token,authHeaders]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel()},[]);
  const list = useMemo(()=>lessons.filter(l=>(category==="All"||l.category===category)),[lessons,category]);
  const current = list[Math.min(index,Math.max(0,list.length-1))]||null;
  useEffect(()=>{setIndex(0)},[category]);
  const move = useCallback((direction:number)=>{
    if(active||tab!=="feed"||!list.length)return;
    const now=Date.now();if(now-lastMove.current<450)return;lastMove.current=now;
    setIndex(i=>(i+direction+list.length)%list.length);speechStop();
  },[active,tab,list,speechStop]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(active||tab!=="feed"||["INPUT","TEXTAREA","SELECT"].includes((e.target as HTMLElement)?.tagName))return;
      if(e.key==="ArrowDown"){e.preventDefault();move(1)}
      if(e.key==="ArrowUp"){e.preventDefault();move(-1)}
    };window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[move,active,tab]);
  const onWheel=(e:WheelEvent)=>{if(active||tab!=="feed")return;if(Math.abs(e.deltaY)>12)move(e.deltaY>0?1:-1)};
  const onTouchStart=(e:TouchEvent)=>{touchY.current=e.touches[0]?.clientY??null};
  const onTouchEnd=(e:TouchEvent)=>{if(touchY.current===null)return;
    const delta=touchY.current-(e.changedTouches[0]?.clientY??touchY.current);touchY.current=null;
    if(Math.abs(delta)>65)move(delta>0?1:-1);
  };
  function start(lesson:Lesson){speechStop();setActive(lesson);setStep(0);setChoice(null);setAnswers([]);setFeedback("");setResult(null)}
  function exit(){speechStop();setActive(null);setResult(null);setChoice(null)}
  async function save(lesson:Lesson) {
    if(savedBusy)return;setSavedBusy(true);
    const yes=!data.saved.includes(lesson.id);
    try{
      const res=await fetch(API_BASE+"/api/beginners/save",{method:"POST",
        headers:{...authHeaders,"Content-Type":"application/json"},
        body:JSON.stringify({lessonId:lesson.id,saved:yes})});
      if(!res.ok)throw Error("Couldn't save this lesson.");
      const body=await res.json();setData(s=>({...s,saved:body.saved}));
    }catch(e:any){setLoadError(e?.message||"Save failed.");}finally{setSavedBusy(false)}
  }
  async function submit(finalAnswers:number[]) {
    if(!active||submitting)return;
    setSubmitting(true);setFeedback("");
    try{
      const res=await fetch(API_BASE+"/api/beginners/attempt",{method:"POST",
        headers:{...authHeaders,"Content-Type":"application/json"},body:JSON.stringify({lessonId:active.id,answers:finalAnswers})});
      const body=await res.json();
      if(!res.ok)throw Error(body.message||"Unable to save your answers.");
      setResult(body);setData(s=>({...s,progress:body.progress,completed:body.completed,beginnerPoints:body.beginnerPoints}));
      setStep(active.slides.length+active.questions.length);
      window.dispatchEvent(new CustomEvent("arise:beginners-progress-updated"));
    }catch(e:any){setFeedback(e?.message||"Please retry saving your answers.");}
    finally{setSubmitting(false)}
  }
  async function nextStep() {
    if(!active||submitting)return;
    const slides=active.slides.length,qs=active.questions.length;
    if(result){exit();setTab("feed");return}
    if(step<slides){setStep(s=>s+1);setFeedback("");return}
    if(choice===null){setFeedback("Choose one answer to continue.");return}
    const nextAnswers=[...answers,choice];
    setAnswers(nextAnswers);setChoice(null);setFeedback("");
    if(nextAnswers.length===qs)await submit(nextAnswers);
    else setStep(s=>s+1);
  }
  const isStudent=user?.role==="student"&&!user?.isAdmin;
  const completedPercent=Math.min(100,Math.round(data.completed/Math.max(1,lessons.length)*100));
  const returnToReader=()=>navigate(isStudent?"/library":"/reader");
  const savedLessons=lessons.filter(l=>data.saved.includes(l.id));
  const searched=lessons.filter(l=>(category==="All"||l.category===category)&&
    [l.title,l.skill,l.subject,l.category].join(" ").toLowerCase().includes(search.toLowerCase()));
  const selectView=(v:Tab)=>{speechStop();setTab(v);setLoadError("")};
  return <div className="min-h-[100dvh] bg-[#080a11] text-white" style={{fontFamily:"Inter, ui-sans-serif, system-ui"}}>
    <header className="sticky top-0 z-20 flex h-[66px] items-center justify-between border-b border-white/10 bg-[#0d0f18]/95 px-4 backdrop-blur-lg sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={returnToReader} aria-label="Back to A.R.I.S.E. Reader" className="rounded-lg p-2 text-zinc-300 hover:bg-white/10"><ArrowLeft size={19}/></button>
        <div><div className="text-base font-black tracking-tight sm:text-lg">A.R.I.S.E. <span className="text-fuchsia-400">BEGINNERS</span></div><div className="hidden text-[10px] font-bold uppercase tracking-[.22em] text-zinc-400 sm:block">Discover. Decode. Earn.</div></div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3"><span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-extrabold text-fuchsia-200">★ {data.beginnerPoints} pts</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-600 font-black">{(user?.displayName||"R").charAt(0).toUpperCase()}</span>
      </div>
    </header>
    {loadError && <div role="alert" className="mx-auto mt-3 flex max-w-4xl items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/70 p-3 text-sm text-rose-100"><span>{loadError}</span><button onClick={()=>load()} className="font-bold underline">Retry</button></div>}
    {loading?<div className="flex min-h-[65vh] items-center justify-center gap-3 text-zinc-300"><Loader2 className="animate-spin"/> Loading reading lessons...</div>:
    <div className="mx-auto grid max-w-[1450px] grid-cols-1 gap-4 px-3 pb-20 pt-4 md:grid-cols-[190px_minmax(0,1fr)] md:px-5 md:pb-6 lg:grid-cols-[205px_minmax(0,1fr)_250px]">
      <aside className="hidden md:block">
        <div className="sticky top-[85px] space-y-2">
          {NAV.map(n=><button key={n.id} type="button" onClick={()=>selectView(n.id)}
            className={"flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition "+
              (tab===n.id?"bg-fuchsia-600/20 text-fuchsia-200 ring-1 ring-fuchsia-500/25":"text-zinc-400 hover:bg-white/5 hover:text-white")}>
            <n.icon size={19}/>{n.label}
          </button>)}
          <div className="px-4 pt-5 text-[11px] font-black uppercase tracking-widest text-zinc-500">Explore topics</div>
          {CATEGORIES.slice(1).map(c=><button key={c} type="button" onClick={()=>{setCategory(c);selectView("feed")}} className="block w-full rounded-lg px-4 py-2 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-white">{c}</button>)}
          <button type="button" onClick={returnToReader} className="mt-5 flex items-center gap-2 px-4 text-xs font-bold text-zinc-500 hover:text-zinc-200"><BookOpen size={15}/> A.R.I.S.E. Reader</button>
        </div>
      </aside>
      <main className="min-w-0">
        {tab==="feed"&&current?<div className="mx-auto max-w-[480px] space-y-3">
          <div className="flex items-center justify-between px-1"><h1 className="text-sm font-black">For You <Sparkles className="inline text-fuchsia-400" size={16}/></h1><span className="text-xs text-zinc-500">{index+1} / {list.length} lessons</span></div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(c=><button key={c} onClick={()=>setCategory(c)} type="button"
              className={"shrink-0 rounded-full px-3 py-1.5 text-xs font-bold "+(category===c?"bg-fuchsia-600 text-white":"bg-white/10 text-zinc-300 hover:bg-white/20")}>{c}</button>)}
          </div>
          <div onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
            className="relative overflow-hidden rounded-[24px] border border-white/10 shadow-[0_25px_85px_rgba(0,0,0,.45)]">
            <LessonArt key={current.id} lesson={current} className="h-[min(66vh,610px)] min-h-[455px]">
              <div className="absolute inset-x-0 top-0 flex justify-between p-5">
                <span className="text-[11px] font-black uppercase tracking-[.23em] text-white/90">ARISE ORIGINAL LESSON</span>
                <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold">{current.duration} min</span>
              </div>
              <div className="absolute bottom-0 left-0 right-14 space-y-3 p-5 pb-7">
                <div className="flex flex-wrap gap-2"><span className="rounded-full bg-fuchsia-500/80 px-3 py-1 text-[11px] font-black uppercase">{current.category}</span><span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold">LEVEL {current.level}</span></div>
                <h2 className="text-3xl font-black leading-[1.07] tracking-tight sm:text-4xl">{current.title}</h2>
                <p className="text-sm leading-relaxed text-zinc-100">{current.hook}</p>
                <div className="text-xs font-semibold text-fuchsia-100">{current.skill} · ★ {current.points} points</div>
                <button type="button" onClick={()=>start(current)} className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-3 font-black hover:bg-fuchsia-500"><Play size={16} fill="currentColor"/>{data.progress[current.id]?.passedAt?"Practice Again":"Start Lesson"}</button>
              </div>
              <div className="absolute bottom-24 right-3 flex flex-col gap-3">
                <button type="button" aria-label={data.saved.includes(current.id)?"Remove saved lesson":"Save lesson"}
                  onClick={()=>save(current)} disabled={savedBusy} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-lg hover:bg-black/70">
                  <Bookmark size={21} fill={data.saved.includes(current.id)?"white":"none"}/>
                </button>
                <button type="button" onClick={()=>move(-1)} aria-label="Previous lesson" className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-lg hover:bg-black/70"><ArrowUp/></button>
                <button type="button" onClick={()=>move(1)} aria-label="Next lesson" className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-lg hover:bg-black/70"><ArrowDown/></button>
              </div>
            </LessonArt>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500"><ArrowUp size={13}/><ArrowDown size={13}/> Scroll or swipe to discover lessons. Points require passing the skill check.</div>
        </div>:null}
        {tab==="feed"&&!current?<div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">No lessons in this category yet. <button onClick={()=>setCategory("All")} className="text-fuchsia-300 underline">Show all</button></div>:null}
        {(tab==="explore"||tab==="saved")&&<div className="mx-auto max-w-4xl space-y-5">
          <div><h1 className="text-3xl font-black">{tab==="saved"?"Your saved lessons":"Explore reading lessons"}</h1><p className="mt-1 text-sm text-zinc-400">Pick what interests you. The lessons teach real reading skills.</p></div>
          {tab==="explore"&&<><label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4"><Search size={18} className="text-zinc-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sports, creators, music..." className="w-full bg-transparent py-3 outline-none placeholder:text-zinc-500"/></label>
            <div className="flex flex-wrap gap-2">{CATEGORIES.map(c=><button key={c} onClick={()=>setCategory(c)} className={"rounded-full px-3 py-2 text-xs font-bold "+(category===c?"bg-fuchsia-600":"bg-white/10")}>{c}</button>)}</div></>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{(tab==="saved"?savedLessons:searched).map(l=>
            <button key={l.id} onClick={()=>start(l)} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left hover:border-fuchsia-400/60">
              <LessonArt lesson={l} className="aspect-[4/5]"><div className="absolute bottom-3 left-3 right-3 text-sm font-black leading-tight">{l.title}</div></LessonArt>
              <div className="p-3"><div className="text-xs font-bold text-fuchsia-300">{l.category} · LEVEL {l.level}</div><div className="mt-1 text-xs text-zinc-400">{l.skill}</div><div className="mt-2 text-xs font-bold">★ {l.points} points {data.progress[l.id]?.passedAt?"· ✓ Passed":""}</div></div>
            </button>)}</div>
          {(tab==="saved"?savedLessons:searched).length===0&&<div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-zinc-300">{tab==="saved"?"Save lessons from the For You feed to collect them here.":"No matches. Try another category."}</div>}
        </div>}
        {tab==="progress"&&<div className="mx-auto max-w-3xl space-y-5">
          <div><h1 className="text-3xl font-black">Your reading journey</h1><p className="mt-1 text-sm text-zinc-400">Every lesson passed is a step forward.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat title="Lessons passed" value={String(data.completed)}/><Stat title="Beginners points" value={String(data.beginnerPoints)}/><Stat title="Lessons available" value={String(lessons.length)}/></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex justify-between"><span className="font-bold">My lesson progress</span><span className="text-fuchsia-300">{completedPercent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-fuchsia-500" style={{width:completedPercent+"%"}}/></div></div>
          <div className="space-y-2">{lessons.map(l=><button key={l.id} onClick={()=>start(l)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"><div><div className="font-bold">{l.title}</div><div className="text-xs text-zinc-400">{l.skill}{data.progress[l.id]?" · Best: "+data.progress[l.id].bestScore+"%":""}</div></div><span className={"shrink-0 text-xs font-bold "+(data.progress[l.id]?.passedAt?"text-emerald-400":"text-zinc-400")}>{data.progress[l.id]?.passedAt?"✓ Passed":"Start →"}</span></button>)}</div>
          <p className="text-xs leading-relaxed text-zinc-500">Lesson passes measure skill-check performance, not reading fluency or grade-equivalent reading level. Teachers should assess oral decoding and words-correct-per-minute separately.</p>
        </div>}
        {tab==="rewards"&&<div className="mx-auto max-w-3xl space-y-5"><div><h1 className="text-3xl font-black">Your reward journey</h1><p className="mt-1 text-sm text-zinc-400">Earn points by passing actual reading lessons.</p></div>
          <div className="rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-purple-900/90 to-[#181328] p-7"><div className="text-xs font-black uppercase tracking-widest text-fuchsia-200">Beginners balance</div><div className="mt-3 text-6xl font-black">{data.beginnerPoints} <span className="text-xl text-fuchsia-200">points</span></div><div className="mt-3 text-sm text-zinc-200">New points are awarded once per passed lesson. You can replay lessons without farming extra points.</div></div>
          <div className="grid gap-3 sm:grid-cols-3">{[["🍿","Snack goal",50],["🥤","Snack combo goal",150],["🎁","Gift card goal",300]].map(([icon,name,cost])=><div key={String(name)} className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-4xl">{icon}</div><div className="mt-3 font-bold">{name}</div><div className="text-xs text-zinc-400">{cost} points · Example prize target</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-fuchsia-500" style={{width:Math.min(100,data.beginnerPoints/Number(cost)*100)+"%"}}/></div></div>)}</div>
          <p className="rounded-xl border border-amber-400/20 bg-amber-950/20 p-4 text-sm text-amber-100">Prize redemption and transfer to regular A.R.I.S.E. Reader points are not yet enabled. These are separate, saved Beginners points; teachers must approve real rewards.</p>
        </div>}
      </main>
      <aside className="hidden lg:block"><div className="sticky top-[85px] space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xs font-black uppercase tracking-widest text-fuchsia-300">Your progress</div><div className="mt-4 text-4xl font-black">{data.completed}<span className="text-base font-normal text-zinc-500"> / {lessons.length}</span></div><div className="text-xs text-zinc-400">Reading lessons passed</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-fuchsia-500" style={{width:completedPercent+"%"}}/></div></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xs font-black uppercase tracking-widest text-fuchsia-300">Weekly motivation</div><div className="mt-3 text-lg font-black">Read. Learn. Grow.</div><p className="mt-2 text-xs leading-relaxed text-zinc-400">Choose topics that interest you. Finish a lesson and pass its five-question skill check.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xs font-black uppercase tracking-widest text-fuchsia-300">Rewards progress</div><div className="mt-3 text-3xl">🍿</div><div className="mt-2 text-sm font-bold">First snack goal</div><div className="mt-1 text-xs text-zinc-400">{Math.max(0,50-data.beginnerPoints)} points to 50</div></div>
        <button type="button" onClick={()=>selectView("progress")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-sm font-bold hover:bg-white/10">View progress <ArrowRight size={16}/></button>
      </div></aside>
    </div>}
    <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-white/10 bg-[#10111b]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      {NAV.map(n=><button key={n.id} onClick={()=>selectView(n.id)} className={"flex min-w-0 flex-1 flex-col items-center gap-1 py-3 text-[10px] font-bold "+(tab===n.id?"text-fuchsia-300":"text-zinc-400")}><n.icon size={19}/>{n.id==="progress"?"Progress":n.label}</button>)}
    </nav>
    {active&&<div className="fixed inset-0 z-50 overflow-y-auto bg-[#090a14] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-4 pb-8 pt-4 sm:px-8">
        <div className="flex items-center justify-between gap-3"><button type="button" onClick={exit} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"><X size={16}/> Exit lesson</button><span className="text-xs font-black uppercase tracking-widest text-fuchsia-300">A.R.I.S.E. BEGINNERS</span></div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-fuchsia-500" style={{width:Math.round((step+1)/(active.slides.length+active.questions.length+1)*100)+"%"}}/></div>
        <div className="mt-5 flex items-center gap-3"><LessonArt lesson={active} className="h-20 w-20 shrink-0 rounded-xl"/><div><div className="text-xs font-bold text-fuchsia-300">{active.category} · {active.skill}</div><div className="text-xl font-black sm:text-2xl">{active.title}</div></div></div>
        <div className="flex flex-1 flex-col justify-center py-7">
          {result?<div className="space-y-5 text-center"><div className="text-6xl">{result.passed?"🏆":"💪"}</div><h2 className="text-3xl font-black">{result.passed?"You passed!":"Keep building your skills"}</h2><div className="text-6xl font-black text-fuchsia-300">{result.score}%</div><p className="text-zinc-300">{result.correct} out of {result.total} correct · {result.passed?"Great reading work!":"80% is needed to pass."}</p>
            <p className="text-sm font-bold">{result.firstPass?"+"+result.earned+" Beginners points earned":result.passed?"You already earned the points for this lesson.":"Reread the lesson and try again."}</p>
            <div className="space-y-2 text-left">{result.review.map((entry,i)=><div key={i} className="rounded-xl bg-white/5 p-3 text-sm"><span className={entry.wasCorrect?"text-emerald-400":"text-amber-300"}>{entry.wasCorrect?"✓":"Review"} Question {i+1}</span>{!entry.wasCorrect&&<div className="mt-1 text-zinc-300">Correct answer: {active.questions[i].choices[entry.correct]}. {entry.hint}</div>}</div>)}</div>
          </div>:step<active.slides.length?(()=>{
            const slide=active.slides[step];return <div className="space-y-6"><div className="text-xs font-black uppercase tracking-[.2em] text-fuchsia-300">Lesson {step+1} of {active.slides.length} · Learn</div><h2 className="text-3xl font-black sm:text-4xl">{slide.heading}</h2>
              <TextWithAudio text={slide.text}/><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xs font-black uppercase tracking-widest text-zinc-400">Decode the words</div><div className="mt-4 flex flex-wrap gap-3">{slide.focus.map(w=><button key={w} type="button" onClick={()=>readAloud(w)} className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-3 text-xl font-extrabold tracking-wider hover:bg-fuchsia-500/20">{w} <Volume2 size={13} className="ml-1 inline"/></button>)}</div><p className="mt-4 text-sm leading-relaxed text-zinc-400">{slide.instruction}</p></div></div>
          })():<div className="space-y-6"><div className="text-xs font-black uppercase tracking-[.2em] text-fuchsia-300">Skill Check · Question {step-active.slides.length+1} of {active.questions.length}</div><h2 className="text-3xl font-black sm:text-4xl">{active.questions[step-active.slides.length].prompt}</h2><div className="space-y-3">{active.questions[step-active.slides.length].choices.map((option,i)=><button key={i} type="button" onClick={()=>{setChoice(i);setFeedback("")}} className={"flex w-full items-center gap-4 rounded-2xl border p-5 text-left text-lg font-semibold transition "+(choice===i?"border-fuchsia-400 bg-fuchsia-500/20":"border-white/10 bg-white/5 hover:bg-white/10")}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">{String.fromCharCode(65+i)}</span>{option}</button>)}</div></div>}
          {feedback&&<div role="alert" className="mt-5 rounded-xl border border-amber-400/30 bg-amber-950/30 p-4 text-sm text-amber-100">{feedback}</div>}
        </div>
        <div className="sticky bottom-0 border-t border-white/10 bg-[#090a14] py-4">
          <button type="button" onClick={result?exit:nextStep} disabled={submitting||(!isStudent&&step>=active.slides.length)}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-fuchsia-600 px-5 py-4 text-base font-black hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting?<><Loader2 className="animate-spin" size={19}/> Saving results...</>:result?"Return to lessons":step===active.slides.length+active.questions.length-1?"Submit skill check":step===active.slides.length-1?"Start skill check":step<active.slides.length?"Next part":"Next question"} <ArrowRight size={19}/>
          </button>
          {!isStudent&&<p className="mt-2 text-center text-xs text-zinc-400">Teacher preview: sign in as a student to submit assessments and earn points.</p>}
        </div>
      </div>
    </div>}
  </div>;
}
function Stat({title,value}:{title:string;value:string}){return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xs text-zinc-400">{title}</div><div className="mt-2 text-3xl font-black">{value}</div></div>}
