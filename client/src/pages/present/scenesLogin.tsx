// Scene 2 of the student welcome show: signing in at C.G.M.S.
// The accounts are already made. A student opens arisereader.com (the real home page is shown here, live), clicks Student sign in,
// signs in with their student number, picks a new password, and says who their ELA teacher is.
// The sign-in page, the "Set your password" screen and the ELA question are the site's own markup (SignIn.tsx,
// ForcePasswordChange.tsx and ClassTeachersPopup.tsx), drawn at a fixed size so they look the same on any screen.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, GraduationCap, KeyRound, LockKeyhole, Sparkles, Briefcase, Eye, Heart } from "lucide-react";
import { SITE } from "@shared/presentShow";
import { LibraryBackdrop } from "./scenesA";
import { RectSpot, Spot, useSince, useTyped, type SceneProps } from "./kit";

const NUMBER = "1234567";
const DOTS = "•••••••";
type Rect = { left: number; top: number; width: number; height: number };

/** The address bar of the browser, so the room sees where to type. */
function AddressBar({ text, caret }: { text: string; caret?: boolean }) {
  return (
    <div className="flex h-[30px] shrink-0 items-center gap-2 bg-[#e4e5f0] px-3">
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffd166]" /><span className="h-2.5 w-2.5 rounded-full bg-[#4cd18a]" />
      <div className="mx-auto flex h-[22px] w-[360px] items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-[#2d3350]">
        <LockKeyhole className="h-3 w-3 text-emerald-600" /><span className={caret ? "sw-caret" : ""}>{text}</span>
      </div>
      <span className="w-[42px]" />
    </div>
  );
}

/** A page drawn at laptop size (1280 wide) and scaled to the screen. */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="relative origin-top-left" style={{ width: 1280, height: 680, transform: "scale(.75)" }}>{children}</div>
    </div>
  );
}

const FALLBACK_BUTTON: Rect = { left: 880, top: 18, width: 128, height: 40 };

/** The real arisereader.com home page, live. The ring goes exactly where its "Student sign in" button really is. */
function HomePage({ spot, tap }: { spot: boolean; tap: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const measure = () => {
    try {
      const el = frame.current?.contentDocument?.querySelector(".student-signin");
      if (el) { const r = el.getBoundingClientRect(); if (r.width > 0) { setRect({ left: r.left, top: r.top, width: r.width, height: r.height }); return; } }
    } catch { /* the page could not be read: use the usual place */ }
    setRect(FALLBACK_BUTTON);
  };
  useEffect(() => { const id = window.setTimeout(measure, 1800); return () => window.clearTimeout(id); }, []);
  return (
    <>
      <iframe ref={frame} src="/reader-landing.html?present=1" title="The A.R.I.S.E. Reader home page" tabIndex={-1} scrolling="no" onLoad={() => { measure(); window.setTimeout(measure, 900); }}
        style={{ width: 1280, height: 680, border: 0, pointerEvents: "none", background: "#fff", display: "block" }} />
      {spot && <RectSpot rect={rect} tap={tap} />}
    </>
  );
}

/** The student sign-in page (the Student tab of SignIn.tsx). */
function SignInPage({ user, pass, pressed, spotUser, spotPass, spotButton }: { user: string; pass: string; pressed: boolean; spotUser: boolean; spotPass: boolean; spotButton: boolean }) {
  return (
    <div className="h-full w-full overflow-hidden bg-[#f8f9ff] text-[#19203b]" style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <header className="border-b border-[#e8eafb] bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-8 py-4">
          <div className="flex items-center gap-3 text-left">
            <span className="grid h-11 w-11 grid-cols-1 place-items-center rounded-2xl bg-[#5b53df] text-white shadow-md shadow-violet-200"><BookOpen size={24} strokeWidth={2.3} /></span>
            <span><span className="block text-[19px] font-black leading-tight tracking-[-.05em]">A.R.I.S.E.</span><span className="block text-[10px] font-bold uppercase tracking-[.13em] text-[#717a95]">Reader · WorkHub · LifeHub</span></span>
          </div>
          <div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e2e5f3] bg-white px-4 text-sm font-bold text-[#3a4162]"><ArrowLeft size={17} /> Back to home</div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_450px] items-start gap-20 px-8 pt-10">
        <section className="relative max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dcd7fd] bg-[#eeebff] px-4 py-2 text-[11px] font-black uppercase tracking-[.12em] text-[#6257d7]"><Sparkles size={15} /> Your reading adventure awaits</div>
          <h1 className="max-w-lg text-6xl font-black leading-[1.09] tracking-[-.06em]">Welcome back to <span className="text-[#5b53df]">your next chapter.</span></h1>
          <p className="mt-6 max-w-md text-lg font-medium leading-8 text-[#68728b]">Your books, quizzes, rewards, and favorite learning spaces are all right where you left them.</p>
          <div className="mt-8 grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded-[22px] border border-[#deddf8] bg-white p-5 shadow-[0_12px_40px_rgba(68,56,122,.05)]"><span className="grid h-10 w-10 grid-cols-1 place-items-center rounded-xl bg-[#e9f9ee] text-[#2f9967]"><BookOpen size={21} /></span><div className="mt-3 font-black">Read and discover</div><p className="mt-1 text-xs leading-5 text-[#707992]">Find another great story.</p></div>
            <div className="rounded-[22px] border border-[#deddf8] bg-white p-5 shadow-[0_12px_40px_rgba(68,56,122,.05)]"><span className="grid h-10 w-10 grid-cols-1 place-items-center rounded-xl bg-[#f4eaff] text-[#795ed6]"><Sparkles size={21} /></span><div className="mt-3 font-black">Keep growing</div><p className="mt-1 text-xs leading-5 text-[#707992]">Celebrate every reading win.</p></div>
          </div>
        </section>

        <section className="relative">
          <div className="rounded-[28px] border border-[#e3e5f6] bg-white p-8 shadow-[0_24px_70px_rgba(65,51,139,.10)]">
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-[#f1f0fb] p-1">
              <div className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-black text-[#6c7290]"><Briefcase size={17} /> Teacher or parent</div>
              <div className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-[#4d45cf] shadow-sm"><GraduationCap size={17} /> Student</div>
            </div>
            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[.13em] text-[#695ede]">Student sign in</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-.045em]">Sign in</h2>
              <p className="mt-2 text-sm text-[#737b94]">Use the username and password from your teacher or parent.</p>
            </div>
            <div className="space-y-5">
              <Spot on={spotUser} radius={16}>
                <div><div className="mb-2 block text-sm font-bold text-[#2e3653]">Username</div>
                  <div className={`flex h-12 w-full items-center rounded-xl border bg-[#fbfbff] px-4 text-base text-[#17213b] ${user ? "border-[#665ae6]" : "border-[#dfe3f1]"}`}>{user || <span className="text-[#9aa0b5]">Your username</span>}{spotUser && user.length < NUMBER.length && <span className="sw-caret" />}</div></div>
              </Spot>
              <Spot on={spotPass} radius={16}>
                <div><div className="mb-2 block text-sm font-bold text-[#2e3653]">Password</div>
                  <div className="relative"><div className="flex h-12 w-full items-center rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 pr-12 text-base tracking-[.2em] text-[#17213b]">{pass || <span className="tracking-normal text-[#9aa0b5]">Your password</span>}</div>
                    <span className="absolute inset-y-0 right-0 grid w-12 grid-cols-1 place-items-center text-[#788098]"><Eye size={20} /></span></div></div>
              </Spot>
              <Spot on={spotButton} radius={14}>
                <div className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5b53df] px-5 text-sm font-black text-white shadow-md shadow-violet-200 ${pressed ? "sw-press" : ""}`}>{pressed ? "Signing you in…" : "Sign in to A.R.I.S.E. Reader"} <ArrowRight size={18} /></div>
              </Spot>
            </div>
            <div className="my-6 flex items-center gap-3 text-xs text-[#8b91a5]"><span className="h-px flex-1 bg-[#e5e7f4]" /><span>New to A.R.I.S.E.?</span><span className="h-px flex-1 bg-[#e5e7f4]" /></div>
            <div className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d9d5fb] bg-[#f5f3ff] text-sm font-black text-[#5b53df]">Create an account</div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-semibold text-[#848ba4]"><LockKeyhole size={14} /> Secure access to your A.R.I.S.E. account</div>
        </section>
      </main>
    </div>
  );
}

/** The "Set your password" screen a student sees the first time (ForcePasswordChange.tsx). */
function SetPassword({ one, two, pressed, spot }: { one: string; two: string; pressed: boolean; spot: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-[1.75rem] bg-white p-7 shadow-[0_30px_90px_rgba(30,34,80,.18)]">
        <div className="mx-auto grid h-14 w-14 grid-cols-1 place-items-center rounded-2xl bg-violet-600 text-white"><KeyRound className="h-7 w-7" /></div>
        <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight text-slate-900">Set your password</h1>
        <p className="mt-2 text-center text-sm font-medium leading-5 text-slate-500">Your teacher gave you a starting password. Pick a new one that only you know before you continue.</p>
        <Spot on={spot === 1} radius={14} className="mt-5">
          <div className="block text-sm font-bold text-slate-700">New password
            <div className="mt-1.5 flex w-full items-center rounded-xl border border-slate-200 px-3.5 py-2.5 text-base tracking-[.2em] text-slate-900">{one || " "}{spot === 1 && one.length < 7 && <span className="sw-caret" />}</div></div>
        </Spot>
        <Spot on={spot === 2} radius={14} className="mt-4">
          <div className="block text-sm font-bold text-slate-700">Type it again
            <div className="mt-1.5 flex w-full items-center rounded-xl border border-slate-200 px-3.5 py-2.5 text-base tracking-[.2em] text-slate-900">{two || " "}{spot === 2 && two.length < 7 && <span className="sw-caret" />}</div></div>
        </Spot>
        <Spot on={spot === 3} radius={14} className="mt-5">
          <div className={`flex min-h-12 w-full items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white ${pressed ? "sw-press" : ""}`}>{pressed ? "Saving…" : "Save and continue"}</div>
        </Spot>
        <div className="mt-3 w-full text-center text-sm font-semibold text-slate-400">Sign out instead</div>
      </div>
    </div>
  );
}

/** "Who is your ELA teacher?" (ClassTeachersPopup.tsx), over the library. */
function ElaQuestion({ typed, picked, saving, saved, spot }: { typed: string; picked: boolean; saving: boolean; saved: boolean; spot: "box" | "list" | "save" | "" }) {
  const showList = typed.length >= 3 && !picked;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <LibraryBackdrop />
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
        <div role="dialog" aria-label="Who is your ELA teacher?" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
          {saved ? (
            <div className="sw-in py-4 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600" aria-hidden>✓</div>
              <h2 className="text-xl font-bold">Thanks!</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your ELA teacher is saved. You can change it anytime on your profile.</p>
              <div className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground">Done</div>
            </div>
          ) : (
            <>
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl" aria-hidden>🏫</div>
                <h2 className="text-xl font-bold">Who is your ELA teacher?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Type your ELA teacher's name, then tap it. Teachers at <span className="font-medium text-foreground">Conservatory Green Middle School</span> will see this.</p>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <div className="mb-1.5 block text-sm font-semibold text-foreground">ELA teacher</div>
                  <Spot on={spot === "box"} radius={14}>
                    <div className={`relative flex h-12 w-full items-center rounded-xl border bg-background px-3.5 pr-10 text-base ${picked ? "border-emerald-500" : "border-border"}`}>
                      {picked ? "Ms. Rivera" : typed ? <span className="sw-caret">{typed}</span> : <span className="text-muted-foreground">Start typing, like Garcia</span>}
                      {picked && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-emerald-600" aria-hidden>✓</span>}
                    </div>
                  </Spot>
                  {showList && (
                    <Spot on={spot === "list"} radius={12} className="absolute left-0 right-0 z-10 mt-1">
                      <ul className="rounded-xl border border-border bg-card p-1 shadow-xl">
                        <li className="flex min-h-11 items-center rounded-lg bg-primary/10 px-3 text-sm font-semibold">Ms. Rivera</li>
                      </ul>
                    </Spot>
                  )}
                  <p className="mt-1 min-h-[1.25rem] text-xs text-muted-foreground">{picked ? "Got it." : ""}</p>
                </div>
                <Spot on={spot === "save"} radius={14}>
                  <div className={`flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground ${picked ? "" : "opacity-50"} ${saving ? "sw-press" : ""}`}>{saving ? "Saving…" : "Save"}</div>
                </Spot>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function LoginScene({ beat }: SceneProps) {
  // beat 0: the address is typed, the ring finds Student sign in, and it is clicked
  const address = useTyped(SITE, beat === 0 ? "run" : "done", 500, 11);
  const ring = useSince(beat, 3000, beat === 0);
  const click = useSince(beat, 6000, beat === 0);
  // beat 1: the student number goes in as the username, then again as the password, then Sign in is tapped
  const m1 = beat === 1 ? "run" : beat >= 2 ? "done" : "idle";
  const user = useTyped(NUMBER, m1, 900, 6);
  const pass = useTyped(DOTS, m1, 4000, 7);
  const tapSignIn = useSince(beat, 7200, beat === 1);
  // beat 2: a new password, typed twice, then Save and continue
  const m2 = beat === 2 ? "run" : "idle";
  const one = useTyped(DOTS, m2, 900, 6);
  const two = useTyped(DOTS, m2, 3600, 6);
  const tapSave = useSince(beat, 7000, beat === 2);
  // beat 3: Riv is typed, the teacher is tapped from the list, and Save is pressed
  const m3 = beat === 3 ? "run" : "idle";
  const ela = useTyped("Riv", m3, 900, 4);
  const picked = useSince(beat, 3800, beat === 3);
  const saving = useSince(beat, 5800, beat === 3);
  const saved = useSince(beat, 6700, beat === 3);

  if (beat === 2) return <div className="relative h-full w-full"><SetPassword one={one} two={two} pressed={tapSave} spot={tapSave ? 3 : two.length > 0 ? 2 : 1} /></div>;
  if (beat === 3) return <ElaQuestion typed={ela} picked={picked} saving={saving && !saved} saved={saved} spot={saved ? "" : saving ? "save" : picked ? "save" : ela.length >= 3 ? "list" : "box"} />;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <AddressBar text={beat === 0 ? address : `${SITE}/#/signin?as=student`} caret={beat === 0 && address.length < SITE.length} />
      <Page>
        {beat === 0
          ? <HomePage spot={ring} tap={click} />
          : <SignInPage user={user} pass={pass} pressed={tapSignIn} spotUser={user.length < NUMBER.length || (user.length === NUMBER.length && pass.length === 0)} spotPass={pass.length > 0 && !tapSignIn} spotButton={tapSignIn} />}
      </Page>
    </div>
  );
}
