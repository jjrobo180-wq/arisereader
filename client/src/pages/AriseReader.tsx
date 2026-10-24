// A.R.I.S.E. Reader, on its own page at /reader — the way Arise Math has /math/.
//
// The Reader used to live inside Arise WorkHub as one menu item holding nine tabs, and inside
// LifeHub as one section. Both hubs now hand off to this page instead, so the Reader is one place
// rather than two that drift apart. Signing in is unchanged: it still happens in the hub, and a
// signed-out visitor here is sent there and brought back.
//
// The screens themselves are the ones that already worked — ReaderTools for a teacher,
// family-hub/Reader for a parent — inside one shell for everyone (pages/TeacherReader.tsx).
import { useEffect, useState } from "react";
import { ArrowLeft, BookHeart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { appHref, goToSignIn } from "@/lib/hubs";
import { isReaderTab, type ReaderTab } from "@/components/teacher-hub/HubReaderTools";
import TeacherReader from "./TeacherReader";
import type { HubTab } from "@shared/teacherHub";

const TAB_KEY = "reader_page_tab";
/** The accent the teacher picked, left here by WorkHub (shared/hubAccent.ts) for pages outside it. */
export const ACCENT_KEY = "arise-hub-accent";
/** Where to go back to, and what to call it, for whoever is reading. */
/** Where "back" goes, and what to call it. A full address, not a bare hash: this page sits outside
 *  the app's router, so "#/workhub" alone would change the address and leave the page as it was. */
const hubFor = (role: string | undefined) =>
  role === "parent" ? { href: appHref("/lifehub"), label: "To Do" } : { href: appHref("/workhub"), label: "WorkHub" };
/** The tab this page opens on: the one asked for by whatever sent us here, else the one last used. */
function firstTab(): ReaderTab {
  try {
    const asked = sessionStorage.getItem(TAB_KEY);
    if (asked) {
      sessionStorage.removeItem(TAB_KEY);
      if (isReaderTab(asked as HubTab)) return asked as ReaderTab;
    }
    const last = localStorage.getItem("reader_page_last");
    if (last && isReaderTab(last as HubTab)) return last as ReaderTab;
  } catch { /* the usual first screen */ }
  return "reader";
}

export default function AriseReader() {
  const { user } = useAuth();
  // Signing in as someone else starts clean, so one teacher's Reader is never shown to the next.
  return <ReaderPage key={user?.id ?? "signed-out"} />;
}

function ReaderPage() {
  const { user } = useAuth();
  const [tab, setTabState] = useState<ReaderTab>(firstTab);
  const isParent = user?.role === "parent";
  const back = hubFor(user?.role);

  const setTab = (t: ReaderTab) => {
    setTabState(t);
    try { localStorage.setItem("reader_page_last", t); } catch { /* not remembered */ }
    window.scrollTo({ top: 0 });
  };


  // Signing in stays in the hub. A signed-out visitor is sent there, and the hub brings them back
  // here once they are in, so a bookmarked /reader link still lands where it says it will.
  useEffect(() => {
    if (user) return;
    goToSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return <div className="grid grid-cols-1 min-h-screen place-items-center bg-slate-100 text-slate-600">
      <p className="text-sm">Taking you to sign in…</p>
    </div>;
  }

  // A.R.I.S.E. Reader is one of the paid programs, so a personal To-Do account has WorkHub but not
  // this. Said plainly, with the way to get it, rather than an empty screen or a wall of errors.
  if (!isParent && user.role !== "teacher" && !user.isAdmin) {
    return <div className="grid grid-cols-1 min-h-screen place-items-center bg-slate-100 px-5">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><BookHeart className="h-7 w-7" /></span>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">A.R.I.S.E. Reader</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">The Reader's class tools come with a teacher or parent account. Your account has Arise WorkHub and Arise To Duo, which stay free.</p>
        <a href={back.href} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">
          <ArrowLeft className="h-4 w-4" /> Back to {back.label}
        </a>
      </div>
    </div>;
  }

  // Teachers, parents and the administrator all get the same Reader: its own dark look, menu on
  // the left, and the banner that opens their hub (pages/TeacherReader.tsx).
  return <TeacherReader tab={isParent ? "reader" : tab} setTab={setTab} workhubHref={back.href} />;
}
