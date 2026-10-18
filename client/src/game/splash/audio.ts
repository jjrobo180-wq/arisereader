// Animal Splash — synthesized splashes, bubbles, chimes, birdsong and a gentle marimba loop (no audio files),
// plus the real recorded splash from Wikimedia Commons layered on top when it can load.
const REAL_SPLASH = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Water%20sloshing%20in%20a%20small%20bottle.ogg";
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class SplashAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode; private sfx!: GainNode; private music!: GainNode; private noise!: AudioBuffer; private verb!: GainNode;
  private timer = 0; private next = 0; private step = 0; private birdT = 0; musicVol = 0.4; sfxVol = 0.9; private real: HTMLAudioElement | null = null;

  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!C) return;
    const ctx = new C(); this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.3; this.music.connect(comp);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const conv = ctx.createConvolver(); const ir = ctx.createBuffer(2, ctx.sampleRate * 1.6, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.6); }
    conv.buffer = ir; this.verb = ctx.createGain(); this.verb.gain.value = 0.3; this.verb.connect(conv).connect(comp);
    try { this.real = new Audio(REAL_SPLASH); this.real.preload = "auto"; } catch { this.real = null; }
  }
  setVolumes(music: number, sfx: number) { this.musicVol = music; this.sfxVol = sfx; if (this.ctx) { this.music.gain.value = music * 0.3; this.sfx.gain.value = sfx; } if (this.real) this.real.volume = Math.min(1, sfx); }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number, wet = 0, out?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || this.sfx); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(this.verb); } o.start(t); o.stop(t + dur + 0.03);
  }
  private hiss(dur: number, vol: number, at: number, f0: number, f1: number, type: BiquadFilterType = "lowpass", q = 0.8, out?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime + at;
    const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out || this.sfx); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03);
  }
  private bubbles(n: number, at: number, spread: number, vol = 0.08) { for (let i = 0; i < n; i++) { const f = 300 + Math.random() * 500; this.tone(f, 0.07 + Math.random() * 0.06, "sine", vol * (0.5 + Math.random() * 0.5), at + Math.random() * spread, f * (1.8 + Math.random()), 0.3); } }

  play(name: string) {
    if (!this.ctx) return;
    switch (name) {
      case "splash": {
        this.hiss(0.18, 0.55, 0, 2500, 400, "lowpass", 0.7); this.tone(140, 0.22, "sine", 0.35, 0, 55);
        this.hiss(0.9, 0.22, 0.04, 6000, 1800, "bandpass", 0.6); this.hiss(1.4, 0.1, 0.25, 1200, 500, "lowpass", 0.5);
        this.bubbles(16, 0.15, 0.9, 0.09);
        if (this.real) { try { this.real.currentTime = 0; void this.real.play().then(() => window.setTimeout(() => { try { this.real?.pause(); } catch { /* ignore */ } }, 1500)).catch(() => {}); } catch { /* the synth splash already played */ } }
        break;
      }
      case "plop": this.tone(420, 0.09, "sine", 0.14, 0, 900, 0.3); this.hiss(0.2, 0.08, 0, 3000, 900, "bandpass"); this.bubbles(4, 0.05, 0.25, 0.05); break;
      case "whoosh": this.hiss(0.55, 0.16, 0, 500, 3000, "bandpass", 1.6); break;
      case "pick": this.tone(660, 0.08, "triangle", 0.1); this.tone(990, 0.12, "triangle", 0.09, 0.06, undefined, 0.3); break;
      case "hover": this.tone(1568, 0.04, "sine", 0.03); break;
      case "listen": this.tone(880, 0.1, "sine", 0.08); this.tone(1320, 0.14, "sine", 0.07, 0.1, undefined, 0.3); break;
      case "correct": [72, 76, 79, 84, 88].forEach((m, i) => this.tone(midi(m), 0.32, "triangle", 0.13, i * 0.07, undefined, 0.45)); this.tone(midi(96), 0.6, "sine", 0.06, 0.38, undefined, 0.6); this.bubbles(10, 0.1, 0.6, 0.05); break;
      case "fountain": this.hiss(1.6, 0.12, 0, 4000, 2500, "highpass", 0.5); break;
      case "gentle": this.tone(midi(67), 0.25, "sine", 0.1, 0, undefined, 0.3); this.tone(midi(64), 0.35, "sine", 0.09, 0.18, undefined, 0.3); break;
      case "fish": this.hiss(0.15, 0.12, 0, 3000, 800, "bandpass"); this.tone(500, 0.08, "sine", 0.06, 0, 1100); break;
      case "dock": this.tone(523, 0.12, "triangle", 0.08, 0, undefined, 0.3); this.tone(659, 0.16, "triangle", 0.07, 0.08, undefined, 0.3); break;
      case "finale": [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => { this.tone(midi(m), 0.4, "triangle", 0.12, i * 0.12, undefined, 0.5); this.tone(midi(m + 12), 0.3, "sine", 0.05, i * 0.12 + 0.05, undefined, 0.5); }); break;
    }
  }

  // gentle marimba-ish loop with occasional birdsong
  startMusic() {
    this.ensure(); if (!this.ctx || this.timer) return;
    this.next = this.ctx.currentTime + 0.1; this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }
  stopMusic() { if (this.timer) window.clearInterval(this.timer); this.timer = 0; }
  private schedule() {
    const ctx = this.ctx; if (!ctx) return;
    const spb = 60 / 96 / 2; // eighth notes at 96 bpm
    const prog = [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]];
    const mel = [76, -1, 79, 76, 74, -1, 72, -1, 74, 76, -1, 72, 69, -1, 67, -1];
    while (this.next < ctx.currentTime + 0.3) {
      const t = this.next - ctx.currentTime, st = this.step % 32, chord = prog[Math.floor(this.step / 8) % 4];
      if (st % 8 === 0) this.tone(midi(chord[0] - 12), spb * 6, "sine", 0.16, t, undefined, 0, this.music);
      if (st % 2 === 0) this.tone(midi(chord[(st / 2) % 3]), spb * 1.6, "triangle", 0.05, t, undefined, 0.2, this.music);
      const m = mel[st % 16]; if (m > 0 && (this.step % 64) < 32) this.tone(midi(m), spb * 1.5, "sine", 0.06, t, undefined, 0.35, this.music);
      this.next += spb; this.step++;
    }
    this.birdT -= 0.06;
    if (this.birdT <= 0) { this.birdT = 5 + Math.random() * 7; const base = 2200 + Math.random() * 1600; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(base, 0.09, "sine", 0.025 * this.musicVol * 2, i * 0.13, base * (1.15 + Math.random() * 0.3), 0.4, this.music); }
  }
  dispose() { this.stopMusic(); try { this.real?.pause(); } catch { /* ignore */ } void this.ctx?.close(); this.ctx = null; }
}
