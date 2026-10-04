// Tiny engine and horn sounds made with Web Audio (no files to download).
export class CityAudio {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  muted = false;

  /** Must be called from a user gesture (a key press or tap). */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      osc.type = "sawtooth"; osc.frequency.value = 40;
      filter.type = "lowpass"; filter.frequency.value = 380;
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start();
      this.ctx = ctx; this.osc = osc; this.gain = gain; this.filter = filter;
    } catch { /* no audio on this device */ }
  }

  /** speed01: 0 idle … 1 top speed. driving false fades the engine out. */
  engine(driving: boolean, speed01: number) {
    if (!this.ctx || !this.osc || !this.gain || !this.filter) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(38 + speed01 * 95, t, 0.08);
    this.filter.frequency.setTargetAtTime(300 + speed01 * 700, t, 0.1);
    this.gain.gain.setTargetAtTime(driving && !this.muted ? 0.035 + speed01 * 0.04 : 0, t, 0.15);
  }

  horn() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (const f of [392, 494]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.5);
    }
  }

  bump() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.3);
  }

  beep(high = false) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "sine"; o.frequency.value = high ? 880 : 520;
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.32);
  }

  /** A rising whoosh when the car leaves a ramp. */
  whoosh() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(660, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.5);
  }

  /** A bright three-note chime for finding a star. */
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [784, 988, 1319].forEach((f, i) => {
      const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
      o.type = "triangle"; o.frequency.value = f;
      const s = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.07, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5);
      o.connect(g).connect(this.ctx!.destination); o.start(s); o.stop(s + 0.55);
    });
  }

  dispose() { try { this.osc?.stop(); void this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; }
}
