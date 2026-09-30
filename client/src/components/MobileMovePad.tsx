type Props={
  onMove:(key:"w"|"a"|"s"|"d",pressed:boolean)=>void;
  className?:string;
  label?:string;
};

export default function MobileMovePad({onMove,className="",label="Move"}:Props){
  const button=(key:"w"|"a"|"s"|"d",symbol:string,aria:string)=>(
    <button
      type="button"
      aria-label={aria}
      onContextMenu={e=>e.preventDefault()}
      onPointerDown={e=>{e.preventDefault();(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);onMove(key,true);}}
      onPointerUp={e=>{e.preventDefault();onMove(key,false);}}
      onPointerCancel={()=>onMove(key,false)}
      onLostPointerCapture={()=>onMove(key,false)}
      className="grid h-12 w-12 touch-none select-none place-items-center rounded-2xl border border-white/15 bg-slate-950/88 text-xl font-black text-white shadow-xl backdrop-blur active:bg-cyan-300 active:text-slate-950 sm:h-14 sm:w-14"
    >{symbol}</button>
  );
  return <div className={"absolute z-40 lg:hidden "+className} aria-label={label}>
    <div className="grid grid-cols-3 gap-1.5 rounded-[1.7rem] border border-white/10 bg-black/30 p-2 backdrop-blur-sm">
      <span/>{button("w","▲","Move forward")}<span/>
      {button("a","◀","Move left")}{button("s","▼","Move backward")}{button("d","▶","Move right")}
    </div>
  </div>;
}
