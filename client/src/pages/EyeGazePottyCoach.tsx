import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Play, RotateCcw, ShieldAlert, TimerReset } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type LogKind="sit"|"pee"|"poop"|"accident"|"dry"|"refused";
type PottyLog={id:string;kind:LogKind;at:string;note:string};
type PottyPlan={checkMinutes:number;sitMinutes:number;observeFirst:boolean;visualSchedule:boolean};
type PottyState={plan:PottyPlan;logs:PottyLog[]};
type Tab="today"|"plan"|"coach"|"media";

const defaultState:PottyState={plan:{checkMinutes:45,sitMinutes:2,observeFirst:true,visualSchedule:true},logs:[]};
const visualSteps=[
  {emoji:"🚶",title:"Go to bathroom",say:"Let's go to the bathroom."},
  {emoji:"👖",title:"Pants down",say:"Pants down."},
  {emoji:"🚽",title:"Sit on potty",say:"Sit on the potty."},
  {emoji:"💧",title:"Pee or poop",say:"Pee and poop go in the potty."},
  {emoji:"🧻",title:"Wipe",say:"Wipe when you are done."},
  {emoji:"🚽",title:"Flush",say:"Flush the toilet."},
  {emoji:"🧼",title:"Wash hands",say:"Wash your hands."},
  {emoji:"⭐",title:"All done",say:"All done. Nice job doing the steps."},
];

const media=[
  {title:"Daniel Tiger: Stop and Go Potty",source:"PBS KIDS",emoji:"🐯",url:"https://pbskids.org/videos/watch/stop-and-go-potty/2232079",why:"A short routine song about stopping play, using the potty, flushing, and washing."},
  {title:"Sitting On The Potty",source:"Super Simple Songs",emoji:"🎵",url:"https://www.youtube.com/watch?v=_RQFMyof650",why:"Simple repetition for sitting and stopping play when the body says it is time."},
  {title:"Daniel Tiger Stop & Go Potty app",source:"PBS KIDS",emoji:"📱",url:"https://m.pbskids.org/apps/daniel-tigers-stop--go-potty.html",why:"Practice bathroom routines through play, including potty, wiping, flushing, and handwashing."},
];

function speak(text:string){
  stopSpeaking();
  void speakCharacterAI(text,{calmMode:true,onFallback:()=>{
    if(!("speechSynthesis" in window))return;
    const utterance=new SpeechSynthesisUtterance(text);utterance.rate=.82;window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
  }});
}

function localDate(iso:string){return new Date(iso).toLocaleDateString();}
function dayKey(date=new Date()){return date.toLocaleDateString();}

export default function EyeGazePottyCoach(){
  const {token,user}=useAuth();
  const [,navigate]=useLocation();
  const [state,setState]=useState<PottyState>(defaultState);
  const [studentName,setStudentName]=useState("your child");
  const [tab,setTab]=useState<Tab>("today");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [note,setNote]=useState("");
  const [nextCheckAt,setNextCheckAt]=useState<number|null>(null);
  const [sitEndsAt,setSitEndsAt]=useState<number|null>(null);
  const [,tick]=useState(0);
  const [readiness,setReadiness]=useState<boolean[]>(()=>Array(6).fill(false));
  const mounted=useRef(true);

  useEffect(()=>{
    mounted.current=true;
    if(!token)return()=>{mounted.current=false;};
    fetch(API_BASE+"/api/eye-gaze/potty",{headers:{Authorization:"Bearer "+token},cache:"no-store"})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||"Could not load potty tracker.");return d;})
      .then(data=>{if(!mounted.current)return;setStudentName(data.student?.name||"your child");setState({plan:data.plan||defaultState.plan,logs:Array.isArray(data.logs)?data.logs:[]});})
      .catch(error=>setMessage(error.message||"Could not load potty tracker."));
    return()=>{mounted.current=false;stopSpeaking();};
  },[token]);

  useEffect(()=>{const id=window.setInterval(()=>tick(v=>v+1),1000);return()=>window.clearInterval(id);},[]);

  const persist=async(next:PottyState)=>{
    setState(next);
    if(!token)return;
    setSaving(true);setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/eye-gaze/potty",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(next)});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.message||"Could not save potty tracker.");
      if(mounted.current)setState({plan:data.plan||next.plan,logs:Array.isArray(data.logs)?data.logs:next.logs});
    }catch(error:any){setMessage(error.message||"Could not save potty tracker.");}
    finally{setSaving(false);}
  };

  const addLog=(kind:LogKind)=>{
    const entry:PottyLog={id:"potty-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),kind,at:new Date().toISOString(),note:note.trim().slice(0,180)};
    const next={...state,logs:[...state.logs.slice(-499),entry]};
    setNote("");
    void persist(next);
    if(kind==="pee"||kind==="poop")speak("Nice job using the potty.");
    if(kind==="accident")speak("Accidents happen. We can try again next time.");
  };

  const today=state.logs.filter(entry=>localDate(entry.at)===dayKey());
  const success=today.filter(entry=>entry.kind==="pee"||entry.kind==="poop").length;
  const sits=today.filter(entry=>entry.kind==="sit").length;
  const accidents=today.filter(entry=>entry.kind==="accident").length;

  const insight=useMemo(()=>{
    const successes=state.logs.filter(entry=>entry.kind==="pee"||entry.kind==="poop");
    if(successes.length<3)return "Log a few potty successes and A.R.I.S.E. will look for useful time-of-day patterns.";
    const buckets=new Map<number,number>();
    successes.forEach(entry=>{const h=new Date(entry.at).getHours();buckets.set(h,(buckets.get(h)||0)+1);});
    const best=[...buckets.entries()].sort((a,b)=>b[1]-a[1])[0];
    if(!best)return "Keep logging to reveal patterns.";
    const start=new Date();start.setHours(best[0],0,0,0);
    const end=new Date(start.getTime()+60*60*1000);
    return "Most logged successes happen around "+start.toLocaleTimeString([], {hour:"numeric"})+"–"+end.toLocaleTimeString([], {hour:"numeric"})+". Consider offering a calm potty opportunity near that window.";
  },[state.logs]);

  const remaining=(end:number|null)=>{
    if(!end)return 0;
    return Math.max(0,Math.ceil((end-Date.now())/1000));
  };
  const fmt=(seconds:number)=>String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
  const nextRemaining=remaining(nextCheckAt);
  const sitRemaining=remaining(sitEndsAt);

  useEffect(()=>{
    if(nextCheckAt&&nextRemaining===0){setNextCheckAt(null);speak("Potty check. Calmly offer the bathroom now.");if(navigator.vibrate)navigator.vibrate([120,80,120]);}
  },[nextRemaining,nextCheckAt]);
  useEffect(()=>{
    if(sitEndsAt&&sitRemaining===0){setSitEndsAt(null);speak("Potty sit is finished. Nice job trying.");if(navigator.vibrate)navigator.vibrate(120);}
  },[sitRemaining,sitEndsAt]);

  const readinessItems=[
    "Stays dry for stretches or after naps",
    "Shows body signals before pee or poop",
    "Can follow a simple one-step direction",
    "Can get to the bathroom with help",
    "Can help with pants up and down",
    "Shows interest in the potty or being changed",
  ];

  return <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b shadow-sm">
      <div className="max-w-6xl mx-auto p-3 sm:p-4 flex items-center gap-3">
        <button onClick={()=>navigate(user?.role==="parent"?"/parent-dashboard":"/eye-gaze-parent")} className="min-h-14 rounded-2xl bg-[#ffd766] border-4 border-[#193d57] px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> BACK</button>
        <div className="flex-1"><p className="text-xs font-black tracking-widest text-teal-700">A.R.I.S.E. FAMILY TOOLS</p><h1 className="text-xl sm:text-3xl font-black">Potty Coach & Tracker 🚽</h1></div>
        {saving&&<span className="text-xs font-black text-slate-500">Saving…</span>}
      </div>
    </header>

    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-cyan-100 via-white to-amber-50 border-2 border-cyan-100 p-5 sm:p-7">
        <p className="text-sm font-black text-teal-700">FOR {studentName.toUpperCase()}</p>
        <h2 className="text-3xl sm:text-5xl font-black mt-1">Teach the skill. Track the pattern. Keep it positive.</h2>
        <p className="font-bold text-slate-600 mt-3 max-w-4xl">Built around pediatric guidance: watch for readiness, keep routines predictable, use visual supports, stay calm about accidents, and address constipation or pain instead of pushing through it.</p>
      </section>

      <nav className="mt-5 grid grid-cols-4 gap-2 bg-white rounded-3xl border-2 p-2">
        {([["today","📅","Today"],["plan","⏱️","Plan"],["coach","🧠","Parent Coach"],["media","🎵","Songs & Videos"]] as const).map(([id,icon,label])=><button key={id} onClick={()=>setTab(id)} className={"min-h-16 rounded-2xl font-black text-sm sm:text-base "+(tab===id?"bg-teal-700 text-white":"bg-slate-50 text-slate-700")}><span className="block text-xl">{icon}</span>{label}</button>)}
      </nav>

      {message&&<p className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3 font-bold">{message}</p>}

      {tab==="today"&&<div className="mt-5 space-y-5">
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-3xl bg-white border-2 border-emerald-100 p-4 text-center"><div className="text-4xl font-black text-emerald-600">{success}</div><div className="font-black text-sm">Potty successes</div></div>
          <div className="rounded-3xl bg-white border-2 border-sky-100 p-4 text-center"><div className="text-4xl font-black text-sky-600">{sits}</div><div className="font-black text-sm">Practice sits</div></div>
          <div className="rounded-3xl bg-white border-2 border-amber-100 p-4 text-center"><div className="text-4xl font-black text-amber-600">{accidents}</div><div className="font-black text-sm">Accidents</div></div>
        </section>

        <section className="rounded-[2rem] bg-white border-2 border-teal-100 p-5 sm:p-6">
          <h3 className="text-2xl font-black">Quick log</h3>
          <p className="font-bold text-slate-600 mt-1">Track what actually happens. Accidents are data—not misbehavior.</p>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note: after breakfast, dry diaper, signs of holding…" className="mt-4 w-full min-h-12 rounded-2xl border-2 border-slate-200 px-4 font-bold"/>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            <button onClick={()=>addLog("sit")} className="min-h-24 rounded-3xl bg-sky-50 border-2 border-sky-200 font-black text-lg">🪑 Sat / tried</button>
            <button onClick={()=>addLog("pee")} className="min-h-24 rounded-3xl bg-emerald-50 border-2 border-emerald-200 font-black text-lg">💧 Pee in potty</button>
            <button onClick={()=>addLog("poop")} className="min-h-24 rounded-3xl bg-emerald-50 border-2 border-emerald-200 font-black text-lg">💩 Poop in potty</button>
            <button onClick={()=>addLog("dry")} className="min-h-24 rounded-3xl bg-cyan-50 border-2 border-cyan-200 font-black text-lg">☀️ Dry check</button>
            <button onClick={()=>addLog("accident")} className="min-h-24 rounded-3xl bg-amber-50 border-2 border-amber-200 font-black text-lg">🧺 Accident</button>
            <button onClick={()=>addLog("refused")} className="min-h-24 rounded-3xl bg-violet-50 border-2 border-violet-200 font-black text-lg">🛑 Did not want to sit</button>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white border-2 border-violet-100 p-5 sm:p-6">
          <h3 className="text-2xl font-black">Pattern finder</h3>
          <p className="mt-2 text-lg font-bold text-slate-700">{insight}</p>
          <div className="mt-4 max-h-72 overflow-auto space-y-2">
            {[...state.logs].reverse().slice(0,30).map(entry=><div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">{entry.kind==="pee"?"💧":entry.kind==="poop"?"💩":entry.kind==="accident"?"🧺":entry.kind==="dry"?"☀️":entry.kind==="refused"?"🛑":"🪑"}</span>
              <div className="flex-1"><strong className="capitalize">{entry.kind}</strong><div className="text-xs font-bold text-slate-500">{new Date(entry.at).toLocaleString()}</div>{entry.note&&<p className="text-sm font-bold text-slate-600">{entry.note}</p>}</div>
            </div>)}
          </div>
        </section>
      </div>}

      {tab==="plan"&&<div className="mt-5 grid lg:grid-cols-2 gap-5">
        <section className="rounded-[2rem] bg-white border-2 border-cyan-100 p-5 sm:p-6">
          <div className="flex items-center gap-3"><Clock3 className="w-7 h-7 text-cyan-600"/><h3 className="text-2xl font-black">Next potty check</h3></div>
          <p className="font-bold text-slate-600 mt-2">A reminder to calmly offer the bathroom. Adjust the interval from your child's real patterns—not from a rigid universal schedule.</p>
          <label className="block font-black mt-4">Reminder interval
            <select value={state.plan.checkMinutes} onChange={e=>void persist({...state,plan:{...state.plan,checkMinutes:Number(e.target.value)}})} className="mt-2 w-full min-h-14 rounded-2xl border-2 px-4 font-bold">
              {[20,30,45,60,90,120].map(value=><option key={value} value={value}>{value} minutes</option>)}
            </select>
          </label>
          <div className="mt-5 rounded-3xl bg-cyan-950 text-white p-6 text-center">
            <div className="text-5xl font-black tabular-nums">{nextCheckAt?fmt(nextRemaining):"--:--"}</div>
            <p className="font-bold text-cyan-100 mt-2">{nextCheckAt?"Next calm potty check":"Timer is not running"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={()=>setNextCheckAt(Date.now()+state.plan.checkMinutes*60000)} className="min-h-14 rounded-2xl bg-cyan-600 text-white font-black flex items-center justify-center gap-2"><Play className="w-5 h-5"/> Start</button>
            <button onClick={()=>setNextCheckAt(null)} className="min-h-14 rounded-2xl bg-slate-100 font-black flex items-center justify-center gap-2"><RotateCcw className="w-5 h-5"/> Stop</button>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white border-2 border-amber-100 p-5 sm:p-6">
          <div className="flex items-center gap-3"><TimerReset className="w-7 h-7 text-amber-600"/><h3 className="text-2xl font-black">Short sit timer</h3></div>
          <p className="font-bold text-slate-600 mt-2">Keep practice sits brief and predictable. Never force a child who is distressed.</p>
          <label className="block font-black mt-4">Sit time
            <select value={state.plan.sitMinutes} onChange={e=>void persist({...state,plan:{...state.plan,sitMinutes:Number(e.target.value)}})} className="mt-2 w-full min-h-14 rounded-2xl border-2 px-4 font-bold">
              {[1,2,3,4,5].map(value=><option key={value} value={value}>{value} minute{value===1?"":"s"}</option>)}
            </select>
          </label>
          <div className="mt-5 rounded-3xl bg-amber-950 text-white p-6 text-center">
            <div className="text-5xl font-black tabular-nums">{sitEndsAt?fmt(sitRemaining):"--:--"}</div>
            <p className="font-bold text-amber-100 mt-2">{sitEndsAt?"Calm practice sit":"Ready when your child is comfortable"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={()=>{setSitEndsAt(Date.now()+state.plan.sitMinutes*60000);addLog("sit");speak("Potty time. Sit calmly. You are safe.");}} className="min-h-14 rounded-2xl bg-amber-500 text-amber-950 font-black">Start sit</button>
            <button onClick={()=>setSitEndsAt(null)} className="min-h-14 rounded-2xl bg-slate-100 font-black">End sit</button>
          </div>
        </section>

        <section className="lg:col-span-2 rounded-[2rem] bg-white border-2 border-emerald-100 p-5 sm:p-6">
          <h3 className="text-2xl font-black">Visual potty routine</h3>
          <p className="font-bold text-slate-600 mt-1">For many autistic children, pictures and consistent steps can be easier to follow than lots of talking.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {visualSteps.map((step,index)=><button key={step.title} onClick={()=>speak(step.say)} className="min-h-36 rounded-3xl bg-emerald-50 border-2 border-emerald-100 p-3 text-center">
              <span className="text-5xl">{step.emoji}</span><strong className="block mt-2">{index+1}. {step.title}</strong><span className="text-xs font-bold text-emerald-800">Tap to hear</span>
            </button>)}
          </div>
        </section>
      </div>}

      {tab==="coach"&&<div className="mt-5 space-y-5">
        <section className="rounded-[2rem] bg-white border-2 border-sky-100 p-5 sm:p-6">
          <h3 className="text-2xl font-black">1. Check readiness, not just age</h3>
          <p className="font-bold text-slate-600 mt-1">AAP guidance emphasizes body awareness, communication, movement, and ability to follow routines. Check what you are seeing now.</p>
          <div className="grid sm:grid-cols-2 gap-2 mt-4">{readinessItems.map((item,i)=><button key={item} onClick={()=>{const next=[...readiness];next[i]=!next[i];setReadiness(next);}} className={"min-h-16 rounded-2xl border-2 p-3 text-left font-black flex items-center gap-3 "+(readiness[i]?"bg-emerald-50 border-emerald-300":"bg-white border-slate-200")}><span className="text-2xl">{readiness[i]?"✅":"○"}</span>{item}</button>)}</div>
          <p className="mt-3 text-sm font-bold text-slate-500">This checklist is for planning, not a pass/fail test. Development can be uneven, especially for children with disabilities.</p>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <article className="rounded-3xl bg-white border-2 border-violet-100 p-5"><div className="text-4xl">👀</div><h3 className="text-xl font-black mt-2">Observe first</h3><p className="font-bold text-slate-600 mt-2">For several days, notice wet/dry times, poop times, body signals, meals, and transitions. Use those patterns to time potty opportunities.</p></article>
          <article className="rounded-3xl bg-white border-2 border-teal-100 p-5"><div className="text-4xl">🖼️</div><h3 className="text-xl font-black mt-2">Use visuals + same steps</h3><p className="font-bold text-slate-600 mt-2">Keep the sequence predictable. Picture steps can reduce language load and support autistic children who respond better to visual cues.</p></article>
          <article className="rounded-3xl bg-white border-2 border-amber-100 p-5"><div className="text-4xl">👏</div><h3 className="text-xl font-black mt-2">Praise the exact skill</h3><p className="font-bold text-slate-600 mt-2">Use calm, specific praise for cooperation and progress. Avoid shame, punishment, begging, or power struggles after accidents.</p></article>
        </section>

        <section className="rounded-[2rem] bg-rose-50 border-2 border-rose-200 p-5 sm:p-6">
          <div className="flex items-start gap-3"><ShieldAlert className="w-7 h-7 text-rose-600 flex-shrink-0"/><div>
            <h3 className="text-2xl font-black text-rose-950">Pain or constipation changes the plan</h3>
            <p className="font-bold text-rose-900 mt-2">Hard or painful stool, stool withholding, repeated soiling, blood, significant belly pain/swelling, vomiting, urinary symptoms, or a sudden major regression deserve medical attention. Do not turn painful toileting into a behavior battle.</p>
            <p className="text-sm font-bold text-rose-800 mt-2">This tracker is educational and does not diagnose or treat constipation, urinary problems, or other medical conditions.</p>
          </div></div>
        </section>

        <section className="rounded-[2rem] bg-white border-2 border-slate-200 p-5 sm:p-6">
          <h3 className="text-xl font-black">Evidence & parent reading</h3>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <a href="https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/Cognitive-and-Verbal-Skills-Needed-for-Toilet-Training.aspx" target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-sky-50 border p-4 font-black flex items-center justify-between">AAP: Potty training readiness <ExternalLink className="w-5 h-5"/></a>
            <a href="https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/Praise-and-Reward-Your-Childs-Success.aspx" target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-emerald-50 border p-4 font-black flex items-center justify-between">AAP: Keep potty training positive <ExternalLink className="w-5 h-5"/></a>
            <a href="https://www.healthychildren.org/English/health-issues/conditions/abdominal/Pages/constipation.aspx" target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-amber-50 border p-4 font-black flex items-center justify-between">AAP: Constipation in children <ExternalLink className="w-5 h-5"/></a>
            <a href="https://www.cdc.gov/ncbddd/actearly/autism/curriculum/documents/autism-specific-anticipatory-guidance_508.pdf" target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-violet-50 border p-4 font-black flex items-center justify-between">CDC autism guidance: toileting supports <ExternalLink className="w-5 h-5"/></a>
          </div>
        </section>
      </div>}

      {tab==="media"&&<div className="mt-5 space-y-5">
        <section className="rounded-[2rem] bg-white border-2 border-fuchsia-100 p-5 sm:p-6">
          <h3 className="text-2xl font-black">Potty songs & practice videos</h3>
          <p className="font-bold text-slate-600 mt-1">Use media as a short routine cue, not as a requirement to sit. Pick one or two favorites and keep the language consistent.</p>
          <div className="grid md:grid-cols-3 gap-4 mt-5">{media.map(item=><a key={item.title} href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-3xl bg-gradient-to-br from-fuchsia-50 to-sky-50 border-2 border-fuchsia-100 p-5 hover:shadow-lg transition-shadow">
            <span className="text-5xl">{item.emoji}</span><p className="text-xs font-black text-fuchsia-700 mt-3">{item.source}</p><h4 className="text-xl font-black mt-1">{item.title}</h4><p className="text-sm font-bold text-slate-600 mt-2">{item.why}</p><span className="mt-4 inline-flex items-center gap-2 font-black text-blue-700">Open <ExternalLink className="w-4 h-4"/></span>
          </a>)}</div>
        </section>

        <section className="rounded-[2rem] bg-gradient-to-br from-amber-100 to-emerald-100 p-5 sm:p-6">
          <h3 className="text-2xl font-black">A.R.I.S.E. potty language</h3>
          <p className="font-bold text-slate-700 mt-2">Short scripts help every caregiver use the same calm words.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {[
              ["Body cue","Your body is telling you it might be potty time."],
              ["Transition","We can come back to play after the bathroom."],
              ["Try","You sat on the potty. Nice job trying the steps."],
              ["Success","You put pee in the potty. You listened to your body."],
              ["Accident","Accidents happen. Let's get clean and try again next time."],
              ["Refusal","You do not want to sit right now. We will stay calm and try another time."],
            ].map(([title,line])=><button key={title} onClick={()=>speak(line)} className="rounded-2xl bg-white/80 p-4 text-left border-2 border-white"><strong>{title}</strong><p className="font-bold text-slate-600 mt-1">“{line}”</p><span className="text-xs font-black text-teal-700">🔊 TAP TO HEAR</span></button>)}
          </div>
        </section>
      </div>}
    </div>
  </main>;
}
