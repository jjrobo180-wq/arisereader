// Arise LifeHub · Sleep: the sound machine. Every sound is made right here in the browser with
// the Web Audio API, so there's nothing to download and nothing that runs out: noise colors,
// rain, waves, a stream, wind, crickets, a fire, a fan, a heartbeat and a soft hum. Sounds can
// be layered, each at its own level, and a sleep timer fades everything out slowly on the
// audio clock itself, so it still fades if the page's timers are slowed down.
//
// Recorded-style sounds (rain drops, bubbles, crackles, crickets, the heartbeat) are drawn into
// short buffers whose ends are crossfaded into their beginnings, so they loop with no click.
// Moving sounds (waves, wind, the fan, the hum, thunder) are built from live filters and slow
// oscillators instead, so they never repeat exactly.

import type { SoundId } from "@shared/sleepApp";

type Built = { out: GainNode; stop: () => void };

/** How loud each sound is at full level, relative to the others, so a mix is easy to balance. */
/** Balanced by measuring each sound's loudness (RMS) in an offline render, then leaving the deep
 *  sounds (brown, fan, ocean) a little louder, since low sounds seem quieter at low volume. */
export const BASE_LEVEL: Record<SoundId, number> = {
  brown: 1, pink: 0.72, white: 0.4, rain: 1.2, thunder: 1.35, ocean: 1.05, stream: 1.15, wind: 1.6, crickets: 0.3, fire: 0.95, fan: 0.85, heartbeat: 1, drone: 0.25,
};

const TARGET_RMS = 0.2;

// ── Drawing buffers ──────────────────────────────────────────────────────────

/** A buffer that loops seamlessly: it's drawn a little long, and the extra tail is crossfaded
 *  (equal power) into the start, so the last sample flows straight into the first. */
export function loopBuffer(ctx: BaseAudioContext, secs: number, channels: number, draw: (out: Float32Array, sr: number, ch: number) => void, fadeSecs = 0.6, rms = TARGET_RMS): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(secs * sr), f = Math.min(Math.floor(fadeSecs * sr), n);
  const buf = ctx.createBuffer(channels, n, sr);
  for (let ch = 0; ch < channels; ch++) {
    const tmp = new Float32Array(n + f);
    draw(tmp, sr, ch);
    const out = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      if (i < f) { const t = i / f; out[i] = tmp[i] * Math.sqrt(t) + tmp[n + i] * Math.sqrt(1 - t); }
      else out[i] = tmp[i];
    }
    normalize(out, rms);
  }
  return buf;
}

/** Scales a channel to a target loudness (RMS), never letting a peak reach full scale. */
function normalize(data: Float32Array, rms: number) {
  let sum = 0, peak = 0;
  for (let i = 0; i < data.length; i++) { const v = data[i]; if (!Number.isFinite(v)) data[i] = 0; sum += data[i] * data[i]; peak = Math.max(peak, Math.abs(data[i])); }
  const now = Math.sqrt(sum / Math.max(1, data.length));
  if (!now) return;
  const k = Math.min(rms / now, 0.95 / Math.max(peak, 1e-9));
  for (let i = 0; i < data.length; i++) data[i] *= k;
}

const white = (out: Float32Array) => { for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1; };

/** Pink noise (equal energy per octave), Paul Kellet's filter. */
function pink(out: Float32Array) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
}

/** Brown noise (deep, like a waterfall far away): white noise, gently integrated, with the
 *  slow drift taken out so it stays centered. */
function brown(out: Float32Array) {
  let last = 0, prevX = 0, y = 0;
  for (let i = 0; i < out.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    const x = last * 3.5;
    y = x - prevX + 0.9995 * y; // removes the drift (a gentle high-pass)
    prevX = x;
    out[i] = y;
  }
}

/** A one-pole low-pass, in place: keeps the low rumble of a signal. */
function lowpass(data: Float32Array, sr: number, hz: number) {
  const a = Math.exp(-2 * Math.PI * hz / sr);
  let y = 0;
  for (let i = 0; i < data.length; i++) { y = (1 - a) * data[i] + a * y; data[i] = y; }
}

/** Rain drops: many tiny clicks of noise, mostly soft, a few closer and louder. */
function drops(out: Float32Array, sr: number) {
  const perSecond = 85;
  const count = Math.floor((out.length / sr) * perSecond);
  for (let k = 0; k < count; k++) {
    const at = Math.floor(Math.random() * out.length);
    const amp = 0.1 + 0.9 * Math.random() ** 3;
    const len = Math.floor(sr * (0.002 + Math.random() * 0.005));
    for (let j = 0; j < len && at + j < out.length; j++) out[at + j] += amp * (Math.random() * 2 - 1) * Math.exp(-j / (len / 4));
  }
  for (let i = out.length - 1; i > 0; i--) out[i] = (out[i] - out[i - 1]) * 0.5; // crisper
}

/** A brook: hundreds of tiny bubbles a second, each a short tone that rises as it pops. */
function bubbles(out: Float32Array, sr: number, ch: number) {
  const perSecond = 110;
  const count = Math.floor((out.length / sr) * perSecond);
  for (let k = 0; k < count; k++) {
    const at = Math.floor(Math.random() * out.length);
    const f0 = 400 * Math.pow(4, Math.random()); // 400 Hz to 1.6 kHz
    const dur = 0.004 + Math.random() * 0.02;
    const len = Math.floor(sr * dur);
    const amp = (0.2 + 0.8 * Math.random() ** 2) * (ch ? 0.9 + Math.random() * 0.2 : 1);
    let phase = 0;
    for (let j = 0; j < len && at + j < out.length; j++) {
      const t = j / len;
      phase += (2 * Math.PI * f0 * (1 + 0.6 * t)) / sr;
      const env = Math.min(1, j / (sr * 0.001)) * Math.exp(-4 * t);
      out[at + j] += amp * env * Math.sin(phase);
    }
  }
}

/** Crickets far off: three of them, each chirping in short bursts at its own pitch and pace. */
function crickets(out: Float32Array, sr: number, ch: number) {
  const voices = [{ hz: 4400, every: 1.05, pan: 0.3 }, { hz: 4750, every: 1.32, pan: 0.85 }, { hz: 4150, every: 0.9, pan: 0.55 }];
  for (const v of voices) {
    const gain = ch === 0 ? 1 - v.pan * 0.6 : 0.4 + v.pan * 0.6;
    let t = Math.random() * v.every;
    while (t < out.length / sr) {
      for (let p = 0; p < 3; p++) {
        const start = Math.floor((t + p * 0.045) * sr), len = Math.floor(0.02 * sr);
        for (let j = 0; j < len && start + j < out.length; j++) {
          const env = Math.sin((Math.PI * j) / len) ** 2;
          out[start + j] += gain * 0.5 * env * Math.sin((2 * Math.PI * v.hz * j) / sr);
        }
      }
      t += v.every * (0.85 + Math.random() * 0.3);
    }
  }
}

/** A fire: a low, flickering roar with crackles and the odd pop. */
function fire(out: Float32Array, sr: number) {
  brown(out);
  lowpass(out, sr, 260);
  // Slow flicker in the roar.
  let flick = 0;
  for (let i = 0; i < out.length; i++) {
    if (i % 256 === 0) flick += (Math.random() - 0.5) * 0.08;
    flick *= 0.999;
    out[i] *= 0.8 + Math.max(-0.3, Math.min(0.3, flick));
  }
  // Crackles: mostly small, a few bigger pops.
  const count = Math.floor((out.length / sr) * 7);
  const crackle = new Float32Array(out.length);
  for (let k = 0; k < count; k++) {
    const burst = Math.random() < 0.25 ? 3 + Math.floor(Math.random() * 5) : 1;
    let at = Math.floor(Math.random() * out.length);
    for (let b = 0; b < burst; b++) {
      const amp = (0.15 + 0.85 * Math.random() ** 4) * (b ? 0.6 : 1);
      const len = Math.floor(sr * (0.0008 + Math.random() * 0.004));
      for (let j = 0; j < len && at + j < out.length; j++) crackle[at + j] += amp * (Math.random() * 2 - 1) * Math.exp(-j / (len / 3));
      at += Math.floor(sr * (0.01 + Math.random() * 0.05));
    }
  }
  for (let i = out.length - 1; i > 0; i--) crackle[i] = crackle[i] - crackle[i - 1];
  // Mixed after the roar is normalized by loopBuffer, so set the crackles' share here.
  let rr = 0; for (let i = 0; i < out.length; i++) rr += out[i] * out[i];
  const roar = Math.sqrt(rr / out.length) || 1;
  for (let i = 0; i < out.length; i++) out[i] = out[i] / roar * 0.6 + crackle[i] * 0.9;
}

/** A calm heartbeat at 60 beats a minute: a soft "lub", then a softer "dub". */
function heartbeat(out: Float32Array, sr: number) {
  const beat = (at: number, hz: number, secs: number, amp: number) => {
    const start = Math.floor(at * sr), len = Math.floor(secs * sr);
    let phase = 0;
    for (let j = 0; j < len && start + j < out.length; j++) {
      const t = j / len;
      phase += (2 * Math.PI * hz * (1 - 0.3 * t)) / sr;
      const env = Math.min(1, j / (sr * 0.012)) * Math.exp(-5 * t);
      out[start + j] += amp * env * Math.sin(phase);
    }
  };
  const secs = out.length / sr;
  for (let t = 0; t < secs; t += 1) { beat(t, 52, 0.16, 1); beat(t + 0.3, 64, 0.12, 0.6); }
}

// ── Building each sound ──────────────────────────────────────────────────────

/** Drawn buffers are kept per audio context, so turning a sound off and on is instant. */
const cache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
function buffer(ctx: BaseAudioContext, key: string, make: () => AudioBuffer): AudioBuffer {
  let m = cache.get(ctx);
  if (!m) { m = new Map(); cache.set(ctx, m); }
  let b = m.get(key);
  if (!b) { b = make(); m.set(key, b); }
  return b;
}
const noiseBuffer = (ctx: BaseAudioContext, kind: "white" | "pink" | "brown") =>
  buffer(ctx, kind, () => loopBuffer(ctx, 9, 2, kind === "white" ? white : kind === "pink" ? pink : brown));

function loopSource(ctx: BaseAudioContext, buf: AudioBuffer, offset = Math.random() * buf.duration) {
  const s = ctx.createBufferSource();
  s.buffer = buf; s.loop = true;
  s.start(0, offset);
  return s;
}
function filter(ctx: BaseAudioContext, type: BiquadFilterType, hz: number, q = 0.7, gainDb = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = hz; f.Q.value = q; f.gain.value = gainDb;
  return f;
}
function gain(ctx: BaseAudioContext, v: number) { const g = ctx.createGain(); g.gain.value = v; return g; }
/** A slow oscillator that moves an AudioParam up and down around its set value. Each one starts
 *  a moment apart, so two layers never swell in lockstep. */
function lfo(ctx: BaseAudioContext, hz: number, depth: number, param: AudioParam) {
  const o = ctx.createOscillator(), d = gain(ctx, depth);
  o.frequency.value = hz;
  o.connect(d).connect(param);
  o.start(ctx.currentTime + Math.random() * 3);
  return o;
}
function panner(ctx: BaseAudioContext, pan: number): AudioNode {
  if (typeof (ctx as AudioContext).createStereoPanner === "function") { const p = ctx.createStereoPanner(); p.pan.value = pan; return p; }
  return gain(ctx, 1);
}

export function buildSound(ctx: BaseAudioContext, id: SoundId): Built {
  const out = gain(ctx, BASE_LEVEL[id]);
  const stops: (() => void)[] = [];
  const src = (node: AudioScheduledSourceNode) => { stops.push(() => { try { node.stop(); } catch { /* already stopped */ } node.disconnect(); }); return node; };
  const done = (): Built => ({ out, stop: () => { stops.forEach((s) => s()); out.disconnect(); } });

  switch (id) {
    case "white": case "pink": case "brown": {
      const s = src(loopSource(ctx, noiseBuffer(ctx, id)));
      s.connect(id === "brown" ? filter(ctx, "highpass", 25) : gain(ctx, 1)).connect(out);
      return done();
    }
    case "rain": {
      const hiss = src(loopSource(ctx, noiseBuffer(ctx, "pink")));
      hiss.connect(filter(ctx, "highpass", 500)).connect(filter(ctx, "lowpass", 7000)).connect(gain(ctx, 0.75)).connect(out);
      const dropBuf = buffer(ctx, "drops", () => loopBuffer(ctx, 9, 2, drops, 0.2));
      const d = src(loopSource(ctx, dropBuf));
      d.connect(filter(ctx, "highpass", 1200)).connect(gain(ctx, 0.45)).connect(out);
      return done();
    }
    case "thunder": {
      // Low rumbles at random moments, about every half minute, each rolling in and fading away.
      const rumble = src(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const env = gain(ctx, 0);
      rumble.connect(filter(ctx, "lowpass", 140, 0.5)).connect(filter(ctx, "lowpass", 220, 0.5)).connect(env).connect(out);
      env.gain.setValueAtTime(0.0001, ctx.currentTime);
      // Rumbles are scheduled on the audio clock, a minute ahead, so they keep coming even when
      // the page's timers are slowed down; the timer below only tops the schedule up.
      let timer: ReturnType<typeof setTimeout> | null = null, nextAt = ctx.currentTime + 3, first = true;
      const schedule = () => {
        while (nextAt < ctx.currentTime + 60) {
          const at = nextAt, peak = 0.45 + Math.random() * 0.55, rise = 0.8 + Math.random() * 1.6, fall = 4 + Math.random() * 5;
          env.gain.setValueAtTime(0.0001, at);
          env.gain.linearRampToValueAtTime(peak, at + rise);
          env.gain.linearRampToValueAtTime(peak * 0.35, at + rise + fall * 0.35);
          env.gain.linearRampToValueAtTime(peak * 0.55, at + rise + fall * 0.45); // a second roll
          env.gain.linearRampToValueAtTime(0.0001, at + rise + fall);
          // The next one waits until this one has died away, then leaves a quiet gap.
          nextAt = at + rise + fall + (first ? 8 + Math.random() * 8 : 14 + Math.random() * 30);
          first = false;
        }
        timer = setTimeout(schedule, 20000);
      };
      schedule();
      stops.push(() => { if (timer) clearTimeout(timer); });
      return done();
    }
    case "ocean": {
      // Two wave trains, left and right, each swelling and washing back at its own pace.
      for (const [pan, hz] of [[-0.55, 0.083], [0.55, 0.112]] as const) {
        const body = src(loopSource(ctx, noiseBuffer(ctx, "brown")));
        const f = filter(ctx, "lowpass", 650, 0.6), g = gain(ctx, 0.42), p = panner(ctx, pan);
        body.connect(f).connect(g).connect(p).connect(out);
        src(lfo(ctx, hz, 0.32, g.gain));
        src(lfo(ctx, hz, 420, f.frequency));
        const foam = src(loopSource(ctx, noiseBuffer(ctx, "pink")));
        const fg = gain(ctx, 0.12);
        foam.connect(filter(ctx, "highpass", 1800)).connect(fg).connect(p);
        src(lfo(ctx, hz, 0.11, fg.gain));
      }
      return done();
    }
    case "stream": {
      const bub = src(loopSource(ctx, buffer(ctx, "bubbles", () => loopBuffer(ctx, 8, 2, bubbles, 0.3))));
      bub.connect(filter(ctx, "bandpass", 1100, 0.5)).connect(gain(ctx, 0.8)).connect(out);
      const bed = src(loopSource(ctx, noiseBuffer(ctx, "pink")));
      bed.connect(filter(ctx, "bandpass", 1500, 0.6)).connect(gain(ctx, 0.35)).connect(out);
      return done();
    }
    case "wind": {
      const air = src(loopSource(ctx, noiseBuffer(ctx, "pink")));
      const bp = filter(ctx, "bandpass", 550, 0.9), g = gain(ctx, 0.6);
      air.connect(bp).connect(g).connect(out);
      src(lfo(ctx, 0.047, 260, bp.frequency));
      src(lfo(ctx, 0.071, 0.35, g.gain));
      const whistle = src(loopSource(ctx, noiseBuffer(ctx, "white")));
      const wf = filter(ctx, "bandpass", 1300, 4), wg = gain(ctx, 0.05);
      whistle.connect(wf).connect(wg).connect(panner(ctx, 0.4)).connect(out);
      src(lfo(ctx, 0.11, 350, wf.frequency));
      src(lfo(ctx, 0.09, 0.045, wg.gain));
      return done();
    }
    case "crickets": {
      const c = src(loopSource(ctx, buffer(ctx, "crickets", () => loopBuffer(ctx, 12, 2, crickets, 0.1, 0.12))));
      c.connect(filter(ctx, "lowpass", 6000)).connect(out);
      return done();
    }
    case "fire": {
      const f = src(loopSource(ctx, buffer(ctx, "fire", () => loopBuffer(ctx, 10, 2, fire, 0.4))));
      f.connect(filter(ctx, "lowpass", 5500)).connect(out);
      return done();
    }
    case "fan": {
      const motor = src(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const g = gain(ctx, 0.85);
      motor.connect(filter(ctx, "lowpass", 1100, 0.5)).connect(filter(ctx, "peaking", 170, 1, 6)).connect(g).connect(out);
      src(lfo(ctx, 7.4, 0.025, g.gain)); // the faint pulse of the blades
      const airflow = src(loopSource(ctx, noiseBuffer(ctx, "pink")));
      airflow.connect(filter(ctx, "lowpass", 3200)).connect(gain(ctx, 0.25)).connect(out);
      return done();
    }
    case "heartbeat": {
      // Silence at both ends already meets in the middle, so no crossfade is needed.
      const h = src(loopSource(ctx, buffer(ctx, "heartbeat", () => loopBuffer(ctx, 4, 1, heartbeat, 0)), 0));
      h.connect(filter(ctx, "lowpass", 300)).connect(out);
      return done();
    }
    case "drone": {
      // A low D chord, each voice slightly detuned against a twin and slowly swelling.
      const lp = filter(ctx, "lowpass", 900, 0.5);
      lp.connect(out);
      for (const [hz, level] of [[73.42, 0.5], [110, 0.42], [146.83, 0.32], [185, 0.2], [220, 0.16]] as const) {
        const vg = gain(ctx, level * 0.6);
        vg.connect(lp);
        for (const detune of [-0.35, 0.35]) {
          const o = ctx.createOscillator();
          o.type = "sine"; o.frequency.value = hz + detune;
          o.connect(vg);
          o.start();
          src(o);
        }
        src(lfo(ctx, 0.03 + Math.random() * 0.05, level * 0.35, vg.gain));
      }
      return done();
    }
  }
}

// ── The engine: one per page ─────────────────────────────────────────────────

type Layer = { built: Built; level: GainNode; value: number };
type Listener = () => void;

/** Volume sliders feel even when the level is squared. */
const curve = (v: number) => Math.max(0, Math.min(1, v)) ** 2;

class SleepSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fade: GainNode | null = null;
  private layers = new Map<SoundId, Layer>();
  private listeners = new Set<Listener>();
  private volume = 0.8;
  private timerEnd: number | null = null;
  private timerHandle: ReturnType<typeof setTimeout> | null = null;
  private timerListeners = new Set<Listener>();
  private snapshot: { levels: Partial<Record<SoundId, number>>; timerEnd: number | null; playing: boolean } = { levels: {}, timerEnd: null, playing: false };

  /** Web Audio can play here at all. */
  get supported() { return typeof window !== "undefined" && !!(window.AudioContext || (window as any).webkitAudioContext); }

  /** The audio context, made (and woken) on the first tap. iPhones are told this is playback,
   *  so sound plays even with the ring/silent switch on silent. */
  private context(): AudioContext | null {
    if (!this.supported) return null;
    try { const s = (navigator as any).audioSession; if (s && s.type !== "playback") s.type = "playback"; } catch { /* older Safari */ }
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctx();
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 6; limiter.attack.value = 0.01; limiter.release.value = 0.4;
      this.master = gain(this.ctx, this.masterLevel());
      this.fade = gain(this.ctx, 1);
      this.fade.connect(this.master).connect(limiter).connect(this.ctx.destination);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && this.layers.size) void this.ctx?.resume(); });
    }
    if (this.ctx.state !== "running") void this.ctx.resume();
    return this.ctx;
  }

  /** Turns one sound to a level from 0 (off) to 1, fading it in or out. */
  setLevel(id: SoundId, value: number) {
    const v = Math.max(0, Math.min(1, value));
    const have = this.layers.get(id);
    if (!v) {
      if (!have || !this.ctx) return;
      const now = this.ctx.currentTime;
      have.level.gain.cancelScheduledValues(now);
      have.level.gain.setValueAtTime(have.level.gain.value, now);
      have.level.gain.linearRampToValueAtTime(0.0001, now + 1.2);
      this.layers.delete(id);
      setTimeout(() => { have.built.stop(); have.level.disconnect(); }, 1400);
      this.emit();
      return;
    }
    const ctx = this.context();
    if (!ctx || !this.fade) return;
    if (!this.layers.size) this.resetFade();
    if (have) {
      have.value = v;
      have.level.gain.cancelScheduledValues(ctx.currentTime);
      have.level.gain.setTargetAtTime(curve(v), ctx.currentTime, 0.15);
    } else {
      const built = buildSound(ctx, id);
      const level = gain(ctx, 0.0001);
      built.out.connect(level).connect(this.fade);
      level.gain.setValueAtTime(0.0001, ctx.currentTime);
      level.gain.linearRampToValueAtTime(curve(v), ctx.currentTime + 2);
      this.layers.set(id, { built, level, value: v });
    }
    this.emit();
  }

  /** Plays a whole mix at once (sounds not in it are turned off). */
  setMix(mix: Partial<Record<SoundId, number>>) {
    for (const id of [...this.layers.keys()]) if (!mix[id]) this.setLevel(id, 0);
    for (const [id, v] of Object.entries(mix) as [SoundId, number][]) if (v > 0) this.setLevel(id, v);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.1);
  }

  /** While something is being read aloud, the sounds sit a little lower so the voice is clear. */
  setDucked(on: boolean) {
    this.ducked = on;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.5);
  }
  private ducked = false;
  private masterLevel() { return curve(this.volume) * (this.ducked ? 0.55 : 1); }

  /** Fades every sound out over a couple of seconds. The sleep timer keeps running: a story or a
   *  counting game may still be using it. */
  stopAll() { for (const id of [...this.layers.keys()]) this.setLevel(id, 0); }

  levels(): Partial<Record<SoundId, number>> { return Object.fromEntries([...this.layers].map(([id, l]) => [id, l.value])); }
  get playing() { return this.layers.size > 0; }

  // ── Sleep timer ──
  /** Ends in `minutes`: sound fades out over the last few minutes, then stops. 0 clears it. */
  startTimer(minutes: number) {
    this.clearTimer(false);
    if (!minutes) { this.emit(); return; }
    const secs = minutes * 60;
    this.timerEnd = Date.now() + secs * 1000;
    const ctx = this.context();
    if (ctx && this.fade) {
      const fadeSecs = Math.min(180, secs * 0.25), now = ctx.currentTime;
      this.fade.gain.cancelScheduledValues(now);
      this.fade.gain.setValueAtTime(this.fade.gain.value, now);
      this.fade.gain.setValueAtTime(1, now + Math.max(0.1, secs - fadeSecs));
      this.fade.gain.linearRampToValueAtTime(0.0001, now + secs);
    }
    this.timerHandle = setTimeout(() => this.timerDone(), secs * 1000);
    this.emit();
  }
  clearTimer(emit = true) {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.timerHandle = null; this.timerEnd = null;
    this.resetFade();
    if (emit) this.emit();
  }
  get timerEndsAt() { return this.timerEnd; }
  private timerDone() {
    this.timerHandle = null; this.timerEnd = null;
    for (const [id, l] of [...this.layers]) { l.built.stop(); l.level.disconnect(); this.layers.delete(id); }
    this.resetFade();
    this.timerListeners.forEach((fn) => fn());
    this.emit();
  }
  /** Something else (the reader) wants to know when the timer runs out. */
  onTimerEnd(fn: Listener) { this.timerListeners.add(fn); return () => { this.timerListeners.delete(fn); }; }
  private resetFade() {
    if (!this.ctx || !this.fade) return;
    const now = this.ctx.currentTime;
    this.fade.gain.cancelScheduledValues(now);
    this.fade.gain.setValueAtTime(1, now);
  }

  // ── Soft cues for breathing ──
  /** A quiet tone: rising for a breath in, falling for a breath out, a bell for the end. */
  chime(kind: "in" | "out" | "hold" | "end") {
    const ctx = this.context();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const tone = (from: number, to: number, secs: number, peak: number, at = now) => {
      const o = ctx.createOscillator(), g = gain(ctx, 0.0001);
      o.type = "sine";
      o.frequency.setValueAtTime(from, at); o.frequency.exponentialRampToValueAtTime(to, at + secs);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, at + secs);
      o.connect(g).connect(this.master!);
      o.start(at); o.stop(at + secs + 0.05);
    };
    if (kind === "in") tone(262, 330, 1.2, 0.05);
    else if (kind === "out") tone(330, 247, 1.6, 0.05);
    else if (kind === "hold") tone(294, 294, 0.6, 0.025);
    else { tone(528, 528, 4, 0.08); tone(792, 792, 3, 0.03); }
  }

  // ── For React ──
  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snapshot;
  private emit() {
    this.snapshot = { levels: this.levels(), timerEnd: this.timerEnd, playing: this.layers.size > 0 };
    this.listeners.forEach((fn) => fn());
  }
}

export const sleepSounds = new SleepSoundEngine();
