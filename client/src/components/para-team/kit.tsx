// The small pieces every Para Team screen uses: buttons, the shared context, and confirm/act helpers.
import { createContext, useContext, useState, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { ParaTeamApi } from "@/lib/paraTeam";
import type { ParaItem, ParaTeamView } from "@shared/paraTeam";
import { canEdit } from "@shared/paraTeam";

export const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
export const PRIMARY = `${BTN} bg-teal-700 text-white hover:bg-teal-800`;
export const SECOND = `${BTN} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`;
export const DANGER = `${BTN} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50`;
export const SMALL = "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900";
export const CARD = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
export const CHIP = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold";

export type Section = "today" | "messages" | "calendar" | "tasks" | "schedule" | "students" | "data" | "lessons" | "docs" | "team";

export type Para = {
  team: ParaTeamView;
  api: ParaTeamApi;
  me: number;
  lead: boolean;
  today: string;
  nameOf: (id: number | null | undefined) => string;
  say: (text: string) => void;
  go: (s: Section, focus?: string) => void;
  /** Runs a save; a failure is said out loud and returns false. */
  act: (work: () => Promise<unknown>, done?: string) => Promise<boolean>;
  mayEdit: (item: ParaItem) => boolean;
};

const ParaCtx = createContext<Para | null>(null);
export const ParaProvider = ParaCtx.Provider;
export function usePara(): Para {
  const p = useContext(ParaCtx);
  if (!p) throw new Error("Para Team screen outside its team");
  return p;
}

export function makePara(team: ParaTeamView, api: ParaTeamApi, today: string, say: (t: string) => void, go: Para["go"]): Para {
  const names = new Map(team.members.map((m) => [m.userId, m.name]));
  const act: Para["act"] = async (work, done) => {
    try { await work(); if (done) say(done); return true; } catch (e: any) { say(e?.message || "That didn't save. Try again."); return false; }
  };
  return {
    team, api, me: team.me, lead: team.role === "lead", today, say, go, act,
    nameOf: (id) => (id ? names.get(id) || "Former member" : "Everyone"),
    mayEdit: (item) => canEdit(team.role, team.me, item),
  };
}

export function SectionHead({ title, line, right }: { title: string; line?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-[28px]">{title}</h1>
        {line && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{line}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm leading-relaxed text-slate-600">{children}</p>;
}

/** "Delete" that turns into "Delete? Yes / No" before anything is lost. */
export function DeleteButton({ onDelete, label = "Delete" }: { onDelete: () => void; label?: string }) {
  const [sure, setSure] = useState(false);
  if (!sure) return <button type="button" className={`${SMALL} text-rose-700 hover:bg-rose-50 hover:text-rose-800`} onClick={() => setSure(true)}>{label}</button>;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-1.5 text-xs font-semibold text-rose-800">
      Sure?
      <button type="button" className={`${SMALL} text-rose-800 hover:bg-rose-100`} onClick={() => { setSure(false); onDelete(); }}>Yes, delete</button>
      <button type="button" className={SMALL} onClick={() => setSure(false)}>Keep</button>
    </span>
  );
}

export function Who({ id, at }: { id: number | null; at?: string }) {
  const { nameOf } = usePara();
  return <span className="text-xs text-slate-500">{nameOf(id)}{at ? ` · ${when(at)}` : ""}</span>;
}

/** "Today 9:05 AM", "Yesterday 2:10 PM", "Oct 14". */
export function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Today ${t}`;
  if (d.toDateString() === y.toDateString()) return `Yesterday ${t}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

/** "Tue, Oct 20" for a "YYYY-MM-DD". */
export function dayWords(key: string, long = false): string {
  if (!key) return "";
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString([], long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
}

export const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };


const BOX = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:text-sm";

/** A text box whose height is set here (WorkHub's own TextArea has a fixed minimum that would win). */
export function Area({ h = "min-h-24", className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { h?: string }) {
  return <textarea {...props} className={`${BOX} block w-full ${h} ${className}`} />;
}

/** A drop-down whose width is set here: full width unless `w` says otherwise. */
export function Choice({ w = "w-full", className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { w?: string }) {
  return <select {...props} className={`${BOX} min-h-11 sm:min-h-10 ${w} ${className}`} />;
}
