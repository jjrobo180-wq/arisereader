// Shared sounds for the stage games: card flips, bubble pops, train whistles, clicks, switches and chimes,
// on top of the Reading Runner synth + music engine (no audio files).
import { RunnerAudio } from "@/game/runner/audio";
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class StageAudio extends RunnerAudio {
  private lastSoft = 0;
  play(name: string, n = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case "flip": this.noise(0.09, 0.12, 0, 2400, 1.4, "bandpass", undefined, undefined, 900); this.tone(520, 0.06, "triangle", 0.05, 0.02, 760); return;
      case "match": [72, 76, 79, 84].forEach((m, i) => this.tone(midi(m + (n % 3) * 2), 0.22, "triangle", 0.11, i * 0.06, undefined, true)); return;
      case "nomatch": this.tone(330, 0.14, "sine", 0.08); this.tone(294, 0.2, "sine", 0.07, 0.1); return;
      case "pop": this.noise(0.05, 0.3, 0, 3200, 0.9, "bandpass"); this.tone(800 + Math.random() * 300, 0.07, "sine", 0.12, 0, 1800, true); return;
      case "bubble": if (now - this.lastSoft < 0.05) return; this.lastSoft = now; this.tone(300 + Math.random() * 300, 0.09, "sine", 0.05, 0, 700 + Math.random() * 400); return;
      case "bounce": this.tone(260, 0.16, "sine", 0.1, 0, 520); return;
      case "block": this.noise(0.08, 0.2, 0, 900, 1, "lowpass"); this.tone(180, 0.1, "square", 0.07, 0, 120); return;
      case "couple": this.noise(0.06, 0.3, 0, 2600, 2, "bandpass"); this.tone(1200, 0.05, "square", 0.05, 0.03); this.noise(0.1, 0.2, 0.06, 600, 1, "lowpass"); return;
      case "toot": this.tone(midi(74), 0.5, "sawtooth", 0.06, 0, undefined, true); this.tone(midi(78), 0.5, "sawtooth", 0.05, 0, undefined, true); this.tone(midi(81), 0.5, "triangle", 0.06, 0); this.noise(0.6, 0.05, 0, 1800, 2, "bandpass"); return;
      case "chug": for (let i = 0; i < 8; i++) this.noise(0.08, 0.12 - i * 0.012, i * 0.14, 700, 1, "lowpass"); return;
      case "click": this.tone(1800, 0.02, "square", 0.08); this.noise(0.03, 0.2, 0, 4000, 1, "highpass"); return;
      case "switch": this.noise(0.04, 0.3, 0, 2500, 1.2, "bandpass"); this.tone(n ? 900 : 600, 0.05, "square", 0.05, 0.01); return;
      case "sparkle": if (now - this.lastSoft < 0.04) return; this.lastSoft = now; this.tone(midi(84 + Math.floor(Math.random() * 12)), 0.18, "sine", 0.05, 0, undefined, true); return;
      case "squish": this.noise(0.2, 0.12, 0, 400, 0.8, "lowpass", undefined, undefined, 1200); this.tone(140, 0.18, "sine", 0.08, 0, 90); return;
      case "spin": this.noise(0.25, 0.06, 0, 1200 + n * 40, 3, "bandpass"); return;
      case "chime": this.tone(midi(72 + (n % 12)), 0.4, "sine", 0.08, 0, undefined, true); this.tone(midi(84 + (n % 12)), 0.3, "triangle", 0.03, 0.01, undefined, true); return;
      case "gentle": this.tone(midi(67), 0.2, "sine", 0.08, 0, undefined, true); this.tone(midi(64), 0.3, "sine", 0.07, 0.15, undefined, true); return;
      case "quack": this.tone(620, 0.16, "sawtooth", 0.06, 0, 380); this.noise(0.14, 0.12, 0, 1100, 3, "bandpass"); return;
      case "whoosh": this.noise(0.35, 0.14, 0, 600 + n * 60, 1.2, "bandpass", undefined, undefined, 2400 + n * 80); return;
      case "splash": this.noise(0.5, 0.3, 0, 1600, 0.7, "lowpass", undefined, undefined, 500); this.tone(500, 0.12, "sine", 0.06, 0.02, 1200, true); return;
      case "chirp": { const b = 2400 + Math.random() * 1200; for (let i = 0; i < 2 + (n % 3); i++) this.tone(b, 0.07, "sine", 0.035, i * 0.11, b * 1.35, true); return; }
      case "munch": for (let i = 0; i < 4; i++) this.noise(0.06, 0.16, i * 0.16, 1500, 1.1, "bandpass"); return;
      case "drop": this.tone(1400, 0.12, "sine", 0.08, 0, 500, true); return;
    }
    super.play(name, n);
  }
}
