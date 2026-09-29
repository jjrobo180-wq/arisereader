import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, LockKeyhole, X } from "lucide-react";

type WorldId="neighborhood"|"space"|"beach"|"racetrack";
const WORLDS:{id:WorldId;title:string;subtitle:string;description:string;available:boolean}[]=[
  {id:"neighborhood",title:"The Block",subtitle:"Neighborhood · open now",description:"Walk down the block, see your own house beside other readers' homes, and visit your place.",available:true},
  {id:"space",title:"Outer Space",subtitle:"Stars · coming soon",description:"A future world of glowing planets, star trails, and places to explore beyond Earth.",available:false},
  {id:"beach",title:"The Beach",subtitle:"Sunshine · coming soon",description:"A future seaside world with palm trees, warm sand, and a boardwalk for your friends.",available:false},
  {id:"racetrack",title:"The Racetrack",subtitle:"Fast lanes · coming soon",description:"A future driving world with colorful tracks and room to put your cars to the test.",available:false},
];

function WorldArt({id}:{id:WorldId}){
  return <div className={"relative h-full w-full overflow-hidden world-art world-art-"+id} aria-hidden="true">
    {id==="neighborhood"&&<>
      <div className="absolute inset-0 bg-[linear-gradient(#6dbfe9_0%,#b5ebf9_59%,#81b85f_60%,#5d9a49_100%)]"/>
      <div className="absolute right-[15%] top-[11%] h-14 w-14 rounded-full bg-yellow-100 shadow-[0_0_55px_20px_rgba(253,224,71,.45)]"/>
      <div className="absolute bottom-[14%] left-0 h-[19%] w-full -skew-y-3 bg-slate-600 shadow-[0_9px_0_#e2e8f0,0_-5px_0_#cbd5e1]"/>
      <div className="absolute bottom-[23%] left-[8%] h-[34%] w-[27%] rounded-t-xl bg-orange-100 shadow-xl"><div className="absolute -left-[9%] -top-[24%] h-[30%] w-[118%] -skew-y-6 rounded bg-rose-700"/><div className="absolute bottom-0 left-[38%] h-[53%] w-[26%] rounded-t bg-amber-800"/><div className="absolute left-[9%] top-[24%] h-[23%] w-[23%] bg-sky-300"/></div>
      <div className="absolute bottom-[25%] left-[48%] h-[31%] w-[27%] rounded-t-xl bg-sky-100 shadow-xl"><div className="absolute -left-[9%] -top-[26%] h-[31%] w-[118%] skew-y-6 rounded bg-teal-700"/><div className="absolute bottom-0 left-[37%] h-[52%] w-[27%] bg-slate-700"/><div className="absolute right-[9%] top-[23%] h-[22%] w-[22%] bg-sky-300"/></div>
      <span className="absolute bottom-[11%] right-[12%] text-5xl drop-shadow-lg">🚙</span><span className="absolute bottom-[26%] right-[7%] text-5xl drop-shadow-lg">🌳</span>
    </>}
    {id==="space"&&<>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_65%,#43317c_0%,#17123d_36%,#070d24_85%)]"/>
      {Array.from({length:28},(_,i)=><span key={i} className="absolute h-1 w-1 animate-pulse rounded-full bg-white" style={{left:((i*37)%93+3)+"%",top:((i*59)%85+5)+"%",animationDelay:(i%7)*.3+"s"}}/>)}
      <div className="absolute left-[17%] top-[18%] h-[30%] aspect-square rounded-full bg-[radial-gradient(circle_at_30%_30%,#dcb7ff,#7545ba_58%,#35266d)] shadow-[0_0_70px_#a855f7]"/>
      <div className="absolute right-[11%] bottom-[15%] h-[42%] aspect-square rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffefad,#e78d51_56%,#843d51)] shadow-[0_0_50px_#f97316]"/>
      <div className="absolute right-[4%] bottom-[29%] h-[12%] w-[54%] -rotate-12 rounded-full border-[10px] border-amber-200/65"/><span className="absolute bottom-[15%] left-[15%] text-6xl">🚀</span>
    </>}
    {id==="beach"&&<>
      <div className="absolute inset-0 bg-[linear-gradient(#ef8ca3_0%,#ffd3ab_42%,#52c8d5_43%,#267caa_65%,#f6d89d_67%,#d9b978_100%)]"/>
      <div className="absolute left-[52%] top-[22%] h-20 w-20 rounded-full bg-yellow-100 shadow-[0_0_50px_#ffcb75]"/>
      <div className="absolute top-[53%] h-2 w-full rotate-1 bg-white/70 blur-[2px]"/><div className="absolute top-[62%] h-2 w-full -rotate-1 bg-white/65 blur-[2px]"/>
      <span className="absolute bottom-[11%] left-[9%] text-8xl drop-shadow-xl">🌴</span><span className="absolute bottom-[8%] right-[15%] text-6xl drop-shadow-xl">⛱️</span>
    </>}
    {id==="racetrack"&&<>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#29936e,#135b4b_68%,#0b3c3a)]"/>
      <div className="absolute left-[12%] top-[15%] h-[70%] w-[76%] -rotate-[14deg] rounded-[45%] border-[42px] border-slate-800 shadow-[0_0_0_6px_#f8fafc,0_0_35px_#050b1b]"/>
      <div className="absolute left-[17%] top-[20%] h-[60%] w-[66%] -rotate-[14deg] rounded-[45%] border-[2px] border-dashed border-yellow-300/85"/>
      <span className="absolute right-[12%] top-[22%] -rotate-12 text-6xl drop-shadow-xl">🏎️</span><span className="absolute bottom-[11%] left-[12%] text-5xl">🏁</span>
    </>}
  </div>;
}

export default function Worlds(){
  const [,navigate]=useLocation();
  const [preview,setPreview]=useState<WorldId|null>(null);
  const selected=WORLDS.find(world=>world.id===preview);
  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#1e3a5f,#0b1026_48%,#050816)] text-white">
    <header className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-5">
      <button onClick={()=>navigate("/library")} className="flex min-h-12 items-center gap-2 rounded-2xl bg-white/10 px-4 font-black"><ArrowLeft className="h-5 w-5"/> Library</button>
      <div className="flex-1 text-right text-xs font-black uppercase tracking-[.2em] text-cyan-300">A.R.I.S.E. World Map</div>
    </header>
    <section className="mx-auto max-w-7xl px-4 pb-16">
      <p className="mt-4 text-xs font-black uppercase tracking-[.24em] text-amber-300">Choose your next stop</p>
      <h1 className="mt-2 text-4xl font-black sm:text-6xl">Where will you go?</h1>
      <p className="mt-3 max-w-2xl text-base font-semibold text-white/65">Step outside Club A.R.I.S.E. and explore The Block. Get a look at worlds being built next.</p>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        {WORLDS.map(world=><article key={world.id} className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 shadow-2xl">
          <div className="relative h-56 sm:h-64"><WorldArt id={world.id}/><span className={"absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-black shadow-lg "+(world.available?"bg-emerald-300 text-emerald-950":"bg-slate-950/85 text-white")}>{world.available?"OPEN NOW":"COMING SOON"}</span></div>
          <div className="p-5"><p className="text-xs font-black uppercase tracking-widest text-cyan-300">{world.subtitle}</p><h2 className="mt-1 text-2xl font-black">{world.title}</h2><p className="mt-2 min-h-12 text-sm font-medium text-white/65">{world.description}</p>
            <div className="mt-4 flex gap-2"><button type="button" onClick={()=>setPreview(world.id)} className="min-h-12 flex-1 rounded-xl bg-white/10 px-4 font-black hover:bg-white/20">Preview world</button>{world.available&&<button type="button" onClick={()=>navigate("/neighborhood")} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 font-black text-slate-950">Enter The Block <ArrowRight className="h-5 w-5"/></button>}</div>
          </div>
        </article>)}
      </div>
      <button type="button" onClick={()=>navigate("/club-arise")} className="mt-7 min-h-14 w-full rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/15 px-5 font-black text-fuchsia-100 hover:bg-fuchsia-500/25">Return to Club A.R.I.S.E.</button>
    </section>
    {selected&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-labelledby="world-preview-title">
      <div className="w-[min(720px,100%)] overflow-hidden rounded-3xl border border-white/20 bg-slate-950"><div className="relative h-60 sm:h-80"><WorldArt id={selected.id}/><button type="button" onClick={()=>setPreview(null)} className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-xl bg-black/70" aria-label="Close preview"><X/></button></div>
        <div className="p-5"><p className="text-xs font-black tracking-widest text-cyan-300">{selected.available?"OPEN NOW":"COMING SOON"}</p><h2 id="world-preview-title" className="mt-1 text-3xl font-black">{selected.title}</h2><p className="mt-2 text-white/70">{selected.description}</p>
          {selected.available?<button type="button" onClick={()=>navigate("/neighborhood")} className="mt-5 min-h-12 w-full rounded-xl bg-amber-300 font-black text-slate-950">Enter The Block</button>:<div className="mt-5 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white/70"><LockKeyhole className="h-4 w-4"/> Preview only · this world is coming soon</div>}
        </div>
      </div>
    </div>}
  </main>;
}
