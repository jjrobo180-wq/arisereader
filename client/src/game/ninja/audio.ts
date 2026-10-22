// Reading Ninja — blade whooshes, juicy slices, combo chimes and launch thumps on top of the runner's music engine.
import { RunnerAudio } from "@/game/runner/audio";
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class NinjaAudio extends RunnerAudio {
  private swishT = 0;
  play(name: string, n = 0) {
    if (!this.ctx) return;
    switch (name) {
      case "swish": { const now = this.ctx.currentTime; if (now - this.swishT < 0.09) return; this.swishT = now; this.noise(0.16, 0.09, 0, 1800 + Math.random() * 1500, 2.2, "bandpass", undefined, undefined, 5200); return; }
      case "slice": this.noise(0.12, 0.22, 0, 5000, 1.2, "bandpass", undefined, undefined, 1500); this.noise(0.22, 0.16, 0.02, 700, 0.9, "lowpass", undefined, undefined, 250); this.tone(midi(76 + Math.min(12, (n - 1) * 2)), 0.18, "triangle", 0.1, 0.03, undefined, true); return;
      case "combo": [0, 4, 7, 12, 16].slice(0, Math.min(5, n + 1)).forEach((s, i) => this.tone(midi(79 + s), 0.16, "square", 0.06, i * 0.05, undefined, true)); return;
      case "wrong": this.tone(150, 0.25, "square", 0.12, 0, 70); this.noise(0.25, 0.25, 0, 400, 0.7, "lowpass"); return;
      case "launch": this.noise(0.18, 0.05, 0, 300, 1, "lowpass", undefined, undefined, 900); this.tone(110, 0.12, "sine", 0.06, 0, 160); return;
      case "clear": for (let i = 0; i < 4; i++) this.tone(midi(84 + i * 3), 0.1, "triangle", 0.06, i * 0.04, undefined, true); return;
      case "miss": this.tone(523, 0.1, "sine", 0.05); this.tone(392, 0.16, "sine", 0.05, 0.08); return;
    }
    super.play(name, n);
  }
}
