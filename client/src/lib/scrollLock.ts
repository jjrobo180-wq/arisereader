// One page-scroll lock shared by every pop-up, sheet and full-screen view.
// Each one used to save the page's overflow, set it to hidden, and put the saved value back when it closed.
// When two overlapped (the apps grid open over the phone-style Home, then an app picked), the one closing last
// put back the "hidden" it had saved from the other, and the page could not scroll again until a reload.
// Now each holder takes a lock and gets a release; the page is put back exactly as it was only when the last
// holder lets go, whatever the order.

type Hold = { fixed: boolean };
const holds = new Set<Hold>();
let saved: null | { ho: string; hb: string; bo: string; bb: string; bp: string; bt: string; bw: string; pr: string; y: number } = null;
let fixedOn = false;

function apply() {
  if (typeof document === "undefined") return;
  const html = document.documentElement, body = document.body;
  if (!holds.size) {
    if (!saved) return;
    const s = saved; saved = null;
    html.style.overflow = s.ho; html.style.overscrollBehavior = s.hb;
    body.style.overflow = s.bo; body.style.overscrollBehavior = s.bb; body.style.position = s.bp; body.style.top = s.bt; body.style.width = s.bw; body.style.paddingRight = s.pr;
    if (fixedOn) window.scrollTo(0, s.y);
    fixedOn = false;
    return;
  }
  if (!saved) {
    const gap = window.innerWidth - html.clientWidth;
    saved = { ho: html.style.overflow, hb: html.style.overscrollBehavior, bo: body.style.overflow, bb: body.style.overscrollBehavior, bp: body.style.position, bt: body.style.top, bw: body.style.width, pr: body.style.paddingRight, y: window.scrollY };
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
  }
  // A full-screen view also pins the page where it is (iPhone ignores overflow alone).
  const wantFixed = [...holds].some((h) => h.fixed);
  if (wantFixed && !fixedOn) {
    html.style.overflow = "hidden"; html.style.overscrollBehavior = "none"; body.style.overscrollBehavior = "none";
    body.style.position = "fixed"; body.style.top = `-${saved.y}px`; body.style.width = "100%";
    fixedOn = true;
  } else if (!wantFixed && fixedOn) {
    html.style.overflow = saved.ho; html.style.overscrollBehavior = saved.hb; body.style.overscrollBehavior = saved.bb;
    body.style.position = saved.bp; body.style.top = saved.bt; body.style.width = saved.bw;
    window.scrollTo(0, saved.y);
    fixedOn = false;
  }
}

/** Stops the page behind from scrolling. Call the returned function to let go (safe to call twice). */
export function lockPageScroll(opts: { fixed?: boolean } = {}): () => void {
  const hold: Hold = { fixed: !!opts.fixed };
  holds.add(hold);
  apply();
  return () => { if (holds.delete(hold)) apply(); };
}

/** How many holders there are now (for tests). */
export const pageScrollHolds = () => holds.size;
