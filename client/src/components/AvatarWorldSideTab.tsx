import { useEffect, useState } from "react";
import { UserRound, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function AvatarWorldSideTab(){
  const {user}=useAuth();
  const [open,setOpen]=useState(false);
  const [visible,setVisible]=useState(false);

  useEffect(()=>{
    const check=()=>{
      const hash=window.location.hash.replace("#","");
      const regularStudent=!!user&&!user.isAdmin&&user.role==="student"&&!user.is_eye_gaze_user;
      setVisible(regularStudent&&!hash.startsWith("/avatar-world"));
    };
    check();
    window.addEventListener("hashchange",check);
    return()=>window.removeEventListener("hashchange",check);
  },[user]);

  if(!visible)return null;

  return <div className="fixed left-0 top-[42%] z-[15000]" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
    <button
      type="button"
      onClick={()=>{if(open)window.location.hash="/avatar-world";else setOpen(true);}}
      className="rounded-r-3xl border border-l-0 border-cyan-300/40 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white shadow-[8px_12px_40px_rgba(49,46,129,.45)] overflow-hidden flex items-center transition-all duration-300"
      style={{width:open?210:54,minHeight:82}}
      aria-label="Open Avatar World"
    >
      <div className="w-[54px] min-w-[54px] h-[82px] grid place-items-center relative">
        <UserRound className="w-7 h-7 text-cyan-300"/>
        <Sparkles className="absolute w-4 h-4 text-amber-300 right-2 top-2"/>
      </div>
      <div className="text-left pr-4 whitespace-nowrap">
        <p className="text-[10px] font-black tracking-widest text-cyan-300">A.R.I.S.E.</p>
        <p className="font-black">Avatar World</p>
        <p className="text-[10px] font-bold text-white/55">Level up your character</p>
      </div>
    </button>
  </div>;
}
