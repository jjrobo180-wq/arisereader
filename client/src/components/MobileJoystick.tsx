import { useRef, useState } from "react";

type MoveKey="w"|"a"|"s"|"d";
type Props={
  onMove:(key:MoveKey,active:boolean)=>void;
  label?:string;
  className?:string;
};

export default function MobileJoystick({onMove,label="Move",className=""}:Props){
  const activeRef=useRef<Set<MoveKey>>(new Set());
  const [knob,setKnob]=useState({x:0,y:0});
  const [pressed,setPressed]=useState(false);

  const apply=(clientX:number,clientY:number,currentTarget:HTMLElement)=>{
    const rect=currentTarget.getBoundingClientRect();
    const dx=clientX-(rect.left+rect.width/2);
    const dy=clientY-(rect.top+rect.height/2);
    const radius=Math.min(rect.width,rect.height)*.30;
    const length=Math.hypot(dx,dy)||1;
    const scale=Math.min(1,radius/length);
    setKnob({x:dx*scale,y:dy*scale});

    const next=new Set<MoveKey>();
    const deadZone=radius*.22;
    if(dy<-deadZone)next.add("w");
    if(dy>deadZone)next.add("s");
    if(dx<-deadZone)next.add("a");
    if(dx>deadZone)next.add("d");

    for(const key of activeRef.current)if(!next.has(key))onMove(key,false);
    for(const key of next)if(!activeRef.current.has(key))onMove(key,true);
    activeRef.current=next;
  };

  const clear=()=>{
    for(const key of activeRef.current)onMove(key,false);
    activeRef.current.clear();
    setKnob({x:0,y:0});
    setPressed(false);
  };

  return <div className={"absolute z-40 lg:hidden "+className} aria-label={label}>
    <div
      className={
        "relative h-[124px] w-[124px] touch-none select-none rounded-full border shadow-2xl backdrop-blur-xl transition "+
        (pressed
          ?"border-cyan-200/75 bg-slate-950/82 shadow-cyan-400/25"
          :"border-white/20 bg-slate-950/68 shadow-black/50")
      }
      style={{boxShadow:pressed?"0 0 0 5px rgba(34,211,238,.08), 0 18px 45px rgba(0,0,0,.55)":"0 18px 45px rgba(0,0,0,.5)"}}
      onPointerDown={e=>{
        e.preventDefault();
        setPressed(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e.clientX,e.clientY,e.currentTarget);
      }}
      onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))apply(e.clientX,e.clientY,e.currentTarget);}}
      onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);clear();}}
      onPointerCancel={clear}
      onLostPointerCapture={clear}
      onContextMenu={e=>e.preventDefault()}
    >
      <div className="absolute inset-[10px] rounded-full border border-white/10 bg-white/[.035]"/>
      <div className="absolute left-1/2 top-3 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/45"/>
      <div className="absolute bottom-3 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/45"/>
      <div className="absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/45"/>
      <div className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/45"/>
      <div
        className={
          "absolute left-1/2 top-1/2 grid h-[54px] w-[54px] place-items-center rounded-full border-2 transition-[transform,background-color,box-shadow] duration-75 "+
          (pressed
            ?"border-cyan-100 bg-cyan-300 shadow-[0_0_24px_rgba(34,211,238,.5)]"
            :"border-white/55 bg-gradient-to-br from-cyan-200 to-cyan-400 shadow-lg")
        }
        style={{transform:`translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`}}
      >
        <div className="h-5 w-5 rounded-full border border-slate-900/20 bg-white/30"/>
      </div>
      <span className="pointer-events-none absolute left-1/2 top-[6px] -translate-x-1/2 text-[9px] font-black tracking-[.18em] text-white/55">MOVE</span>
    </div>
  </div>;
}
