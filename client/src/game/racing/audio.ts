// Aurora Racers — synthesised engine, effects and a little music sequencer (no audio files).
import type { ThemeId } from "./tracks";

export class RaceAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private engineOsc: OscillatorNode[] = [];
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private driftGain!: GainNode;
  private musicTimer = 0;
  private step = 0;
  private nextNote = 0;
  private theme: ThemeId = "shores";
  private musicOn = false;
  private vol = { sfx: 0.8, music: 0.5 };

  unlock() {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain(); this.master.gain.value = 1;
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
        this.master.connect(comp).connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.vol.music * 0.5; this.musicBus.connect(this.master);
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // engine
        this.engineFilter = ctx.createBiquadFilter(); this.engineFilter.type = "lowpass"; this.engineFilter.frequency.value = 900; this.engineFilter.Q.value = 3;
        this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
        this.engineFilter.connect(this.engineGain).connect(this.sfx);
        for (const [type, mul, g] of [["sawtooth", 1, 0.32], ["square", 0.5, 0.18], ["triangle", 2, 0.12]] as [OscillatorType, number, number][]) {
          const o = ctx.createOscillator(); o.type = type; o.frequency.value = 60 * mul;
          const og = ctx.createGain(); og.gain.value = g;
          o.connect(og).connect(this.engineFilter); o.start();
          o.userData = mul;
          this.engineOsc.push(o);
        }
        // drift screech (looped noise, band-passed)
        const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 2.5;
        this.driftGain = ctx.createGain(); this.driftGain.gain.value = 0;
        src.connect(bp).connect(this.driftGain).connect(this.sfx); src.start();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch { /* audio unavailable */ }
  }

  setVolumes(sfx: number, music: number) {
    this.vol = { sfx, music };
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.05);
  }

  engine(speed: number, max: number, throttle: number, boosting: boolean, drifting: boolean, active: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const r = Math.min(1.3, Math.abs(speed) / Math.max(1, max));
    // fake gears: pitch climbs then dips
    const gear = Math.min(3, Math.floor(r * 4));
    const inGear = r * 4 - gear;
    const base = 55 + gear * 14 + inGear * 70 + (boosting ? 25 : 0);
    for (const o of this.engineOsc) o.frequency.setTargetAtTime(base * ((o as any).userData || 1), t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(500 + r * 1600 + throttle * 400, t, 0.08);
    this.engineGain.gain.setTargetAtTime(active ? 0.06 + throttle * 0.07 + r * 0.05 : 0, t, 0.1);
    this.driftGain.gain.setTargetAtTime(active && drifting ? 0.07 : 0, t, 0.06);
  }

  private burst(dur: number, type: BiquadFilterType, freq: number, gain: number, freqEnd?: number, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx); src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, gain: number, delay = 0, bus?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfx); o.start(t); o.stop(t + dur + 0.03);
  }

  boost() { this.burst(0.7, "bandpass", 600, 0.5, 3000); this.tone(220, 660, 0.4, "sawtooth", 0.08); }
  miniTurbo(level: number) { this.burst(0.5, "highpass", 1500, 0.35, 5000); this.tone(400 + level * 150, 900 + level * 200, 0.25, "square", 0.08); }
  spark(level: number) { this.tone(900 + level * 300, 1300 + level * 300, 0.08, "square", 0.05); }
  hop() { this.tone(160, 320, 0.08, "sine", 0.12); }
  land() { this.burst(0.18, "lowpass", 400, 0.4, 120); }
  wall() { this.burst(0.2, "lowpass", 700, 0.6, 150); this.tone(120, 60, 0.15, "sine", 0.25); }
  coin() { this.tone(988, 988, 0.06, "square", 0.08); this.tone(1319, 1319, 0.18, "square", 0.08, 0.06); }
  itemBox() { for (let i = 0; i < 6; i++) this.tone(600 + i * 120, 620 + i * 120, 0.05, "triangle", 0.08, i * 0.05); }
  roulette() { this.tone(1200, 1200, 0.03, "square", 0.04); }
  gotItem() { this.tone(880, 1760, 0.2, "triangle", 0.12); }
  throwItem() { this.burst(0.25, "bandpass", 1200, 0.3, 400); }
  splat() { this.burst(0.35, "lowpass", 1800, 0.6, 200); this.tone(300, 80, 0.3, "sine", 0.3); }
  spin() { for (let i = 0; i < 4; i++) this.tone(700 - i * 120, 500 - i * 100, 0.1, "triangle", 0.08, i * 0.08); }
  shield() { this.tone(500, 1000, 0.3, "sine", 0.12); }
  shieldBreak() { this.burst(0.3, "highpass", 3000, 0.35); }
  rush() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.12, "square", 0.08, i * 0.07)); }
  beep(final: boolean) { this.tone(final ? 880 : 440, final ? 880 : 440, final ? 0.6 : 0.25, "square", 0.12); }
  lap(final: boolean) {
    const notes = final ? [659, 784, 988, 1319] : [784, 1047];
    notes.forEach((f, i) => this.tone(f, f, 0.18, "triangle", 0.14, i * 0.11));
  }
  finish(place: number) {
    const win = place <= 3;
    const notes = win ? [523, 659, 784, 1047, 1319, 1568] : [523, 494, 440, 392];
    notes.forEach((f, i) => { this.tone(f, f, 0.32, "triangle", 0.15, i * 0.14); this.tone(f / 2, f / 2, 0.32, "sine", 0.1, i * 0.14); });
  }
  click() { this.tone(900, 700, 0.05, "sine", 0.1); }

  // ---------------- music ----------------
  startMusic(theme: ThemeId) {
    this.theme = theme;
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    const tick = () => {
      if (!this.ctx || !this.musicOn) return;
      while (this.nextNote < this.ctx.currentTime + 0.25) { this.playStep(this.step, this.nextNote); this.step++; this.nextNote += this.stepLen(); }
      this.musicTimer = window.setTimeout(tick, 60);
    };
    tick();
  }
  stopMusic() { this.musicOn = false; window.clearTimeout(this.musicTimer); }

  private stepLen() { return 60 / (this.theme === "neon" ? 132 : this.theme === "frost" ? 118 : 124) / 4; }

  private playStep(i: number, t: number) {
    if (!this.ctx) return;
    const songs: Record<ThemeId, { root: number; prog: number[]; scale: number[]; lead: OscillatorType }> = {
      shores: { root: 220, prog: [0, 5, 3, 4], scale: [0, 2, 4, 7, 9, 12], lead: "triangle" },
      books: { root: 196, prog: [0, 3, 4, 3], scale: [0, 2, 3, 5, 7, 10, 12], lead: "triangle" },
      neon: { root: 174.6, prog: [0, 0, 5, 3], scale: [0, 3, 5, 7, 10, 12], lead: "sawtooth" },
      frost: { root: 246.9, prog: [0, 4, 5, 3], scale: [0, 2, 4, 7, 9, 11, 12], lead: "sine" },
    };
    const song = songs[this.theme];
    const bar = Math.floor(i / 16) % 4, s = i % 16;
    const chordRoot = song.root * Math.pow(2, [0, 2, 4, 5, 7, 9, 11][song.prog[bar]] / 12);
    const note = (f: number, dur: number, type: OscillatorType, gain: number) => {
      const o = this.ctx!.createOscillator(); o.type = type; o.frequency.value = f;
      const g = this.ctx!.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + dur + 0.02);
    };
    // kick & hat
    if (s % 4 === 0) { const o = this.ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); const g = this.ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.16); }
    if (s % 2 === 1) { const src = this.ctx.createBufferSource(); src.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000; const g = this.ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); src.connect(f).connect(g).connect(this.musicBus); src.start(t, Math.random() * 0.5, 0.06); }
    // bass
    if (s % 2 === 0) note(chordRoot / 2 * (s % 8 === 6 ? 1.5 : 1), this.stepLen() * 1.8, "square", 0.08);
    // arpeggio lead
    const pattern = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 5, 6, 4, 2, 4];
    const deg = song.scale[pattern[s] % song.scale.length];
    if (s % 2 === 0 || s === 15) note(chordRoot * 2 * Math.pow(2, deg / 12), this.stepLen() * 1.6, song.lead, 0.045);
  }

  dispose() {
    this.stopMusic();
    try { void this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }
}

declare global { interface OscillatorNode { userData?: number } }
