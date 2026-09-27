import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { CONTROLLED_FEATURES, loadParentControls, saveParentControls, type ParentControls } from "@/lib/parentControls";

export default function EyeGazeParentControls(){
 const {user}=useAuth(); const [,navigate]=useLocation(); const [controls,setControls]=useState<ParentControls>(()=>loadParentControls(user?.id)); const [saved,setSaved]=useState(false);
 useEffect(()=>setControls(loadParentControls(user?.id)),[user?.id]);
 const toggle=(path:string)=>setControls(c=>({...c,allowedPaths:c.allowedPaths.includes(path)?c.allowedPaths.filter(x=>x!==path):[...c.allowedPaths,path]}));
 const save=()=>{saveParentControls(user?.id,controls);setSaved(true);window.setTimeout(()=>setSaved(false),1800);};
 return <main className="min-h-screen bg-slate-50 text-slate-950 p-4 sm:p-7"><div className="max-w-3xl mx-auto">
  <button onClick={()=>navigate("/eye-gaze-parent")} className="min-h-12 rounded-2xl bg-white border px-4 font-black">← Parent Mode</button>
  <section className="mt-4 rounded-[2rem] bg-white border-2 border-violet-100 p-5 sm:p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-violet-700">Grown-up controls</p><h1 className="text-3xl sm:text-5xl font-black mt-1">Choose what your child can open</h1><p className="font-bold text-slate-600 mt-2">Turn limits on, then tap any feature to allow or hide it. Parent Mode always stays available.</p>
   <button onClick={()=>setControls(c=>({...c,enabled:!c.enabled}))} className={`mt-5 w-full min-h-16 rounded-2xl text-xl font-black border-4 ${controls.enabled?"bg-emerald-100 border-emerald-400 text-emerald-950":"bg-slate-100 border-slate-300"}`}>{controls.enabled?"✓ Profile limits are ON":"Profile limits are OFF"}</button>
  </section>
  <section className="mt-4 grid sm:grid-cols-2 gap-3">{CONTROLLED_FEATURES.map(feature=>{const on=controls.allowedPaths.includes(feature.path);return <button key={feature.path} onClick={()=>toggle(feature.path)} disabled={!controls.enabled} className={`min-h-24 rounded-3xl border-4 p-4 text-left flex items-center gap-4 disabled:opacity-45 ${on?"bg-white border-emerald-400":"bg-slate-100 border-slate-300"}`}><span className="text-4xl">{feature.emoji}</span><span className="flex-1"><strong className="block text-xl">{feature.label}</strong><small className="font-black text-slate-500">{on?"ALLOWED":"HIDDEN"}</small></span><span className="text-2xl">{on?"✓":"—"}</span></button>})}</section>
  <section className="mt-4 rounded-3xl bg-white border-2 border-sky-100 p-5"><label className="font-black text-lg">A.R.I.S.E. TV daily limit</label><p className="text-sm font-bold text-slate-500">0 means no daily time limit.</p><div className="grid grid-cols-4 gap-2 mt-3">{[0,15,30,60].map(n=><button key={n} onClick={()=>setControls(c=>({...c,tvDailyMinutes:n}))} className={`min-h-12 rounded-xl border-2 font-black ${controls.tvDailyMinutes===n?"bg-sky-100 border-sky-500":"bg-white border-slate-200"}`}>{n===0?"No limit":`${n} min`}</button>)}</div></section>
  <button onClick={save} className="mt-5 w-full min-h-16 rounded-2xl bg-violet-700 text-white text-xl font-black shadow-lg">{saved?"✓ Saved":"Save child profile limits"}</button>
 </div></main>;
}
