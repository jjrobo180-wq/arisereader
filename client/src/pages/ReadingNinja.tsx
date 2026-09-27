import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, RotateCcw, Star, Volume2, VolumeX, Zap } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type BuddyPreset = "puppy" | "dino" | "robot" | "bunny";
type BuddyConfig = {
  type: "preset" | "upload";
  preset: BuddyPreset;
  name: string;
  imageData: string | null;
  voiceEnabled: boolean;
  calmMode?: boolean;
};
type Difficulty = "easy" | "medium" | "hard";
type Thing = { label: string; emoji: string };
type Theme = { name:string; badge:string; background:string; glow:string; decor:string[] };
type Mission = { prompt:string; target:Thing; distractors:Thing[]; goal:number; theme:Theme };
type FlyingThing = Thing & { id:number; x:number; y:number; vx:number; vy:number; isTarget:boolean; sliced:boolean; rotation:number };
type Burst = { id:number; x:number; y:number; emoji:string; good:boolean };

const THEMES: Theme[] = [
  {name:"Fruit Dojo",badge:"🍎",background:"radial-gradient(circle at 50% 15%,#ffb26b,#b44b4b 48%,#421d32)",glow:"#ffd06a",decor:["🍃","🥭","🌿","🍊"]},
  {name:"Animal Garden",badge:"🐱",background:"radial-gradient(circle at 50% 10%,#80e3b1,#388f68 48%,#153f3c)",glow:"#84ffd6",decor:["🌼","🌿","🦋","🌳"]},
  {name:"Galaxy Slice",badge:"⭐",background:"radial-gradient(circle at 50% 20%,#6745c7,#1b1b50 55%,#080b20)",glow:"#b99bff",decor:["🪐","🌙","✨","☄️"]},
  {name:"Pet Park",badge:"🐶",background:"radial-gradient(circle at 50% 20%,#80d7ff,#43a16d 58%,#24593c)",glow:"#8cf3ff",decor:["🛝","🌳","🦴","🌼"]},
  {name:"School Lab",badge:"📘",background:"radial-gradient(circle at 50% 10%,#87c8ff,#4b79a8 55%,#263752)",glow:"#9bd4ff",decor:["✏️","🎒","📚","🏫"]},
  {name:"Ocean Splash",badge:"🐟",background:"radial-gradient(circle at 50% 5%,#56d8ff,#157aa9 48%,#073b65)",glow:"#66f1ff",decor:["🪸","🌊","🐚","🫧"]},
  {name:"Farm Chop",badge:"🥕",background:"radial-gradient(circle at 50% 10%,#ffe789,#84b85e 52%,#42643a)",glow:"#fff08a",decor:["🌻","🚜","🌾","🐮"]},
  {name:"Candy Storm",badge:"🍭",background:"radial-gradient(circle at 50% 10%,#ffb2ee,#a15fd2 50%,#472866)",glow:"#ffb8f1",decor:["🍬","🧁","🍩","✨"]},
  {name:"Sports Arena",badge:"⚽",background:"radial-gradient(circle at 50% 10%,#7fd8ff,#2d73a4 45%,#172e4a)",glow:"#a5e8ff",decor:["🏟️","🏆","🎉","🥇"]},
  {name:"Jungle Slash",badge:"🐒",background:"radial-gradient(circle at 50% 10%,#8ce087,#357a46 50%,#173c2a)",glow:"#aaff8c",decor:["🌴","🦜","🌿","🍃"]},
  {name:"Snow Slice",badge:"❄️",background:"radial-gradient(circle at 50% 10%,#e9fbff,#83b8d8 50%,#426482)",glow:"#d9fbff",decor:["⛄","🌲","🏔️","✨"]},
  {name:"Neon Arcade",badge:"💎",background:"radial-gradient(circle at 50% 10%,#6024b8,#27144e 54%,#090a19)",glow:"#00f6ff",decor:["👾","🕹️","🎮","⚡"]},
  {name:"Breakfast Rush",badge:"🥞",background:"radial-gradient(circle at 50% 10%,#ffd699,#c97555 55%,#5f3534)",glow:"#ffe0a6",decor:["☕","🍳","🥛","🍞"]},
  {name:"Weather Lab",badge:"☀️",background:"radial-gradient(circle at 50% 10%,#8fdcff,#4e78c5 55%,#273962)",glow:"#ffe970",decor:["🌈","☁️","🌧️","⚡"]},
  {name:"Treasure Vault",badge:"👑",background:"radial-gradient(circle at 50% 10%,#ffcb65,#7e5730 50%,#2b1e22)",glow:"#ffe28c",decor:["💎","🏰","🗝️","✨"]},
];

const m=(prompt:string,target:Thing,distractors:Thing[],theme:Theme,goal=9):Mission=>({prompt,target,distractors,theme,goal});
const MISSIONS: Mission[] = [
  m("Slice the apples!",{label:"apple",emoji:"🍎"},[{label:"banana",emoji:"🍌"},{label:"orange",emoji:"🍊"},{label:"grapes",emoji:"🍇"},{label:"pear",emoji:"🍐"}],THEMES[0]),
  m("Find the cats!",{label:"cat",emoji:"🐱"},[{label:"dog",emoji:"🐶"},{label:"rabbit",emoji:"🐰"},{label:"frog",emoji:"🐸"},{label:"bear",emoji:"🐻"}],THEMES[1]),
  m("Swipe through the stars!",{label:"star",emoji:"⭐"},[{label:"moon",emoji:"🌙"},{label:"planet",emoji:"🪐"},{label:"rocket",emoji:"🚀"},{label:"comet",emoji:"☄️"}],THEMES[2]),
  m("Catch the dogs with your swipe!",{label:"dog",emoji:"🐶"},[{label:"cat",emoji:"🐱"},{label:"cow",emoji:"🐮"},{label:"pig",emoji:"🐷"},{label:"fox",emoji:"🦊"}],THEMES[3]),
  m("Spot the books!",{label:"book",emoji:"📘"},[{label:"pencil",emoji:"✏️"},{label:"backpack",emoji:"🎒"},{label:"scissors",emoji:"✂️"},{label:"ruler",emoji:"📏"}],THEMES[4]),
  m("Get the fish!",{label:"fish",emoji:"🐟"},[{label:"crab",emoji:"🦀"},{label:"turtle",emoji:"🐢"},{label:"octopus",emoji:"🐙"},{label:"shell",emoji:"🐚"}],THEMES[5]),
  m("Chop the carrots!",{label:"carrot",emoji:"🥕"},[{label:"corn",emoji:"🌽"},{label:"tomato",emoji:"🍅"},{label:"potato",emoji:"🥔"},{label:"pepper",emoji:"🫑"}],THEMES[6]),
  m("Pop the lollipops!",{label:"lollipop",emoji:"🍭"},[{label:"candy",emoji:"🍬"},{label:"cupcake",emoji:"🧁"},{label:"donut",emoji:"🍩"},{label:"cake",emoji:"🎂"}],THEMES[7]),
  m("Hit the soccer balls!",{label:"soccer ball",emoji:"⚽"},[{label:"basketball",emoji:"🏀"},{label:"football",emoji:"🏈"},{label:"baseball",emoji:"⚾"},{label:"tennis ball",emoji:"🎾"}],THEMES[8]),
  m("Find the monkeys!",{label:"monkey",emoji:"🐒"},[{label:"tiger",emoji:"🐯"},{label:"snake",emoji:"🐍"},{label:"parrot",emoji:"🦜"},{label:"frog",emoji:"🐸"}],THEMES[9]),
  m("Touch the snowflakes!",{label:"snowflake",emoji:"❄️"},[{label:"snowman",emoji:"⛄"},{label:"tree",emoji:"🌲"},{label:"mountain",emoji:"🏔️"},{label:"sled",emoji:"🛷"}],THEMES[10]),
  m("Collect the gems!",{label:"gem",emoji:"💎"},[{label:"alien",emoji:"👾"},{label:"game",emoji:"🎮"},{label:"joystick",emoji:"🕹️"},{label:"star",emoji:"⭐"}],THEMES[11],10),
  m("Grab the pancakes!",{label:"pancake",emoji:"🥞"},[{label:"egg",emoji:"🍳"},{label:"milk",emoji:"🥛"},{label:"bread",emoji:"🍞"},{label:"coffee",emoji:"☕"}],THEMES[12]),
  m("Tap the suns!",{label:"sun",emoji:"☀️"},[{label:"cloud",emoji:"☁️"},{label:"rain",emoji:"🌧️"},{label:"rainbow",emoji:"🌈"},{label:"lightning",emoji:"⚡"}],THEMES[13]),
  m("Collect the crowns!",{label:"crown",emoji:"👑"},[{label:"gem",emoji:"💎"},{label:"key",emoji:"🗝️"},{label:"castle",emoji:"🏰"},{label:"shield",emoji:"🛡️"}],THEMES[14],10),
];

const SPEED={
  easy:{launch:-1.72,gravity:.030,spawn:1320,label:"Easy",description:"Toddler-friendly · bigger targets + slower flight"},
  medium:{launch:-2.35,gravity:.045,spawn:820,label:"Medium",description:"Classic arcade speed"},
  hard:{launch:-2.85,gravity:.059,spawn:540,label:"Hard",description:"Fast objects · quick response"},
} as const;
const BUDDY_EMOJI:Record<BuddyPreset,string>={puppy:"🐶",dino:"🦕",robot:"🤖",bunny:"🐰"};

function cheer(label:string){
  const lines=["Got the "+label+"!","Yes! "+label+"!","Perfect slice! "+label+"!","Nice! "+label+"!"];
  return lines[Math.floor(Math.random()*lines.length)];
}
function SliceToken({item,large=false}:{item:FlyingThing;large?:boolean}){
  return <div className={"relative transition-all duration-150 "+(item.sliced?"opacity-10 scale-150":"")}>
    <div className="absolute -inset-4 rounded-full blur-2xl opacity-35 bg-white"/>
    <div className={"relative rounded-full border-[5px] shadow-[0_12px_28px_rgba(0,0,0,.38)] grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_32%_25%,#ffffff_0%,#f8fafc_35%,#dbeafe_100%)] border-white "+(large?"w-24 h-24 sm:w-28 sm:h-28":"w-20 h-20 sm:w-24 sm:h-24")}>
      <div className="absolute inset-x-4 top-2 h-4 bg-white/80 rounded-full blur-[1px]"/>
      <div className="absolute inset-2 rounded-full border border-sky-100/70"/>
      <span className={large?"relative text-6xl sm:text-7xl drop-shadow-lg":"relative text-5xl sm:text-6xl drop-shadow-lg"}>{item.emoji}</span>
    </div>
    <div className="relative mt-1 mx-auto w-max max-w-28 truncate rounded-full bg-slate-950/92 border border-white/20 px-3 py-1 text-[10px] sm:text-xs font-black uppercase text-white shadow-lg">{item.label}</div>
  </div>;
}

export default function ReadingNinja({onBack,buddy}:{onBack:()=>void;buddy:BuddyConfig}){
  const [difficulty,setDifficulty]=useState<Difficulty>("easy");
  const [started,setStarted]=useState(false);
  const [setupStep,setSetupStep]=useState<"difficulty"|"level">("difficulty");
  const [missionIndex,setMissionIndex]=useState(0);
  const [things,setThings]=useState<FlyingThing[]>([]);
  const thingsRef=useRef<FlyingThing[]>([]);
  const [slicedCount,setSlicedCount]=useState(0);
  const slicedRef=useRef(0);
  const [score,setScore]=useState(0);
  const [hearts,setHearts]=useState(3);
  const heartsRef=useRef(3);
  const [message,setMessage]=useState("Swipe through only the target.");
  const [missionComplete,setMissionComplete]=useState(false);
  const missionCompleteRef=useRef(false);
  const [gameOver,setGameOver]=useState(false);
  const gameOverRef=useRef(false);
  const [slicing,setSlicing]=useState(false);
  const slicingRef=useRef(false);
  const [trail,setTrail]=useState<Array<{x:number;y:number;id:number}>>([]);
  const [bursts,setBursts]=useState<Burst[]>([]);
  const [soundOn,setSoundOn]=useState(true);
  const arenaRef=useRef<HTMLDivElement|null>(null);
  const nextId=useRef(1);
  const trailId=useRef(1);
  const burstId=useRef(1);
  const audioRef=useRef<AudioContext|null>(null);

  const mission=MISSIONS[missionIndex%MISSIONS.length];
  const speed=SPEED[difficulty];

  const updateThings=useCallback((next:FlyingThing[]|((current:FlyingThing[])=>FlyingThing[]))=>{
    const value=typeof next==="function"?next(thingsRef.current):next;thingsRef.current=value;setThings(value);
  },[]);

  const sfx=useCallback((kind:"slice"|"wrong"|"complete"|"launch")=>{
    if(!soundOn)return;
    try{
      const ctx=audioRef.current||new AudioContext();audioRef.current=ctx;void ctx.resume();const now=ctx.currentTime;
      const notes=kind==="slice"?[[900,0],[1250,.045]]:kind==="wrong"?[[170,0],[115,.1]]:kind==="launch"?[[250,0],[350,.06]]:[[523,0],[659,.09],[784,.18],[1047,.29]];
      notes.forEach(([f,o])=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==="wrong"?"square":"sine";osc.frequency.setValueAtTime(f,now+o);gain.gain.setValueAtTime(.0001,now+o);gain.gain.exponentialRampToValueAtTime(kind==="launch"?.018:.075,now+o+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+o+.13);osc.connect(gain);gain.connect(ctx.destination);osc.start(now+o);osc.stop(now+o+.15);});
    }catch{}
  },[soundOn]);

  const say=useCallback((text:string,calm=false)=>{
    if(!buddy.voiceEnabled)return;stopSpeaking();void speakCharacterAI(text,{calmMode:calm||!!buddy.calmMode,onFallback:()=>{if(!("speechSynthesis" in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.92;window.speechSynthesis.speak(u);}});
  },[buddy.voiceEnabled,buddy.calmMode]);

  const announceMission=useCallback(()=>{setMessage(mission.prompt+"!");say("Level "+(missionIndex+1)+". "+mission.theme.name+". "+mission.prompt+". Swipe through only the "+mission.target.label+"s.",difficulty==="easy");},[mission,missionIndex,say,difficulty]);

  useEffect(()=>()=>{stopSpeaking();void audioRef.current?.close();},[]);
  useEffect(()=>{if(started&&!missionComplete&&!gameOver)announceMission();},[started,missionComplete,gameOver,missionIndex,announceMission]);

  useEffect(()=>{
    if(!started||missionComplete||gameOver)return;
    const timer=window.setInterval(()=>{
      const isTarget=Math.random()<.48;
      const source=isTarget?mission.target:mission.distractors[Math.floor(Math.random()*mission.distractors.length)];
      const x=10+Math.random()*80,toward=(50-x)*.0026;
      const item:FlyingThing={...source,id:nextId.current++,x,y:108,vx:toward+(Math.random()-.5)*.15,vy:speed.launch*(.9+Math.random()*.2),isTarget,sliced:false,rotation:Math.random()*30-15};
      updateThings(c=>[...c,item]);
    },speed.spawn);
    return()=>window.clearInterval(timer);
  },[started,missionComplete,gameOver,mission,speed.launch,speed.spawn,updateThings,sfx]);

  useEffect(()=>{
    if(!started||missionComplete||gameOver)return;
    const timer=window.setInterval(()=>updateThings(c=>c.map(item=>({...item,x:item.x+item.vx,y:item.y+item.vy,vy:item.vy+speed.gravity,rotation:item.rotation+(item.sliced?8:2.2)})).filter(item=>item.y<118&&item.x>-12&&item.x<112)),32);
    return()=>window.clearInterval(timer);
  },[started,missionComplete,gameOver,speed.gravity,updateThings]);

  const burst=useCallback((item:FlyingThing)=>{
    const id=burstId.current++;
    setBursts(c=>[...c,{id,x:item.x,y:item.y,emoji:item.emoji,good:item.isTarget}]);
    window.setTimeout(()=>setBursts(c=>c.filter(b=>b.id!==id)),500);
  },[]);

  const handleHit=useCallback((item:FlyingThing)=>{
    if(item.sliced||gameOverRef.current||missionCompleteRef.current)return;
    updateThings(c=>c.map(x=>x.id===item.id?{...x,sliced:true}:x));burst(item);
    if(item.isTarget){
      const next=slicedRef.current+1;slicedRef.current=next;setSlicedCount(next);setScore(v=>v+(difficulty==="hard"?45:difficulty==="medium"?30:20));sfx("slice");
      const line=cheer(item.label);setMessage(line);say(line);
      if(next>=mission.goal){missionCompleteRef.current=true;setMissionComplete(true);updateThings([]);sfx("complete");setMessage("Level complete!");say("Level complete! You got all the "+mission.target.label+"s. Great job!");}
    }else{
      const next=difficulty==="easy"?heartsRef.current:Math.max(0,heartsRef.current-1);heartsRef.current=next;setHearts(next);sfx("wrong");setMessage("That is a "+item.label+". Keep looking for "+mission.target.label+"!");say("That is a "+item.label+". Keep looking for "+mission.target.label+"s.",true);
      if(difficulty!=="easy"&&next<=0){gameOverRef.current=true;setGameOver(true);setStarted(false);updateThings([]);say("Nice try. Let's try that level again.");}
    }
  },[difficulty,mission,say,sfx,updateThings,burst]);

  const sliceAt=useCallback((clientX:number,clientY:number)=>{
    const arena=arenaRef.current;if(!arena||gameOverRef.current||missionCompleteRef.current)return;const rect=arena.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const x=((clientX-rect.left)/rect.width)*100,y=((clientY-rect.top)/rect.height)*100;
    const point={x,y,id:trailId.current++};setTrail(c=>[...c.slice(-16),point]);window.setTimeout(()=>setTrail(c=>c.filter(p=>p.id!==point.id)),220);
    const hitX=difficulty==="easy"?13:8.5;
    const hitY=difficulty==="easy"?15:10.5;
    const hit=[...thingsRef.current].filter(i=>!i.sliced).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)).find(i=>Math.abs(i.x-x)<=hitX&&Math.abs(i.y-y)<=hitY);
    if(hit)handleHit(hit);
  },[handleHit]);

  const resetLevel=(index:number,resetScore=false)=>{setMissionIndex(index);setSlicedCount(0);slicedRef.current=0;setHearts(3);heartsRef.current=3;setMissionComplete(false);missionCompleteRef.current=false;setGameOver(false);gameOverRef.current=false;updateThings([]);setTrail([]);setBursts([]);if(resetScore)setScore(0);setMessage("Get ready!");};
  const enterImmersive=()=>{ try { const el=document.documentElement as any; const request=el.requestFullscreen||el.webkitRequestFullscreen; if(request) void request.call(el).catch?.(()=>{}); } catch {} };
  const startGame=()=>{stopSpeaking();enterImmersive();setStarted(true);resetLevel(missionIndex,true);};
  const openSetup=(step:"difficulty"|"level"="level")=>{
    setStarted(false);
    setGameOver(false);
    gameOverRef.current=false;
    setMissionComplete(false);
    missionCompleteRef.current=false;
    updateThings([]);
    setTrail([]);
    setBursts([]);
    setSetupStep(step);
  };
  const retry=()=>{setStarted(true);resetLevel(missionIndex,false);};
  const nextMission=()=>resetLevel((missionIndex+1)%MISSIONS.length,false);

  const buddyVisual=buddy.type==="upload"&&buddy.imageData?<img src={buddy.imageData} alt={buddy.name} className="w-full h-full object-cover rounded-full"/>:<span>{BUDDY_EMOJI[buddy.preset]||"🐶"}</span>;
  const progress=Math.min(100,(slicedCount/mission.goal)*100);
  const trailPoints=trail.map(p=>p.x+","+p.y).join(" ");

  if(!started&&!gameOver){
    return <div className="fixed inset-0 z-[120] h-[100dvh] overflow-hidden text-white p-3 sm:p-5" style={{background:"radial-gradient(circle at 30% 0%,#71266d,#170e2e 55%,#050711)"}}>
      <style>{"@keyframes ninjaSetupIn{from{opacity:.25;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}} .ninja-setup-in{animation:ninjaSetupIn .22s ease-out}"}</style>
      <div className="absolute inset-0 opacity-25 pointer-events-none" style={{backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)",backgroundSize:"38px 38px"}}/>
      <div className="relative max-w-4xl mx-auto h-full flex flex-col">
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <button type="button" onClick={onBack} className="min-h-11 px-3 sm:px-4 rounded-2xl bg-slate-950/85 border border-white/20 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> Games</button>
          <div className="rounded-full bg-white/10 border border-white/15 px-3 py-2 text-xs font-black">READING NINJA</div>
          <button type="button" onClick={()=>setSoundOn(v=>!v)} className="w-11 h-11 rounded-2xl bg-slate-950/85 border border-white/20 grid place-items-center" aria-label="Toggle sound">{soundOn?<Volume2 className="w-5 h-5"/>:<VolumeX className="w-5 h-5"/>}</button>
        </div>

        <div className="flex-1 min-h-0 grid place-items-center py-3">
          {setupStep==="difficulty" ? (
            <section key="difficulty" className="ninja-setup-in w-full max-w-3xl rounded-[2rem] bg-white text-slate-950 border-4 border-fuchsia-400 p-5 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,.45)]">
              <p className="text-xs font-black uppercase tracking-[.18em] text-fuchsia-700">Step 1 of 2</p>
              <h1 className="text-3xl sm:text-5xl font-black mt-2">How fast should things fly?</h1>
              <p className="font-bold text-slate-600 mt-2">Choose one. Easy gives bigger targets, slower movement, and no lost hearts.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                {(Object.keys(SPEED) as Difficulty[]).map(level=>(
                  <button key={level} type="button" onClick={()=>setDifficulty(level)} className={"min-h-24 rounded-2xl border-4 p-4 text-left transition touch-manipulation shadow-md "+(difficulty===level?"border-fuchsia-500 bg-fuchsia-100 text-slate-950 ring-4 ring-fuchsia-300/40":"border-slate-300 bg-slate-100 text-slate-950 hover:border-fuchsia-400 hover:bg-fuchsia-50")}>
                    <div className="text-2xl font-black">{level==="easy"?"🧸":level==="medium"?"🥷":"⚡"} {SPEED[level].label}</div>
                    <div className="text-sm font-bold text-slate-600 mt-1">{SPEED[level].description}</div>
                    {difficulty===level&&<div className="text-fuchsia-800 font-black mt-2">✓ Selected</div>}
                  </button>
                ))}
              </div>
              <button type="button" onClick={()=>setSetupStep("level")} className="mt-5 w-full min-h-16 rounded-2xl bg-pink-300 text-slate-950 text-xl font-black shadow-xl">Next: choose a level →</button>
            </section>
          ) : (
            <section key="level" className="ninja-setup-in w-full max-w-4xl h-full max-h-[760px] rounded-[2rem] bg-white text-slate-950 border-4 border-fuchsia-400 p-4 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,.45)] flex flex-col min-h-0">
              <div className="flex items-center gap-3 flex-shrink-0">
                <button type="button" onClick={()=>setSetupStep("difficulty")} className="min-h-11 rounded-xl bg-slate-200 border-2 border-slate-300 text-slate-950 px-3 font-black shadow-sm">← Speed</button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-fuchsia-700">Step 2 of 2</p>
                  <h1 className="text-2xl sm:text-4xl font-black">Choose a level</h1>
                </div>
                <div className="rounded-full bg-pink-300 text-slate-950 px-3 py-2 text-xs font-black">{SPEED[difficulty].label}</div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
                {MISSIONS.map((m,i)=>(
                  <button key={i} type="button" onClick={()=>setMissionIndex(i)} className={"min-h-[92px] rounded-2xl border-4 p-2 text-center touch-manipulation shadow-md "+(missionIndex===i?"border-fuchsia-500 bg-fuchsia-100 text-slate-950 ring-4 ring-fuchsia-300/40":"border-slate-300 bg-slate-100 text-slate-950 hover:border-fuchsia-400 hover:bg-fuchsia-50")}>
                    <div className="text-3xl sm:text-4xl">{m.theme.badge}</div>
                    <div className="font-black text-xs mt-1">LEVEL {i+1}</div>
                    <div className="text-[10px] font-bold text-slate-600 truncate">{m.theme.name}</div>
                  </button>
                ))}
              </div>

              <div className="pt-3 flex-shrink-0">
                <div className="rounded-xl bg-slate-100 border-2 border-slate-200 text-slate-950 px-3 py-2 text-center font-black text-sm truncate shadow-sm">{MISSIONS[missionIndex].target.emoji} {MISSIONS[missionIndex].prompt}</div>
                <button type="button" onClick={startGame} className="mt-2 w-full min-h-16 rounded-2xl bg-gradient-to-r from-pink-300 via-fuchsia-400 to-violet-400 text-slate-950 text-xl font-black shadow-xl">🥷 Start Level {missionIndex+1}</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>;
  }

  if(gameOver){
    return <div className="fixed inset-0 z-[120] h-[100dvh] bg-[#070611] text-white grid place-items-center p-5"><div className="w-full max-w-lg rounded-[2rem] bg-slate-900 border-2 border-white/15 p-7 text-center shadow-2xl"><div className="text-7xl">🥷</div><h1 className="text-4xl font-black mt-3">Try the arena again!</h1><p className="text-xl font-bold text-white/70 mt-2">Level {missionIndex+1} · {mission.theme.name}</p><p className="text-3xl text-amber-300 font-black mt-2">{score} points</p><button type="button" onClick={retry} className="mt-6 w-full min-h-14 rounded-2xl bg-pink-300 text-slate-950 font-black flex items-center justify-center gap-2"><RotateCcw className="w-5 h-5"/> Retry level</button><button type="button" onClick={()=>openSetup("level")} className="mt-2 w-full min-h-12 rounded-2xl bg-fuchsia-600 font-black">☰ Choose level</button><button type="button" onClick={onBack} className="mt-2 w-full min-h-12 rounded-2xl bg-white/10 font-black">Back to games</button></div></div>;
  }

  return <div className="fixed inset-0 z-[120] h-[100dvh] overflow-hidden bg-[#050611] text-white p-2 sm:p-5 select-none">
    <style>{"@keyframes burstPop{0%{transform:translate(-50%,-50%) scale(.4);opacity:1}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}} @keyframes decorFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}} .burst-pop{animation:burstPop .5s ease-out forwards}.decor-float{animation:decorFloat 4s ease-in-out infinite}"}</style>
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <button type="button" onClick={()=>openSetup("level")} className="min-h-10 sm:min-h-11 px-3 rounded-xl bg-slate-900 border border-white/15 font-black text-sm flex items-center gap-1.5 flex-shrink-0">☰ <span className="hidden sm:inline">Setup</span></button>
        <button type="button" onClick={announceMission} className="flex-1 min-w-0 min-h-10 sm:min-h-11 rounded-xl bg-slate-900 border border-white/15 px-3 text-left">
          <div className="text-[9px] sm:text-xs uppercase tracking-wider font-black text-pink-300 truncate">{mission.theme.badge} {mission.theme.name} · {SPEED[difficulty].label}</div>
          <div className="text-xs sm:text-base font-black truncate">{mission.target.emoji} {mission.prompt}</div>
        </button>
        <button type="button" onClick={()=>setSoundOn(v=>!v)} className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 border border-white/15 grid place-items-center flex-shrink-0" aria-label="Toggle sound">{soundOn?<Volume2 className="w-5 h-5"/>:<VolumeX className="w-5 h-5"/>}</button>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-2 flex-shrink-0 text-center">
        <div className="rounded-xl bg-pink-300 text-slate-950 px-1 py-1.5 sm:py-2"><div className="text-[9px] sm:text-[10px] font-black uppercase">Level</div><div className="font-black text-sm sm:text-base">{missionIndex+1}/{MISSIONS.length}</div></div>
        <div className="rounded-xl bg-emerald-400 text-slate-950 px-1 py-1.5 sm:py-2"><div className="text-[9px] sm:text-[10px] font-black uppercase">Sliced</div><div className="font-black text-sm sm:text-base">{slicedCount}/{mission.goal}</div></div>
        <div className="rounded-xl bg-rose-500/20 text-rose-200 px-1 py-1.5 sm:py-2"><div className="text-[9px] sm:text-[10px] font-black uppercase">Hearts</div><div className="font-black text-sm sm:text-base">❤️ {hearts}</div></div>
        <div className="rounded-xl bg-amber-400/15 text-amber-300 px-1 py-1.5 sm:py-2"><div className="text-[9px] sm:text-[10px] font-black uppercase">Score</div><div className="font-black text-sm sm:text-base">{score}</div></div>
      </div>

      <div
        ref={arenaRef}
        className="relative flex-1 min-h-0 overflow-hidden rounded-2xl sm:rounded-[2rem] border-4 border-white/15 touch-none cursor-crosshair shadow-2xl"
        style={{background:mission.theme.background}}
        onPointerDown={e=>{setSlicing(true);slicingRef.current=true;e.currentTarget.setPointerCapture?.(e.pointerId);sliceAt(e.clientX,e.clientY);}}
        onPointerMove={e=>{if(slicingRef.current)sliceAt(e.clientX,e.clientY);}}
        onPointerUp={e=>{if(slicingRef.current)sliceAt(e.clientX,e.clientY);slicingRef.current=false;setSlicing(false);}}
        onPointerCancel={()=>{slicingRef.current=false;setSlicing(false);}}
      >
        <div className="absolute inset-0 opacity-25" style={{backgroundImage:"radial-gradient(circle,white 1px,transparent 1px)",backgroundSize:"42px 42px"}}/>
        <div className="absolute inset-x-0 top-8 flex justify-around text-5xl sm:text-7xl opacity-25 decor-float">{mission.theme.decor.map((x,i)=><span key={i}>{x}</span>)}</div>
        <div className="absolute bottom-0 inset-x-0 h-[22%] bg-gradient-to-t from-black/40 to-transparent"/>

        {things.map(item=><div key={item.id} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150 pointer-events-none" style={{left:item.x+"%",top:item.y+"%",transform:"translate(-50%,-50%) rotate("+item.rotation+"deg) "+(item.sliced?"scale(1.4)":"scale(1)")}}><SliceToken item={item} large={difficulty==="easy"&&item.isTarget}/></div>)}

        <svg className="absolute inset-0 z-40 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs><linearGradient id="bladeTrail" x1="0" x2="1"><stop offset="0%" stopColor="#67e8f9"/><stop offset="50%" stopColor="#ffffff"/><stop offset="100%" stopColor="#f0abfc"/></linearGradient></defs>
          {trailPoints&&<polyline points={trailPoints} fill="none" stroke="url(#bladeTrail)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".95" style={{filter:"drop-shadow(0 0 6px white)"}}/>}
        </svg>

        {bursts.map(b=><div key={b.id} className={"absolute z-45 -translate-x-1/2 -translate-y-1/2 pointer-events-none burst-pop "+(b.good?"text-emerald-200":"text-rose-200")} style={{left:b.x+"%",top:b.y+"%"}}><div className="text-7xl">{b.good?"✨":"💥"}</div><div className="text-4xl text-center">{b.emoji}</div></div>)}

        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-950/85 border border-white/20 px-4 py-2 font-black text-sm sm:text-base whitespace-nowrap shadow-xl">{mission.target.emoji} {mission.prompt}</div>

        {difficulty==="easy"&&<div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 rounded-full bg-pink-100/95 text-fuchsia-900 border-2 border-white px-4 py-2 text-xs sm:text-sm font-black shadow-lg">🧸 EASY MODE · bigger target hit area · no lost hearts</div>}
                {missionComplete&&<div className="absolute inset-0 z-50 bg-slate-950/76 backdrop-blur-sm grid place-items-center p-5"><div className="w-full max-w-lg rounded-[2rem] bg-white text-slate-950 p-7 text-center shadow-2xl border-4 border-pink-300"><div className="text-7xl">{mission.theme.badge}🎉</div><p className="text-xs font-black uppercase tracking-widest text-fuchsia-700 mt-2">Level {missionIndex+1} complete</p><h2 className="text-4xl font-black mt-1">{mission.theme.name}</h2><p className="font-bold text-slate-600 mt-2">You completed the challenge and found all the {mission.target.label}s!</p><button
  type="button"
  onClick={nextMission}
  className="mt-6 w-full min-h-[88px] sm:min-h-[76px] rounded-[1.75rem] bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white text-xl sm:text-2xl font-black shadow-xl ring-4 ring-fuchsia-200/70 touch-manipulation active:scale-[0.98] transition-transform px-5"
>
  {missionIndex===MISSIONS.length-1
    ? "↻ Play Level 1 Again"
    : <>NEXT LEVEL →<span className="block text-sm sm:text-base font-bold text-white/80 mt-1">Level {missionIndex+2}: {MISSIONS[(missionIndex+1)%MISSIONS.length].theme.name}</span></>}
</button></div></div>}
      </div>

      <div className="hidden sm:block mt-3 rounded-xl bg-slate-900 p-3 text-center text-sm font-black text-white/70 flex-shrink-0">Swipe through only {mission.target.emoji} {mission.target.label}s. Wrong objects cost a heart.</div>
    </div>
  </div>;
}
