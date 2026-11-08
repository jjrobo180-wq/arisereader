// The iPhone and iPad apps: element full screen is turned into "already full screen" (see main.tsx).
// requestFullscreen resolves without asking WebKit, so callers that wait for it carry on, and nothing moves
// the page out of the app's window (which crashed the app on iPad).
export function installNoFullscreen(target: { Element?: { prototype: any }; Document?: { prototype: any } } = globalThis as any): void {
  const el = target.Element?.prototype;
  if (!el || el.__noFullscreen) return;
  const ok = function () { return Promise.resolve(); };
  for (const name of ["requestFullscreen", "webkitRequestFullscreen", "webkitRequestFullScreen", "webkitEnterFullscreen"]) {
    try { Object.defineProperty(el, name, { value: ok, configurable: true, writable: true }); } catch { /* left as it was */ }
  }
  const doc = target.Document?.prototype;
  if (doc) for (const name of ["exitFullscreen", "webkitExitFullscreen"]) {
    try { Object.defineProperty(doc, name, { value: ok, configurable: true, writable: true }); } catch { /* left as it was */ }
  }
  el.__noFullscreen = true;
}
