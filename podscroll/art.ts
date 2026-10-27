// Cover art that eases in from a slight zoom once it has loaded (styles.css: .pz-art / .pz-in).
// Spread onto an <img className="pz-art …">; already-loaded (cached) images show at once.
import type { SyntheticEvent } from "react";
export const artIn = {
  onLoad: (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("pz-in"),
  onError: (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("pz-in"),
  ref: (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("pz-in"); },
};
