import { useEffect, useState } from "react";
import { UserRound, Sparkles, X } from "lucide-react";
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
      setOpen(false);
    };
    check();
    window.addEventListener("hashchange",check);
    return()=>window.removeEventListener("hashchange",check);
  },[user]);

  if(!visible)return null;

  return (
    <div
      className="fixed right-0 top-1/2 -translate-y-1/2 z-[15000] flex items-center"
      onMouseEnter={()=>setOpen(true)}
      onMouseLeave={()=>setOpen(false)}
    >
      {open && (
        <div className="mr-1 w-[168px] rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-3 text-white shadow-[-8px_12px_32px_rgba(49,46,129,.35)]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-black tracking-widest text-cyan-300">A.R.I.S.E.</p>
              <p className="text-sm font-black leading-tight">Avatar World</p>
              <p className="mt-0.5 text-[9px] font-bold leading-tight text-white/55">Level up your character</p>
            </div>
            <button
              type="button"
              onClick={(e)=>{e.stopPropagation();setOpen(false);}}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Close Avatar World tab"
            >
              <X className="h-4 w-4"/>
            </button>
          </div>
          <button
            type="button"
            onClick={()=>{setOpen(false);window.location.hash="/avatar-world";}}
            className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950"
          >
            Open Avatar World
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={()=>setOpen(v=>!v)}
        className="relative grid h-[58px] w-[42px] place-items-center rounded-l-2xl border border-r-0 border-cyan-300/40 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white shadow-[-6px_8px_24px_rgba(49,46,129,.35)] transition-transform active:scale-95"
        aria-label={open ? "Close Avatar World menu" : "Open Avatar World menu"}
        aria-expanded={open}
      >
        <UserRound className="h-5 w-5 text-cyan-300"/>
        <Sparkles className="absolute right-1.5 top-1.5 h-3 w-3 text-amber-300"/>
      </button>
    </div>
  );
}
