import { useRef, useState } from "react";

type MoveKey="w"|"a"|"s"|"d";

export default function MobileJoystick({onMove,label="Move"}:{onMove:(key:MoveKey,active:boolean)=>void;label?:string}){
  const activeRef=useRef<Set<MoveKey>>(new Set());
  const [knob,setKnob]=useState({x:0,y:0});

  const apply=(clientX:number,clientY:number,currentTarget:HTMLElement)=>{
    const rect=currentTarget.getBoundingClientRect();
    const dx=clientX-(rect.left+rect.width/2);
    const dy=clientY-(rect.top+rect.height/2);
    const radius=Math.min(rect.width,rect.height)*.31;
    const length=Math.hypot(dx,dy)||1;
    const scale=Math.min(1,radius/length);
    setKnob({x:dx*scale,y:dy*scale});

    const next=new Set<MoveKey>();
    const dead=12;
    if(dy<-dead)next.add("w");
    if(dy>dead)next.add("s");
    if(dx<-dead)next.add("a");
    if(dx>dead)next.add("d");

    for(const key of activeRef.current)if(!next.has(key))onMove(key,false);
    for(const key of next)if(!activeRef.current.has(key))onMove(key,true);
    activeRef.current=next;
  };

  const clear=()=>{
    for(const key of activeRef.current)onMove(key,false);
    activeRef.current.clear();
    setKnob({x:0,y:0});
  };

  return <div className="pointer-events-auto select-none touch-none" aria-label={label}>
    <div
      className="relative h-32 w-32 rounded-full border border-white/20 bg-slate-950/70 shadow-2xl backdrop-blur-xl"
      onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);apply(e.clientX,e.clientY,e.currentTarget);}}
      onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))apply(e.clientX,e.clientY,e.currentTarget);}}
      onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);clear();}}
      onPointerCancel={clear}
    >
      <span className="absolute left-1/2 top-2 -translate-x-1/2 text-sm font-black text-white/60">▲</span>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm font-black text-white/60">▼</span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-black text-white/60">◀</span>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-black text-white/60">▶</span>
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border border-cyan-100/60 bg-cyan-300 shadow-lg transition-[transform] duration-75"
        style={{transform:`translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`}}
      />
    </div>
    <p className="mt-1 text-center text-[10px] font-black uppercase tracking-wider text-white/70">{label}</p>
  </div>;
}
