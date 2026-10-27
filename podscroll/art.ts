// Cover art that eases in from a slight zoom once it has loaded (styles.css: .ps-art / .ps-in).
// Spread onto an <img className="ps-art …">; already-loaded (cached) images show at once.
import type { SyntheticEvent } from "react";
export const artIn = {
  onLoad: (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("ps-in"),
  onError: (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("ps-in"),
  ref: (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("ps-in"); },
};
