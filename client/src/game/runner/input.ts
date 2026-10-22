// Reading Runner — every way to play, merged into one input:
//  • Look to steer (eye gaze, head mouse or a normal mouse): look at the left, middle or right of the screen to change lanes,
//    look up at the top of the screen (or click / dwell-click) to jump.
//  • Touch: swipe left/right/up, or tap the left/right side to move and the middle to jump.
//  • Keyboard (arrows, WASD, space, Enter for switch users) and gamepads.
import type { SimInput } from "@shared/runner/sim";

export type Steer = "look" | "touch";
export type InputOptions = { steer: Steer; dwellMs: number };

const LEFT = ["ArrowLeft", "KeyA"], RIGHT = ["ArrowRight", "KeyD"], JUMP = ["ArrowUp", "KeyW", "Space", "Enter", "NumpadEnter"];

export class RunnerInput {
  onPause: (() => void) | null = null;
  onActivity: (() => void) | null = null;
  gazeLane: number | null = null;
  pointerLane: number | null = null;
  lookingUp = false;
  private moves: number[] = []; private jumpQ = false;
  private cand: { lane: number; since: number } | null = null; private armed = true;
  private touch: { x: number; y: number; id: number; t: number; type: string } | null = null;
  private pad = { l: false, r: false, j: false, p: false };

  constructor(private host: HTMLElement, public opts: InputOptions) {
    window.addEventListener("keydown", this.kd);
    window.addEventListener("pointermove", this.pm, { passive: true });
    host.addEventListener("pointerdown", this.pd);
    window.addEventListener("pointerup", this.pu);
    window.addEventListener("pointercancel", this.pc);
    window.addEventListener("blur", this.blur);
  }

  private rel(e: PointerEvent) { const r = this.host.getBoundingClientRect(); return { nx: (e.clientX - r.left) / Math.max(1, r.width), ny: (e.clientY - r.top) / Math.max(1, r.height) }; }
  private laneFor(nx: number, current: number | null) {
    const m = 0.045; // hysteresis so a wobbly gaze near a border doesn't flip lanes
    if (current === 0 && nx < 1 / 3 + m) return 0;
    if (current === 2 && nx > 2 / 3 - m) return 2;
    if (current === 1 && nx > 1 / 3 - m && nx < 2 / 3 + m) return 1;
    return nx < 1 / 3 ? 0 : nx > 2 / 3 ? 2 : 1;
  }
  private move(d: number) { this.moves.push(d); this.gazeLane = null; this.cand = null; this.onActivity?.(); }
  private jump() { this.jumpQ = true; this.onActivity?.(); }

  private kd = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((e.target as HTMLElement)?.closest?.("[data-runner-ui]")) return; // menus keep normal keyboard use
    if (e.code === "Escape" || e.code === "KeyP") { this.onPause?.(); e.preventDefault(); return; }
    if (e.repeat) return;
    if (LEFT.includes(e.code)) { this.move(-1); e.preventDefault(); }
    else if (RIGHT.includes(e.code)) { this.move(1); e.preventDefault(); }
    else if (JUMP.includes(e.code)) { this.jump(); e.preventDefault(); }
  };

  private pm = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const { nx, ny } = this.rel(e);
    if (nx < -0.02 || nx > 1.02 || ny < -0.02 || ny > 1.02) return;
    this.pointerLane = this.laneFor(nx, this.pointerLane);
    if (this.opts.steer !== "look") return;
    const lane = this.laneFor(nx, this.gazeLane);
    const now = performance.now();
    if (lane === this.gazeLane) this.cand = null;
    else if (!this.cand || this.cand.lane !== lane) this.cand = { lane, since: now };
    // look up to jump
    this.lookingUp = ny < 0.17;
    if (ny < 0.17 && this.armed) { this.armed = false; this.jump(); }
    else if (ny > 0.27) this.armed = true;
  };
  private pd = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest?.("button,[data-runner-ui]")) return;
    this.touch = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), type: e.pointerType };
    if (e.pointerType === "touch") e.preventDefault();
  };
  private pu = (e: PointerEvent) => {
    const st = this.touch; if (!st || st.id !== e.pointerId) return; this.touch = null;
    const dx = e.clientX - st.x, dy = e.clientY - st.y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) >= 28) { if (ay > ax) { if (dy < 0) this.jump(); } else this.move(dx < 0 ? -1 : 1); return; }
    // a tap / click
    if (st.type !== "touch" && this.opts.steer === "look") { this.jump(); return; }
    const { nx } = this.rel(e);
    if (nx < 1 / 3) this.move(-1); else if (nx > 2 / 3) this.move(1); else this.jump();
  };
  private pc = () => { this.touch = null; };
  private blur = () => { this.touch = null; this.cand = null; };

  read(): SimInput {
    const now = performance.now();
    if (this.opts.steer === "look" && this.cand && now - this.cand.since >= this.opts.dwellMs) { this.gazeLane = this.cand.lane; this.cand = null; this.onActivity?.(); }
    // gamepads (edge-triggered)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of Array.from(pads)) {
      if (!p) continue;
      const ax = p.axes[0] || 0;
      const l = ax < -0.5 || !!p.buttons[14]?.pressed, r = ax > 0.5 || !!p.buttons[15]?.pressed, j = !!(p.buttons[0]?.pressed || p.buttons[12]?.pressed || p.buttons[3]?.pressed), ps = !!p.buttons[9]?.pressed;
      if (l && !this.pad.l) this.move(-1); if (r && !this.pad.r) this.move(1); if (j && !this.pad.j) this.jump(); if (ps && !this.pad.p) this.onPause?.();
      this.pad = { l, r, j, p: ps };
    }
    const out: SimInput = { moves: this.moves, jump: this.jumpQ, lane: this.opts.steer === "look" ? this.gazeLane : null };
    this.moves = []; this.jumpQ = false;
    return out;
  }
  /** pending lane while the player is still dwelling on it (for the on-track hint) */
  pendingLane() { return this.cand?.lane ?? null; }

  dispose() {
    window.removeEventListener("keydown", this.kd); window.removeEventListener("pointermove", this.pm);
    this.host.removeEventListener("pointerdown", this.pd); window.removeEventListener("pointerup", this.pu);
    window.removeEventListener("pointercancel", this.pc); window.removeEventListener("blur", this.blur);
  }
}
