// Arise Kids' shared pieces: the prototype's style text as React styles, its icons, and the tab bar
// (also shown under the other Arise AAC pages by EyeGazeSiteShell). Small, so the shell can load it at once.
import type { CSSProperties } from "react";
import { useLocation } from "wouter";

export type KidsTab = "home" | "apps" | "stickers";
export const KIDS_TAB_PATHS: Record<KidsTab, string> = { home: "/eye-gaze-home", apps: "/eye-gaze-apps", stickers: "/eye-gaze-stickers" };

const cache = new Map<string, CSSProperties>();
/** The prototype's style text as a React style object. */
export function css(text: string): CSSProperties {
  const hit = cache.get(text);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const part of text.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const key = part.slice(0, i).trim().replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    if (key) out[key] = part.slice(i + 1).trim();
  }
  cache.set(text, out as CSSProperties);
  return out as CSSProperties;
}

export function Icon({ d, size, stroke = "currentColor", width = 2, fill = "none", cap = true }: { d: string; size: number; stroke?: string; width?: number; fill?: string; cap?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={width} strokeLinecap={cap ? "round" : undefined} strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const FONT = "Lexend, system-ui, sans-serif";
const STAR = "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";

/** The bar along the bottom of Home, Apps and Stickers (also under the other Arise AAC pages). */
export function KidsTabBar({ tab }: { tab: KidsTab | null }) {
  const [, navigate] = useLocation();
  const tabs: [KidsTab, string, string][] = [["home", "Home", "M3 11 12 4l9 7v9H3z"], ["apps", "Apps", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"], ["stickers", "Stickers", STAR]];
  return (
    <nav aria-label="Main" style={css("position: absolute; left: 0; right: 0; bottom: 0; height: 92px; box-sizing: border-box; padding: 10px 14px 26px; background: #ffffff; border-top: 1px solid #e4e4de; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; font-family: " + FONT)}>
      {tabs.map(([id, name, d]) => {
        const on = tab === id;
        return <button key={id} type="button" onClick={() => navigate(KIDS_TAB_PATHS[id])} aria-current={on ? "page" : undefined}
          style={css("min-height: 56px; border: 0; border-radius: 18px; background: " + (on ? "#161616" : "transparent") + "; color: " + (on ? "#ffffff" : "#555555") + "; font-family: inherit; font-size: 12px; font-weight: 800; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px")}>
          <Icon d={d} size={24} width={2.2} />{name}</button>;
      })}
    </nav>
  );
}

