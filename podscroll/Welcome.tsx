// Pod+'s first launch in the iPhone app (never on the website): a welcome screen with Sign in with
// Apple, email, or "start listening" (listening never needs an account), then the notification
// question (iOS's prompt comes from its button), then a short tour. Shown once per phone.
import { useRef, useState } from "react";
import { Bell, Loader2, Mail } from "lucide-react";
import { PodScene, SceneFit } from "../client/src/components/tour/TourScenes";
import { APPLE_LOGO_PATH, appleSignInAvailable, askApple } from "../client/src/lib/appleSignIn";
import { POD_LINKS } from "./Account";
import { podPushAllowed, podPushAvailable } from "./applePush";

export const WELCOME_KEY = "podplus.welcome.v1";
type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type Page = "hello" | "notify" | "tour";

const TOUR: { id: string; title: string; text: string }[] = [
  { id: "swipe", title: "Swipe to discover", text: "Every card is a real episode. Tap the cover to listen, and swipe up for the next one." },
  { id: "learn", title: "It learns what you love", text: "Follow, like and save, and your feed and home page follow your taste. Group favourites into Pod Modes." },
  { id: "make", title: "Make your own podcast", text: "Study Pod+ turns your notes, a PDF or a recorded class into a podcast, read by real AI voices. Studio holds your own show." },
  { id: "social", title: "Pod+ Social", text: "Post, share clips and stories, follow your favourite shows and creators, and message people, all in Social." },
  { id: "live", title: "Go live", text: "Tap Go live to start a LivePod: talk live to your listeners, read their comments and get Cheers as you go." },
  { id: "earn", title: "Earn from your show", text: "With Pod+ Rise you set your own prices: supporter memberships, premium episodes and Cheers from LivePods. Payouts are opening soon; join the list in Studio." },
];

export function Welcome({ api, signedIn, onSignedIn, onEmail, onPush, onDone }: {
  api: Api; signedIn: boolean;
  onSignedIn: (token: string, email: string) => void;
  /** Opens the email sign-in sheet; the welcome continues once it's done or closed. */
  onEmail: () => void;
  /** Turns notifications on (raises iOS's prompt). Resolves with whether they're on. */
  onPush: () => Promise<boolean>;
  onDone: () => void;
}) {
  const [page, setPage] = useState<Page>(signedIn ? "notify" : "hello");
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const touch = useRef<number | null>(null);
  const afterHello = async () => setPage(podPushAvailable() && !(await podPushAllowed()) ? "notify" : "tour");

  const apple = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const a = await askApple("com.arisereader.podplus");
      if (!a) return;
      const b = await api("/api/earshot/account/apple", { method: "POST", body: a });
      onSignedIn(b.token, b.email);
      await afterHello();
    } catch (e: any) { setErr(e?.message || "Sign in with Apple didn't work. Try again."); }
    finally { setBusy(false); }
  };

  const shell = "fixed inset-0 z-[95] flex flex-col bg-[#0f0b12] pb-[max(16px,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-white";
  const font = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif" };
  const big = "flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] text-[17px] font-semibold transition active:opacity-85 disabled:opacity-60";

  if (page === "hello") return <div className={shell} style={font} role="dialog" aria-modal="true" aria-label="Welcome to Pod+" data-testid="pod-welcome">
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(70%_60%_at_50%_10%,rgba(255,106,31,.35),transparent_70%)]" />
    <div className="relative mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col px-6">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <img src="./icon-512.png" alt="" className="h-[92px] w-[92px] rounded-[22px] shadow-[0_24px_60px_-20px_rgba(255,106,31,.7)]" />
        <h1 className="mt-7 text-[36px] font-bold leading-none tracking-[-.02em]">Pod+</h1>
        <p className="mt-3 max-w-[17rem] text-[18px] leading-snug text-white/70 [text-wrap:balance]">Every podcast, one swipe away.</p>
      </div>
      <div className="shrink-0 space-y-3">
        {appleSignInAvailable() && <button type="button" onClick={() => void apple()} disabled={busy} className={`${big} bg-white text-black`} data-testid="pod-welcome-apple">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={APPLE_LOGO_PATH} /></svg>}Continue with Apple
        </button>}
        <button type="button" onClick={onEmail} disabled={busy} className={`${big} bg-white/[.12] text-white`} data-testid="pod-welcome-email"><Mail className="h-5 w-5" />Continue with email</button>
        <button type="button" onClick={() => void afterHello()} className="h-12 w-full text-[16px] font-semibold text-[#ff8a3d]" data-testid="pod-welcome-listen">Start listening</button>
        {err && <p role="alert" className="text-center text-[14px] text-rose-300">{err}</p>}
        <p className="px-2 text-center text-[12px] leading-snug text-white/45">Listening is free, no account needed. By continuing you agree to the <a href={POD_LINKS.terms} target="_blank" rel="noreferrer" className="underline">Terms</a> and <a href={POD_LINKS.privacy} target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>.</p>
      </div>
    </div>
  </div>;

  if (page === "notify") return <div className={shell} style={font} role="dialog" aria-modal="true" aria-label="Turn on notifications" data-testid="pod-notify-ask">
    <div className="relative mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col px-7">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-10 w-full max-w-[19rem]" aria-hidden>
          <div className="absolute inset-x-6 -bottom-3 h-14 rounded-[20px] bg-white/[.06]" />
          <div className="relative flex items-start gap-3 rounded-[20px] bg-white/[.12] p-3.5 text-left ring-1 ring-white/10 backdrop-blur">
            <img src="./icon-512.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2"><span className="text-[14px] font-semibold">Pod+</span><span className="text-[12px] text-white/50">now</span></div>
              <p className="mt-0.5 text-[14px] leading-snug text-white/85">Your favourite show just posted a new episode.</p>
            </div>
          </div>
        </div>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-.02em] [text-wrap:balance]">Hear it first</h1>
        <p className="mt-3 max-w-[20rem] text-[17px] leading-snug text-white/65 [text-wrap:balance]">Get a heads-up when a show you follow posts a new episode. Never at night, never more than a few a day.</p>
        {err && <p role="status" className="mt-5 rounded-[12px] bg-white/10 px-4 py-3 text-[14px] text-white/80">{err}</p>}
      </div>
      <div className="shrink-0 space-y-2 pt-4">
        <button type="button" disabled={busy} className={`${big} bg-[#ff6a1f] text-white shadow-[0_14px_30px_-12px_rgba(255,106,31,.8)]`} data-testid="pod-notify-allow"
          onClick={async () => { setBusy(true); setErr(""); const on = await onPush().catch(() => false); setBusy(false); if (on) setPage("tour"); else setErr("Notifications are off. You can turn them on any time in Settings → Notifications → Pod+."); }}>
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}<Bell className="h-5 w-5" />Turn on notifications
        </button>
        <button type="button" onClick={() => setPage("tour")} className="h-12 w-full text-[16px] font-medium text-white/60" data-testid="pod-notify-later">Not now</button>
      </div>
    </div>
  </div>;

  const step = TOUR[i];
  const last = i === TOUR.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));
  return <div className={shell} style={font} role="dialog" aria-modal="true" aria-label="How Pod+ works" data-testid="pod-tour"
    onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
    onTouchEnd={(e) => { const x = touch.current; touch.current = null; if (x == null) return; const dx = (e.changedTouches[0]?.clientX ?? x) - x; if (dx < -50) next(); else if (dx > 50) setI(Math.max(0, i - 1)); }}>
    <div className="relative mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-end px-4">{!last && <button type="button" onClick={onDone} className="h-11 px-2 text-[16px] font-medium text-white/60" data-testid="pod-tour-skip">Skip</button>}</div>
      <div data-scene-col key={i} className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
        {/* The page acted out on a small phone with Pod+'s real screens. */}
        <div className="mb-6"><SceneFit><PodScene id={step.id} /></SceneFit></div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-.02em] [text-wrap:balance]">{step.title}</h1>
        <p className="mt-3 max-w-[21rem] text-[16px] leading-[1.45] text-white/65">{step.text}</p>
      </div>
      <div className="shrink-0 px-6 pt-4">
        <div className="mb-5 flex justify-center gap-2" aria-label={`Page ${i + 1} of ${TOUR.length}`}>{TOUR.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all duration-300 ${k === i ? "w-6 bg-white" : "w-2 bg-white/25"}`} />)}</div>
        <button type="button" onClick={next} className={`${big} bg-white text-black`} data-testid="pod-tour-next">{last ? "Start listening" : "Continue"}</button>
      </div>
    </div>
  </div>;
}
