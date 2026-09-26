import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Award, Flame, Gift, Lock, Star, Trophy } from "lucide-react";

function cookieToken() {
  try {
    const m=document.cookie.match(/arise_session=([^;]+)/);
    return m ? JSON.parse(atob(m[1])).token || null : null;
  } catch { return null; }
}

export default function EyeGazeProgress() {
  const { user, token } = useAuth();
  const t = token || cookieToken();
  const [badges,setBadges]=useState<any[]>([]);
  const [rewards,setRewards]=useState<any[]>([]);
  const [leaderboard,setLeaderboard]=useState<any[]>([]);
  const [engagement,setEngagement]=useState<any>(null);
  const [tab,setTab]=useState<"badges"|"rewards"|"rank">("badges");

  useEffect(()=>{
    if(!t) return;
    Promise.all([
      fetch(`${API_BASE}/api/engagement/badges`,{headers:{Authorization:`Bearer ${t}`},cache:"no-store"}).then(r=>r.ok?r.json():null),
      fetch(`${API_BASE}/api/student/rewards`,{headers:{Authorization:`Bearer ${t}`},cache:"no-store"}).then(r=>r.ok?r.json():null),
      fetch(`${API_BASE}/api/leaderboard`,{headers:{Authorization:`Bearer ${t}`},cache:"no-store"}).then(r=>r.ok?r.json():[]),
      fetch(`${API_BASE}/api/engagement/summary`,{headers:{Authorization:`Bearer ${t}`},cache:"no-store"}).then(r=>r.ok?r.json():null),
    ]).then(([b,r,l,e])=>{
      setBadges(Array.isArray(b?.badges)?b.badges:[]);
      setRewards(Array.isArray(r?.rewards)?r.rewards:[]);
      setLeaderboard(Array.isArray(l)?l:[]);
      setEngagement(e);
    }).catch(()=>{});
  },[t]);

  const rank=useMemo(()=>{
    const i=leaderboard.findIndex((x:any)=>(x.userId||x.id)===user?.id);
    return i>=0?i+1:null;
  },[leaderboard,user?.id]);

  return (
    <div className="bg-[#f7fbff] min-h-screen px-4 sm:px-6 py-6">
      <div className="max-w-[1250px] mx-auto space-y-6">
        <section className="rounded-[2rem] bg-gradient-to-r from-yellow-100 via-white to-violet-100 border border-yellow-100 p-6 sm:p-8">
          <div className="text-sm font-black uppercase tracking-wider text-violet-600">My Progress</div>
          <h1 className="text-3xl sm:text-5xl font-black text-blue-950 mt-1">Look how much you've done!</h1>
          <p className="text-slate-600 font-semibold mt-2">Badges, rewards, streaks, and rank all in one place.</p>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["⭐", engagement?.totalPoints ?? 0, "POINTS"],
            ["🔥", engagement?.streak ?? 0, "DAY STREAK"],
            ["🏆", rank ? `#${rank}` : "—", "RANK"],
            ["🌟", engagement?.level?.level ? `Level ${engagement.level.level}` : "Level 1", engagement?.level?.name || "READER"],
          ].map((x:any,i)=>(
            <div key={i} className="rounded-3xl bg-white border border-sky-100 p-5">
              <div className="text-3xl mb-2">{x[0]}</div>
              <div className="text-3xl font-black text-blue-950">{x[1]}</div>
              <div className="text-xs font-black text-slate-400 mt-1">{x[2]}</div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white border border-sky-100 p-2">
          <button onClick={()=>setTab("badges")} className={`min-h-[64px] rounded-2xl font-black flex items-center justify-center gap-2 ${tab==="badges"?"bg-yellow-100 text-amber-800":"text-slate-500"}`}><Award className="w-5 h-5"/> Badges</button>
          <button onClick={()=>setTab("rewards")} className={`min-h-[64px] rounded-2xl font-black flex items-center justify-center gap-2 ${tab==="rewards"?"bg-green-100 text-green-800":"text-slate-500"}`}><Gift className="w-5 h-5"/> Rewards</button>
          <button onClick={()=>setTab("rank")} className={`min-h-[64px] rounded-2xl font-black flex items-center justify-center gap-2 ${tab==="rank"?"bg-violet-100 text-violet-800":"text-slate-500"}`}><Trophy className="w-5 h-5"/> Rankings</button>
        </div>

        {tab==="badges" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {badges.map((b:any)=>(
              <div key={b.id} className={`min-h-[190px] rounded-3xl border-2 bg-white p-5 text-center ${b.unlocked?"border-yellow-300":"border-slate-100 opacity-55"}`}>
                <div className="text-6xl mb-3">{b.unlocked?b.emoji:<Lock className="w-12 h-12 mx-auto text-slate-300"/>}</div>
                <div className="font-black text-blue-950">{b.name}</div>
                <div className="text-xs text-slate-500 mt-2">{b.description}</div>
                {b.unlocked && <div className="mt-3 text-xs font-black text-green-600">UNLOCKED!</div>}
              </div>
            ))}
          </div>
        )}

        {tab==="rewards" && (
          <div className="grid sm:grid-cols-2 gap-4">
            {rewards.length===0 ? <div className="sm:col-span-2 rounded-3xl bg-white border border-sky-100 p-10 text-center font-bold text-slate-500">Keep learning to unlock rewards!</div> :
              rewards.map((r:any)=>(
                <div key={r.id} className="rounded-3xl bg-white border-2 border-green-100 p-5">
                  <Gift className="w-9 h-9 text-green-500 mb-3"/>
                  <div className="text-xl font-black text-blue-950">{r.title}</div>
                  <div className="text-sm text-slate-500 mt-2">{r.message}</div>
                  {r.progress && <div className="mt-3 text-sm font-black text-green-600">{r.progress}</div>}
                </div>
              ))}
          </div>
        )}

        {tab==="rank" && (
          <div className="space-y-3">
            {leaderboard.slice(0,20).map((x:any,i)=>(
              <div key={x.userId||x.id||i} className={`rounded-3xl p-4 flex items-center gap-4 border-2 ${(x.userId||x.id)===user?.id?"bg-violet-100 border-violet-300":"bg-white border-sky-100"}`}>
                <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center text-xl font-black text-amber-700">{i+1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-blue-950 truncate">{x.displayName}{(x.userId||x.id)===user?.id?" (You)":""}</div>
                  <div className="text-xs text-slate-500">{x.quizzesTaken || 0} activities</div>
                </div>
                <div className="text-2xl font-black text-violet-700">{x.totalPoints || 0} <span className="text-xs">pts</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
