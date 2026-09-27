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
type Theme = {
  name: string;
  badge: string;
  sky: string;
  horizon: string;
  ground: string;
  road: string;
  accent: string;
  scenery: string[];
};
type Mission = {
  action: string;
  target: Thing;
  distractors: Thing[];
  goal: number;
  theme: Theme;
};

type FallingThing = Thing & {
  id: number;
  lane: number;
  y: number;
  isTarget: boolean;
  handled: boolean;
};

const THEMES: Record<string, Theme> = {
  city: { name: "Rainbow City", badge: "🏙️", sky: "linear-gradient(#69d2ff 0%, #b7edff 44%, #f8d9a7 45%)", horizon: "#85a7ba", ground: "#5e913f", road: "#29313c", accent: "#52e3ff", scenery: ["🏢","🏬","🌳","🚕","🏙️"] },
  farm: { name: "Sunny Farm", badge: "🚜", sky: "linear-gradient(#76cfff 0%, #d5f3ff 48%, #e7c67d 49%)", horizon: "#71a85b", ground: "#6ea34b", road: "#665848", accent: "#ffd95a", scenery: ["🌾","🚜","🌳","🏡","🌻"] },
  beach: { name: "Splash Beach", badge: "🏖️", sky: "linear-gradient(#54cdf7 0%, #c9f3ff 45%, #ffd894 46%)", horizon: "#37afd0", ground: "#f2c46b", road: "#9e744f", accent: "#5df3e2", scenery: ["🌴","⛱️","🌊","🐚","🏄"] },
  space: { name: "Star Station", badge: "🚀", sky: "radial-gradient(circle at 50% 10%, #392a75, #090d25 60%, #050713)", horizon: "#121944", ground: "#252c55", road: "#111527", accent: "#a98bff", scenery: ["🪐","🚀","⭐","🌙","☄️"] },
  snow: { name: "Snowy Summit", badge: "❄️", sky: "linear-gradient(#8cd8ff, #eefaff 55%, #d7edf7 56%)", horizon: "#a7ccda", ground: "#e8f6fb", road: "#7b8c97", accent: "#8ce8ff", scenery: ["⛄","🌲","🏔️","❄️","🛷"] },
  jungle: { name: "Jungle Dash", badge: "🌴", sky: "linear-gradient(#49ba91, #a6e4b7 46%, #4e8c43 47%)", horizon: "#28663c", ground: "#356d33", road: "#51483a", accent: "#b7ff62", scenery: ["🌴","🦜","🌿","🪨","🐒"] },
  school: { name: "School Sprint", badge: "🏫", sky: "linear-gradient(#72cbff, #dff5ff 50%, #8fc46c 51%)", horizon: "#83a8ba", ground: "#6aa24f", road: "#424b58", accent: "#ffd44d", scenery: ["🏫","🚌","🌳","🎒","📚"] },
  candy: { name: "Candy Kingdom", badge: "🍭", sky: "linear-gradient(#c682ff, #ffd3f4 50%, #ffb4cf 51%)", horizon: "#dc83bc", ground: "#ff9bbd", road: "#704c75", accent: "#fff175", scenery: ["🍭","🍬","🧁","🍩","🎂"] },
  night: { name: "Neon Night", badge: "🌃", sky: "linear-gradient(#15183d, #242659 55%, #101127 56%)", horizon: "#343560", ground: "#181a32", road: "#0b0d18", accent: "#37f3ff", scenery: ["🌃","🚕","✨","🏢","🌙"] },
  castle: { name: "Castle Quest", badge: "🏰", sky: "linear-gradient(#8ec8ff, #e6f4ff 48%, #74aa65 49%)", horizon: "#89909c", ground: "#618d50", road: "#665f59", accent: "#ffd768", scenery: ["🏰","🌲","🛡️","🐉","👑"] },
  ocean: { name: "Ocean Tunnel", badge: "🐠", sky: "linear-gradient(#24a9df, #12699d 55%, #0b436b 56%)", horizon: "#14668a", ground: "#12577a", road: "#15364d", accent: "#64f7e9", scenery: ["🐠","🐟","🪸","🐙","🌊"] },
  volcano: { name: "Volcano Run", badge: "🌋", sky: "linear-gradient(#ff7a4f, #4e2531 58%, #2a1b22 59%)", horizon: "#71352e", ground: "#4c3029", road: "#1e2024", accent: "#ffcf4f", scenery: ["🌋","🔥","🪨","🌫️","⚡"] },
  park: { name: "Super Park", badge: "🛝", sky: "linear-gradient(#67d4ff, #dbf7ff 52%, #83bf5d 53%)", horizon: "#75a75e", ground: "#69a64d", road: "#4b535c", accent: "#ffde59", scenery: ["🛝","🌳","🪁","🌼","🚲"] },
  desert: { name: "Desert Dash", badge: "🏜️", sky: "linear-gradient(#62cfff, #f5dfb3 50%, #e1ad58 51%)", horizon: "#d69a4f", ground: "#d9a34d", road: "#735941", accent: "#ffdd6d", scenery: ["🌵","🏜️","🐪","☀️","🪨"] },
  arcade: { name: "Pixel Arcade", badge: "🕹️", sky: "linear-gradient(#2b135d, #501e78 55%, #181028 56%)", horizon: "#54217a", ground: "#21143c", road: "#0c0a18", accent: "#00f6ff", scenery: ["👾","🕹️","🎮","✨","💎"] },
};

const M = (action: string, target: Thing, distractors: Thing[], theme: Theme, goal = 8): Mission => ({ action, target, distractors, theme, goal });
const MISSIONS: Mission[] = [
  M("Rescue all the cats", {label:"cat",emoji:"🐱"}, [{label:"dog",emoji:"🐶"},{label:"rabbit",emoji:"🐰"},{label:"frog",emoji:"🐸"},{label:"pig",emoji:"🐷"}], THEMES.city),
  M("Catch all the apples", {label:"apple",emoji:"🍎"}, [{label:"banana",emoji:"🍌"},{label:"orange",emoji:"🍊"},{label:"grapes",emoji:"🍇"},{label:"pear",emoji:"🍐"}], THEMES.farm),
  M("Catch all the fish", {label:"fish",emoji:"🐟"}, [{label:"crab",emoji:"🦀"},{label:"shell",emoji:"🐚"},{label:"turtle",emoji:"🐢"},{label:"octopus",emoji:"🐙"}], THEMES.beach),
  M("Catch all the stars", {label:"star",emoji:"⭐"}, [{label:"moon",emoji:"🌙"},{label:"planet",emoji:"🪐"},{label:"rocket",emoji:"🚀"},{label:"comet",emoji:"☄️"}], THEMES.space),
  M("Catch all the snowflakes", {label:"snowflake",emoji:"❄️"}, [{label:"tree",emoji:"🌲"},{label:"snowman",emoji:"⛄"},{label:"sled",emoji:"🛷"},{label:"mountain",emoji:"🏔️"}], THEMES.snow),
  M("Rescue all the monkeys", {label:"monkey",emoji:"🐒"}, [{label:"tiger",emoji:"🐯"},{label:"parrot",emoji:"🦜"},{label:"snake",emoji:"🐍"},{label:"frog",emoji:"🐸"}], THEMES.jungle),
  M("Catch all the books", {label:"book",emoji:"📘"}, [{label:"pencil",emoji:"✏️"},{label:"backpack",emoji:"🎒"},{label:"scissors",emoji:"✂️"},{label:"ruler",emoji:"📏"}], THEMES.school),
  M("Catch all the lollipops", {label:"lollipop",emoji:"🍭"}, [{label:"candy",emoji:"🍬"},{label:"cupcake",emoji:"🧁"},{label:"donut",emoji:"🍩"},{label:"cake",emoji:"🎂"}], THEMES.candy),
  M("Catch all the yellow taxis", {label:"taxi",emoji:"🚕"}, [{label:"car",emoji:"🚗"},{label:"bus",emoji:"🚌"},{label:"bike",emoji:"🚲"},{label:"truck",emoji:"🚚"}], THEMES.night),
  M("Catch all the crowns", {label:"crown",emoji:"👑"}, [{label:"shield",emoji:"🛡️"},{label:"dragon",emoji:"🐉"},{label:"castle",emoji:"🏰"},{label:"gem",emoji:"💎"}], THEMES.castle),
  M("Catch all the turtles", {label:"turtle",emoji:"🐢"}, [{label:"fish",emoji:"🐟"},{label:"octopus",emoji:"🐙"},{label:"coral",emoji:"🪸"},{label:"whale",emoji:"🐋"}], THEMES.ocean),
  M("Catch all the water drops", {label:"water",emoji:"💧"}, [{label:"fire",emoji:"🔥"},{label:"rock",emoji:"🪨"},{label:"cloud",emoji:"☁️"},{label:"lightning",emoji:"⚡"}], THEMES.volcano),
  M("Catch all the soccer balls", {label:"soccer ball",emoji:"⚽"}, [{label:"basketball",emoji:"🏀"},{label:"football",emoji:"🏈"},{label:"baseball",emoji:"⚾"},{label:"tennis ball",emoji:"🎾"}], THEMES.park),
  M("Catch all the suns", {label:"sun",emoji:"☀️"}, [{label:"cactus",emoji:"🌵"},{label:"camel",emoji:"🐪"},{label:"rock",emoji:"🪨"},{label:"tent",emoji:"⛺"}], THEMES.desert),
  M("Catch all the gems", {label:"gem",emoji:"💎"}, [{label:"game",emoji:"🎮"},{label:"alien",emoji:"👾"},{label:"joystick",emoji:"🕹️"},{label:"star",emoji:"⭐"}], THEMES.arcade, 10),
];

const SPEED = {
  easy: { fall: 0.64, spawn: 1080, label: "Easy", description: "Slow · lots of response time" },
  medium: { fall: 0.98, spawn: 760, label: "Medium", description: "Steady runner speed" },
  hard: { fall: 1.48, spawn: 500, label: "Hard", description: "Fast · quick response" },
} as const;

const BUDDY_EMOJI: Record<BuddyPreset, string> = { puppy:"🐶", dino:"🦕", robot:"🤖", bunny:"🐰" };

function celebrationLine(label: string) {
  const lines = ["Got a " + label + "!","Yes! " + label + "!","Great catch! " + label + "!","You found the " + label + "!"];
  return lines[Math.floor(Math.random()*lines.length)];
}

function RunnerAvatar({ jumping }: { jumping: boolean }) {
  return (
    <div className={"relative w-20 h-28 transition-transform duration-200 " + (jumping ? "-translate-y-32 rotate-[-8deg]" : "")}>
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-11 h-11 rounded-full bg-amber-200 border-4 border-white shadow-xl">
        <div className="absolute left-2 top-4 w-1.5 h-1.5 bg-slate-900 rounded-full" />
        <div className="absolute right-2 top-4 w-1.5 h-1.5 bg-slate-900 rounded-full" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-4 h-1.5 bg-rose-500 rounded-full" />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-9 w-12 h-12 rounded-xl bg-gradient-to-b from-cyan-300 to-blue-600 border-4 border-white shadow-lg" />
      <div className="absolute left-[21px] top-[75px] w-5 h-12 bg-slate-800 rounded-full rotate-[12deg] origin-top" />
      <div className="absolute right-[21px] top-[75px] w-5 h-12 bg-slate-800 rounded-full rotate-[-18deg] origin-top" />
      <div className="absolute left-[5px] top-[50px] w-6 h-4 bg-amber-200 rounded-full rotate-[-22deg]" />
      <div className="absolute right-[5px] top-[50px] w-6 h-4 bg-amber-200 rounded-full rotate-[24deg]" />
    </div>
  );
}

function TargetToken({ item }: { item: FallingThing }) {
  return (
    <div className={"relative transition-all " + (item.handled ? "opacity-25 scale-75" : "")}>
      <div className={"absolute -inset-2 rounded-[1.5rem] blur-md opacity-50 " + (item.isTarget ? "bg-emerald-300" : "bg-white")} />
      <div className={"relative w-17 h-17 sm:w-21 sm:h-21 rounded-[1.4rem] border-4 shadow-2xl grid place-items-center text-4xl sm:text-5xl " + (item.isTarget ? "bg-gradient-to-br from-white to-emerald-100 border-emerald-200" : "bg-gradient-to-br from-white to-slate-200 border-white")}>
        <span className="drop-shadow">{item.emoji}</span>
        <div className="absolute inset-x-2 top-1 h-2 rounded-full bg-white/70 blur-[1px]" />
      </div>
      <div className="relative mt-1 mx-auto w-max max-w-24 truncate rounded-full bg-slate-950/90 px-2 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wide text-white shadow">{item.label}</div>
    </div>
  );
}

export default function ReadingRunnerPro({ onBack, buddy }: { onBack: () => void; buddy: BuddyConfig }) {
  const [difficulty,setDifficulty]=useState<Difficulty>("easy");
  const [started,setStarted]=useState(false);
  const [missionIndex,setMissionIndex]=useState(0);
  const [lane,setLane]=useState(1);
  const [jumping,setJumping]=useState(false);
  const [things,setThings]=useState<FallingThing[]>([]);
  const [caught,setCaught]=useState(0);
  const [score,setScore]=useState(0);
  const [hearts,setHearts]=useState(3);
  const [message,setMessage]=useState("Swipe to move. Swipe up to jump.");
  const [flash,setFlash]=useState<"good"|"wrong"|null>(null);
  const [missionComplete,setMissionComplete]=useState(false);
  const [gameOver,setGameOver]=useState(false);
  const [soundOn,setSoundOn]=useState(true);

  const touchStart=useRef<{x:number;y:number}|null>(null);
  const nextId=useRef(1);
  const laneRef=useRef(lane);
  const jumpingRef=useRef(jumping);
  const heartsRef=useRef(hearts);
  const caughtRef=useRef(caught);
  const startedRef=useRef(started);
  const missionCompleteRef=useRef(missionComplete);
  const gameOverRef=useRef(gameOver);
  const audioRef=useRef<AudioContext|null>(null);
  const mission=MISSIONS[missionIndex % MISSIONS.length];
  const speed=SPEED[difficulty];

  useEffect(()=>{laneRef.current=lane;},[lane]);
  useEffect(()=>{jumpingRef.current=jumping;},[jumping]);
  useEffect(()=>{heartsRef.current=hearts;},[hearts]);
  useEffect(()=>{caughtRef.current=caught;},[caught]);
  useEffect(()=>{startedRef.current=started;},[started]);
  useEffect(()=>{missionCompleteRef.current=missionComplete;},[missionComplete]);
  useEffect(()=>{gameOverRef.current=gameOver;},[gameOver]);

  const sfx=useCallback((kind:"catch"|"wrong"|"jump"|"move"|"complete")=>{
    if(!soundOn) return;
    try{
      const ctx=audioRef.current || new AudioContext();
      audioRef.current=ctx;
      void ctx.resume();
      const now=ctx.currentTime;
      const tones=kind==="catch"?[[740,0],[980,.07]]:kind==="wrong"?[[190,0],[135,.12]]:kind==="jump"?[[360,0],[520,.09]]:kind==="move"?[[260,0]]:[[523,0],[659,.1],[784,.2],[1047,.32]];
      tones.forEach(([freq,offset])=>{
        const o=ctx.createOscillator(); const g=ctx.createGain();
        o.type=kind==="wrong"?"sawtooth":"sine"; o.frequency.setValueAtTime(freq,now+offset);
        g.gain.setValueAtTime(.0001,now+offset); g.gain.exponentialRampToValueAtTime(kind==="move"?.025:.08,now+offset+.015); g.gain.exponentialRampToValueAtTime(.0001,now+offset+.14);
        o.connect(g); g.connect(ctx.destination); o.start(now+offset); o.stop(now+offset+.16);
      });
    }catch{}
  },[soundOn]);

  const say=useCallback((text:string,calm=false)=>{
    if(!buddy.voiceEnabled)return;
    stopSpeaking();
    void speakCharacterAI(text,{calmMode:calm||!!buddy.calmMode,onFallback:()=>{
      if(!("speechSynthesis" in window))return;
      window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=.92; window.speechSynthesis.speak(u);
    }});
  },[buddy.voiceEnabled,buddy.calmMode]);

  const announceMission=useCallback(()=>{
    setMessage(mission.action+"!");
    say("Level "+(missionIndex+1)+". "+mission.theme.name+". "+mission.action+". Swipe left or right to move. Swipe up to jump over the wrong things.",difficulty==="easy");
  },[mission,missionIndex,say,difficulty]);

  const jump=useCallback(()=>{
    if(!startedRef.current||gameOverRef.current||missionCompleteRef.current||jumpingRef.current)return;
    sfx("jump"); setJumping(true); jumpingRef.current=true;
    window.setTimeout(()=>{setJumping(false);jumpingRef.current=false;},difficulty==="hard"?500:650);
  },[difficulty,sfx]);

  const moveLane=useCallback((direction:-1|1)=>{
    if(!startedRef.current||gameOverRef.current||missionCompleteRef.current)return;
    sfx("move");
    setLane(current=>Math.max(0,Math.min(2,current+direction)));
  },[sfx]);

  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==="ArrowLeft")moveLane(-1);if(e.key==="ArrowRight")moveLane(1);if(e.key==="ArrowUp"||e.key===" "){e.preventDefault();jump();}};
    window.addEventListener("keydown",key); return()=>window.removeEventListener("keydown",key);
  },[moveLane,jump]);

  useEffect(()=>{if(started&&!gameOver&&!missionComplete)announceMission();},[started,gameOver,missionComplete,missionIndex,announceMission]);

  useEffect(()=>{
    if(!started||gameOver||missionComplete)return;
    const timer=window.setInterval(()=>{
      const isTarget=Math.random()<.48;
      const source=isTarget?mission.target:mission.distractors[Math.floor(Math.random()*mission.distractors.length)];
      setThings(current=>[...current.filter(i=>i.y<105),{...source,id:nextId.current++,lane:Math.floor(Math.random()*3),y:-10,isTarget,handled:false}]);
    },speed.spawn);
    return()=>window.clearInterval(timer);
  },[started,gameOver,missionComplete,mission,speed.spawn]);

  useEffect(()=>{
    if(!started||gameOver||missionComplete)return;
    const timer=window.setInterval(()=>{
      let got:FallingThing|null=null; let wrong:FallingThing|null=null;
      setThings(current=>current.map(item=>{
        const nextY=item.y+speed.fall;
        if(!item.handled&&nextY>=78&&nextY<=94&&item.lane===laneRef.current&&!jumpingRef.current){
          if(item.isTarget)got=item;else wrong=item;
          return {...item,y:nextY,handled:true};
        }
        return {...item,y:nextY};
      }).filter(item=>item.y<108&&!(item.handled&&item.y>96)));

      if(got){
        const item=got as FallingThing; const nextCaught=caughtRef.current+1;
        caughtRef.current=nextCaught; setCaught(nextCaught); setScore(v=>v+(difficulty==="hard"?40:difficulty==="medium"?25:15));
        setFlash("good"); sfx("catch"); const line=celebrationLine(item.label); setMessage(line); say(line); window.setTimeout(()=>setFlash(null),300);
        if(nextCaught>=mission.goal){
          missionCompleteRef.current=true;setMissionComplete(true);setThings([]);sfx("complete");
          setMessage("Level complete!");say("Level complete! You found all the "+mission.target.label+"s. Great job!");
        }
      }
      if(wrong){
        const item=wrong as FallingThing; const next=Math.max(0,heartsRef.current-1);
        heartsRef.current=next;setHearts(next);setFlash("wrong");sfx("wrong");
        setMessage("That is a "+item.label+". Find "+mission.target.label+"!");
        say("That is a "+item.label+". Keep looking for "+mission.target.label+"s.",true);window.setTimeout(()=>setFlash(null),350);
        if(next<=0){gameOverRef.current=true;setGameOver(true);setStarted(false);setThings([]);say("Nice try. Let's run that level again.");}
      }
    },32);
    return()=>window.clearInterval(timer);
  },[started,gameOver,missionComplete,speed.fall,difficulty,mission,say,sfx]);

  useEffect(()=>()=>{stopSpeaking();void audioRef.current?.close();},[]);

  const resetLevel=(index:number,resetScore=false)=>{
    setMissionIndex(index);setCaught(0);caughtRef.current=0;setHearts(3);heartsRef.current=3;setLane(1);setThings([]);setMissionComplete(false);missionCompleteRef.current=false;setGameOver(false);gameOverRef.current=false;
    if(resetScore)setScore(0);
    setMessage("Get ready!");
  };
  const startGame=()=>{stopSpeaking();setStarted(true);startedRef.current=true;resetLevel(0,true);};
  const retry=()=>{setStarted(true);startedRef.current=true;resetLevel(missionIndex,false);};
  const nextMission=()=>resetLevel((missionIndex+1)%MISSIONS.length,false);

  const swipeEnd=(x:number,y:number)=>{
    const start=touchStart.current;touchStart.current=null;if(!start)return;
    const dx=x-start.x,dy=y-start.y,ax=Math.abs(dx),ay=Math.abs(dy);if(Math.max(ax,ay)<24)return;
    if(ay>ax&&dy<0)jump();else if(ax>=ay&&dx<0)moveLane(-1);else if(ax>=ay&&dx>0)moveLane(1);
  };

  const playerLeft=["16.66%","50%","83.33%"][lane];
  const buddyVisual=buddy.type==="upload"&&buddy.imageData?<img src={buddy.imageData} alt={buddy.name} className="w-full h-full object-cover rounded-full" />:<span>{BUDDY_EMOJI[buddy.preset]||"🐶"}</span>;
  const progress=Math.min(100,(caught/mission.goal)*100);

  if(!started&&!gameOver){
    return(
      <div className="min-h-screen text-white px-4 py-5 overflow-hidden relative" style={{background:"radial-gradient(circle at 70% 10%, #154a73, #06111f 58%, #02050a)"}}>
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{backgroundImage:"linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px, transparent 1px)",backgroundSize:"42px 42px"}} />
        <div className="max-w-6xl mx-auto relative">
          <div className="flex justify-between gap-3">
            <button type="button" onClick={onBack} className="min-h-12 px-4 rounded-2xl bg-slate-950/80 border border-white/20 font-black flex items-center gap-2 shadow-xl"><ArrowLeft className="w-5 h-5"/> Games</button>
            <button type="button" onClick={()=>setSoundOn(v=>!v)} className="w-12 h-12 rounded-2xl bg-slate-950/80 border border-white/20 grid place-items-center">{soundOn?<Volume2/>:<VolumeX/>}</button>
          </div>

          <div className="mt-5 grid lg:grid-cols-[1.05fr_.95fr] gap-5">
            <section className="rounded-[2.3rem] bg-slate-950/88 border-2 border-cyan-300/30 p-6 sm:p-8 shadow-2xl backdrop-blur">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 border border-cyan-200/30 px-3 py-1 text-xs font-black uppercase tracking-widest text-cyan-200"><Zap className="w-4 h-4"/> 15 WORLD ADVENTURE</div>
              <h1 className="text-5xl sm:text-7xl font-black mt-4 tracking-tight">Reading<br/><span className="text-cyan-300">Runner</span></h1>
              <p className="text-lg sm:text-xl font-bold text-white/80 mt-4">Hear the mission. Swipe through a real course. Collect only the right targets and jump the rest.</p>
              <div className="grid sm:grid-cols-3 gap-3 mt-7">
                {(Object.keys(SPEED) as Difficulty[]).map(level=><button key={level} type="button" onClick={()=>setDifficulty(level)} className={"rounded-2xl border-2 p-4 text-left min-h-24 transition " +(difficulty===level?"border-cyan-300 bg-cyan-300/15 shadow-lg":"border-white/15 bg-white/5")}><div className="font-black text-xl">{SPEED[level].label}</div><div className="text-sm text-white/65 mt-1">{SPEED[level].description}</div></button>)}
              </div>
              <button type="button" onClick={startGame} className="mt-6 w-full min-h-17 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 text-slate-950 text-xl font-black shadow-[0_0_35px_rgba(80,220,255,.35)]">▶ Start World 1</button>
            </section>

            <section className="rounded-[2.3rem] overflow-hidden border-2 border-white/20 bg-slate-900 shadow-2xl">
              <div className="relative h-72 overflow-hidden" style={{background:THEMES.city.sky}}>
                <div className="absolute inset-x-0 bottom-[35%] h-[22%]" style={{background:THEMES.city.horizon}} />
                <div className="absolute inset-x-0 bottom-0 h-[36%]" style={{background:THEMES.city.ground}} />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[72%] h-[62%] origin-bottom" style={{background:THEMES.city.road,clipPath:"polygon(38% 0,62% 0,100% 100%,0 100%)"}} />
                <div className="absolute inset-x-0 bottom-[37%] flex justify-around text-5xl">{THEMES.city.scenery.map((x,i)=><span key={i}>{x}</span>)}</div>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-5 scale-75"><RunnerAvatar jumping={false}/></div>
                <div className="absolute top-4 right-4 rounded-full bg-slate-950/75 px-3 py-1 text-xs font-black">LEVEL 1 · {THEMES.city.name}</div>
              </div>
              <div className="p-5 bg-slate-950">
                <h2 className="text-xl font-black">15 changing worlds</h2>
                <div className="flex gap-2 overflow-x-auto mt-3 pb-2">{MISSIONS.map((m,i)=><div key={i} className="flex-shrink-0 rounded-xl bg-white/8 px-3 py-2 text-center"><div className="text-2xl">{m.theme.badge}</div><div className="text-[10px] font-black">L{i+1}</div></div>)}</div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs font-black text-white/70"><div className="rounded-xl bg-white/5 p-2">← → Move</div><div className="rounded-xl bg-white/5 p-2">↑ Jump</div><div className="rounded-xl bg-white/5 p-2">🔊 Sound FX</div></div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if(gameOver){
    return <div className="min-h-screen bg-[#050914] text-white grid place-items-center p-5"><div className="w-full max-w-lg rounded-[2rem] bg-slate-900 border-2 border-white/15 p-7 text-center shadow-2xl"><div className="text-7xl">🏁</div><h1 className="text-4xl font-black mt-3">Run it again!</h1><p className="text-xl font-bold text-white/70 mt-2">Level {missionIndex+1} · {mission.theme.name}</p><p className="text-3xl font-black text-amber-300 mt-2">{score} points</p><button type="button" onClick={retry} className="mt-6 w-full min-h-14 rounded-2xl bg-cyan-300 text-slate-950 font-black flex items-center justify-center gap-2"><RotateCcw className="w-5 h-5"/> Retry level</button><button type="button" onClick={onBack} className="mt-2 w-full min-h-12 rounded-2xl bg-white/10 font-black">Back to games</button></div></div>;
  }

  return(
    <div className="min-h-screen bg-[#030712] text-white p-3 sm:p-5 select-none">
      <style>{"@keyframes roadMove{from{transform:translateY(-35px)}to{transform:translateY(0)}} @keyframes floatScene{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}} .road-stripes{animation:roadMove .55s linear infinite}.scene-float{animation:floatScene 3s ease-in-out infinite}"}</style>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button type="button" onClick={onBack} className="min-h-11 px-3 rounded-xl bg-slate-900 border border-white/15 font-black flex items-center gap-2"><ArrowLeft className="w-4 h-4"/> Games</button>
          <div className="rounded-xl bg-cyan-300 text-slate-950 px-3 py-2 font-black">LEVEL {missionIndex+1}/{MISSIONS.length}</div>
          <div className="flex-1 min-w-[180px]"><div className="text-xs uppercase tracking-widest font-black text-cyan-300">{mission.theme.badge} {mission.theme.name} · {SPEED[difficulty].label}</div><div className="text-xl sm:text-2xl font-black">{mission.action}</div></div>
          <button type="button" onClick={()=>setSoundOn(v=>!v)} className="w-11 h-11 rounded-xl bg-white/10 grid place-items-center">{soundOn?<Volume2 className="w-5 h-5"/>:<VolumeX className="w-5 h-5"/>}</button>
          <div className="flex items-center gap-1 rounded-xl bg-rose-500/15 px-3 py-2">{Array.from({length:3}).map((_,i)=><Heart key={i} className={"w-5 h-5 "+(i<hearts?"fill-rose-400 text-rose-400":"text-white/20")}/>)}</div>
          <div className="rounded-xl bg-amber-400/15 text-amber-300 px-3 py-2 font-black"><Star className="w-4 h-4 inline fill-current mr-1"/>{score}</div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-white/10 p-3 mb-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/10 grid place-items-center text-3xl overflow-hidden flex-shrink-0">{buddyVisual}</div>
            <div className="flex-1 min-w-0"><div className="font-black truncate">{message}</div><div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full transition-all" style={{width:progress+"%",background:mission.theme.accent}}/></div><div className="text-xs font-bold text-white/55 mt-1">{caught} / {mission.goal} {mission.target.label}s</div></div>
            <button type="button" onClick={announceMission} className="w-11 h-11 rounded-xl bg-white/10 grid place-items-center"><Volume2 className="w-5 h-5"/></button>
          </div>
        </div>

        <div
          className={"relative overflow-hidden rounded-[2rem] border-4 touch-none shadow-2xl "+(flash==="good"?"border-emerald-300":flash==="wrong"?"border-rose-400":"border-white/15")}
          style={{height:"min(70vh,760px)",minHeight:540,background:mission.theme.sky}}
          onPointerDown={e=>{touchStart.current={x:e.clientX,y:e.clientY};}}
          onPointerUp={e=>swipeEnd(e.clientX,e.clientY)}
          onPointerCancel={()=>{touchStart.current=null;}}
        >
          <div className="absolute inset-x-0 bottom-[35%] h-[24%]" style={{background:mission.theme.horizon}}/>
          <div className="absolute inset-x-0 bottom-0 h-[36%]" style={{background:mission.theme.ground}}/>
          <div className="absolute inset-x-0 bottom-[37%] flex justify-around items-end px-4 text-5xl sm:text-7xl opacity-95 scene-float">{mission.theme.scenery.map((x,i)=><span key={i} className={i%2?"scale-75":"scale-100"}>{x}</span>)}</div>

          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[94%] sm:w-[76%] h-[78%]" style={{background:mission.theme.road,clipPath:"polygon(40% 0,60% 0,100% 100%,0 100%)"}}>
            <div className="absolute inset-0 opacity-35" style={{background:"linear-gradient(90deg,transparent 32%,rgba(255,255,255,.35) 33%,rgba(255,255,255,.35) 34%,transparent 35%,transparent 65%,rgba(255,255,255,.35) 66%,rgba(255,255,255,.35) 67%,transparent 68%)"}}/>
            <div className="road-stripes absolute inset-x-[20%] top-0 bottom-0 opacity-60" style={{backgroundImage:"repeating-linear-gradient(to bottom,rgba(255,255,255,.75) 0 18px,transparent 18px 56px)",backgroundSize:"8px 56px",backgroundPosition:"50% 0",backgroundRepeat:"repeat-y"}}/>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 rounded-full bg-slate-950/85 border border-white/20 px-4 py-2 font-black text-sm sm:text-base whitespace-nowrap shadow-xl">{mission.target.emoji} {mission.action}</div>

          {things.map(item=><div key={item.id} className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-75" style={{left:["24%","50%","76%"][item.lane],top:item.y+"%"}}><TargetToken item={item}/></div>)}

          <div className="absolute z-40 -translate-x-1/2 transition-[left] duration-150 ease-out" style={{left:["24%","50%","76%"][lane],bottom:"4%"}}><RunnerAvatar jumping={jumping}/></div>

          {missionComplete&&<div className="absolute inset-0 z-50 bg-slate-950/76 backdrop-blur-sm grid place-items-center p-5"><div className="w-full max-w-lg rounded-[2rem] bg-white text-slate-950 p-7 text-center shadow-2xl border-4 border-amber-300"><div className="text-7xl">{mission.theme.badge}🎉</div><p className="text-xs font-black uppercase tracking-widest text-violet-700 mt-2">Level {missionIndex+1} complete</p><h2 className="text-4xl font-black mt-1">{mission.theme.name}</h2><p className="font-bold text-slate-600 mt-2">You found all the {mission.target.label}s.</p><button type="button" onClick={nextMission} className="mt-5 w-full min-h-15 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black">{missionIndex===MISSIONS.length-1?"Play World 1 again":"Next world →"}</button></div></div>}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm font-black text-white/70"><div className="rounded-xl bg-slate-900 p-2">← Swipe left</div><div className="rounded-xl bg-slate-900 p-2">↑ Jump</div><div className="rounded-xl bg-slate-900 p-2">Swipe right →</div></div>
      </div>
    </div>
  );
}
