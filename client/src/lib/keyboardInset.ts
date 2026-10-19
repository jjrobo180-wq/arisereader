// Phone keyboards cover the bottom of the screen without making the page any shorter (always on
// iPhone, and by default in Chrome on Android). A sheet that sits at the bottom of the screen
// ends up behind the keyboard, with the box being typed in out of sight.
//
// While the keyboard is up, this marks the page (html.kb-open) and shares the part of the screen
// that's still visible as --kb-top and --kb-height, and sheets marked .kb-sheet fit themselves
// into it (keyboard-inset.css), so they rest right on top of the keyboard. It also keeps the box
// being typed in visible inside its sheet. A box inside an element marked data-keyboard-top (like
// the food search) is brought to the top instead, so what it finds shows in the room below it.

const OPEN = "kb-open";
let watching = false;

/** Whether the focused element brings up the keyboard. */
function typing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName !== "INPUT") return false;
  return !/^(button|checkbox|color|file|hidden|image|radio|range|reset|submit)$/i.test((el as HTMLInputElement).type);
}

/** Scrolls the sheet's scrolling area so the focused box (or its data-keyboard-top area) shows. */
export function revealInSheet(target: Element | null): void {
  if (!(target instanceof HTMLElement)) return;
  const sheet = target.closest(".kb-sheet");
  if (!sheet) return;
  let box: HTMLElement | null = target.parentElement;
  while (box && box !== sheet.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight + 1) break;
    box = box.parentElement;
  }
  if (!box || box === sheet.parentElement) return;
  const area = box.getBoundingClientRect();
  const pin = target.closest<HTMLElement>("[data-keyboard-top]");
  if (pin && box.contains(pin)) {
    const gap = pin.getBoundingClientRect().top - area.top;
    if (gap > 2) box.scrollTop += gap;
    return;
  }
  const r = target.getBoundingClientRect(), margin = 16;
  if (r.bottom > area.bottom - margin) box.scrollTop += r.bottom - (area.bottom - margin);
  else if (r.top < area.top + margin) box.scrollTop -= area.top + margin - r.top;
}

/** Starts watching for the on-screen keyboard. Safe to call more than once. */
export function watchKeyboard(): void {
  if (watching || typeof window === "undefined" || !window.visualViewport) return;
  watching = true;
  const vv = window.visualViewport;
  const root = document.documentElement;
  let open = false, height = 0, frame = 0;

  // After the sheet has been resized: two frames, so the new layout is in place.
  const reveal = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => revealInSheet(document.activeElement)); }); };

  const update = () => {
    const full = Math.max(window.innerHeight, root.clientHeight);
    const up = full - vv.height > 120 && Math.abs(vv.scale - 1) < 0.05 && typing();
    if (up) {
      root.style.setProperty("--kb-top", `${Math.max(0, Math.round(vv.offsetTop))}px`);
      root.style.setProperty("--kb-height", `${Math.round(vv.height)}px`);
      const changed = !open || Math.abs(vv.height - height) > 40; // just came up, or changed size
      height = vv.height;
      if (!open) { root.classList.add(OPEN); open = true; }
      if (changed) reveal();
    } else if (open) {
      root.classList.remove(OPEN);
      root.style.removeProperty("--kb-top");
      root.style.removeProperty("--kb-height");
      open = false;
    }
  };

  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  document.addEventListener("focusin", () => { update(); if (open) reveal(); });
  // Moving from one box to the next keeps the keyboard up; check once the new box has focus.
  document.addEventListener("focusout", () => { window.setTimeout(update, 60); });
  // Typing in a box that belongs at the top keeps it there as what's below it changes.
  document.addEventListener("input", (e) => { if (open && (e.target as Element | null)?.closest?.("[data-keyboard-top]")) reveal(); });
}
