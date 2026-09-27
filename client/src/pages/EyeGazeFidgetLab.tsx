import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, Sparkles, Volume2, VolumeX, Vibrate, VibrateOff } from "lucide-react";

type FidgetId = "popit"|"bubbles"|"spinner"|"slime"|"ripple"|"galaxy"|"clicker"|"stretch"|"liquid"|"kaleido"|"switches"|"tiles";

const FIDGETS:{id:FidgetId;name:string;emoji:string;hint:string}[]=[
  {id:"popit",name:"Mega Pop-It",emoji:"🫧",hint:"Pop every bubble"},
  {id:"bubbles",name:"Bubble Wrap",emoji:"🟣",hint:"Tiny satisfying pops"},
  {id:"spinner",name:"Neon Spinner",emoji:"🌀",hint:"Spin it fast"},
  {id:"slime",name:"Galaxy Slime",emoji:"🧪",hint:"Squish and stretch"},
  {id:"ripple",name:"Ripple Pool",emoji:"💧",hint:"Tap the water"},
  {id:"galaxy",name:"Star Maker",emoji:"🌌",hint:"Fill space with stars"},
  {id:"clicker",name:"Super Clicker",emoji:"🔘",hint:"Click, count, reset"},
  {id:"stretch",name:"Stretch Bands",emoji:"〰️",hint:"Pull the bands"},
  {id:"liquid",name:"Liquid Orbs",emoji:"🔮",hint:"Mix glowing blobs"},
  {id:"kaleido",name:"Kaleidoscope",emoji:"✨",hint:"Tap for new patterns"},
  {id:"switches",name:"Switch Board",emoji:"🎛️",hint:"Flip every switch"},
  {id:"tiles",name:"Glow Tiles",emoji:"🌈",hint:"Light up the grid"},
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

export default function EyeGazeFidgetLab(){
  const [,navigate]=useLocation();
  const [selected,setSelected]=useState<FidgetId>("popit");
  const [sound,setSound]=useState(true);
  const [haptics,setHaptics]=useState(true);
  const [pop,setPop]=useState<boolean[]>(()=>Array(36).fill(false));
  const [wrap,setWrap]=useState<boolean[]>(()=>Array(40).fill(false));
  const [spin,setSpin]=useState(0);
  const [squish,setSquish]=useState(0);
  const [ripples,setRipples]=useState<{id:number;x:number;y:number}[]>([]);
  const [stars,setStars]=useState<{id:number;x:number;y:number;s:number}[]>([]);
  const [count,setCount]=useState(0);
  const [stretch,setStretch]=useState(45);
  const [liquid,setLiquid]=useState(0);
  const [kaleido,setKaleido]=useState(0);
  const [switches,setSwitches]=useState<boolean[]>(()=>Array(12).fill(false));
  const [tiles,setTiles]=useState<boolean[]>(()=>Array(48).fill(false));
  const stage=useRef<HTMLDivElement|null>(null);

  const feedback=(freq=420,duration=.07,type:OscillatorType="sine")=>{
    if(sound)audioPing(freq,duration,type);
    if(haptics&&navigator.vibrate)navigator.vibrate(18);
  };

  const reset=()=>{
    setPop(Array(36).fill(false));setWrap(Array(40).fill(false));setSpin(0);setSquish(0);setRipples([]);setStars([]);
    setCount(0);setStretch(45);setLiquid(value=>value+1);setKaleido(0);setSwitches(Array(12).fill(false));setTiles(Array(48).fill(false));
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
    if(selected==="popit")return <div className="w-full max-w-2xl rounded-[3rem] p-5 sm:p-8 bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 shadow-[0_30px_80px_rgba(88,28,135,.35)] border-[10px] border-white/40">
      <div className="grid grid-cols-6 gap-2 sm:gap-4">{pop.map((on,i)=><button key={i} onClick={()=>{const n=[...pop];n[i]=!n[i];setPop(n);feedback(on?310:520,.06,"sine");}} className={"aspect-square rounded-full border-4 border-white/40 transition-all duration-150 "+(on?"bg-slate-900/35 shadow-inner scale-90":"bg-white/75 shadow-[inset_0_-12px_20px_rgba(0,0,0,.18),0_8px_15px_rgba(0,0,0,.2)] scale-100")} aria-label={"Pop bubble "+(i+1)}/>)}</div>
    </div>;

    if(selected==="bubbles")return <div className="w-full max-w-3xl rounded-[2.5rem] bg-gradient-to-br from-slate-100 to-blue-100 p-5 sm:p-8 shadow-2xl border-4 border-white">
      <div className="grid grid-cols-8 gap-2 sm:gap-3">{wrap.map((on,i)=><button key={i} onClick={()=>{if(!on){const n=[...wrap];n[i]=true;setWrap(n);feedback(650+((i%5)*45),.045,"triangle");}}} className={"aspect-square rounded-full border transition-all "+(on?"bg-slate-200 border-slate-300 scale-75 opacity-35":"bg-gradient-to-br from-white to-cyan-100 border-white shadow-[inset_0_-7px_10px_rgba(14,165,233,.22),0_5px_9px_rgba(15,23,42,.15)]")}/>)}</div>
    </div>;

    if(selected==="spinner")return <button onClick={()=>{setSpin(v=>v+720);feedback(280,.16,"sawtooth");}} className="relative w-[min(72vw,460px)] aspect-square rounded-full bg-slate-950 shadow-[0_35px_100px_rgba(14,165,233,.4)] border-[12px] border-white/10 grid place-items-center overflow-hidden">
      <div className="absolute inset-[10%] rounded-full transition-transform ease-out" style={{transform:"rotate("+spin+"deg)",transitionDuration:"1300ms"}}>
        {[0,60,120,180,240,300].map((deg,i)=><div key={deg} className="absolute left-1/2 top-1/2 w-[43%] h-[18%] origin-left rounded-full bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-amber-300 shadow-[0_0_30px_rgba(34,211,238,.65)]" style={{transform:"rotate("+deg+"deg) translateX(8%)"}}/>)}
      </div>
      <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white border-[10px] border-slate-300 shadow-2xl grid place-items-center text-4xl">🌀</div>
    </button>;

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
