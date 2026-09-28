import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, Sparkles, Volume2, VolumeX, Vibrate, VibrateOff } from "lucide-react";

type FidgetId = "popit"|"bubbles"|"spinner"|"slime"|"ripple"|"galaxy"|"clicker"|"stretch"|"liquid"|"kaleido"|"switches"|"tiles"|"reveal";

const FIDGETS:{id:FidgetId;name:string;emoji:string;hint:string}[]=[
  {id:"popit",name:"Mega Pop-It",emoji:"🌈",hint:"Big reusable silicone pops"},
  {id:"bubbles",name:"Bubble Wrap",emoji:"📦",hint:"Crinkle and pop a whole sheet"},
  {id:"spinner",name:"Fidget Spinner",emoji:"🌀",hint:"Flick it with real momentum"},
  {id:"slime",name:"Galaxy Slime",emoji:"🧪",hint:"Squish and stretch"},
  {id:"ripple",name:"Ripple Pool",emoji:"💧",hint:"Tap the water"},
  {id:"galaxy",name:"Star Maker",emoji:"🌌",hint:"Fill space with stars"},
  {id:"clicker",name:"Super Clicker",emoji:"🔘",hint:"Click, count, reset"},
  {id:"stretch",name:"Stretch Bands",emoji:"〰️",hint:"Pull the bands"},
  {id:"liquid",name:"Liquid Orbs",emoji:"🔮",hint:"Mix glowing blobs"},
  {id:"kaleido",name:"Kaleidoscope",emoji:"✨",hint:"Tap for new patterns"},
  {id:"switches",name:"Switch Board",emoji:"🎛️",hint:"Flip every switch"},
  {id:"tiles",name:"Glow Tiles",emoji:"🌈",hint:"Light up the grid"},
  {id:"reveal",name:"Reveal Tiles",emoji:"🎁",hint:"Tap tiles to uncover a surprise"},
];

type RevealCategory="all"|"food"|"animals"|"vehicles"|"toys"|"home"|"school"|"nature";
type RevealItem={name:string;emoji:string;category:Exclude<RevealCategory,"all">;bg:string};

const REVEAL_ITEMS:RevealItem[]=[
  {name:"Apple",emoji:"🍎",category:"food",bg:"linear-gradient(145deg,#fee2e2,#fecaca,#fff7ed)"},
  {name:"Banana",emoji:"🍌",category:"food",bg:"linear-gradient(145deg,#fef9c3,#fde68a,#fff7ed)"},
  {name:"Pizza",emoji:"🍕",category:"food",bg:"linear-gradient(145deg,#ffedd5,#fed7aa,#fde68a)"},
  {name:"Hamburger",emoji:"🍔",category:"food",bg:"linear-gradient(145deg,#fef3c7,#fdba74,#dcfce7)"},
  {name:"Taco",emoji:"🌮",category:"food",bg:"linear-gradient(145deg,#fef3c7,#fde68a,#bbf7d0)"},
  {name:"Ice Cream",emoji:"🍦",category:"food",bg:"linear-gradient(145deg,#fce7f3,#e0e7ff,#fef3c7)"},
  {name:"Strawberry",emoji:"🍓",category:"food",bg:"linear-gradient(145deg,#ffe4e6,#fecdd3,#dcfce7)"},
  {name:"Watermelon",emoji:"🍉",category:"food",bg:"linear-gradient(145deg,#dcfce7,#fecdd3,#f0fdf4)"},
  {name:"Cookie",emoji:"🍪",category:"food",bg:"linear-gradient(145deg,#fef3c7,#fed7aa,#fff7ed)"},
  {name:"Cupcake",emoji:"🧁",category:"food",bg:"linear-gradient(145deg,#fce7f3,#e9d5ff,#fef3c7)"},
  {name:"Dog",emoji:"🐶",category:"animals",bg:"linear-gradient(145deg,#fef3c7,#fed7aa,#dbeafe)"},
  {name:"Cat",emoji:"🐱",category:"animals",bg:"linear-gradient(145deg,#fef3c7,#fde68a,#e0e7ff)"},
  {name:"Lion",emoji:"🦁",category:"animals",bg:"linear-gradient(145deg,#fef3c7,#fdba74,#fde68a)"},
  {name:"Elephant",emoji:"🐘",category:"animals",bg:"linear-gradient(145deg,#e2e8f0,#cbd5e1,#dbeafe)"},
  {name:"Monkey",emoji:"🐵",category:"animals",bg:"linear-gradient(145deg,#fef3c7,#d6b892,#dcfce7)"},
  {name:"Frog",emoji:"🐸",category:"animals",bg:"linear-gradient(145deg,#dcfce7,#bbf7d0,#cffafe)"},
  {name:"Penguin",emoji:"🐧",category:"animals",bg:"linear-gradient(145deg,#e0f2fe,#dbeafe,#f8fafc)"},
  {name:"Butterfly",emoji:"🦋",category:"animals",bg:"linear-gradient(145deg,#dbeafe,#e9d5ff,#fce7f3)"},
  {name:"Dolphin",emoji:"🐬",category:"animals",bg:"linear-gradient(145deg,#cffafe,#bae6fd,#dbeafe)"},
  {name:"Horse",emoji:"🐴",category:"animals",bg:"linear-gradient(145deg,#fef3c7,#fed7aa,#dcfce7)"},
  {name:"Car",emoji:"🚗",category:"vehicles",bg:"linear-gradient(145deg,#fee2e2,#dbeafe,#e2e8f0)"},
  {name:"Bus",emoji:"🚌",category:"vehicles",bg:"linear-gradient(145deg,#fef9c3,#fde68a,#dbeafe)"},
  {name:"Train",emoji:"🚂",category:"vehicles",bg:"linear-gradient(145deg,#e2e8f0,#cbd5e1,#fed7aa)"},
  {name:"Airplane",emoji:"✈️",category:"vehicles",bg:"linear-gradient(145deg,#dbeafe,#bae6fd,#f8fafc)"},
  {name:"Rocket",emoji:"🚀",category:"vehicles",bg:"linear-gradient(145deg,#ddd6fe,#dbeafe,#fecdd3)"},
  {name:"Fire Truck",emoji:"🚒",category:"vehicles",bg:"linear-gradient(145deg,#fee2e2,#fecaca,#f8fafc)"},
  {name:"Bicycle",emoji:"🚲",category:"vehicles",bg:"linear-gradient(145deg,#dcfce7,#dbeafe,#fef3c7)"},
  {name:"Tractor",emoji:"🚜",category:"vehicles",bg:"linear-gradient(145deg,#dcfce7,#fde68a,#fed7aa)"},
  {name:"Boat",emoji:"⛵",category:"vehicles",bg:"linear-gradient(145deg,#cffafe,#bae6fd,#f8fafc)"},
  {name:"Helicopter",emoji:"🚁",category:"vehicles",bg:"linear-gradient(145deg,#e2e8f0,#dbeafe,#dcfce7)"},
  {name:"Teddy Bear",emoji:"🧸",category:"toys",bg:"linear-gradient(145deg,#fef3c7,#fed7aa,#fce7f3)"},
  {name:"Ball",emoji:"⚽",category:"toys",bg:"linear-gradient(145deg,#f8fafc,#dcfce7,#dbeafe)"},
  {name:"Puzzle",emoji:"🧩",category:"toys",bg:"linear-gradient(145deg,#e9d5ff,#dbeafe,#fce7f3)"},
  {name:"Yo-Yo",emoji:"🪀",category:"toys",bg:"linear-gradient(145deg,#fee2e2,#dbeafe,#fef3c7)"},
  {name:"Kite",emoji:"🪁",category:"toys",bg:"linear-gradient(145deg,#dbeafe,#cffafe,#fef3c7)"},
  {name:"Robot",emoji:"🤖",category:"toys",bg:"linear-gradient(145deg,#e2e8f0,#dbeafe,#e9d5ff)"},
  {name:"Video Game",emoji:"🎮",category:"toys",bg:"linear-gradient(145deg,#ddd6fe,#c4b5fd,#dbeafe)"},
  {name:"Blocks",emoji:"🧱",category:"toys",bg:"linear-gradient(145deg,#fed7aa,#fde68a,#dbeafe)"},
  {name:"Bed",emoji:"🛏️",category:"home",bg:"linear-gradient(145deg,#dbeafe,#e0e7ff,#f8fafc)"},
  {name:"Chair",emoji:"🪑",category:"home",bg:"linear-gradient(145deg,#fef3c7,#fed7aa,#f8fafc)"},
  {name:"Lamp",emoji:"💡",category:"home",bg:"linear-gradient(145deg,#fef9c3,#fde68a,#f8fafc)"},
  {name:"Bathtub",emoji:"🛁",category:"home",bg:"linear-gradient(145deg,#cffafe,#dbeafe,#f8fafc)"},
  {name:"Clock",emoji:"⏰",category:"home",bg:"linear-gradient(145deg,#fee2e2,#f8fafc,#dbeafe)"},
  {name:"Key",emoji:"🔑",category:"home",bg:"linear-gradient(145deg,#fef3c7,#fde68a,#f8fafc)"},
  {name:"Book",emoji:"📚",category:"school",bg:"linear-gradient(145deg,#fee2e2,#dbeafe,#fef3c7)"},
  {name:"Pencil",emoji:"✏️",category:"school",bg:"linear-gradient(145deg,#fef9c3,#fed7aa,#f8fafc)"},
  {name:"Backpack",emoji:"🎒",category:"school",bg:"linear-gradient(145deg,#dbeafe,#e0e7ff,#fee2e2)"},
  {name:"School",emoji:"🏫",category:"school",bg:"linear-gradient(145deg,#e0f2fe,#f8fafc,#dcfce7)"},
  {name:"Ruler",emoji:"📏",category:"school",bg:"linear-gradient(145deg,#fef3c7,#dcfce7,#f8fafc)"},
  {name:"Paint",emoji:"🎨",category:"school",bg:"linear-gradient(145deg,#fce7f3,#e9d5ff,#cffafe)"},
  {name:"Sun",emoji:"☀️",category:"nature",bg:"linear-gradient(145deg,#fef9c3,#fde68a,#dbeafe)"},
  {name:"Rainbow",emoji:"🌈",category:"nature",bg:"linear-gradient(145deg,#fee2e2,#fef3c7,#dcfce7,#dbeafe,#e9d5ff)"},
  {name:"Tree",emoji:"🌳",category:"nature",bg:"linear-gradient(145deg,#dcfce7,#bbf7d0,#fef3c7)"},
  {name:"Flower",emoji:"🌻",category:"nature",bg:"linear-gradient(145deg,#fef9c3,#dcfce7,#dbeafe)"},
  {name:"Snowflake",emoji:"❄️",category:"nature",bg:"linear-gradient(145deg,#e0f2fe,#dbeafe,#f8fafc)"},
  {name:"Moon",emoji:"🌙",category:"nature",bg:"linear-gradient(145deg,#e0e7ff,#c4b5fd,#dbeafe)"},
  {name:"Cloud",emoji:"☁️",category:"nature",bg:"linear-gradient(145deg,#f8fafc,#dbeafe,#e0f2fe)"},
  {name:"Leaf",emoji:"🍁",category:"nature",bg:"linear-gradient(145deg,#fed7aa,#fde68a,#dcfce7)"},
];

function audioPing(freq=420,duration=.07,type:OscillatorType="sine"){
  try{
    const AudioCtx=(window.AudioContext||(window as any).webkitAudioContext);
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type=type;osc.frequency.value=freq;
    gain.gain.setValueAtTime(.09,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);
    window.setTimeout(()=>ctx.close().catch(()=>{}),400);
  }catch{}
}

function audioCrackle(){
  try{
    const AudioCtx=(window.AudioContext||(window as any).webkitAudioContext);
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.055),ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
    const source=ctx.createBufferSource();
    const filter=ctx.createBiquadFilter();
    const gain=ctx.createGain();
    filter.type="highpass";filter.frequency.value=1100;
    gain.gain.setValueAtTime(.16,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.055);
    source.buffer=buffer;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
    source.start();source.stop(ctx.currentTime+.06);
    window.setTimeout(()=>ctx.close().catch(()=>{}),300);
  }catch{}
}

export default function EyeGazeFidgetLab(){
  const [,navigate]=useLocation();
  const [selected,setSelected]=useState<FidgetId>("popit");
  const [sound,setSound]=useState(true);
  const [haptics,setHaptics]=useState(true);
  const [pop,setPop]=useState<boolean[]>(()=>Array(36).fill(false));
  const [wrap,setWrap]=useState<boolean[]>(()=>Array(40).fill(false));
  const [spinAngle,setSpinAngle]=useState(0);
  const [spinSpeed,setSpinSpeed]=useState(0);
  const [spinnerSkin,setSpinnerSkin]=useState<"neon"|"metal"|"galaxy">("neon");
  const [squish,setSquish]=useState(0);
  const [ripples,setRipples]=useState<{id:number;x:number;y:number}[]>([]);
  const [stars,setStars]=useState<{id:number;x:number;y:number;s:number}[]>([]);
  const [count,setCount]=useState(0);
  const [stretch,setStretch]=useState(45);
  const [liquid,setLiquid]=useState(0);
  const [kaleido,setKaleido]=useState(0);
  const [switches,setSwitches]=useState<boolean[]>(()=>Array(12).fill(false));
  const [tiles,setTiles]=useState<boolean[]>(()=>Array(48).fill(false));
  const [revealCategory,setRevealCategory]=useState<RevealCategory>("all");
  const [revealSize,setRevealSize]=useState<3|4|5|6>(4);
  const [revealIndex,setRevealIndex]=useState(0);
  const [revealTiles,setRevealTiles]=useState<boolean[]>(()=>Array(16).fill(false));
  const [revealComplete,setRevealComplete]=useState(false);
  const [revealRound,setRevealRound]=useState(1);
  const revealTimer=useRef<number|undefined>(undefined);
  const stage=useRef<HTMLDivElement|null>(null);
  const spinnerRef=useRef<HTMLDivElement|null>(null);
  const spinAngleRef=useRef(0);
  const spinVelocityRef=useRef(0);
  const spinDragRef=useRef<{angle:number;time:number}|null>(null);

  const feedback=(freq=420,duration=.07,type:OscillatorType="sine")=>{
    if(sound)audioPing(freq,duration,type);
    if(haptics&&navigator.vibrate)navigator.vibrate(18);
  };

  const popItFeedback=()=>{
    if(sound)audioPing(210,.09,"sine");
    if(haptics&&navigator.vibrate)navigator.vibrate(26);
  };

  const bubbleFeedback=()=>{
    if(sound)audioCrackle();
    if(haptics&&navigator.vibrate)navigator.vibrate([10,8,16]);
  };

  const spinnerPointerAngle=(event:React.PointerEvent)=>{
    const rect=spinnerRef.current?.getBoundingClientRect();
    if(!rect)return 0;
    const x=event.clientX-(rect.left+rect.width/2);
    const y=event.clientY-(rect.top+rect.height/2);
    return Math.atan2(y,x)*180/Math.PI;
  };

  const normalizeDelta=(value:number)=>{
    let next=value;
    while(next>180)next-=360;
    while(next<-180)next+=360;
    return next;
  };

  const beginSpin=(event:React.PointerEvent<HTMLDivElement>)=>{
    event.currentTarget.setPointerCapture?.(event.pointerId);
    spinVelocityRef.current=0;
    spinDragRef.current={angle:spinnerPointerAngle(event),time:performance.now()};
  };

  const moveSpin=(event:React.PointerEvent<HTMLDivElement>)=>{
    const drag=spinDragRef.current;
    if(!drag)return;
    const now=performance.now();
    const angle=spinnerPointerAngle(event);
    const delta=normalizeDelta(angle-drag.angle);
    const dt=Math.max(8,now-drag.time);
    spinAngleRef.current+=delta;
    setSpinAngle(spinAngleRef.current);
    spinVelocityRef.current=delta/dt;
    setSpinSpeed(Math.min(100,Math.abs(spinVelocityRef.current)*70));
    spinDragRef.current={angle,time:now};
  };

  const endSpin=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(!spinDragRef.current)return;
    spinDragRef.current=null;
    try{event.currentTarget.releasePointerCapture?.(event.pointerId);}catch{}
    if(Math.abs(spinVelocityRef.current)<.08)spinVelocityRef.current=spinVelocityRef.current<0?-.45:.45;
    if(sound)audioPing(150+Math.min(260,Math.abs(spinVelocityRef.current)*180),.11,"sine");
    if(haptics&&navigator.vibrate)navigator.vibrate(24);
  };

  const superSpin=()=>{
    const direction=spinVelocityRef.current<0?-1:1;
    spinVelocityRef.current=direction*1.75;
    setSpinSpeed(100);
    if(sound)audioPing(260,.14,"sawtooth");
    if(haptics&&navigator.vibrate)navigator.vibrate([20,20,35]);
  };

  useEffect(()=>{
    let frame=0;
    let previous=performance.now();
    const animate=(now:number)=>{
      const dt=Math.min(34,Math.max(1,now-previous));
      previous=now;
      if(!spinDragRef.current&&Math.abs(spinVelocityRef.current)>.003){
        spinAngleRef.current+=spinVelocityRef.current*dt;
        setSpinAngle(spinAngleRef.current);
        spinVelocityRef.current*=Math.pow(.969,dt/16);
        setSpinSpeed(Math.min(100,Math.abs(spinVelocityRef.current)*70));
        if(Math.abs(spinVelocityRef.current)<=.003){
          spinVelocityRef.current=0;
          setSpinSpeed(0);
        }
      }
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    return()=>cancelAnimationFrame(frame);
  },[]);

  const revealPool=useMemo(()=>REVEAL_ITEMS.filter(item=>revealCategory==="all"||item.category===revealCategory),[revealCategory]);
  const revealItem=revealPool[revealIndex%Math.max(1,revealPool.length)]||REVEAL_ITEMS[0];

  const speakReveal=(word:string)=>{
    if(!sound||!("speechSynthesis" in window))return;
    try{
      window.speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(word);
      utterance.rate=.88;
      utterance.pitch=1.02;
      window.speechSynthesis.speak(utterance);
    }catch{}
  };

  const nextReveal=(pool=revealPool,size=revealSize)=>{
    if(revealTimer.current)window.clearTimeout(revealTimer.current);
    setRevealComplete(false);
    setRevealTiles(Array(size*size).fill(false));
    setRevealRound(v=>v+1);
    setRevealIndex(current=>{
      if(pool.length<=1)return 0;
      const jump=1+Math.floor(Math.random()*(pool.length-1));
      return (current+jump)%pool.length;
    });
  };

  const tapReveal=(i:number)=>{
    if(revealComplete||revealTiles[i])return;
    const next=[...revealTiles];
    next[i]=true;
    setRevealTiles(next);
    feedback(420+(i%6)*45,.055,"triangle");
    if(next.every(Boolean)){
      setRevealComplete(true);
      if(sound){
        audioPing(660,.11,"sine");
        window.setTimeout(()=>audioPing(840,.12,"sine"),110);
      }
      if(haptics&&navigator.vibrate)navigator.vibrate([35,35,55,35,80]);
      speakReveal(revealItem.name);
      revealTimer.current=window.setTimeout(()=>nextReveal(),2200);
    }
  };

  useEffect(()=>()=>{if(revealTimer.current)window.clearTimeout(revealTimer.current);},[]);

  const reset=()=>{
    setPop(Array(36).fill(false));setWrap(Array(40).fill(false));spinAngleRef.current=0;spinVelocityRef.current=0;setSpinAngle(0);setSpinSpeed(0);setSquish(0);setRipples([]);setStars([]);
    setCount(0);setStretch(45);setLiquid(value=>value+1);setKaleido(0);setSwitches(Array(12).fill(false));setTiles(Array(48).fill(false));
    setRevealComplete(false);setRevealTiles(Array(revealSize*revealSize).fill(false));
  };

  const point=(e:React.PointerEvent)=>{
    const rect=stage.current?.getBoundingClientRect();
    if(!rect)return{x:50,y:50};
    return{x:((e.clientX-rect.left)/rect.width)*100,y:((e.clientY-rect.top)/rect.height)*100};
  };

  const palette=useMemo(()=>[
    "from-fuchsia-500 via-violet-500 to-cyan-400","from-cyan-400 via-sky-500 to-indigo-600","from-amber-300 via-orange-500 to-pink-500",
    "from-emerald-300 via-teal-500 to-blue-600","from-pink-400 via-rose-500 to-purple-600","from-lime-300 via-emerald-400 to-cyan-500"
  ],[]);

  const stageContent=()=>{
    if(selected==="popit"){
      const colors=["#ff6b6b","#ff9f43","#feca57","#48db9a","#54a0ff","#a66cff"];
      return <div className="w-full max-w-[720px]">
        <div className="rounded-[4rem] p-5 sm:p-8 bg-[#24243a] shadow-[0_35px_100px_rgba(0,0,0,.45)] border-[12px] border-[#39395a]">
          <div className="rounded-[3rem] overflow-hidden border-8 border-white/10 shadow-inner">
            {Array.from({length:6}).map((_,row)=><div key={row} className="grid grid-cols-6 gap-2 sm:gap-3 p-2 sm:p-3" style={{background:colors[row]}}>
              {pop.slice(row*6,row*6+6).map((on,column)=>{
                const i=row*6+column;
                return <button key={i} onClick={()=>{const n=[...pop];n[i]=!n[i];setPop(n);popItFeedback();}} aria-label={"Reusable pop "+(i+1)} className="aspect-square rounded-full relative transition-all duration-100 touch-manipulation" style={{
                  background:on?"radial-gradient(circle at 50% 72%,rgba(0,0,0,.38),rgba(255,255,255,.08) 55%,rgba(0,0,0,.18))":"radial-gradient(circle at 36% 28%,rgba(255,255,255,.92),rgba(255,255,255,.16) 32%,rgba(0,0,0,.16) 74%)",
                  transform:on?"scale(.78)":"scale(1)",
                  boxShadow:on?"inset 0 12px 18px rgba(0,0,0,.42), inset 0 -3px 6px rgba(255,255,255,.18)":"inset 0 -13px 20px rgba(0,0,0,.25), inset 0 8px 13px rgba(255,255,255,.45), 0 7px 8px rgba(0,0,0,.2)",
                  border:"4px solid rgba(255,255,255,.25)"
                }}><span className="absolute inset-[22%] rounded-full border-2 border-white/20"/></button>;
              })}
            </div>)}
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="font-black text-white text-lg">Reusable silicone Pop-It</p>
          <p className="text-white/60 text-sm font-bold">Push in · push back out · repeat forever</p>
        </div>
      </div>;
    }

    if(selected==="bubbles"){
      const remaining=wrap.filter(value=>!value).length;
      return <div className="w-full max-w-[760px]">
        <div className="relative rounded-[1.4rem] p-4 sm:p-6 bg-[linear-gradient(135deg,rgba(255,255,255,.82),rgba(186,230,253,.3),rgba(255,255,255,.68))] border border-white/80 shadow-[0_24px_70px_rgba(15,23,42,.28)] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-30 bg-[repeating-linear-gradient(25deg,transparent_0_18px,rgba(255,255,255,.9)_19px,transparent_21px)]"/>
          <div className="relative grid grid-cols-8 gap-1.5 sm:gap-2.5">
            {wrap.map((on,i)=><button key={i} disabled={on} onClick={()=>{const n=[...wrap];n[i]=true;setWrap(n);bubbleFeedback();}} aria-label={on?"Popped bubble":"Pop bubble "+(i+1)} className="aspect-square relative rounded-full transition-all duration-100 disabled:cursor-default" style={{
              transform:on?"scale(.62)":`scale(${i%5===0?1.05:i%3===0?.92:1})`,
              background:on?"rgba(148,163,184,.11)":"radial-gradient(circle at 31% 24%,rgba(255,255,255,.98) 0 14%,rgba(224,242,254,.76) 28%,rgba(125,211,252,.25) 65%,rgba(255,255,255,.72) 100%)",
              border:on?"1px solid rgba(148,163,184,.28)":"1px solid rgba(255,255,255,.95)",
              boxShadow:on?"inset 0 2px 5px rgba(71,85,105,.22)":"inset 0 -6px 12px rgba(14,165,233,.14), inset 0 5px 10px rgba(255,255,255,.9), 0 3px 6px rgba(15,23,42,.16)"
            }}>
              {on&&<><span className="absolute left-[20%] right-[20%] top-1/2 h-px bg-slate-400/35 rotate-12"/><span className="absolute left-1/2 top-[20%] bottom-[20%] w-px bg-slate-400/30 -rotate-12"/></>}
              {!on&&<span className="absolute left-[23%] top-[17%] w-[28%] h-[18%] rounded-full bg-white/80 blur-[1px]"/>}
            </button>)}
          </div>
          <div className="relative mt-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-black text-slate-800">Real sheet mode</p>
              <p className="text-sm font-bold text-slate-500">{remaining?remaining+" bubbles left":"Every bubble is popped!"}</p>
            </div>
            <button onClick={()=>{setWrap(Array(40).fill(false));if(haptics&&navigator.vibrate)navigator.vibrate(20);}} className="min-h-12 rounded-2xl bg-slate-900 text-white px-4 font-black">{remaining?"NEW SHEET":"UNROLL NEW SHEET"}</button>
          </div>
        </div>
        <p className="mt-3 text-center text-white/60 text-sm font-bold">Each bubble pops once. Start a new sheet when you want more.</p>
      </div>;
    }

    if(selected==="spinner"){
      const skin=spinnerSkin==="metal"
        ? {body:"linear-gradient(145deg,#f8fafc,#94a3b8 38%,#334155 72%,#e2e8f0)",ring:"#e2e8f0",glow:"rgba(148,163,184,.38)",bearing:"radial-gradient(circle,#f8fafc 0 18%,#64748b 20% 34%,#0f172a 36% 54%,#cbd5e1 56% 74%,#475569 76%)"}
        : spinnerSkin==="galaxy"
          ? {body:"radial-gradient(circle at 28% 20%,#f0abfc,#7c3aed 27%,#312e81 55%,#020617 86%)",ring:"#c4b5fd",glow:"rgba(168,85,247,.58)",bearing:"radial-gradient(circle,#f5d0fe 0 17%,#8b5cf6 20% 34%,#111827 36% 54%,#22d3ee 56% 73%,#312e81 76%)"}
          : {body:"linear-gradient(145deg,#22d3ee,#2563eb 38%,#7c3aed 68%,#ec4899)",ring:"#67e8f9",glow:"rgba(34,211,238,.6)",bearing:"radial-gradient(circle,#ecfeff 0 17%,#22d3ee 20% 34%,#082f49 36% 54%,#a855f7 56% 73%,#111827 76%)"};
      return <div className="w-full max-w-[700px] flex flex-col items-center">
        <div className="flex gap-2 mb-5 bg-white/10 rounded-2xl p-1.5 border border-white/10">
          {(["neon","metal","galaxy"] as const).map(mode=><button key={mode} onClick={()=>setSpinnerSkin(mode)} className={"min-h-10 rounded-xl px-4 font-black text-sm capitalize "+(spinnerSkin===mode?"bg-white text-slate-950":"text-white/75")}>{mode}</button>)}
        </div>
        <div
          ref={spinnerRef}
          role="button"
          tabIndex={0}
          aria-label="Fidget spinner. Drag or flick to spin."
          onPointerDown={beginSpin}
          onPointerMove={moveSpin}
          onPointerUp={endSpin}
          onPointerCancel={endSpin}
          className="relative w-[min(76vw,520px)] aspect-square touch-none select-none cursor-grab active:cursor-grabbing grid place-items-center"
        >
          {spinSpeed>18&&<div className="absolute inset-[8%] rounded-full border-[10px] border-cyan-300/15 blur-sm" style={{boxShadow:"0 0 "+Math.round(25+spinSpeed*.7)+"px "+skin.glow}}/>}
          <div className="absolute inset-[8%]" style={{transform:"rotate("+spinAngle+"deg)",willChange:"transform"}}>
            {[0,120,240].map((deg,i)=><div key={deg} className="absolute left-1/2 top-1/2 w-[44%] h-[25%] origin-left" style={{transform:"rotate("+deg+"deg) translateX(3%)"}}>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[62%] rounded-full" style={{background:skin.body,boxShadow:"0 0 26px "+skin.glow+", inset 0 5px 11px rgba(255,255,255,.35), inset 0 -8px 13px rgba(0,0,0,.28)"}}/>
              <div className="absolute right-[1%] top-1/2 -translate-y-1/2 w-[42%] aspect-square rounded-full border-[8px] sm:border-[11px]" style={{background:skin.body,borderColor:skin.ring,boxShadow:"0 0 30px "+skin.glow+", inset 0 7px 12px rgba(255,255,255,.3)"}}>
                <div className="absolute inset-[23%] rounded-full bg-slate-950 shadow-inner"/>
              </div>
            </div>)}
            <div className="absolute left-1/2 top-1/2 w-[29%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-[8px] sm:border-[12px]" style={{background:skin.bearing,borderColor:skin.ring,boxShadow:"0 0 30px "+skin.glow+",0 10px 25px rgba(0,0,0,.38)"}}>
              <div className="absolute inset-[31%] rounded-full bg-white/80 shadow-[inset_0_-5px_8px_rgba(0,0,0,.3)]"/>
            </div>
          </div>
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{background:spinSpeed>45?"conic-gradient(from 0deg,transparent,rgba(34,211,238,.12),transparent,rgba(236,72,153,.1),transparent)":"transparent"}}/>
        </div>
        <div className="w-full max-w-lg mt-3">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 transition-[width] duration-75" style={{width:Math.round(spinSpeed)+"%"}}/></div>
          <div className="mt-3 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 text-center sm:text-left"><p className="font-black text-lg">Flick the spinner with your finger</p><p className="text-sm font-bold text-white/60">It keeps its momentum and slows down naturally.</p></div>
            <button onClick={superSpin} className="min-h-12 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 px-5 font-black shadow-lg">⚡ SUPER SPIN</button>
          </div>
        </div>
      </div>;
    }

    if(selected==="slime")return <button onPointerMove={e=>{if(e.buttons){setSquish(v=>(v+5)%100);}}} onClick={()=>{setSquish(v=>(v+23)%100);feedback(180,.12,"sine");}} className="relative w-[min(76vw,560px)] h-[min(58vh,470px)] grid place-items-center">
      <div className="absolute w-[72%] h-[68%] bg-gradient-to-br from-fuchsia-400 via-violet-500 to-cyan-400 shadow-[0_30px_90px_rgba(109,40,217,.48),inset_0_10px_35px_rgba(255,255,255,.35)] transition-all duration-300" style={{borderRadius:(35+(squish%35))+"% "+(65-(squish%25))+"% "+(45+(squish%30))+"% "+(55-(squish%20))+"%",transform:"scale("+(1+(squish%9)/55)+","+(1-(squish%7)/70)+") rotate("+((squish%17)-8)+"deg)"}}/>
      <div className="relative text-7xl drop-shadow-2xl">✨</div>
    </button>;

    if(selected==="ripple")return <div ref={stage} onPointerDown={e=>{const p=point(e);const id=Date.now();setRipples(v=>[...v.slice(-9),{id,...p}]);feedback(330,.1,"sine");window.setTimeout(()=>setRipples(v=>v.filter(r=>r.id!==id)),1100);}} className="relative w-full max-w-4xl h-[min(66vh,620px)] rounded-[3rem] overflow-hidden bg-[radial-gradient(circle_at_50%_20%,#67e8f9,#0284c7_40%,#082f49_100%)] shadow-[inset_0_0_90px_rgba(255,255,255,.25),0_35px_100px_rgba(2,132,199,.3)] border-8 border-white/60">
      <div className="absolute inset-0 opacity-40 bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,.4)_45%,transparent_70%)]"/>
      {ripples.map(r=><span key={r.id} className="absolute w-6 h-6 rounded-full border-4 border-white/80 animate-[ping_1s_ease-out]" style={{left:r.x+"%",top:r.y+"%",transform:"translate(-50%,-50%)"}}/>)}
    </div>;

    if(selected==="galaxy")return <div ref={stage} onPointerDown={e=>{const p=point(e);const id=Date.now();setStars(v=>[...v.slice(-79),{id,...p,s:16+Math.random()*36}]);feedback(720,.06,"triangle");}} className="relative w-full max-w-4xl h-[min(66vh,620px)] rounded-[3rem] overflow-hidden bg-[radial-gradient(circle_at_40%_30%,#312e81,#111827_48%,#020617_100%)] shadow-[0_35px_100px_rgba(49,46,129,.5)] border-8 border-violet-200/20">
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_80%,#ec4899_0,transparent_28%),radial-gradient(circle_at_80%_20%,#22d3ee_0,transparent_25%)]"/>
      {stars.map(s=><span key={s.id} className="absolute animate-pulse drop-shadow-[0_0_12px_white]" style={{left:s.x+"%",top:s.y+"%",fontSize:s.s}}>✦</span>)}
      {!stars.length&&<div className="absolute inset-0 grid place-items-center text-white/70 font-black text-xl">Tap anywhere to make stars ✨</div>}
    </div>;

    if(selected==="reveal"){
      const opened=revealTiles.filter(Boolean).length;
      const total=revealTiles.length;
      const percent=Math.round((opened/Math.max(1,total))*100);
      return <div className="w-full max-w-[920px]">
        <div className="mb-4">
          <p className="text-[11px] font-black tracking-[.2em] text-cyan-300">REVEAL TILES</p>
          <h2 className="text-2xl sm:text-4xl font-black leading-tight">Tap the tiles. Discover the picture.</h2>
          <p className="mt-1 text-sm sm:text-base font-bold text-white/55">The picture stays completely covered until you uncover each square.</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
          {(["all","food","animals","vehicles","toys","home","school","nature"] as RevealCategory[]).map(category=><button
            key={category}
            onClick={()=>{
              if(revealTimer.current)window.clearTimeout(revealTimer.current);
              setRevealCategory(category);
              setRevealIndex(0);
              setRevealComplete(false);
              setRevealTiles(Array(revealSize*revealSize).fill(false));
              feedback(390,.04,"sine");
            }}
            className={"min-w-max min-h-11 rounded-2xl px-4 text-sm font-black capitalize border transition-all "+(revealCategory===category?"bg-cyan-300 text-slate-950 border-cyan-100 shadow-[0_0_22px_rgba(103,232,249,.28)]":"bg-white/8 text-white border-white/10")}
          >{category}</button>)}
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_220px] gap-4 items-start">
          <div className="relative w-full max-w-[720px] aspect-square mx-auto rounded-[2.4rem] overflow-hidden border-[10px] border-slate-700/80 bg-slate-950 shadow-[0_35px_110px_rgba(0,0,0,.42)]">
            <div className="absolute inset-0 z-0 overflow-hidden" style={{background:revealItem.bg}}>
              <div className="absolute inset-[4%] rounded-[2rem] border-[5px] border-white/55 bg-white/16 shadow-[inset_0_0_80px_rgba(255,255,255,.38)]"/>
              <div className="absolute inset-0 grid place-items-center select-none pointer-events-none">
                <span
                  aria-hidden="true"
                  className="leading-none drop-shadow-[0_22px_22px_rgba(15,23,42,.20)]"
                  style={{fontSize:"clamp(16rem,72vw,38rem)",transform:"translateY(-1%) scale(1.08)"}}
                >{revealItem.emoji}</span>
              </div>
            </div>

            <div className="absolute inset-0 z-20 grid bg-transparent" style={{
              gridTemplateColumns:"repeat("+revealSize+",minmax(0,1fr))",
              gridTemplateRows:"repeat("+revealSize+",minmax(0,1fr))"
            }}>
              {revealTiles.map((open,i)=>{
                const hue=(i*43+revealRound*29)%360;
                return <button
                  key={revealRound+"-"+i}
                  disabled={open||revealComplete}
                  onClick={()=>tapReveal(i)}
                  aria-label={open?"Picture section revealed":"Reveal picture tile "+(i+1)}
                  className={"relative overflow-hidden border-[2px] sm:border-[3px] border-slate-950 transition-[transform,opacity] duration-200 touch-manipulation "+(open?"opacity-0 pointer-events-none":"opacity-100 active:scale-[.92]")}
                  style={{
                    background:"linear-gradient(145deg,hsl("+hue+" 86% 58%) 0%,hsl("+((hue+52)%360)+" 84% 45%) 58%,hsl("+((hue+90)%360)+" 78% 34%) 100%)",
                    boxShadow:"inset 0 5px 13px rgba(255,255,255,.35), inset 0 -12px 20px rgba(0,0,0,.30)"
                  }}
                >
                  <span className="absolute inset-[13%] rounded-[24%] border-[3px] border-white/28 shadow-[inset_0_3px_8px_rgba(255,255,255,.16)]"/>
                  <span className="absolute left-[20%] top-[15%] w-[32%] h-[18%] rounded-full bg-white/30 blur-[2px]"/>
                  <span className="absolute right-[15%] bottom-[14%] w-[26%] h-[15%] rounded-full bg-black/10 blur-[2px]"/>
                </button>;
              })}
            </div>

            {opened===0&&<div className="absolute inset-0 z-30 pointer-events-none grid place-items-center">
              <div className="rounded-full bg-slate-950/82 border border-white/15 px-5 py-3 text-center shadow-xl backdrop-blur">
                <p className="text-lg sm:text-xl font-black">Tap any tile to start</p>
              </div>
            </div>}

            {revealComplete&&<div className="absolute inset-0 z-40 pointer-events-none">
              <div className="absolute inset-x-0 bottom-5 flex justify-center">
                <div className="rounded-full bg-slate-950/88 border border-white/15 px-6 py-3 text-xl sm:text-3xl font-black shadow-2xl">{revealItem.name}</div>
              </div>
              {Array.from({length:34}).map((_,i)=><span
                key={i}
                className="absolute animate-[ping_1.25s_ease-out_forwards] text-2xl sm:text-4xl"
                style={{left:(3+(i*37)%94)+"%",top:(3+(i*61)%90)+"%",animationDelay:(i%10)*.045+"s"}}
              >{["✨","⭐","🎉","🎊"][i%4]}</span>)}
            </div>}
          </div>

          <aside className="rounded-[2rem] bg-white/8 border border-white/10 p-4 space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-black tracking-widest text-white/40">ROUND</p>
                <p className="text-3xl font-black">{revealRound}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black tracking-widest text-white/40">REVEALED</p>
                <p className="text-2xl font-black text-cyan-300">{percent}%</p>
              </div>
            </div>

            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400 transition-all duration-200" style={{width:percent+"%"}}/>
            </div>
            <p className="text-sm font-black text-white/65">{opened} of {total} tiles</p>

            <div>
              <p className="text-[10px] font-black tracking-widest text-white/40 mb-2">BOARD SIZE</p>
              <div className="grid grid-cols-2 gap-2">
                {([3,4,5,6] as const).map(size=><button
                  key={size}
                  onClick={()=>{
                    if(revealTimer.current)window.clearTimeout(revealTimer.current);
                    setRevealSize(size);
                    setRevealComplete(false);
                    setRevealTiles(Array(size*size).fill(false));
                    feedback(360+size*35,.04,"sine");
                  }}
                  className={"min-h-12 rounded-xl font-black "+(revealSize===size?"bg-white text-slate-950":"bg-white/10 text-white")}
                >{size}×{size}</button>)}
              </div>
            </div>

            <button onClick={()=>nextReveal()} className="w-full min-h-14 rounded-2xl bg-amber-300 text-slate-950 font-black shadow-lg">NEW PICTURE</button>
          </aside>
        </div>
      </div>;
    }

    if(selected==="clicker")return <div className="text-center">
      <div className="text-7xl sm:text-9xl font-black text-white drop-shadow-2xl mb-5 tabular-nums">{count}</div>
      <button onClick={()=>{setCount(v=>v+1);feedback(520+(count%4)*70,.045,"square");}} className="w-[min(72vw,430px)] aspect-square rounded-full bg-gradient-to-br from-amber-300 via-orange-500 to-rose-600 border-[16px] border-white/70 shadow-[inset_0_-28px_40px_rgba(127,29,29,.35),0_35px_70px_rgba(249,115,22,.45)] active:translate-y-3 active:shadow-[inset_0_-12px_20px_rgba(127,29,29,.35)] transition-all grid place-items-center">
        <span className="text-5xl sm:text-7xl font-black text-white drop-shadow-lg">CLICK</span>
      </button>
    </div>;

    if(selected==="stretch")return <div className="w-full max-w-3xl rounded-[3rem] bg-white/90 p-6 sm:p-10 shadow-2xl">
      <h2 className="text-3xl font-black text-center mb-8">Pull the bands</h2>
      <div className="space-y-7">{[0,1,2,3].map((row)=><div key={row} className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-slate-900 flex-shrink-0"/>
        <div className={"h-8 rounded-full bg-gradient-to-r "+palette[row]+" shadow-lg transition-all"} style={{width:Math.max(12,stretch-(row*6))+"%"}}/>
        <span className="w-10 h-10 rounded-full bg-slate-900 flex-shrink-0"/>
      </div>)}</div>
      <input aria-label="Stretch bands" type="range" min="20" max="88" value={stretch} onChange={e=>{setStretch(Number(e.target.value));feedback(210+Number(e.target.value)*3,.025,"sine");}} className="w-full mt-10 h-10 accent-violet-600"/>
    </div>;

    if(selected==="liquid")return <button onClick={()=>{setLiquid(v=>v+1);feedback(240,.12,"sine");}} className="relative w-full max-w-4xl h-[min(66vh,620px)] rounded-[3rem] overflow-hidden bg-slate-950 shadow-[0_35px_100px_rgba(14,165,233,.3)] border-8 border-white/10">
      {Array.from({length:9}).map((_,i)=><span key={liquid+"-"+i} className="absolute rounded-full blur-sm mix-blend-screen animate-[pulse_2.8s_ease-in-out_infinite]" style={{width:(90+(i%4)*42)+"px",height:(90+(i%4)*42)+"px",left:((i*17+liquid*11)%88)+"%",top:((i*29+liquid*7)%78)+"%",background:["#22d3ee","#a855f7","#ec4899","#34d399","#fbbf24"][i%5],boxShadow:"0 0 45px currentColor",animationDelay:(i*.15)+"s"}}/>)}
      <span className="absolute inset-0 grid place-items-center text-white font-black text-xl">Tap to remix</span>
    </button>;

    if(selected==="kaleido")return <button onClick={()=>{setKaleido(v=>v+1);feedback(460+(kaleido%5)*60,.08,"triangle");}} className="w-[min(80vw,620px)] aspect-square rounded-full border-[14px] border-white/40 shadow-[0_35px_100px_rgba(217,70,239,.35)] transition-transform duration-500" style={{transform:"rotate("+(kaleido*17)+"deg)",background:"repeating-conic-gradient(from "+(kaleido*23)+"deg,#22d3ee 0 12deg,#a855f7 12deg 24deg,#f472b6 24deg 36deg,#facc15 36deg 48deg,#34d399 48deg 60deg)"}}/>;

    if(selected==="switches")return <div className="w-full max-w-3xl rounded-[3rem] bg-slate-800 p-5 sm:p-8 shadow-2xl border-8 border-slate-600">
      <div className="grid grid-cols-3 gap-4">{switches.map((on,i)=><button key={i} onClick={()=>{const n=[...switches];n[i]=!n[i];setSwitches(n);feedback(on?240:610,.055,"square");}} className={"min-h-28 rounded-3xl border-4 transition-all flex flex-col items-center justify-center "+(on?"bg-emerald-400 border-emerald-200 shadow-[0_0_28px_rgba(52,211,153,.7)]":"bg-slate-700 border-slate-500")}>
        <span className={"w-14 h-8 rounded-full p-1 transition-all "+(on?"bg-white":"bg-slate-950")}><span className={"block w-6 h-6 rounded-full transition-transform "+(on?"translate-x-6 bg-emerald-500":"translate-x-0 bg-slate-400")}/></span>
        <strong className={"mt-2 "+(on?"text-emerald-950":"text-white")}>{on?"ON":"OFF"}</strong>
      </button>)}</div>
    </div>;

    return <div className="w-full max-w-3xl rounded-[3rem] bg-white/80 p-4 sm:p-6 shadow-2xl">
      <div className="grid grid-cols-8 gap-2">{tiles.map((on,i)=><button key={i} onClick={()=>{const n=[...tiles];n[i]=!n[i];setTiles(n);feedback(360+(i%8)*55,.04,"sine");}} className={"aspect-square rounded-xl sm:rounded-2xl transition-all duration-200 border-2 "+(on?"bg-gradient-to-br "+palette[i%palette.length]+" border-white shadow-[0_0_24px_rgba(59,130,246,.45)] scale-105":"bg-slate-100 border-slate-200")}/>)}</div>
    </div>;
  };

  return <main className="fixed inset-0 z-[140] h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,#334155,#0f172a_55%,#020617)] text-white flex flex-col">
    <header className="flex items-center gap-2 p-3 sm:p-4 bg-slate-950/65 backdrop-blur border-b border-white/10">
      <button onClick={()=>navigate("/eye-gaze-games")} className="min-h-14 rounded-2xl bg-[#ffd766] border-4 border-white/80 text-slate-950 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> BACK</button>
      <div className="flex-1 min-w-0"><p className="text-xs font-black tracking-widest text-cyan-300">A.R.I.S.E. GAMES</p><h1 className="text-xl sm:text-3xl font-black truncate">Fidget Lab ✨</h1></div>
      <button onClick={()=>setSound(v=>!v)} className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 grid place-items-center" aria-label={sound?"Turn sound off":"Turn sound on"}>{sound?<Volume2/>:<VolumeX/>}</button>
      <button onClick={()=>setHaptics(v=>!v)} className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 grid place-items-center" aria-label={haptics?"Turn haptics off":"Turn haptics on"}>{haptics?<Vibrate/>:<VibrateOff/>}</button>
      <button onClick={reset} className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 grid place-items-center" aria-label="Reset fidget"><RotateCcw/></button>
    </header>

    <div className="flex-1 min-h-0 grid lg:grid-cols-[250px_1fr]">
      <aside className="overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden p-3 bg-slate-950/30 border-b lg:border-b-0 lg:border-r border-white/10">
        <div className="flex lg:grid gap-2 min-w-max lg:min-w-0">
          {FIDGETS.map(item=><button key={item.id} onClick={()=>{setSelected(item.id);feedback(400,.035,"sine");}} className={"min-w-[150px] lg:min-w-0 lg:w-full rounded-2xl p-3 text-left border-2 transition-all "+(selected===item.id?"bg-white text-slate-950 border-cyan-300 shadow-lg":"bg-white/5 border-white/10 text-white")}>
            <span className="text-3xl">{item.emoji}</span><strong className="block mt-1">{item.name}</strong><small className={selected===item.id?"text-slate-500":"text-white/60"}>{item.hint}</small>
          </button>)}
        </div>
      </aside>
      <section className="min-h-0 overflow-auto p-4 sm:p-8 grid place-items-center relative">
        <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs font-black"><Sparkles className="w-4 h-4"/> {FIDGETS.find(f=>f.id===selected)?.name}</div>
        {stageContent()}
      </section>
    </div>
  </main>;
}
