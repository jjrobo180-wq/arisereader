// Skybound Sprint — synthesized sound effects and a cheerful chiptune-style music loop (no audio files).
type Mode = "major" | "minor" | "dorian";
const SCALES: Record<Mode, number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
const PROG: Record<Mode, number[]> = { major: [0, 4, 5, 3], minor: [0, 5, 3, 6], dorian: [0, 3, 0, 6] };
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class SkyAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode; private sfx!: GainNode; private music!: GainNode; private noiseBuf!: AudioBuffer;
  private timer = 0; private nextTime = 0; private step = 0; private song: { root: number; tempo: number; mode: Mode; seed: number } | null = null;
  private melody: number[] = []; musicVol = 0.5; sfxVol = 0.8; private starMode = false;

  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination);
    const comp = this.ctx.createDynamicsCompressor(); comp.connect(this.master);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
    this.music = this.ctx.createGain(); this.music.gain.value = this.musicVol * 0.35; this.music.connect(comp);
    const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setVolumes(music: number, sfx: number) {
    this.musicVol = music; this.sfxVol = sfx;
    if (this.ctx) { this.music.gain.value = music * 0.35; this.sfx.gain.value = sfx; }
  }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number, out?: AudioNode) {
    if (!this.ctx) return; const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, at = 0, freq = 1200, q = 0.8, type: BiquadFilterType = "bandpass", out?: AudioNode, time?: number) {
    if (!this.ctx) return; const t = time ?? this.ctx.currentTime + at;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name: string, n = 0) {
    if (!this.ctx) return;
    switch (name) {
      case "jump": this.tone(300, 0.16, "square", 0.12, 0, 640); break;
      case "flutter": this.tone(500, 0.14, "square", 0.1, 0, 900); this.tone(700, 0.1, "triangle", 0.08, 0.06, 1100); break;
      case "walljump": this.tone(260, 0.14, "square", 0.12, 0, 700); this.noise(0.08, 0.15, 0, 2000); break;
      case "glide": this.noise(0.35, 0.12, 0, 900, 1.2); this.tone(520, 0.2, "sine", 0.06, 0, 380); break;
      case "land": this.noise(0.07, 0.12, 0, 400, 1, "lowpass"); break;
      case "landHard": this.noise(0.12, 0.25, 0, 300, 1, "lowpass"); this.tone(90, 0.12, "sine", 0.18, 0, 50); break;
      case "gem": case "gemPop": { const base = 1046 + ((n % 4) * 60); this.tone(base, 0.08, "square", 0.07); this.tone(base * 1.5, 0.16, "square", 0.07, 0.06); break; }
      case "shard": [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.13, i * 0.07)); break;
      case "stomp": this.tone(220, 0.08, "square", 0.15, 0, 110); this.tone(660, 0.12, "triangle", 0.12, 0.04, 990); break;
      case "kick": this.tone(400, 0.18, "square", 0.12, 0, 120); break;
      case "bump": this.tone(140, 0.1, "square", 0.14, 0, 90); break;
      case "thud": this.tone(110, 0.08, "sine", 0.12); break;
      case "break": this.noise(0.25, 0.35, 0, 900, 0.6); this.tone(180, 0.12, "square", 0.1, 0, 60); break;
      case "sprout": [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.1, i * 0.06, f * 1.5)); break;
      case "powerUp": [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.14, "square", 0.08, i * 0.06)); break;
      case "star": [784, 988, 1175, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, "square", 0.08, i * 0.05)); break;
      case "powerDown": [784, 587, 440, 330].forEach((f, i) => this.tone(f, 0.14, "square", 0.09, i * 0.07)); break;
      case "hurt": this.tone(500, 0.3, "sawtooth", 0.12, 0, 120); break;
      case "fall": this.tone(700, 0.6, "triangle", 0.12, 0, 90); break;
      case "faint": [523, 392, 330, 262].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.12, i * 0.14)); break;
      case "spring": this.tone(180, 0.35, "sine", 0.22, 0, 900); this.tone(240, 0.3, "square", 0.05, 0, 1200); break;
      case "bounce": this.tone(260, 0.25, "sine", 0.18, 0, 700); break;
      case "poundStart": this.tone(600, 0.12, "triangle", 0.1, 0, 300); break;
      case "pound": this.noise(0.3, 0.4, 0, 250, 0.7, "lowpass"); this.tone(70, 0.3, "sine", 0.35, 0, 40); break;
      case "check": [659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.12, i * 0.09)); break;
      case "heartUp": [880, 1108, 1318, 1760].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.1, i * 0.06)); break;
      case "crumble": this.noise(0.25, 0.2, 0, 600, 0.6); break;
      case "shake": this.noise(0.12, 0.08, 0, 1500); break;
      case "win": [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => { this.tone(f, 0.26, "square", 0.09, i * 0.11); this.tone(f / 2, 0.26, "triangle", 0.09, i * 0.11); }); break;
      case "bossRoar": this.noise(0.9, 0.3, 0, 200, 0.5, "lowpass"); this.tone(80, 0.9, "sawtooth", 0.15, 0, 50); break;
      case "boltWarn": this.tone(1200, 0.12, "square", 0.05); this.tone(1200, 0.12, "square", 0.05, 0.2); break;
      case "bolt": this.noise(0.5, 0.45, 0, 3000, 0.4, "highpass"); this.tone(60, 0.4, "sawtooth", 0.2, 0, 40); break;
      case "bossSlam": this.noise(0.5, 0.5, 0, 180, 0.6, "lowpass"); this.tone(50, 0.5, "sine", 0.4, 0, 30); break;
      case "bossHit": [300, 200, 400].forEach((f, i) => this.tone(f, 0.16, "square", 0.14, i * 0.08)); break;
      case "bossDefeat": [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, "square", 0.1, i * 0.12)); this.noise(1.2, 0.3, 0, 400); break;
      case "bossWindup": this.tone(200, 0.6, "sawtooth", 0.08, 0, 600); break;
      case "pause": this.tone(880, 0.08, "square", 0.08); this.tone(660, 0.1, "square", 0.08, 0.08); break;
      case "select": this.tone(988, 0.07, "square", 0.08); break;
    }
  }

  // ── music ──
  startMusic(root: number, tempo: number, mode: Mode, seed: number) {
    this.ensure(); if (!this.ctx) return;
    this.stopMusic();
    this.song = { root, tempo, mode, seed };
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    // a 32-step (2 bar) melody per chord, reused with variation
    this.melody = [];
    let deg = 4;
    for (let i = 0; i < 64; i++) {
      if (i % 2 === 1 && rnd() < 0.45) { this.melody.push(-1); continue; }
      deg += Math.round((rnd() - 0.5) * 3.2); deg = Math.max(0, Math.min(11, deg));
      this.melody.push(rnd() < 0.12 ? -1 : deg);
    }
    this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }
  setStarMode(on: boolean) { this.starMode = on; }
  stopMusic() { if (this.timer) window.clearInterval(this.timer); this.timer = 0; }
  private schedule() {
    if (!this.ctx || !this.song) return;
    const { root, mode } = this.song; const scale = SCALES[mode];
    const tempo = this.song.tempo * (this.starMode ? 1.25 : 1);
    const stepDur = 60 / tempo / 4;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const st = this.step % 64, bar = Math.floor(this.step / 16) % 4, chord = PROG[mode][bar];
      const t = this.nextTime, out = this.music;
      const note = (degree: number, oct: number) => root + oct * 12 + scale[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
      // drums
      if (st % 8 === 0) this.kick(t);
      if (st % 8 === 4) this.noise(0.12, 0.25, 0, 1800, 0.7, "bandpass", out, t);
      if (st % 2 === 0) this.noise(0.04, 0.08, 0, 7000, 0.7, "highpass", out, t);
      // bass
      if (st % 2 === 0) this.voice(midi(note(chord + (st % 8 === 6 ? 4 : 0), -2)), stepDur * 1.6, "triangle", 0.22, t, out);
      // chord stabs
      if (st % 8 === 2 || st % 8 === 6) for (const k of [0, 2, 4]) this.voice(midi(note(chord + k, 0)), stepDur * 0.9, "square", 0.035, t, out);
      // melody
      const m = this.melody[(this.step + (Math.floor(this.step / 64) % 2) * 8) % 64];
      if (m >= 0) this.voice(midi(note(m + chord % 2, 1)), stepDur * 1.8, this.starMode ? "sawtooth" : "square", 0.06, t, out);
      this.nextTime += stepDur; this.step++;
    }
  }
  private voice(f: number, dur: number, type: OscillatorType, vol: number, t: number, out: AudioNode) {
    const ctx = this.ctx!; const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  private kick(t: number) {
    const ctx = this.ctx!; const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.2);
  }
  dispose() { this.stopMusic(); void this.ctx?.close(); this.ctx = null; }
}
