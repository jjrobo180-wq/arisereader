import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
const colors=['#fb7185','#fbbf24','#34d399','#38bdf8','#c084fc'];
export default function EyeGazeCelebrations() {
  const [burst,setBurst]=useState<{id:number;style:number;calm:boolean}|null>(null);
  const sequence=useRef(0);
  useEffect(()=>{
    let timer:number|undefined;
    const celebrate=(event:Event)=>{
      const id=++sequence.current;
      setBurst({id,style:(id-1)%3,calm:!!(event as CustomEvent).detail?.calm});
      window.clearTimeout(timer);
      timer=window.setTimeout(()=>setBurst(null),1800);
    };
    window.addEventListener('eye-gaze-celebrate',celebrate);
    return()=>{window.removeEventListener('eye-gaze-celebrate',celebrate);window.clearTimeout(timer);};
  },[]);
  if(!burst)return null;
  return <div key={burst.id} data-testid="eye-gaze-celebration" data-style={['balloons','fireworks','confetti'][burst.style]} className="fixed inset-0 z-[1000] pointer-events-none overflow-hidden" aria-hidden="true">
    <style>{`
      @keyframes eg-balloon {from{transform:translateY(0) rotate(-8deg);opacity:0}20%{opacity:1}to{transform:translateY(-85vh) rotate(8deg);opacity:0}}
      @keyframes eg-paper {from{transform:translateY(-8vh) rotate(0deg);opacity:1}to{transform:translateY(100vh) rotate(400deg);opacity:0}}
      @keyframes eg-firework {from{transform:translate(0,0) scale(.3);opacity:1}to{transform:translate(var(--dx),var(--dy)) scale(.7);opacity:0}}
      .eg-balloon{animation:eg-balloon 1.8s ease-out both}.eg-paper{animation:eg-paper 1.8s ease-in both}.eg-firework{animation:eg-firework 1.4s ease-out both}
      @media(prefers-reduced-motion:reduce){.eg-party-particle{display:none}}
    `}</style>
    <div className="absolute top-[22%] inset-x-0 text-center"><span className="inline-block rounded-3xl border-4 border-amber-300 bg-white text-teal-950 px-6 py-3 text-2xl sm:text-4xl font-black shadow-xl">{['🎈 You did it!','🎆 Amazing!','🎉 Great job!'][burst.style]}</span></div>
    {!burst.calm && burst.style===0 && Array.from({length:9},(_,i)=><span key={i} className="eg-party-particle eg-balloon absolute bottom-[-80px] text-6xl" style={{left:`${5+i*11}%`,animationDelay:`${i%3*0.09}s`}}>🎈</span>)}
    {!burst.calm && burst.style===2 && Array.from({length:36},(_,i)=><span key={i} className="eg-party-particle eg-paper absolute top-0 rounded-sm" style={{left:`${(i*29)%100}%`,width:10,height:18,backgroundColor:colors[i%5],animationDelay:`${i%5*.06}s`}}/>)}
    {!burst.calm && burst.style===1 && Array.from({length:36},(_,i)=>{const angle=(i%12)/12*Math.PI*2;return <span key={i} className="eg-party-particle eg-firework absolute rounded-full" style={{left:`${[20,50,80][Math.floor(i/12)]}%`,top:`${[40,55,40][Math.floor(i/12)]}%`,width:10,height:10,backgroundColor:colors[i%5],'--dx':`${Math.cos(angle)*140}px`,'--dy':`${Math.sin(angle)*140}px`} as CSSProperties}/>;})}
  </div>;
}
