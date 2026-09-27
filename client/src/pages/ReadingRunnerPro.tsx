import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, RotateCcw, Star, Volume2, VolumeX, Zap } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

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
  easy: { fall: 0.48, spawn: 1380, label: "Easy", description: "Toddler assist · slow + gentle auto-catch" },
  medium: { fall: 0.90, spawn: 820, label: "Medium", description: "Steady runner speed" },
  hard: { fall: 1.42, spawn: 520, label: "Hard", description: "Fast · quick response" },
} as const;


function celebrationLine(label: string) {
  const lines = ["Got a " + label + "!","Yes! " + label + "!","Great catch! " + label + "!","You found the " + label + "!"];
  return lines[Math.floor(Math.random()*lines.length)];
}

function RunnerAvatar({ jumping }: { jumping: boolean }) {
  return (
    <div className={"relative w-24 h-32 transition-transform duration-200 drop-shadow-2xl " + (jumping ? "-translate-y-32 rotate-[-6deg] scale-105" : "")}>
      <svg viewBox="0 0 120 160" className="w-full h-full overflow-visible" role="img" aria-label="Friendly runner">
        <defs>
          <linearGradient id="runnerShirt" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="55%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          <linearGradient id="runnerShorts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <filter id="runnerShadow"><feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity=".35"/></filter>
        </defs>
        <ellipse cx="60" cy="151" rx="34" ry="7" fill="rgba(15,23,42,.28)" />
        <g filter="url(#runnerShadow)">
          <path d="M44 91 C39 108 34 125 27 145" stroke="#1e293b" strokeWidth="15" strokeLinecap="round" />
          <path d="M76 91 C82 110 86 126 94 145" stroke="#1e293b" strokeWidth="15" strokeLinecap="round" />
          <path d="M20 145 Q31 139 43 145 L42 153 Q27 157 16 152 Z" fill="#ffffff" />
          <path d="M82 145 Q96 139 107 146 L105 153 Q91 157 80 152 Z" fill="#ffffff" />
          <path d="M37 73 L18 98" stroke="#f2bd84" strokeWidth="13" strokeLinecap="round" />
          <path d="M83 73 L104 94" stroke="#f2bd84" strokeWidth="13" strokeLinecap="round" />
          <path d="M38 65 Q60 53 82 65 L80 103 Q61 114 40 103 Z" fill="url(#runnerShirt)" stroke="#ffffff" strokeWidth="4" />
          <path d="M39 99 Q60 108 81 99 L78 119 Q59 126 42 118 Z" fill="url(#runnerShorts)" />
          <circle cx="60" cy="43" r="29" fill="#f2bd84" stroke="#ffffff" strokeWidth="5" />
          <path d="M33 40 Q35 10 62 10 Q89 12 88 42 Q73 29 55 30 Q43 30 33 40 Z" fill="#172554" />
          <path d="M35 32 Q58 14 86 31" stroke="#22d3ee" strokeWidth="7" strokeLinecap="round" />
          <circle cx="50" cy="45" r="3.5" fill="#172554" />
          <circle cx="70" cy="45" r="3.5" fill="#172554" />
          <path d="M51 58 Q60 66 70 57" fill="none" stroke="#9f1239" strokeWidth="4" strokeLinecap="round" />
          <circle cx="42" cy="54" r="4" fill="#fb7185" opacity=".55" />
          <circle cx="78" cy="54" r="4" fill="#fb7185" opacity=".55" />
          <path d="M45 70 L75 70" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="84" r="8" fill="#facc15" stroke="#ffffff" strokeWidth="3" />
          <path d="M57 80 L60 87 L65 82" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

function TargetToken({ item }: { item: FallingThing }) {
  return (
    <div className={"relative transition-all " + (item.handled ? "opacity-25 scale-75" : "")}>
      <div className="absolute -inset-2 rounded-[1.5rem] blur-md opacity-40 bg-white" />
      <div className="relative w-17 h-17 sm:w-21 sm:h-21 rounded-[1.4rem] border-4 shadow-2xl grid place-items-center text-4xl sm:text-5xl bg-gradient-to-br from-white to-slate-200 border-white">
        <span className="drop-shadow">{item.emoji}</span>
        <div className="absolute inset-x-2 top-1 h-2 rounded-full bg-white/70 blur-[1px]" />
      </div>
      <div className="relative mt-1 mx-auto w-max max-w-24 truncate rounded-full bg-slate-950/90 px-2 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wide text-white shadow">{item.label}</div>
    </div>
  );
}

export default function ReadingRunnerPro({ onBack }: { onBack: () => void }) {
  const [difficulty,setDifficulty]=useState<Difficulty>("easy");
  const [started,setStarted]=useState(false);
  const [setupStep,setSetupStep]=useState<"difficulty"|"level">("difficulty");
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
  const [captureBurst,setCaptureBurst]=useState<{label:string;emoji:string;id:number}|null>(null);

  const touchStart=useRef<{x:number;y:number}|null>(null);
  const nextId=useRef(1);
  const thingsRef=useRef<FallingThing[]>([]);
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

  const updateThings=useCallback((next:FallingThing[]|((current:FallingThing[])=>FallingThing[]))=>{
    const value=typeof next==="function" ? next(thingsRef.current) : next;
    thingsRef.current=value;
    setThings(value);
    return value;
  },[]);

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
    stopSpeaking();
    void speakCharacterAI(text,{calmMode:calm,onFallback:()=>{
      if(!("speechSynthesis" in window))return;
      window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=.92; window.speechSynthesis.speak(u);
    }});
  },[]);

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
      updateThings(current=>[...current.filter(i=>i.y<105),{...source,id:nextId.current++,lane:Math.floor(Math.random()*3),y:-10,isTarget,handled:false}]);
    },speed.spawn);
    return()=>window.clearInterval(timer);
  },[started,gameOver,missionComplete,mission,speed.spawn,updateThings]);

  useEffect(()=>{
    if(!started||gameOver||missionComplete)return;
    const timer=window.setInterval(()=>{
      let got:FallingThing|null=null;
      let wrong:FallingThing|null=null;
      const nextThings:FallingThing[]=[];

      for(const item of thingsRef.current){
        const nextY=item.y+speed.fall;
        if (difficulty === "easy" && item.isTarget && !item.handled && nextY >= 62 && nextY < 78 && !jumpingRef.current) {
          laneRef.current=item.lane;
          setLane(item.lane);
        }

        const captureStart=difficulty==="easy"?72:78;
        const captureEnd=difficulty==="easy"?97:94;
        let nextItem={...item,y:nextY};

        if(!item.handled&&nextY>=captureStart&&nextY<=captureEnd&&item.lane===laneRef.current&&!jumpingRef.current){
          nextItem={...nextItem,handled:true};
          if(item.isTarget&&!got) got=nextItem;
          else if(!item.isTarget&&!wrong) wrong=nextItem;
        }

        if(nextItem.y<108&&!(nextItem.handled&&nextItem.y>96)) nextThings.push(nextItem);
      }

      updateThings(nextThings);

      if(got){
        const item=got;
        const nextCaught=caughtRef.current+1;
        caughtRef.current=nextCaught;
        setCaught(nextCaught);
        setScore(v=>v+(difficulty==="hard"?40:difficulty==="medium"?25:15));
        setFlash("good");
        sfx("catch");
        const burstId=Date.now();
        setCaptureBurst({label:item.label,emoji:item.emoji,id:burstId});
        navigator.vibrate?.(45);
        const line=celebrationLine(item.label);
        setMessage("Captured "+nextCaught+" of "+mission.goal+"! "+line);
        celebrateEyeGaze(false);
        window.setTimeout(()=>setFlash(null),500);
        window.setTimeout(()=>setCaptureBurst(current=>current?.id===burstId?null:current),900);
        if(nextCaught>=mission.goal){
          missionCompleteRef.current=true;
          setMissionComplete(true);
          updateThings([]);
          sfx("complete");
          setMessage("Level complete! "+nextCaught+" of "+mission.goal+" captured.");
          say("Level complete! You found all the "+mission.target.label+"s. Great job!");
        }
      }

      if(wrong){
        const item=wrong;
        const next=difficulty==="easy"?heartsRef.current:Math.max(0,heartsRef.current-1);
        heartsRef.current=next;
        setHearts(next);
        setFlash("wrong");
        sfx("wrong");
        setMessage("That is a "+item.label+". Find "+mission.target.label+"!");
        say("That is a "+item.label+". Keep looking for "+mission.target.label+"s.",true);
        window.setTimeout(()=>setFlash(null),350);
        if(difficulty!=="easy"&&next<=0){
          gameOverRef.current=true;
          setGameOver(true);
          setStarted(false);
          updateThings([]);
          say("Nice try. Let's run that level again.");
        }
      }
    },32);
    return()=>window.clearInterval(timer);
  },[started,gameOver,missionComplete,speed.fall,difficulty,mission,say,sfx,updateThings]);

  useEffect(()=>()=>{stopSpeaking();void audioRef.current?.close();},[]);

  const resetLevel=(index:number,resetScore=false)=>{
    setMissionIndex(index);setCaught(0);caughtRef.current=0;setHearts(3);heartsRef.current=3;setLane(1);updateThings([]);setCaptureBurst(null);setMissionComplete(false);missionCompleteRef.current=false;setGameOver(false);gameOverRef.current=false;
    if(resetScore)setScore(0);
    setMessage("Get ready!");
  };
  const enterImmersive=()=>{ try { const el=document.documentElement as any; const request=el.requestFullscreen||el.webkitRequestFullscreen; if(request) void request.call(el).catch?.(()=>{}); } catch {} };
  const startGame=()=>{stopSpeaking();enterImmersive();setStarted(true);startedRef.current=true;resetLevel(missionIndex,true);};
  const openSetup=(step:"difficulty"|"level"="level")=>{
    setStarted(false);
    startedRef.current=false;
    updateThings([]);
    setMissionComplete(false);
    missionCompleteRef.current=false;
    setGameOver(false);
    gameOverRef.current=false;
    setSetupStep(step);
  };
  const retry=()=>{setStarted(true);startedRef.current=true;resetLevel(missionIndex,false);};
  const nextMission=()=>resetLevel((missionIndex+1)%MISSIONS.length,false);

  const swipeEnd=(x:number,y:number)=>{
    const start=touchStart.current;touchStart.current=null;if(!start)return;
    const dx=x-start.x,dy=y-start.y,ax=Math.abs(dx),ay=Math.abs(dy);if(Math.max(ax,ay)<24)return;
    if(ay>ax&&dy<0)jump();else if(ax>=ay&&dx<0)moveLane(-1);else if(ax>=ay&&dx>0)moveLane(1);
  };

  const playerLeft=["16.66%","50%","83.33%"][lane];
  const progress=Math.min(100,(caught/mission.goal)*100);

  if(!started&&!gameOver){
    return(
      <div className="fixed inset-0 z-[120] h-[100dvh] overflow-hidden text-white p-3 sm:p-5" style={{background:"radial-gradient(circle at 70% 10%, #154a73, #06111f 58%, #02050a)"}}>
        <style>{"@keyframes runnerSetupIn{from{opacity:.25;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}} .runner-setup-in{animation:runnerSetupIn .22s ease-out}"}</style>
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{backgroundImage:"linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px, transparent 1px)",backgroundSize:"42px 42px"}} />
        <div className="relative max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex items-center justify-between gap-2 flex-shrink-0">
            <button type="button" onClick={onBack} className="min-h-11 px-3 sm:px-4 rounded-2xl bg-slate-950/80 border border-white/20 font-black flex items-center gap-2 shadow-xl"><ArrowLeft className="w-5 h-5"/> Games</button>
            <div className="rounded-full bg-white/10 border border-white/15 px-3 py-2 text-xs font-black">READING RUNNER</div>
            <button type="button" onClick={()=>setSoundOn(v=>!v)} className="w-11 h-11 rounded-2xl bg-slate-950/80 border border-white/20 grid place-items-center" aria-label="Toggle sound">{soundOn?<Volume2 className="w-5 h-5"/>:<VolumeX className="w-5 h-5"/>}</button>
          </div>

          <div className="flex-1 min-h-0 grid place-items-center py-3">
            {setupStep==="difficulty" ? (
              <section key="difficulty" className="runner-setup-in w-full max-w-3xl rounded-[2rem] bg-white text-slate-950 border-4 border-cyan-400 p-5 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,.45)]">
                <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Step 1 of 2</p>
                <h1 className="text-3xl sm:text-5xl font-black mt-2">How fast should we run?</h1>
                <p className="font-bold text-slate-600 mt-2">Choose one. Easy is built for young learners and gives lots of time.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                  {(Object.keys(SPEED) as Difficulty[]).map(level=>(
                    <button key={level} type="button" onClick={()=>setDifficulty(level)} className={"min-h-24 rounded-2xl border-4 p-4 text-left transition touch-manipulation shadow-md "+(difficulty===level?"border-cyan-500 bg-cyan-100 text-slate-950 ring-4 ring-cyan-300/40":"border-slate-300 bg-slate-100 text-slate-950 hover:border-cyan-400 hover:bg-cyan-50")}>
                      <div className="text-2xl font-black">{level==="easy"?"🧸":level==="medium"?"🏃":"⚡"} {SPEED[level].label}</div>
                      <div className="text-sm font-bold text-slate-600 mt-1">{SPEED[level].description}</div>
                      {difficulty===level&&<div className="text-cyan-800 font-black mt-2">✓ Selected</div>}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={()=>setSetupStep("level")} className="mt-5 w-full min-h-16 rounded-2xl bg-cyan-300 text-slate-950 text-xl font-black shadow-xl">Next: choose a world →</button>
              </section>
            ) : (
              <section key="level" className="runner-setup-in w-full max-w-4xl h-full max-h-[760px] rounded-[2rem] bg-white text-slate-950 border-4 border-cyan-400 p-4 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,.45)] flex flex-col min-h-0">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button type="button" onClick={()=>setSetupStep("difficulty")} className="min-h-11 rounded-xl bg-slate-200 border-2 border-slate-300 text-slate-950 px-3 font-black shadow-sm">← Speed</button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Step 2 of 2</p>
                    <h1 className="text-2xl sm:text-4xl font-black">Choose a world</h1>
                  </div>
                  <div className="rounded-full bg-cyan-300 text-slate-950 px-3 py-2 text-xs font-black">{SPEED[difficulty].label}</div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
                  {MISSIONS.map((m,i)=>(
                    <button key={i} type="button" onClick={()=>setMissionIndex(i)} className={"min-h-[92px] rounded-2xl border-4 p-2 text-center touch-manipulation shadow-md "+(missionIndex===i?"border-cyan-500 bg-cyan-100 text-slate-950 ring-4 ring-cyan-300/40":"border-slate-300 bg-slate-100 text-slate-950 hover:border-cyan-400 hover:bg-cyan-50")}>
                      <div className="text-3xl sm:text-4xl">{m.theme.badge}</div>
                      <div className="font-black text-xs mt-1">LEVEL {i+1}</div>
                      <div className="text-[10px] font-bold text-slate-600 truncate">{m.theme.name}</div>
                    </button>
                  ))}
                </div>
                <div className="pt-3 flex-shrink-0">
                  <div className="rounded-xl bg-slate-100 border-2 border-slate-200 text-slate-950 px-3 py-2 text-center font-black text-sm truncate shadow-sm">{MISSIONS[missionIndex].target.emoji} {MISSIONS[missionIndex].action}</div>
                  <button type="button" onClick={startGame} className="mt-2 w-full min-h-16 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 text-slate-950 text-xl font-black shadow-xl">▶ Start Level {missionIndex+1}</button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }

  if(gameOver){
    return <div className="fixed inset-0 z-[120] h-[100dvh] bg-[#050914] text-white grid place-items-center p-5"><div className="w-full max-w-lg rounded-[2rem] bg-slate-900 border-2 border-white/15 p-7 text-center shadow-2xl"><div className="text-7xl">🏁</div><h1 className="text-4xl font-black mt-3">Run it again!</h1><p className="text-xl font-bold text-white/70 mt-2">Level {missionIndex+1} · {mission.theme.name}</p><p className="text-3xl font-black text-amber-300 mt-2">{score} points</p><button type="button" onClick={retry} className="mt-6 w-full min-h-14 rounded-2xl bg-cyan-300 text-slate-950 font-black flex items-center justify-center gap-2"><RotateCcw className="w-5 h-5"/> Retry level</button><button type="button" onClick={()=>openSetup("level")} className="mt-2 w-full min-h-12 rounded-2xl bg-violet-600 font-black">☰ Choose level</button><button type="button" onClick={onBack} className="mt-2 w-full min-h-12 rounded-2xl bg-white/10 font-black">Back to games</button></div></div>;
  }

  return(
    <div className="fixed inset-0 z-[120] h-[100dvh] overflow-hidden bg-[#030712] text-white p-2 sm:p-5 select-none">
      <style>{"@keyframes roadMove{from{transform:translateY(-35px)}to{transform:translateY(0)}} @keyframes floatScene{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}} .road-stripes{animation:roadMove .55s linear infinite}.scene-float{animation:floatScene 3s ease-in-out infinite}"}</style>
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <button type="button" onClick={()=>openSetup("level")} className="min-h-10 sm:min-h-11 px-3 rounded-xl bg-slate-900 border border-white/15 font-black text-sm flex items-center gap-1.5 flex-shrink-0">☰ <span className="hidden sm:inline">Setup</span></button>
          <button type="button" onClick={announceMission} className="flex-1 min-w-0 min-h-10 sm:min-h-11 rounded-xl bg-slate-900 border border-white/15 px-3 text-left">
            <div className="text-[9px] sm:text-xs uppercase tracking-wider font-black text-cyan-300 truncate">{mission.theme.badge} {mission.theme.name} · {SPEED[difficulty].label}</div>
            <div className="text-xs sm:text-base font-black truncate">{mission.target.emoji} {mission.action}</div>
          </button>
          <button type="button" onClick={()=>setSoundOn(v=>!v)} className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 border border-white/15 grid place-items-center flex-shrink-0" aria-label="Toggle sound">{soundOn?<Volume2 className="w-5 h-5"/>:<VolumeX className="w-5 h-5"/>}</button>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-2 flex-shrink-0 text-center">
          <div className="rounded-xl bg-cyan-300 text-slate-950 px-1 py-1.5 sm:py-2"><div className="text-[9px] sm:text-[10px] font-black uppercase">Level</div><div className="font-black text-sm sm:text-base">{missionIndex+1}/{MISSIONS.length}</div></div>
          <div className="rounded-xl bg-emerald-400 text-slate-950 px-1 py-1.5 sm:py-2"><div className="text-[9px] sm:text-[10px] font-black uppercase">Caught</div><div className="font-black text-sm sm:text-base">{caught}/{mission.goal}</div></div>
          <div className="rounded-xl bg-rose-500/20 text-rose-200 px-1 py-1.5 sm:py-2"><div className="text-[9px] sm:text-[10px] font-black uppercase">Hearts</div><div className="font-black text-sm sm:text-base">❤️ {hearts}</div></div>
          <div className="rounded-xl bg-amber-400/15 text-amber-300 px-1 py-1.5 sm:py-2"><div className="text-[9px] sm:text-[10px] font-black uppercase">Score</div><div className="font-black text-sm sm:text-base">{score}</div></div>
        </div>

        <div
          className={"relative flex-1 min-h-0 overflow-hidden rounded-2xl sm:rounded-[2rem] border-4 touch-none shadow-2xl "+(flash==="good"?"border-emerald-300":flash==="wrong"?"border-rose-400":"border-white/15")}
          style={{background:mission.theme.sky}}
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

          {things.map(item=><div key={item.id} className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-75" style={{left:["24%","50%","76%"][item.lane],top:item.y+"%",transform:"translate(-50%,-50%) scale("+(difficulty==="easy"&&item.isTarget?1.28:1)+")"}}><TargetToken item={item}/></div>)}

          <div className="absolute z-40 -translate-x-1/2 transition-[left] duration-150 ease-out" style={{left:["24%","50%","76%"][lane],bottom:"4%"}}><RunnerAvatar jumping={jumping}/></div>

          {captureBurst&&<div className="absolute inset-0 z-45 pointer-events-none grid place-items-center"><div className="rounded-[2rem] bg-emerald-500/95 border-4 border-white text-white px-7 py-5 text-center shadow-[0_0_55px_rgba(52,211,153,.8)] animate-bounce"><div className="text-7xl">{captureBurst.emoji}</div><div className="text-3xl sm:text-4xl font-black">✓ CAPTURED!</div><div className="text-xl font-black uppercase">{captureBurst.label}</div></div></div>}
          {difficulty==="easy"&&<div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 rounded-full bg-emerald-100/95 text-emerald-900 border-2 border-white px-4 py-2 text-xs sm:text-sm font-black shadow-lg">🧸 TODDLER ASSIST ON · targets gently pull into your lane</div>}
                    {missionComplete&&<div className="absolute inset-0 z-50 bg-slate-950/76 backdrop-blur-sm grid place-items-center p-5"><div className="w-full max-w-lg rounded-[2rem] bg-white text-slate-950 p-7 text-center shadow-2xl border-4 border-amber-300"><div className="text-7xl">{mission.theme.badge}🎉</div><p className="text-xs font-black uppercase tracking-widest text-violet-700 mt-2">Level {missionIndex+1} complete</p><h2 className="text-4xl font-black mt-1">{mission.theme.name}</h2><p className="font-bold text-slate-600 mt-2">You found all the {mission.target.label}s.</p><button type="button" onClick={nextMission} className="mt-5 w-full min-h-15 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black">{missionIndex===MISSIONS.length-1?"Play World 1 again":"Next world →"}</button></div></div>}
        </div>

        <div className="hidden sm:grid mt-3 grid-cols-3 gap-2 text-center text-xs sm:text-sm font-black text-white/70"><div className="rounded-xl bg-slate-900 p-2">← Swipe left</div><div className="rounded-xl bg-slate-900 p-2">↑ Jump</div><div className="rounded-xl bg-slate-900 p-2">Swipe right →</div></div>
      </div>
    </div>
  );
}
