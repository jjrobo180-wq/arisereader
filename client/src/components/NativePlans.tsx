// The plan pages (Pricing, Billing) inside the Arise To Duo iPhone app: plans and add-ons aren't sold
// in the app (App Review Guideline 3.1.1), so this says what's on the account and nothing more.
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NATIVE_NO_PURCHASE } from "@/lib/nativeApp";

export default function NativePlans() {
  const { user } = useAuth();
  const home = user?.role === "teacher" || user?.isAdmin ? "#/workhub" : "#/lifehub";
  return <main className="min-h-[100dvh] bg-[#f6f7fb] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]" data-testid="native-plans">
    <div className="mx-auto max-w-md">
      <a href={user ? home : "#/signin"} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-700 hover:bg-white"><ArrowLeft className="h-4 w-4" />Back</a>
      <section className="mt-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">Your plan</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-600">{NATIVE_NO_PURCHASE}</p>
        <ul className="mt-4 space-y-2 text-[15px] text-slate-800">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />Arise WorkHub and LifeHub are free.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />Calendar, tasks, notes and the built-in sections are always free.</li>
        </ul>
      </section>
    </div>
  </main>;
}
