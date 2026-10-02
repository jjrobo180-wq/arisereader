// Skybound Sprint — keyboard, gamepad and on-screen touch controls merged into one input state.
import type { Input } from "@shared/skybound/sim";

const LEFT = ["ArrowLeft", "KeyA"], RIGHT = ["ArrowRight", "KeyD"], JUMP = ["Space", "ArrowUp", "KeyW", "KeyZ", "KeyK", "KeyJ"], DOWN = ["ArrowDown", "KeyS", "KeyX"];

export class SkyInput {
  private keys = new Set<string>();
  touch: Input = { left: false, right: false, jump: false, down: false };
  onPause: (() => void) | null = null;
  private padPause = false;

  constructor() {
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    window.addEventListener("blur", this.blur);
  }
  private kd = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.code === "Escape" || e.code === "KeyP") { this.onPause?.(); e.preventDefault(); return; }
    if ([...LEFT, ...RIGHT, ...JUMP, ...DOWN].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };
  private ku = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private blur = () => { this.keys.clear(); this.touch = { left: false, right: false, jump: false, down: false }; };

  read(): Input {
    const k = (list: string[]) => list.some(c => this.keys.has(c));
    const inp: Input = { left: k(LEFT) || this.touch.left, right: k(RIGHT) || this.touch.right, jump: k(JUMP) || this.touch.jump, down: k(DOWN) || this.touch.down };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of Array.from(pads)) {
      if (!p) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -0.35 || p.buttons[14]?.pressed) inp.left = true;
      if (ax > 0.35 || p.buttons[15]?.pressed) inp.right = true;
      if (p.buttons[0]?.pressed || p.buttons[3]?.pressed) inp.jump = true;
      if (ay > 0.6 || p.buttons[13]?.pressed || p.buttons[1]?.pressed || p.buttons[2]?.pressed) inp.down = true;
      const start = !!p.buttons[9]?.pressed;
      if (start && !this.padPause) this.onPause?.();
      this.padPause = start;
    }
    return inp;
  }
  dispose() { window.removeEventListener("keydown", this.kd); window.removeEventListener("keyup", this.ku); window.removeEventListener("blur", this.blur); }
}
