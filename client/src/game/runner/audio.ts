// Reading Runner — synthesized sound effects and an upbeat music loop per world (no audio files).
type Mode = "major" | "minor" | "dorian";
const SCALES: Record<Mode, number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
const PROG: Record<Mode, number[]> = { major: [0, 5, 3, 4], minor: [0, 5, 3, 6], dorian: [0, 3, 0, 6] };
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class RunnerAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode; private sfx!: GainNode; private music!: GainNode; private noiseBuf!: AudioBuffer; private verb!: ConvolverNode; private verbSend!: GainNode;
  private timer = 0; private nextTime = 0; private step = 0; private song: { root: number; tempo: number; mode: Mode; seed: number } | null = null;
  private melody: number[] = []; private energy = 0; musicVol = 0.45; sfxVol = 0.85;

  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.75; this.master.connect(this.ctx.destination);
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(this.master);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
    this.music = this.ctx.createGain(); this.music.gain.value = this.musicVol * 0.32; this.music.connect(comp);
    const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // a small room reverb for sparkle sounds
    this.verb = this.ctx.createConvolver(); const ir = this.ctx.createBuffer(2, this.ctx.sampleRate * 1.2, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3); }
    this.verb.buffer = ir; this.verbSend = this.ctx.createGain(); this.verbSend.gain.value = 0.25; this.verbSend.connect(this.verb).connect(comp);
  }
  setVolumes(music: number, sfx: number) { this.musicVol = music; this.sfxVol = sfx; if (this.ctx) { this.music.gain.value = music * 0.32; this.sfx.gain.value = sfx; } }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number, wet = false) {
    if (!this.ctx) return; const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx); if (wet) g.connect(this.verbSend); o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, at = 0, freq = 1200, q = 0.8, type: BiquadFilterType = "bandpass", out?: AudioNode, time?: number, sweepTo?: number) {
    if (!this.ctx) return; const t = time ?? this.ctx.currentTime + at;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name: string, n = 0) {
    if (!this.ctx) return;
    switch (name) {
      case "coin": { const step = [0, 2, 4, 7, 9, 12, 14, 16][n % 8]; const f = midi(84 + step); this.tone(f, 0.07, "square", 0.05); this.tone(f * 1.5, 0.14, "triangle", 0.07, 0.04, undefined, true); break; }
      case "card": [72, 76, 79, 84, 88].forEach((m, i) => this.tone(midi(m), 0.22, "triangle", 0.12, i * 0.06, undefined, true)); this.tone(midi(96), 0.4, "sine", 0.06, 0.3, undefined, true); break;
      case "wrong": this.tone(392, 0.16, "triangle", 0.11); this.tone(330, 0.24, "triangle", 0.1, 0.13); break;
      case "miss": this.tone(523, 0.12, "sine", 0.06); this.tone(440, 0.18, "sine", 0.06, 0.1); break;
      case "jump": this.noise(0.22, 0.12, 0, 900, 1.2, "bandpass", undefined, undefined, 3200); this.tone(280, 0.16, "sine", 0.1, 0, 560); break;
      case "land": this.noise(0.08, 0.14, 0, 380, 1, "lowpass"); break;
      case "landHard": this.noise(0.14, 0.24, 0, 300, 1, "lowpass"); this.tone(90, 0.12, "sine", 0.16, 0, 55); break;
      case "lane": this.noise(0.13, 0.07, 0, 2400, 1.4, "bandpass", undefined, undefined, 900); break;
      case "bump": this.tone(150, 0.12, "square", 0.1, 0, 90); this.noise(0.1, 0.12, 0, 600, 1); break;
      case "crash": this.noise(0.4, 0.4, 0, 500, 0.7, "lowpass"); this.tone(120, 0.35, "sawtooth", 0.12, 0, 50); break;
      case "smash": this.noise(0.3, 0.35, 0, 1400, 0.6); this.tone(200, 0.12, "square", 0.08, 0, 70); break;
      case "magnet": [60, 67, 72, 79].forEach((m, i) => this.tone(midi(m + 12), 0.14, "square", 0.07, i * 0.05)); this.tone(220, 0.5, "sine", 0.08, 0.1, 880, true); break;
      case "shield": [64, 71, 76, 83].forEach((m, i) => this.tone(midi(m + 12), 0.16, "triangle", 0.1, i * 0.06, undefined, true)); break;
      case "shieldPop": this.noise(0.3, 0.25, 0, 3000, 0.6, "highpass"); this.tone(900, 0.25, "sine", 0.1, 0, 300); break;
      case "powerEnd": this.tone(660, 0.12, "triangle", 0.06); this.tone(495, 0.16, "triangle", 0.06, 0.1); break;
      case "goal": [67, 72, 76, 79, 84].forEach((m, i) => this.tone(midi(m), 0.16, "square", 0.07, i * 0.07)); break;
      case "win": [72, 76, 79, 84, 79, 84, 88, 91].forEach((m, i) => { this.tone(midi(m), 0.28, "square", 0.08, i * 0.11); this.tone(midi(m - 12), 0.28, "triangle", 0.09, i * 0.11, undefined, true); }); this.noise(1.2, 0.08, 0.6, 6000, 0.5, "highpass"); break;
      case "fail": [67, 64, 60, 55].forEach((m, i) => this.tone(midi(m), 0.26, "triangle", 0.11, i * 0.16)); break;
      case "count": this.tone(660, 0.14, "square", 0.08); break;
      case "go": this.tone(990, 0.3, "square", 0.09); this.tone(1320, 0.3, "triangle", 0.07, 0.02, undefined, true); break;
      case "select": this.tone(988, 0.07, "square", 0.07); this.tone(1318, 0.1, "triangle", 0.06, 0.05); break;
      case "hover": this.tone(1568, 0.04, "sine", 0.03); break;
      case "pause": this.tone(880, 0.08, "square", 0.07); this.tone(660, 0.1, "square", 0.07, 0.08); break;
    }
  }

  // ── music ──
  startMusic(root: number, tempo: number, mode: Mode, seed: number) {
    this.ensure(); if (!this.ctx) return;
    this.stopMusic(); this.song = { root, tempo, mode, seed };
    let s = seed || 1; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    this.melody = []; let deg = 4;
    for (let i = 0; i < 64; i++) {
      if (i % 2 === 1 && rnd() < 0.5) { this.melody.push(-1); continue; }
      deg += Math.round((rnd() - 0.5) * 3.4); deg = Math.max(0, Math.min(11, deg));
      this.melody.push(rnd() < 0.15 ? -1 : deg);
    }
    this.step = 0; this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }
  /** 0 = calm (menus), 1 = running, 2 = home stretch */
  setEnergy(e: number) { this.energy = e; }
  stopMusic() { if (this.timer) window.clearInterval(this.timer); this.timer = 0; }
  private schedule() {
    if (!this.ctx || !this.song) return;
    const { root, mode } = this.song; const scale = SCALES[mode];
    const tempo = this.song.tempo * (this.energy >= 2 ? 1.08 : this.energy === 0 ? 0.9 : 1);
    const stepDur = 60 / tempo / 4;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const st = this.step % 64, bar = Math.floor(this.step / 16) % 4, chord = PROG[mode][bar];
      const t = this.nextTime, out = this.music;
      const note = (degree: number, oct: number) => root + oct * 12 + scale[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
      const running = this.energy > 0;
      if (running) {
        if (st % 4 === 0) this.kick(t);
        if (st % 8 === 4) this.noise(0.14, 0.26, 0, 1900, 0.7, "bandpass", out, t);
        this.noise(0.035, st % 2 ? 0.05 : 0.09, 0, 8000, 0.7, "highpass", out, t);
        if (st % 2 === 0) this.voice(midi(note(chord + (st % 8 === 6 ? 4 : 0), -2)), stepDur * 1.7, "triangle", 0.24, t, out);
      } else if (st % 8 === 0) this.voice(midi(note(chord, -2)), stepDur * 7, "sine", 0.16, t, out);
      if (st % 16 === 0) for (const k of [0, 2, 4]) this.voice(midi(note(chord + k, 0)), stepDur * 15, "sine", 0.03, t, out, 0.25);
      if (st % 4 === 2 && running) for (const k of [0, 2, 4]) this.voice(midi(note(chord + k, 0)), stepDur * 0.8, "square", 0.022, t, out);
      if (this.energy >= 2 && st % 2 === 1) this.voice(midi(note(chord + [0, 2, 4, 7][(st >> 1) % 4], 1)), stepDur * 0.9, "square", 0.025, t, out);
      const m = this.melody[(this.step + (Math.floor(this.step / 64) % 2) * 8) % 64];
      if (m >= 0 && (running || st % 4 === 0)) this.voice(midi(note(m + (chord % 2), 1)), stepDur * 1.8, running ? "square" : "triangle", running ? 0.05 : 0.04, t, out);
      this.nextTime += stepDur; this.step++;
    }
  }
  private voice(f: number, dur: number, type: OscillatorType, vol: number, t: number, out: AudioNode, attack = 0.01) {
    const ctx = this.ctx!; const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  private kick(t: number) {
    const ctx = this.ctx!; const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.2);
  }
  dispose() { this.stopMusic(); void this.ctx?.close(); this.ctx = null; }
}
