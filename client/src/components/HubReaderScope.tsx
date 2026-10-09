// Gives the A.R.I.S.E. Reader screens the look of the hub they are shown in (see hubReader.css).
// In WorkHub's night mode they keep their own dark look, which already matches it.
import { useEffect, type ReactNode } from "react";
import "./hubReader.css";

export default function HubReaderScope({ which, night = false, children }: { which: "work" | "life"; night?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (night) return;
    const root = document.documentElement;
    root.classList.add("hub-reader-vars", `hub-reader-vars--${which}`);
    return () => root.classList.remove("hub-reader-vars", `hub-reader-vars--${which}`);
  }, [which, night]);
  return <div className={night ? "" : `hub-reader hub-reader--${which}`} data-testid={`hub-reader-${which}`}>{children}</div>;
}
