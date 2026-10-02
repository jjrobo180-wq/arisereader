import { useEffect, useState } from "react";
import { Bone, PawPrint, Stethoscope, Utensils } from "lucide-react";

export type PetCare = { happiness: number; lastUpdatedAt: number; lastFedAt: number; lastTreatAt: number; lastWalkAt: number };
export type PetRules = { feedCost: number; treatCost: number; vetCost: number; feedBoost: number; treatBoost: number; activityBoost: number; activityCooldownMs: number; treatCooldownMs: number; decayMs: number; serverNow?: number };
export type PetAction = "feed" | "treat" | "walk" | "play" | "vet";

export const DEFAULT_PET_RULES: PetRules = { feedCost: 30, treatCost: 10, vetCost: 60, feedBoost: 30, treatBoost: 12, activityBoost: 22, activityCooldownMs: 45 * 60000, treatCooldownMs: 10 * 60000, decayMs: 3 * 3600000 };

export function petMood(h: number) {
  if (h >= 85) return { label: "Thrilled", face: "🤩", bar: "bg-emerald-400" };
  if (h >= 65) return { label: "Happy", face: "😊", bar: "bg-emerald-400" };
  if (h >= 40) return { label: "Okay", face: "🙂", bar: "bg-lime-400" };
  if (h >= 20) return { label: "Needs care", face: "🥺", bar: "bg-amber-400" };
  return { label: "Very unhappy", face: "😢", bar: "bg-rose-500" };
}

/** How long until happiness reaches 0 with no care, as friendly text. */
export function timeUntilRunaway(h: number, rules: PetRules) {
  const ms = Math.max(0, h) * rules.decayMs;
  const hours = Math.round(ms / 3600000);
  if (hours >= 48) return Math.round(hours / 24) + " days";
  return Math.max(1, hours) + " hours";
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(t); }, []);
  return now;
}

export function PetHealthBar({ happiness, rules, compact = false }: { happiness: number; rules: PetRules; compact?: boolean }) {
  const mood = petMood(happiness);
  return <div>
    <div className="flex items-center justify-between text-xs font-black"><span>❤️ Happiness</span><span>{happiness}% · {mood.label} {mood.face}</span></div>
    <div className={"mt-1 overflow-hidden rounded-full bg-white/10 " + (compact ? "h-2.5" : "h-3.5")}><div className={"h-full rounded-full transition-all duration-500 " + mood.bar} style={{ width: happiness + "%" }} /></div>
    {!compact && <p className={"mt-1 text-[11px] font-bold " + (happiness <= 20 ? "text-rose-300" : "text-white/55")}>
      {happiness <= 20 ? "⚠️ Your pet is very unhappy and may run away soon! " : ""}Without care, your pet runs away in about {timeUntilRunaway(happiness, rules)}.
    </p>}
  </div>;
}

export default function PetCareActions({ petId, care, wallet, rules, busy, onAct }: {
  petId: string; care: PetCare | undefined; wallet: number; rules: PetRules; busy: boolean; onAct: (action: PetAction) => void;
}) {
  const now = useNow();
  // Server clock offset so cooldowns line up even if the device clock is off.
  const skew = rules.serverNow ? rules.serverNow - Date.now() : 0;
  const t = now + skew;
  const h = Math.round(care?.happiness ?? 100);
  const full = h >= 100;
  const isDog = petId === "pet-dog";
  const playLeft = Math.max(0, (care?.lastWalkAt || 0) + rules.activityCooldownMs - t);
  const treatLeft = Math.max(0, (care?.lastTreatAt || 0) + rules.treatCooldownMs - t);
  const mins = (ms: number) => Math.ceil(ms / 60000) + " min";
  const btn = "min-h-[4.5rem] rounded-2xl p-3 text-left text-sm font-black text-slate-950 transition active:scale-95 disabled:opacity-40";
  return <div className="grid grid-cols-2 gap-2">
    <button disabled={busy || full || wallet < rules.feedCost} onClick={() => onAct("feed")} className={btn + " bg-amber-300"}>
      <Utensils className="mb-1 h-5 w-5" />Food · {rules.feedCost} 🪙<span className="block text-xs font-bold opacity-70">+{rules.feedBoost} happiness</span></button>
    <button disabled={busy || full || wallet < rules.treatCost || treatLeft > 0} onClick={() => onAct("treat")} className={btn + " bg-pink-300"}>
      <Bone className="mb-1 h-5 w-5" />Treat · {rules.treatCost} 🪙<span className="block text-xs font-bold opacity-70">{treatLeft > 0 ? "Next treat in " + mins(treatLeft) : "+" + rules.treatBoost + " happiness"}</span></button>
    <button disabled={busy || full || playLeft > 0} onClick={() => onAct(isDog ? "walk" : "play")} className={btn + " bg-cyan-300"}>
      <PawPrint className="mb-1 h-5 w-5" />{isDog ? "Walk" : "Play"} · Free<span className="block text-xs font-bold opacity-70">{playLeft > 0 ? "Resting · " + mins(playLeft) : "+" + rules.activityBoost + " happiness"}</span></button>
    <button disabled={busy || full || wallet < rules.vetCost} onClick={() => onAct("vet")} className={btn + " bg-emerald-300"}>
      <Stethoscope className="mb-1 h-5 w-5" />Vet visit · {rules.vetCost} 🪙<span className="block text-xs font-bold opacity-70">Back to 100%</span></button>
    {full && <p className="col-span-2 rounded-xl bg-emerald-400/15 p-2 text-center text-xs font-black text-emerald-200">100% happy! Nothing needed right now. 💚</p>}
  </div>;
}

export const PET_CARE_MESSAGES: Record<PetAction, string> = {
  feed: "Yum! Your pet loved the food.", treat: "Treat time! Tail wags all around.", walk: "What a great walk!", play: "Play time made your pet so happy!", vet: "The vet says your pet is healthy and 100% happy!",
};
