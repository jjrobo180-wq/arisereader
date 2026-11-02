// The Reader iPhone apps run inside a web view, and a web view quietly drops window.open() and
// target="_blank" links, so "Read this book", "Open the PDF" and similar buttons did nothing. This
// makes them work: a page inside the app opens in the app, and any other address opens in Safari.
import { isReaderApp } from "./nativeApp";

export function allowPopups() {
  if (!isReaderApp() || (window as any).__ariseOpenPatched) return;
  (window as any).__ariseOpenPatched = true;
  const nativeOpen = window.open.bind(window);
  const go = (raw: string) => {
    let u: URL;
    try { u = new URL(raw, window.location.href); } catch { return; }
    if (u.protocol === "capacitor:" || u.origin === window.location.origin) { window.location.assign(u.href); return; }
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:" || u.protocol === "tel:") {
      // Outside the app's own pages, the web view hands the address to Safari.
      window.location.href = u.href;
    }
  };
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (!url) return nativeOpen(url as any, target, features);
    go(String(url));
    return null;
  }) as typeof window.open;
  // Links that ask for a new tab.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented) return;
    const a = (e.target as Element | null)?.closest?.("a[target=_blank]") as HTMLAnchorElement | null;
    if (!a || !a.href) return;
    e.preventDefault();
    go(a.href);
  }, true);
}
