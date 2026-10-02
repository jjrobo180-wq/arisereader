import { useEffect, useState } from "react";
import { HALLOREAD_ACTIVE } from "@/lib/halloread";

function playHalloreadStinger(){
  try{
    const AudioCtx=window.AudioContext||(window as any).webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx();void ctx.resume();
    const master=ctx.createGain();master.gain.setValueAtTime(.0001,ctx.currentTime);master.gain.exponentialRampToValueAtTime(.14,ctx.currentTime+.05);master.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+2.15);master.connect(ctx.destination);
    [0,.42,.84].forEach((delay,index)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=index===1?"sawtooth":"triangle";
      const start=ctx.currentTime+delay;osc.frequency.setValueAtTime(170-index*16,start);osc.frequency.exponentialRampToValueAtTime(88+index*8,start+.33);
      gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.07,start+.035);gain.gain.exponentialRampToValueAtTime(.0001,start+.36);
      osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+.4);
    });
    window.setTimeout(()=>ctx.close().catch(()=>{}),2500);
  }catch{}
}

export default function HalloreadWelcome(){
  const [show,setShow]=useState(false);
  useEffect(()=>{
    if(!HALLOREAD_ACTIVE)return;
    const key="arise-halloread-welcome-2026";
    try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");}catch{}
    setShow(true);playHalloreadStinger();
  },[]);
  if(!show)return null;
  return <button type="button" onClick={()=>setShow(false)} className="fixed inset-0 z-[360] grid cursor-pointer place-items-center overflow-hidden bg-[#050108]/88 p-5 text-white backdrop-blur-sm" aria-label="Close Halloread welcome">
    <div className="halloread-flash absolute inset-0"/>
    <div className="relative max-w-2xl text-center">
      <div className="halloread-pumpkin mx-auto grid h-28 w-28 place-items-center rounded-[42%] border-4 border-orange-300/70 bg-orange-500 text-6xl shadow-[0_0_70px_rgba(249,115,22,.55)] sm:h-36 sm:w-36 sm:text-7xl">🎃</div>
      <p className="mt-7 text-xs font-black uppercase tracking-[.42em] text-orange-300">October takeover</p>
      <h2 className="halloread-laugh mt-2 text-5xl font-black tracking-tight sm:text-7xl">HA… HA… HALLOREAD!</h2>
      <p className="mx-auto mt-4 max-w-xl text-sm font-bold text-violet-100/80 sm:text-base">Spooky books, haunted worlds, midnight games, costumes and surprises are live — creepy fun, never gory.</p>
      <span className="mt-5 inline-block rounded-full border border-orange-300/35 bg-orange-400/15 px-5 py-3 text-sm font-black shadow-lg">ENTER HALLOREAD</span>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[.18em] text-violet-200/60">This screen stays open until you enter</p>
    </div>
    <style>{`
      .halloread-flash{background:radial-gradient(circle at 50% 18%,rgba(216,180,254,.22),transparent 34%);animation:halloreadFlash 1.15s steps(2,end) 2}
      .halloread-pumpkin{animation:halloreadPumpkin .72s cubic-bezier(.2,.8,.2,1) both}
      .halloread-laugh{text-shadow:0 0 22px rgba(249,115,22,.42),0 0 42px rgba(139,92,246,.38);animation:halloreadLaugh .58s ease-in-out 3 alternate}
      @keyframes halloreadPumpkin{0%{transform:scale(.2) rotate(-18deg);filter:brightness(2)}70%{transform:scale(1.12) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
      @keyframes halloreadLaugh{from{transform:translateX(-3px) rotate(-.5deg)}to{transform:translateX(3px) rotate(.5deg)}}
      @keyframes halloreadFlash{0%,100%{opacity:.3}50%{opacity:1}}
      @media(prefers-reduced-motion:reduce){.halloread-flash,.halloread-pumpkin,.halloread-laugh{animation:none!important}}
    `}</style>
  </button>;
}
