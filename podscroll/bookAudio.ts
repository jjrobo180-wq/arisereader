// The sound shaping for Pod+ Audiobooks, in the listener's browser (Web Audio):
//  - Voice boost: clearer voices (less rumble, a little more presence) and steadier volume.
//  - Even volume: quiet readers and loud readers come out at about the same level.
//  - Clean up background noise: rumble and hum cut below the voice, hiss cut above it, and the
//    quiet stretches between words (where only the noise is) turned down.
//  - Skip silences: a level meter, so long pauses can be sped through.
//  - A fader for the sleep timer, which works even where a page can't set the volume (iPhone).
// A page may only shape sound a site lets it read, so a shaped chapter comes through the Pod+
// server (the audio relay in server/audiobooks.ts) and the player is set to crossOrigin="anonymous".
// Once a player is routed here it stays routed (browsers allow it once per player).

type Graph = { src: MediaElementAudioSourceNode; hp: BiquadFilterNode; lp: BiquadFilterNode; hum: BiquadFilterNode; gate: GainNode; presence: BiquadFilterNode; comp: DynamicsCompressorNode; makeup: GainNode; fade: GainNode; meter: AnalyserNode; buf: Float32Array };

let ctx: AudioContext | null = null;
const graphs = new WeakMap<HTMLAudioElement, Graph>();

export const bookAudioSupported = () => typeof window !== "undefined" && !!(window.AudioContext || (window as any).webkitAudioContext);
export const isRouted = (a: HTMLAudioElement) => graphs.has(a);

/** Starts the sound engine. Call it inside a tap: browsers only let sound start from one. */
export function primeBookAudio() {
  if (!bookAudioSupported()) return;
  try {
    if (!ctx) { const AC = window.AudioContext || (window as any).webkitAudioContext; ctx = new AC({ latencyHint: "playback" }); }
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
  } catch { ctx = null; }
}

/** Routes a player through the shaping. Only once its sound engine runs and the player may be
 *  read (crossOrigin), or the player would go silent. */
export function routeBook(a: HTMLAudioElement): boolean {
  if (graphs.has(a)) return true;
  if (!ctx || ctx.state !== "running" || a.crossOrigin !== "anonymous") return false;
  try {
    const src = ctx.createMediaElementSource(a);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 20000; lp.Q.value = 0.7;
    const hum = ctx.createBiquadFilter(); hum.type = "peaking"; hum.frequency.value = 60; hum.Q.value = 8; hum.gain.value = 0;
    const gate = ctx.createGain();
    const presence = ctx.createBiquadFilter(); presence.type = "peaking"; presence.frequency.value = 2800; presence.Q.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.knee.value = 12; comp.attack.value = 0.01; comp.release.value = 0.25;
    const makeup = ctx.createGain();
    const fade = ctx.createGain();
    const meter = ctx.createAnalyser(); meter.fftSize = 1024;
    src.connect(hp); hp.connect(hum); hum.connect(lp); lp.connect(presence); presence.connect(comp); comp.connect(makeup); makeup.connect(gate); gate.connect(fade); fade.connect(ctx.destination);
    src.connect(meter);
    const g: Graph = { src, hp, lp, hum, gate, presence, comp, makeup, fade, meter, buf: new Float32Array(meter.fftSize) };
    graphs.set(a, g);
    setBookSound(a, { boost: false, even: false, clean: false });
    return true;
  } catch { return false; }
}

/** Voice boost and Even volume on or off (smoothly, so nothing clicks). */
export function setBookSound(a: HTMLAudioElement, s: { boost: boolean; even: boolean; clean?: boolean }) {
  const g = graphs.get(a); if (!g || !ctx) return;
  const t = ctx.currentTime, k = 0.15;
  g.hp.frequency.setTargetAtTime(s.clean ? 110 : s.boost ? 90 : 10, t, k);
  g.lp.frequency.setTargetAtTime(s.clean ? 7000 : 20000, t, k);
  g.hum.gain.setTargetAtTime(s.clean ? -24 : 0, t, k);
  if (!s.clean) g.gate.gain.setTargetAtTime(1, t, k);
  g.presence.gain.setTargetAtTime(s.boost ? 4 : 0, t, k);
  const squeeze = s.boost || s.even;
  g.comp.threshold.setTargetAtTime(squeeze ? (s.even ? -32 : -24) : 0, t, k);
  g.comp.ratio.setTargetAtTime(squeeze ? (s.even ? 5 : 3) : 1, t, k);
  g.makeup.gain.setTargetAtTime(squeeze ? (s.even ? 2.2 : 1.5) : 1, t, k);
}

/** How loud it is right now (0 to 1, root mean square), or -1 when the player isn't routed. */
export function levelOf(a: HTMLAudioElement): number {
  const g = graphs.get(a); if (!g) return -1;
  g.meter.getFloatTimeDomainData(g.buf as any);
  let sum = 0; for (let i = 0; i < g.buf.length; i++) sum += g.buf[i] * g.buf[i];
  return Math.sqrt(sum / g.buf.length);
}

/** The sleep timer's fade: 0 to 1. Through the shaping when routed (works everywhere), else the
 *  player's own volume (ignored on iPhone, where the sound simply stops at the end). */
export function setFade(a: HTMLAudioElement, v: number) {
  const g = graphs.get(a);
  const x = Math.max(0, Math.min(1, v));
  if (g && ctx) g.fade.gain.setTargetAtTime(x, ctx.currentTime, 0.2);
  else { try { a.volume = x; } catch { /* read-only here */ } }
}

/** Clean up background noise: between words, where only the noise is heard, the sound is turned
 *  down; it comes back up the moment the reader speaks. `open` 0 (quiet stretch) to 1 (speech). */
export function setGate(a: HTMLAudioElement, open: number) {
  const g = graphs.get(a); if (!g || !ctx) return;
  const v = 0.25 + 0.75 * Math.max(0, Math.min(1, open));
  // Opens fast (no clipped first syllable), closes slowly (no pumping).
  g.gate.gain.setTargetAtTime(v, ctx.currentTime, v > g.gate.gain.value ? 0.01 : 0.12);
}
