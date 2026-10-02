// Prism Paintball — synthesised sound effects (WebAudio, no audio files).
type Pos = { x: number; y: number; z: number };

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private amb: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.8;
  private listener: Pos = { x: 0, y: 0, z: 0 };
  private listenerYaw = 0;
  private ambienceStarted = false;
  private lastStep = 0;

  /** Must be called from a user gesture at least once. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
        this.master.connect(comp).connect(this.ctx.destination);
        this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
        this.amb = this.ctx.createGain(); this.amb.gain.value = 0.0; this.amb.connect(this.master);
        const len = this.ctx.sampleRate * 1.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.startAmbience();
    } catch { /* audio unavailable */ }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setListener(p: Pos, yaw: number) { this.listener = p; this.listenerYaw = yaw; }

  /** Gain + stereo pan for a world position. */
  private spatial(p: Pos | null, range = 45): AudioNode | null {
    if (!this.ctx || !this.sfx) return null;
    const g = this.ctx.createGain();
    if (!p) { g.connect(this.sfx); return g; }
    const dx = p.x - this.listener.x, dy = p.y - this.listener.y, dz = p.z - this.listener.z;
    const dist = Math.hypot(dx, dy, dz);
    const att = 1 / (1 + (dist / (range * 0.25)) ** 2);
    if (att < 0.015) return null;
    g.gain.value = att;
    // listener right vector for yaw: (-cos, 0, sin)
    const rx = -Math.cos(this.listenerYaw), rz = Math.sin(this.listenerYaw);
    const pan = dist > 0.01 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) : 0;
    if (this.ctx.createStereoPanner) {
      const pn = this.ctx.createStereoPanner();
      pn.pan.value = pan * 0.85;
      g.connect(pn).connect(this.sfx);
    } else g.connect(this.sfx);
    return g;
  }

  private noiseBurst(out: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, q: number, gain: number, freqEnd?: number) {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.2, dur + 0.05);
  }

  private tone(out: AudioNode, t: number, dur: number, type: OscillatorType, f0: number, f1: number, gain: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  shoot(weapon: number, p: Pos | null) {
    const out = this.spatial(p, 60); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (weapon === 1) {
      this.noiseBurst(out, t, 0.16, "lowpass", 1800, 0.7, 0.9, 300);
      this.tone(out, t, 0.12, "sine", 140, 50, 0.7);
      this.noiseBurst(out, t + 0.28, 0.05, "bandpass", 2600, 3, 0.25);
      this.noiseBurst(out, t + 0.38, 0.05, "bandpass", 2000, 3, 0.25);
    } else if (weapon === 2) {
      this.noiseBurst(out, t, 0.22, "bandpass", 1300, 1.2, 0.9, 400);
      this.tone(out, t, 0.18, "triangle", 220, 60, 0.55);
      this.noiseBurst(out, t + 0.02, 0.35, "highpass", 4000, 0.5, 0.12);
    } else {
      this.noiseBurst(out, t, 0.075, "bandpass", 1900 + Math.random() * 300, 1.4, 0.75, 700);
      this.tone(out, t, 0.06, "sine", 260, 90, 0.45);
    }
  }

  splat(p: Pos | null, onPlayer: boolean) {
    const out = this.spatial(p, 35); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(out, t, onPlayer ? 0.14 : 0.1, "lowpass", 2400, 0.8, onPlayer ? 0.7 : 0.45, 500);
    this.tone(out, t, 0.08, "sine", onPlayer ? 420 : 300 + Math.random() * 120, 120, onPlayer ? 0.32 : 0.2);
  }

  hitMarker(head: boolean) {
    const out = this.spatial(null); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(out, t, 0.07, "square", head ? 1900 : 1500, head ? 2100 : 1400, 0.09);
    if (head) this.tone(out, t + 0.05, 0.09, "sine", 2600, 2600, 0.12);
  }

  elimination() {
    const out = this.spatial(null); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 880, 1320].forEach((f, i) => this.tone(out, t + i * 0.06, 0.22, "triangle", f, f * 1.01, 0.22));
  }

  hurt() {
    const out = this.spatial(null); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(out, t, 0.18, "lowpass", 900, 1, 0.8, 200);
    this.tone(out, t, 0.18, "sine", 180, 70, 0.5);
  }

  splatted() {
    const out = this.spatial(null); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(out, t, 0.4, "lowpass", 1400, 1, 0.9, 120);
    [520, 390, 260].forEach((f, i) => this.tone(out, t + 0.1 + i * 0.12, 0.25, "triangle", f, f * 0.98, 0.18));
  }

  footstep(p: Pos | null, loud: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (!p && now - this.lastStep < 0.08) return;
    if (!p) this.lastStep = now;
    const out = this.spatial(p, 18); if (!out) return;
    this.noiseBurst(out, now, 0.07 + loud * 0.03, "lowpass", 700 + Math.random() * 500, 0.9, (p ? 0.22 : 0.12) + loud * 0.1, 200);
  }

  jump() { const out = this.spatial(null); if (!out || !this.ctx) return; this.noiseBurst(out, this.ctx.currentTime, 0.1, "lowpass", 900, 1, 0.18, 300); }
  land(p: Pos | null) { const out = this.spatial(p, 20); if (!out || !this.ctx) return; const t = this.ctx.currentTime; this.noiseBurst(out, t, 0.14, "lowpass", 500, 1, 0.45, 120); this.tone(out, t, 0.1, "sine", 90, 45, 0.3); }

  reload(weapon: number) {
    const out = this.spatial(null); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = weapon === 1 ? 4 : 3;
    for (let i = 0; i < n; i++) this.noiseBurst(out, t + 0.15 + i * 0.22, 0.05, "bandpass", 3000 - i * 300, 4, 0.28);
    this.noiseBurst(out, t + 0.1, 0.5, "bandpass", 5000, 0.8, 0.06);
  }

  empty() { const out = this.spatial(null); if (!out || !this.ctx) return; this.noiseBurst(out, this.ctx.currentTime, 0.03, "highpass", 4000, 2, 0.25); }
  swap() { const out = this.spatial(null); if (!out || !this.ctx) return; const t = this.ctx.currentTime; this.noiseBurst(out, t, 0.06, "bandpass", 2500, 3, 0.2); this.noiseBurst(out, t + 0.12, 0.05, "bandpass", 1800, 3, 0.2); }

  beep(final = false) {
    const out = this.spatial(null); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(out, t, final ? 0.6 : 0.18, "square", final ? 1046 : 523, final ? 1046 : 523, 0.12);
  }

  stinger(win: boolean | null) {
    const out = this.spatial(null); if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = win === null ? [523, 523, 523] : win ? [523, 659, 784, 1046] : [523, 466, 392, 311];
    notes.forEach((f, i) => { this.tone(out, t + i * 0.16, 0.45, "triangle", f, f, 0.2); this.tone(out, t + i * 0.16, 0.45, "sine", f / 2, f / 2, 0.12); });
  }

  click() { const out = this.spatial(null); if (!out || !this.ctx) return; this.tone(out, this.ctx.currentTime, 0.05, "sine", 900, 700, 0.12); }

  private startAmbience() {
    if (!this.ctx || !this.amb || !this.noise || this.ambienceStarted) return;
    this.ambienceStarted = true;
    // soft wind
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 420;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(f.frequency);
    src.connect(f).connect(g).connect(this.amb);
    src.start(); lfo.start();
    this.amb.gain.setTargetAtTime(1, this.ctx.currentTime, 1.5);
    // occasional birds and crowd
    const chirp = () => {
      if (!this.ctx || !this.amb) return;
      const t = this.ctx.currentTime;
      const base = 2400 + Math.random() * 1600;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(this.amb, t + i * 0.11, 0.08, "sine", base, base * 1.35, 0.025);
      this.birdTimer = window.setTimeout(chirp, 3000 + Math.random() * 7000);
    };
    this.birdTimer = window.setTimeout(chirp, 2000);
  }
  private birdTimer = 0;

  crowdCheer() {
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.amb, t, 1.6, "bandpass", 1100, 0.6, 0.12, 800);
  }

  dispose() {
    window.clearTimeout(this.birdTimer);
    try { void this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }
}
