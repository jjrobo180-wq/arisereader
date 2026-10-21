// Small pieces the show's scenes share: the spotlight ring, timed steps inside a beat, typing, and scrolling.
import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** What a scene is told: which beat of its own it is on (0 is the first). */
export type SceneProps = { beat: number };

/** Puts the "look here" ring around something when `on`. */
export function Spot({ on, children, className, radius = 14 }: { on: boolean; children: ReactNode; className?: string; radius?: number }) {
  return (
    <div className={cn("sw-spotwrap", className)} style={{ "--sw-r": `${radius}px` } as CSSProperties}>
      {children}
      {on && <span className="sw-spot" aria-hidden="true" />}
    </div>
  );
}

/** True once `ms` have passed since `key` last changed (false again the moment it changes). A beat's timed steps hang off this. */
export function useSince(key: unknown, ms: number, enabled = true): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    if (!enabled) return;
    const id = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(id);
  }, [key, ms, enabled]);
  return on;
}

/**
 * Types `text` out when `mode` is "run", shows all of it when "done", none when "idle".
 * Going back to an earlier beat shows the screen as it was; jumping ahead shows it finished.
 */
export function useTyped(text: string, mode: "idle" | "run" | "done", delayMs = 500, charsPerSecond = 11): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (mode !== "run") { setN(0); return; }
    setN(0);
    let count = 0;
    let timer: number | undefined;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        count += 1;
        setN(count);
        if (count >= text.length && timer) window.clearInterval(timer);
      }, 1000 / charsPerSecond);
    }, delayMs);
    return () => { window.clearTimeout(start); if (timer) window.clearInterval(timer); };
  }, [text, mode, delayMs, charsPerSecond]);
  return mode === "done" ? text : mode === "idle" ? "" : text.slice(0, n);
}

/** A page that slides up and down inside the screen, the way a person scrolls it. */
export function Scroll({ y, children, className }: { y: number; children: ReactNode; className?: string }) {
  return <div className={cn("sw-scroll relative", className)} style={{ transform: `translateY(${-y}px)` }}>{children}</div>;
}

/**
 * How far to scroll so `getTarget()` sits at the top of the screen. The target must be a direct child of the scrolling page
 * (not inside a Spot), since its position is measured from the page.
 */
export function useScrollY(getTarget: () => HTMLElement | null, deps: unknown[], pad = 12): number {
  const [y, setY] = useState(0);
  useLayoutEffect(() => {
    const el = getTarget();
    setY(el ? Math.max(0, el.offsetTop - pad) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return y;
}

/** A book's picture cover (the same ones the site shows for the books you can read on Arise). */
export const coverOf = (key: string) => `/covers/reads/${key}.svg`;

/** Sample readers for the leaderboard and competition. Made up, so no real student shows on a projector. */
export const SAMPLE_READERS = [
  { name: "Maya R.", month: 85, all: 640, passed: 11 },
  { name: "Devon K.", month: 70, all: 585, passed: 9 },
  { name: "Aaliyah J.", month: 60, all: 510, passed: 8 },
  { name: "Marcus T.", month: 55, all: 470, passed: 8 },
  { name: "Sophia L.", month: 45, all: 430, passed: 6 },
  { name: "Noah B.", month: 40, all: 395, passed: 6 },
  { name: "Lily C.", month: 30, all: 350, passed: 5 },
  { name: "Jamal W.", month: 25, all: 310, passed: 4 },
] as const;

export const passedLabel = (n: number) => `${n} ${n === 1 ? "quiz" : "quizzes"} passed`;
