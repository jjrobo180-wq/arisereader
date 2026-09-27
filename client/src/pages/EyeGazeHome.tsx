import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { cachedParentControls, fetchFamilySettings, pathAllowed, type ParentControls } from "@/lib/parentControls";

function getTokenFromCookie(): string | null { try { const match=document.cookie.match(/arise_session=([^;]+)/); if(!match)return null; return JSON.parse(atob(match[1])).token||null; } catch{return null;} }
const ACTIONS=[
 {title:"My Talker",subtitle:"Say what I need",emoji:"🗣️",path:"/eye-gaze-talker",tone:"from-teal-100 to-cyan-50 border-teal-200"},
 {title:"My World",subtitle:"Learn with my real rooms, pictures & videos",emoji:"🏠",path:"/my-world",tone:"from-emerald-100 to-lime-50 border-emerald-200"},
 {title:"Lessons",subtitle:"Pictures, words & reading",emoji:"📚",path:"/library",tone:"from-sky-100 to-blue-50 border-sky-200"},
 {title:"Games",subtitle:"Play and practice",emoji:"🎮",path:"/eye-gaze-games",tone:"from-amber-100 to-orange-50 border-amber-200"},
 {title:"A.R.I.S.E. Shorts",subtitle:"Swipe through learning Shorts made for me",emoji:"📺",path:"/eye-gaze-tv",tone:"from-fuchsia-100 to-violet-50 border-fuchsia-200"},
 {title:"Flash Cards",subtitle:"Swipe, see it & hear it",emoji:"🃏",path:"/eye-gaze-flashcards",tone:"from-cyan-100 to-sky-50 border-cyan-200"},
 {title:"My Buddy",subtitle:"Choose my learning friend",emoji:"🐶",path:"/eye-gaze-buddy",tone:"from-violet-100 to-fuchsia-50 border-violet-200"},
 {title:"My Progress",subtitle:"See what I learned",emoji:"⭐",path:"/leaderboard",tone:"from-yellow-100 to-amber-50 border-yellow-200"},
];
export default function EyeGazeHome(){
 const {user,token}=useAuth(); const [,navigate]=useLocation();
 const [stats,setStats]=useState({totalPoints:user?.totalPoints||0,activities:0,rank:null as number|null});
 const [controls,setControls]=useState<ParentControls>(cachedParentControls());
 useEffect(()=>{let active=true;void fetchFamilySettings(token).then(result=>{if(active)setControls(result.settings);}).catch(()=>{});return()=>{active=false;};},[token,user?.id]);
 useEffect(()=>{const authToken=token||getTokenFromCookie();if(!authToken)return;Promise.all([
  fetch(`${API_BASE}/api/profile`,{headers:{Authorization:`Bearer ${authToken}`},cache:"no-store"}).then(r=>r.ok?r.json():null),
  fetch(`${API_BASE}/api/eye-gaze-band-rank`,{headers:{Authorization:`Bearer ${authToken}`},cache:"no-store"}).then(r=>r.ok?r.json():null),
  fetch(`${API_BASE}/api/eye-gaze/profile`,{headers:{Authorization:`Bearer ${authToken}`},cache:"no-store"}).then(r=>r.ok?r.json():null),
 ]).then(([profile,rank,eye])=>setStats({totalPoints:profile?.totalPoints??user?.totalPoints??0,activities:eye?.total_completed??(Array.isArray(profile?.quizResults)?profile.quizResults.length:0),rank:rank?.eyeGazeRank||rank?.overallRank||null})).catch(()=>{});},[token,user?.id,user?.totalPoints]);
 const firstName=user?.displayName?.split(" ")[0]||user?.username||"Reader"; const visible=ACTIONS.filter(a=>pathAllowed(a.path,controls));
 return <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
  <section className="rounded-[2rem] bg-gradient-to-r from-sky-100 via-white to-amber-100 border border-sky-100 p-5 sm:p-7"><div className="flex flex-col lg:flex-row lg:items-center gap-5"><div className="flex-1"><p className="text-sm font-black uppercase tracking-widest text-blue-600">My Learning Home</p><h1 className="text-3xl sm:text-5xl font-black text-blue-950 mt-1">Hi, {firstName}! 👋</h1><p className="text-lg font-bold text-slate-600 mt-2">Choose one big button and start learning.</p>{controls.enabled&&<p className="mt-2 inline-block rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black">👨‍👩‍👧 Grown-up learning plan is on</p>}</div><div className="grid grid-cols-3 gap-2 w-full lg:w-auto"><div className="rounded-2xl bg-white px-4 py-3 text-center border border-sky-100"><div className="text-2xl font-black">{stats.totalPoints}</div><div className="text-[10px] font-black uppercase text-slate-400">Points</div></div><div className="rounded-2xl bg-white px-4 py-3 text-center border border-sky-100"><div className="text-2xl font-black">{stats.activities}</div><div className="text-[10px] font-black uppercase text-slate-400">Activities</div></div><div className="rounded-2xl bg-white px-4 py-3 text-center border border-sky-100"><div className="text-2xl font-black">{stats.rank?`#${stats.rank}`:"—"}</div><div className="text-[10px] font-black uppercase text-slate-400">Rank</div></div></div></div></section>
  <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{visible.map(action=><button key={action.path} type="button" onClick={()=>navigate(action.path)} className={`min-h-[190px] rounded-[2rem] border-2 bg-gradient-to-br ${action.tone} p-5 text-left hover:-translate-y-1 hover:shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-blue-200`}><div className="text-6xl mb-4">{action.emoji}</div><div className="text-2xl sm:text-3xl font-black text-blue-950">{action.title}</div><div className="text-sm sm:text-base font-bold text-slate-600 mt-1">{action.subtitle}</div></button>)}</section>
  <section className="rounded-[2rem] border border-slate-100 bg-white p-4 flex flex-col sm:flex-row items-center gap-3"><div className="flex items-center gap-3 flex-1"><div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">👨‍👩‍👧</div><div><div className="font-black text-blue-950">Grown-up tools</div><div className="text-sm text-slate-500">Words, pictures, progress and profile limits.</div></div></div><button type="button" onClick={()=>navigate("/eye-gaze-parent")} className="w-full sm:w-auto min-h-[50px] rounded-2xl bg-slate-100 px-5 font-black text-slate-700">Open Parent Mode</button></section>
 </main>;
}
