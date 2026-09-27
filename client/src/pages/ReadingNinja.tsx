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
  m("Slice all the apples",{label:"apple",emoji:"🍎"},[{label:"banana",emoji:"🍌"},{label:"orange",emoji:"🍊"},{label:"grapes",emoji:"🍇"},{label:"pear",emoji:"🍐"}],THEMES[0]),
  m("Slice all the cats",{label:"cat",emoji:"🐱"},[{label:"dog",emoji:"🐶"},{label:"rabbit",emoji:"🐰"},{label:"frog",emoji:"🐸"},{label:"bear",emoji:"🐻"}],THEMES[1]),
  m("Slice all the stars",{label:"star",emoji:"⭐"},[{label:"moon",emoji:"🌙"},{label:"planet",emoji:"🪐"},{label:"rocket",emoji:"🚀"},{label:"comet",emoji:"☄️"}],THEMES[2]),
  m("Slice all the dogs",{label:"dog",emoji:"🐶"},[{label:"cat",emoji:"🐱"},{label:"cow",emoji:"🐮"},{label:"pig",emoji:"🐷"},{label:"fox",emoji:"🦊"}],THEMES[3]),
  m("Slice all the books",{label:"book",emoji:"📘"},[{label:"pencil",emoji:"✏️"},{label:"backpack",emoji:"🎒"},{label:"scissors",emoji:"✂️"},{label:"ruler",emoji:"📏"}],THEMES[4]),
  m("Slice all the fish",{label:"fish",emoji:"🐟"},[{label:"crab",emoji:"🦀"},{label:"turtle",emoji:"🐢"},{label:"octopus",emoji:"🐙"},{label:"shell",emoji:"🐚"}],THEMES[5]),
  m("Slice all the carrots",{label:"carrot",emoji:"🥕"},[{label:"corn",emoji:"🌽"},{label:"tomato",emoji:"🍅"},{label:"potato",emoji:"🥔"},{label:"pepper",emoji:"🫑"}],THEMES[6]),
  m("Slice all the lollipops",{label:"lollipop",emoji:"🍭"},[{label:"candy",emoji:"🍬"},{label:"cupcake",emoji:"🧁"},{label:"donut",emoji:"🍩"},{label:"cake",emoji:"🎂"}],THEMES[7]),
  m("Slice all the soccer balls",{label:"soccer ball",emoji:"⚽"},[{label:"basketball",emoji:"🏀"},{label:"football",emoji:"🏈"},{label:"baseball",emoji:"⚾"},{label:"tennis ball",emoji:"🎾"}],THEMES[8]),
  m("Slice all the monkeys",{label:"monkey",emoji:"🐒"},[{label:"tiger",emoji:"🐯"},{label:"snake",emoji:"🐍"},{label:"parrot",emoji:"🦜"},{label:"frog",emoji:"🐸"}],THEMES[9]),
  m("Slice all the snowflakes",{label:"snowflake",emoji:"❄️"},[{label:"snowman",emoji:"⛄"},{label:"tree",emoji:"🌲"},{label:"mountain",emoji:"🏔️"},{label:"sled",emoji:"🛷"}],THEMES[10]),
  m("Slice all the gems",{label:"gem",emoji:"💎"},[{label:"alien",emoji:"👾"},{label:"game",emoji:"🎮"},{label:"joystick",emoji:"🕹️"},{label:"star",emoji:"⭐"}],THEMES[11],10),
  m("Slice all the pancakes",{label:"pancake",emoji:"🥞"},[{label:"egg",emoji:"🍳"},{label:"milk",emoji:"🥛"},{label:"bread",emoji:"🍞"},{label:"coffee",emoji:"☕"}],THEMES[12]),
  m("Slice all the suns",{label:"sun",emoji:"☀️"},[{label:"cloud",emoji:"☁️"},{label:"rain",emoji:"🌧️"},{label:"rainbow",emoji:"🌈"},{label:"lightning",emoji:"⚡"}],THEMES[13]),
  m("Slice all the crowns",{label:"crown",emoji:"👑"},[{label:"gem",emoji:"💎"},{label:"key",emoji:"🗝️"},{label:"castle",emoji:"🏰"},{label:"shield",emoji:"🛡️"}],THEMES[14],10),
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
      const next=difficulty==="easy"?heartsRef.current:Math.max(0,heartsRef.current-1);heartsRef.current=next;setHearts(next);sfx("wrong");setMessage("That is a "+item.label+". Slice only "+mission.target.label+"!");say("That is a "+item.label+". Keep looking for "+mission.target.label+"s.",true);
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
  const startGame=()=>{stopSpeaking();setStarted(true);resetLevel(missionIndex,true);};
  const retry=()=>{setStarted(true);resetLevel(missionIndex,false);};
  const nextMission=()=>resetLevel((missionIndex+1)%MISSIONS.length,false);

  const buddyVisual=buddy.type==="upload"&&buddy.imageData?<img src={buddy.imageData} alt={buddy.name} className="w-full h-full object-cover rounded-full"/>:<span>{BUDDY_EMOJI[buddy.preset]||"🐶"}</span>;
  const progress=Math.min(100,(slicedCount/mission.goal)*100);
  const trailPoints=trail.map(p=>p.x+","+p.y).join(" ");

  if(!started&&!gameOver){
    return <div className="min-h-screen text-white px-4 py-5 relative overflow-hidden" style={{background:"radial-gradient(circle at 30% 0%,#71266d,#170e2e 55%,#050711)"}}>
      <div className="absolute inset-0 opacity-25 pointer-events-none" style={{backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)",backgroundSize:"38px 38px"}}/>
      <div className="max-w-6xl mx-auto relative">
        <div className="flex justify-between gap-3"><button type="button" onClick={onBack} className="min-h-12 px-4 rounded-2xl bg-slate-950/85 border border-white/20 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> Games</button><button type="button" onClick={()=>setSoundOn(v=>!v)} className="w-12 h-12 rounded-2xl bg-slate-950/85 border border-white/20 grid place-items-center">{soundOn?<Volume2/>:<VolumeX/>}</button></div>
        <div className="mt-5 grid lg:grid-cols-[1.05fr_.95fr] gap-5">
          <section className="rounded-[2.3rem] bg-slate-950/90 border-2 border-pink-300/30 p-6 sm:p-8 shadow-2xl backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full bg-pink-300/15 border border-pink-200/30 px-3 py-1 text-xs font-black uppercase tracking-widest text-pink-200"><Zap className="w-4 h-4"/> 15 SLICE LEVELS</div>
            <h1 className="text-5xl sm:text-7xl font-black mt-4 tracking-tight">Reading<br/><span className="text-pink-300">Ninja</span></h1>
            <p className="text-lg sm:text-xl font-bold text-white/80 mt-4">Hear the target, then slash only the correct objects as they launch across the arena.</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-7">{(Object.keys(SPEED) as Difficulty[]).map(level=><button key={level} type="button" onClick={()=>setDifficulty(level)} className={"rounded-2xl border-2 p-4 text-left min-h-24 "+(difficulty===level?"border-pink-300 bg-pink-300/15":"border-white/15 bg-white/5")}><div className="font-black text-xl">{SPEED[level].label}</div><div className="text-sm text-white/65 mt-1">{SPEED[level].description}</div></button>)}</div>
            <button type="button" onClick={startGame} className="mt-6 w-full min-h-17 rounded-2xl bg-gradient-to-r from-pink-300 via-fuchsia-400 to-violet-400 text-slate-950 text-xl font-black shadow-[0_0_35px_rgba(255,90,220,.3)]">🥷 Start Level {missionIndex+1}</button>
          </section>
          <section className="rounded-[2.3rem] overflow-hidden border-2 border-white/20 bg-slate-950 shadow-2xl">
            <div className="relative h-72 overflow-hidden" style={{background:THEMES[0].background}}>
              <div className="absolute inset-x-0 top-5 flex justify-around text-5xl opacity-45">{THEMES[0].decor.map((x,i)=><span key={i}>{x}</span>)}</div>
              <div className="absolute left-[25%] top-[42%] -rotate-12"><div className="w-24 h-24 rounded-full bg-white/90 border-4 border-white shadow-2xl grid place-items-center text-6xl">🍎</div></div>
              <div className="absolute right-[22%] top-[28%] rotate-12"><div className="w-20 h-20 rounded-full bg-white/80 border-4 border-white shadow-2xl grid place-items-center text-5xl">🍌</div></div>
              <div className="absolute left-[18%] bottom-8 right-[18%] h-1 bg-white/80 rotate-[-18deg] shadow-[0_0_18px_white]"/>
              <div className="absolute top-4 right-4 rounded-full bg-slate-950/75 px-3 py-1 text-xs font-black">LEVEL 1 · {THEMES[0].name}</div>
            </div>
            <div className="p-5">
              <div className="flex items-end justify-between gap-3">
                <div><h2 className="text-xl font-black">Choose any arena</h2><p className="text-sm font-bold text-white/55">All 15 levels are open. Tap one, then press Start.</p></div>
                <span className="rounded-full bg-pink-300 text-slate-950 px-3 py-1 text-xs font-black">LEVEL {missionIndex+1}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4 max-h-72 overflow-y-auto pr-1">
                {MISSIONS.map((m,i)=>(
                  <button
                    key={i}
                    type="button"
                    onClick={()=>setMissionIndex(i)}
                    className={"min-h-20 rounded-2xl border-2 p-2 text-center transition "+(missionIndex===i?"border-pink-300 bg-pink-300/20 ring-2 ring-pink-200/30":"border-white/10 bg-white/5 hover:bg-white/10")}
                    aria-label={"Choose level "+(i+1)+": "+m.theme.name}
                  >
                    <div className="text-3xl">{m.theme.badge}</div>
                    <div className="text-[11px] font-black mt-1">L{i+1}</div>
                    <div className="text-[9px] font-bold text-white/60 truncate">{m.theme.name}</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs font-black text-white/70"><div className="rounded-xl bg-white/5 p-2">👆 Swipe</div><div className="rounded-xl bg-white/5 p-2">✨ Bursts</div><div className="rounded-xl bg-white/5 p-2">🔊 Sound FX</div></div>
            </div>
          </section>
        </div>
      </div>
    </div>;
  }

  if(gameOver){
    return <div className="min-h-screen bg-[#070611] text-white grid place-items-center p-5"><div className="w-full max-w-lg rounded-[2rem] bg-slate-900 border-2 border-white/15 p-7 text-center shadow-2xl"><div className="text-7xl">🥷</div><h1 className="text-4xl font-black mt-3">Try the arena again!</h1><p className="text-xl font-bold text-white/70 mt-2">Level {missionIndex+1} · {mission.theme.name}</p><p className="text-3xl text-amber-300 font-black mt-2">{score} points</p><button type="button" onClick={retry} className="mt-6 w-full min-h-14 rounded-2xl bg-pink-300 text-slate-950 font-black flex items-center justify-center gap-2"><RotateCcw className="w-5 h-5"/> Retry level</button><button type="button" onClick={()=>{setGameOver(false);gameOverRef.current=false;setStarted(false);}} className="mt-2 w-full min-h-12 rounded-2xl bg-fuchsia-600/80 font-black">☰ Choose another level</button><button type="button" onClick={onBack} className="mt-2 w-full min-h-12 rounded-2xl bg-white/10 font-black">Back to games</button></div></div>;
  }

  return <div className="min-h-screen bg-[#050611] text-white p-3 sm:p-5 select-none">
    <style>{"@keyframes burstPop{0%{transform:translate(-50%,-50%) scale(.4);opacity:1}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}} @keyframes decorFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}} .burst-pop{animation:burstPop .5s ease-out forwards}.decor-float{animation:decorFloat 4s ease-in-out infinite}"}</style>
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button type="button" onClick={onBack} className="min-h-11 px-3 rounded-xl bg-slate-900 border border-white/15 font-black flex items-center gap-2"><ArrowLeft className="w-4 h-4"/> Games</button>
        <button type="button" onClick={()=>{setStarted(false);updateThings([]);setMissionComplete(false);missionCompleteRef.current=false;}} className="min-h-11 px-3 rounded-xl bg-fuchsia-600 text-white border border-fuchsia-300/30 font-black">☰ Levels</button>
        <div className="rounded-xl bg-pink-300 text-slate-950 px-3 py-2 font-black">LEVEL {missionIndex+1}/{MISSIONS.length}</div>
        <div className="flex-1 min-w-[180px]"><div className="text-xs uppercase tracking-widest font-black text-pink-300">{mission.theme.badge} {mission.theme.name} · {SPEED[difficulty].label}</div><div className="text-xl sm:text-2xl font-black">{mission.prompt}</div></div>
        <button type="button" onClick={()=>setSoundOn(v=>!v)} className="w-11 h-11 rounded-xl bg-white/10 grid place-items-center">{soundOn?<Volume2 className="w-5 h-5"/>:<VolumeX className="w-5 h-5"/>}</button>
        <div className="flex items-center gap-1 rounded-xl bg-rose-500/15 px-3 py-2">{Array.from({length:3}).map((_,i)=><Heart key={i} className={"w-5 h-5 "+(i<hearts?"fill-rose-400 text-rose-400":"text-white/20")}/>)}</div>
        <div className="rounded-xl bg-amber-400/15 text-amber-300 px-3 py-2 font-black"><Star className="w-4 h-4 inline fill-current mr-1"/>{score}</div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-white/10 p-3 mb-3">
        <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-white/10 grid place-items-center text-3xl overflow-hidden flex-shrink-0">{buddyVisual}</div><div className="flex-1 min-w-0"><div className="font-black truncate">{message}</div><div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full transition-all" style={{width:progress+"%",background:mission.theme.glow}}/></div><div className="text-xs font-bold text-white/55 mt-1">{slicedCount} / {mission.goal} {mission.target.label}s</div></div><button type="button" onClick={announceMission} className="w-11 h-11 rounded-xl bg-white/10 grid place-items-center"><Volume2 className="w-5 h-5"/></button></div>
      </div>

      <div
        ref={arenaRef}
        className="relative overflow-hidden rounded-[2rem] border-4 border-white/15 touch-none cursor-crosshair shadow-2xl"
        style={{height:"min(72vh,760px)",minHeight:540,background:mission.theme.background}}
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
                {missionComplete&&<div className="absolute inset-0 z-50 bg-slate-950/76 backdrop-blur-sm grid place-items-center p-5"><div className="w-full max-w-lg rounded-[2rem] bg-white text-slate-950 p-7 text-center shadow-2xl border-4 border-pink-300"><div className="text-7xl">{mission.theme.badge}🎉</div><p className="text-xs font-black uppercase tracking-widest text-fuchsia-700 mt-2">Level {missionIndex+1} complete</p><h2 className="text-4xl font-black mt-1">{mission.theme.name}</h2><p className="font-bold text-slate-600 mt-2">You sliced all the {mission.target.label}s.</p><button type="button" onClick={nextMission} className="mt-5 w-full min-h-15 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white font-black">{missionIndex===MISSIONS.length-1?"Play Level 1 again":"Next arena →"}</button></div></div>}
      </div>

      <div className="mt-3 rounded-xl bg-slate-900 p-3 text-center text-sm font-black text-white/70">Swipe through only {mission.target.emoji} {mission.target.label}s. Wrong objects cost a heart.</div>
    </div>
  </div>;
}
