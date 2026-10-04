// Haven City's sound, all made live with Web Audio (no files to download):
// the car engine and horn, plus a layered city soundscape that follows you —
// traffic rumble and passing cars, distant horns and bus brakes, a crowd
// murmur, the elevated train clacking overhead, waves and gulls at the beach,
// birds in the park, carnival music at the fair, and the clink of plates or
// arcade bleeps indoors.

export type Soundscape = { indoor: "restaurant" | "arcade" | null; traffic: number; crowd: number; beach: number; fair: number; train: number; park: number };

type Beds = { traffic: GainNode; crowd: GainNode; waves: GainNode; train: GainNode; hum: GainNode; sizzle: GainNode };

// An original fairground waltz: one note per beat, three beats a bar (0 = rest, numbers are MIDI notes).
const TUNE = [
  67, 64, 67, 72, 0, 71, 69, 65, 69, 74, 0, 72, 71, 67, 71, 76, 74, 72, 71, 69, 67, 72, 0, 0,
  76, 72, 76, 79, 0, 77, 76, 74, 72, 69, 0, 0, 77, 74, 71, 72, 76, 79, 77, 76, 74, 72, 0, 0,
];
const CHORDS = [48, 48, 53, 53, 55, 48, 55, 48, 48, 48, 57, 53, 55, 48, 55, 48]; // bass root per bar
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class CityAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private outdoor: GainNode | null = null;
  private muffle: BiquadFilterNode | null = null;
  private verb: GainNode | null = null;
  private beds: Beds | null = null;
  private osc: OscillatorNode | null = null;
  private sub: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private white: AudioBuffer | null = null;
  private musicBus: GainNode | null = null;
  private paramAt = 0;
  private next: Record<string, number> = {};
  private music = { step: 0, at: 0 };
  private _muted = false;

  get muted() { return this._muted; }
  set muted(m: boolean) {
    this._muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  /** Must be called from a user gesture (a key press or tap). */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      comp.connect(ctx.destination);
      const master = ctx.createGain(); master.gain.value = this._muted ? 0 : 0.9; master.connect(comp); this.master = master;
      // outdoor sounds go through a filter that muffles them when you step inside
      const muffle = ctx.createBiquadFilter(); muffle.type = "lowpass"; muffle.frequency.value = 18000; muffle.connect(master); this.muffle = muffle;
      const outdoor = ctx.createGain(); outdoor.connect(muffle); this.outdoor = outdoor;
      // a short echo off the buildings
      const conv = ctx.createConvolver(); conv.buffer = this.impulse(1.6); conv.connect(master);
      const verb = ctx.createGain(); verb.gain.value = 0.35; verb.connect(conv); this.verb = verb;

      this.white = this.noiseBuffer("white");
      const brown = this.noiseBuffer("brown"), pink = this.noiseBuffer("pink");
      const loop = (buf: AudioBuffer) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 2); return s; };
      const filt = (type: BiquadFilterType, f: number, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
      const bed = (to: AudioNode) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(to); return g; };

      // traffic: a low rumble plus tyre hiss
      const traffic = bed(outdoor);
      loop(brown).connect(filt("lowpass", 300)).connect(traffic);
      const hiss = ctx.createGain(); hiss.gain.value = 0.25; loop(pink).connect(filt("bandpass", 900, 0.5)).connect(hiss).connect(traffic);
      // crowd murmur: voice-band noise that swells and fades at speaking rhythm
      const crowd = bed(master);
      const babble = ctx.createGain(); babble.gain.value = 0.55; babble.connect(crowd);
      loop(pink).connect(filt("bandpass", 650, 1.1)).connect(babble);
      const hi = ctx.createGain(); hi.gain.value = 0.45; loop(pink).connect(filt("bandpass", 1700, 1.6)).connect(hi).connect(babble);
      for (const [f, d] of [[2.3, 0.18], [3.7, 0.14], [5.3, 0.1], [0.4, 0.15]]) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = f; g.gain.value = d; o.connect(g).connect(babble.gain); o.start(); }
      // waves rolling in
      const waves = bed(outdoor);
      const swell = ctx.createGain(); swell.gain.value = 0.6; swell.connect(waves);
      loop(brown).connect(filt("lowpass", 700)).connect(swell);
      { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 0.09; g.gain.value = 0.45; o.connect(g).connect(swell.gain); o.start(); }
      // the elevated train's rumble
      const train = bed(outdoor);
      loop(brown).connect(filt("lowpass", 150)).connect(train);
      // arcade hum and kitchen sizzle
      const hum = bed(master);
      for (const f of [60, 120]) { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.value = f === 60 ? 0.5 : 0.2; o.connect(g).connect(hum); o.start(); }
      const sizzle = bed(master);
      loop(this.white).connect(filt("highpass", 4200)).connect(sizzle);
      this.beds = { traffic, crowd, waves, train, hum, sizzle };
      const musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(outdoor); this.musicBus = musicBus;

      // engine: a growl plus a sub-octave, through a filter that opens with speed
      const osc = ctx.createOscillator(), sub = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      osc.type = "sawtooth"; osc.frequency.value = 40; sub.type = "square"; sub.frequency.value = 20;
      const subGain = ctx.createGain(); subGain.gain.value = 0.5;
      filter.type = "lowpass"; filter.frequency.value = 380; filter.Q.value = 2;
      gain.gain.value = 0;
      osc.connect(filter); sub.connect(subGain).connect(filter); filter.connect(gain).connect(master);
      osc.start(); sub.start();
      this.osc = osc; this.sub = sub; this.gain = gain; this.filter = filter;
    } catch { this.ctx = null; /* no audio on this device */ }
  }

  private noiseBuffer(kind: "white" | "pink" | "brown") {
    const ctx = this.ctx!, len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w * 0.5;
      else if (kind === "pink") { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 1.4; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    }
    return buf;
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!, len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    return buf;
  }

  /** speed01: 0 idle … 1 top speed. driving false fades the engine out. */
  engine(driving: boolean, speed01: number) {
    if (!this.ctx || !this.osc || !this.sub || !this.gain || !this.filter) return;
    const t = this.ctx.currentTime;
    const f = 38 + speed01 * 95;
    this.osc.frequency.setTargetAtTime(f, t, 0.08);
    this.sub.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.filter.frequency.setTargetAtTime(280 + speed01 * 900, t, 0.1);
    this.gain.gain.setTargetAtTime(driving ? 0.03 + speed01 * 0.045 : 0, t, 0.15);
  }

  /** Called every frame with what's around you; sets the levels and plays the little random sounds. */
  ambience(s: Soundscape, _dt: number) {
    const ctx = this.ctx; if (!ctx || !this.beds || !this.outdoor || !this.muffle) return;
    const t = ctx.currentTime;
    if (t - this.paramAt > 0.1) {
      this.paramAt = t;
      const set = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.6);
      const inside = !!s.indoor;
      this.muffle.frequency.setTargetAtTime(inside ? 520 : 18000, t, 0.2);
      set(this.outdoor as GainNode, inside ? 0.5 : 1);
      set(this.beds.traffic, inside ? 0.05 : 0.05 + s.traffic * 0.22);
      set(this.beds.crowd, inside ? (s.indoor === "restaurant" ? 0.05 : 0.035) : Math.min(0.08, 0.008 + s.crowd * 0.04 + s.fair * 0.035));
      set(this.beds.waves, s.beach * 0.16);
      set(this.beds.train, s.train * s.train * 0.3);
      set(this.beds.hum, s.indoor === "arcade" ? 0.012 : 0);
      set(this.beds.sizzle, s.indoor === "restaurant" ? 0.008 : 0);
      if (this.musicBus) set(this.musicBus, s.fair);
    }
    const due = (k: string, min: number, max: number) => { if ((this.next[k] ?? 0) > t) return false; this.next[k] = t + min + Math.random() * (max - min); return true; };
    if (this._muted) return;
    if (!s.indoor) {
      if (s.traffic > 0.12 && due("pass", 1.2 / s.traffic, 3.6 / s.traffic)) this.passingCar(s.traffic);
      if (s.traffic > 0.3 && due("horn", 7 / s.traffic, 22 / s.traffic)) this.distantHorn();
      if (s.traffic > 0.5 && due("brake", 18, 40)) this.airBrake();
      if (s.train > 0.15 && due("clack", 0.45, 0.6)) this.clack(s.train);
      if (s.beach > 0.2 && due("gull", 5, 14)) this.gull(s.beach);
      if ((s.park > 0.5 || (s.traffic < 0.2 && s.beach < 0.2 && s.fair < 0.2)) && due("bird", 1.5, 6)) this.bird();
      if (s.fair > 0.6 && due("bell", 6, 14)) this.boothBell(s.fair);
    } else if (s.indoor === "restaurant") {
      if (due("clink", 0.7, 2.8)) this.clink();
    } else if (due("blip", 0.35, 1.4)) this.arcadeBlip();
    if (s.fair > 0.03) this.stepMusic();
  }

  // ── little one-off sounds ────────────────────────────────────────────────
  private burst(dur: number, type: BiquadFilterType, from: number, to: number, vol: number, out?: AudioNode, q = 0.8) {
    const ctx = this.ctx!; if (!this.white) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = this.white; src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8;
    src.connect(f).connect(g).connect(p).connect(out ?? this.outdoor!);
    return p;
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = "sine", at = 0, out?: AudioNode, glideTo?: number) {
    const ctx = this.ctx!, t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out ?? this.master!); o.start(t); o.stop(t + dur + 0.05);
    return g;
  }

  private passingCar(level: number) {
    const ctx = this.ctx!, t = ctx.currentTime, dur = 1.6 + Math.random() * 1.4;
    const p = this.burst(dur, "bandpass", 240, 220, 0.05 + level * 0.07, this.outdoor!, 0.6);
    if (p) { p.pan.setValueAtTime(-0.9, t); p.pan.linearRampToValueAtTime(0.9, t + dur); }
  }

  private distantHorn() {
    const f = [330, 370, 415, 440, 466][Math.floor(Math.random() * 5)], twice = Math.random() < 0.4;
    const out = this.ctx!.createStereoPanner(); out.pan.value = Math.random() * 1.6 - 0.8;
    const lp = this.ctx!.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500;
    out.connect(lp); lp.connect(this.outdoor!); lp.connect(this.verb!);
    for (const at of twice ? [0, 0.32] : [0]) for (const k of [1, 1.26]) this.tone(f * k, 0.24 + Math.random() * 0.2, 0.018, "square", at, out);
  }

  private airBrake() { this.burst(0.9, "highpass", 2600, 3200, 0.035); }

  private clack(level: number) {
    for (const at of [0, 0.12]) {
      const ctx = this.ctx!, t = ctx.currentTime + at, src = ctx.createBufferSource(); src.buffer = this.white; src.start(t, Math.random()); src.stop(t + 0.08);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900 + Math.random() * 300; f.Q.value = 2.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(level * 0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(f).connect(g); g.connect(this.outdoor!); g.connect(this.verb!);
    }
  }

  private gull(level: number) {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone(1300 + Math.random() * 200, 0.28, 0.02 * level, "triangle", i * 0.32, this.outdoor!, 780);
  }

  private bird() {
    const base = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 0.07, 0.012, "sine", i * 0.11, this.outdoor!, base * 1.4);
  }

  private boothBell(level: number) { for (const [f, at] of [[1568, 0], [2093, 0.15]]) this.tone(f, 0.9, 0.025 * level, "sine", at, this.outdoor!); }

  private clink() { const f = 2800 + Math.random() * 2400; this.tone(f, 0.25, 0.012, "sine"); this.tone(f * 1.5, 0.18, 0.006, "sine", 0.01); }

  private arcadeBlip() {
    const ctx = this.ctx!, out = ctx.createStereoPanner(); out.pan.value = Math.random() * 1.8 - 0.9; out.connect(this.master!);
    const root = [523, 587, 659, 784, 880][Math.floor(Math.random() * 5)], n = 2 + Math.floor(Math.random() * 4), up = Math.random() < 0.6;
    for (let i = 0; i < n; i++) this.tone(root * 2 ** ((up ? i : -i) * 4 / 12), 0.07, 0.01, "square", i * 0.065, out);
    if (Math.random() < 0.15) this.tone(220, 0.5, 0.012, "sawtooth", 0.3, out, 880);
  }

  /** Schedules the fairground waltz a quarter of a second ahead. */
  private stepMusic() {
    const ctx = this.ctx!, beat = 60 / 160, out = this.musicBus!;
    if (this.music.at < ctx.currentTime - 1) this.music.at = ctx.currentTime + 0.05;
    while (this.music.at < ctx.currentTime + 0.25) {
      const step = this.music.step, at = this.music.at - ctx.currentTime;
      const note = TUNE[step % TUNE.length], bar = Math.floor(step / 3) % CHORDS.length, inBar = step % 3;
      if (note) { this.tone(midi(note), beat * 0.9, 0.022, "triangle", at, out); this.tone(midi(note + 12), beat * 0.6, 0.008, "sine", at, out); }
      const root = CHORDS[bar];
      if (inBar === 0) this.tone(midi(root - 12), beat * 0.8, 0.03, "triangle", at, out);
      else for (const iv of [4, 7]) this.tone(midi(root + iv + (root === 57 ? -1 : 0)), beat * 0.4, 0.009, "square", at, out);
      this.music.step++; this.music.at += beat;
    }
  }

  // ── sounds the game asks for ─────────────────────────────────────────────
  horn() {
    if (!this.ctx || this._muted) return;
    for (const f of [392, 494]) this.tone(f, 0.45, 0.05, "square");
  }

  bump() {
    if (!this.ctx || this._muted) return;
    this.tone(120, 0.25, 0.08, "triangle", 0, undefined, 50);
  }

  beep(high = false) {
    if (!this.ctx || this._muted) return;
    this.tone(high ? 880 : 520, 0.3, 0.06);
  }

  /** A rising whoosh when the car leaves a ramp. */
  whoosh() {
    if (!this.ctx || this._muted) return;
    this.tone(220, 0.45, 0.05, "sine", 0, undefined, 660);
  }

  /** A bright three-note chime for finding a star or ordering food. */
  chime() {
    if (!this.ctx || this._muted) return;
    [784, 988, 1319].forEach((f, i) => this.tone(f, 0.5, 0.07, "triangle", i * 0.09));
  }

  /** The little bell over a shop door. */
  door() {
    if (!this.ctx || this._muted) return;
    [1760, 2217, 1760, 2637].forEach((f, i) => this.tone(f, 0.35, 0.03, "sine", i * 0.07));
  }

  /** A crunchy bite. */
  bite() {
    if (!this.ctx || this._muted) return;
    this.burst(0.12, "bandpass", 2400, 1800, 0.05, this.master!, 1.2);
  }

  dispose() { try { void this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; }
}
