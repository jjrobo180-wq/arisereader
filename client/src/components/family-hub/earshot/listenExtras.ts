// Listening extras kept on this device: the Hours back tally, and Voice boost (clearer voices, quieter
// loud parts) through the Web Audio API. Imports nothing from the Arise app (Pod+ uses it too).
import { addHoursBack, cleanHoursBack, emptyHoursBack, type HoursBack, type SavedKind } from "@shared/earshotListen";

// ---------------------------------------------------------------------------
// Hours back
// ---------------------------------------------------------------------------

const HOURS_KEY = "earshot.hoursBack";
/** Seconds of ads skipped before the weekly tally existed (kept so nobody's count starts over). */
const OLD_KEY = "earshot.adSaved";

export function readHoursBack(): HoursBack {
  try {
    const raw = localStorage.getItem(HOURS_KEY);
    if (raw) return cleanHoursBack(JSON.parse(raw));
    const old = Math.max(0, Number(localStorage.getItem(OLD_KEY)) || 0);
    const h = emptyHoursBack(); h.total.ads = old;
    return h;
  } catch { return emptyHoursBack(); }
}

/** Pending seconds, written every few seconds (speed savings arrive four times a second). */
let pending: Partial<Record<SavedKind, number>> = {};
let flushT: ReturnType<typeof setTimeout> | null = null;
function flush() {
  flushT = null;
  let h = readHoursBack();
  for (const [k, v] of Object.entries(pending) as [SavedKind, number][]) h = addHoursBack(h, k, v);
  pending = {};
  try { localStorage.setItem(HOURS_KEY, JSON.stringify(h)); } catch { /* not kept */ }
  try { window.dispatchEvent(new Event("earshot-hours")); } catch { /* no window */ }
}
export function countHoursBack(kind: SavedKind, secs: number) {
  if (!Number.isFinite(secs) || !secs) return;
  pending[kind] = (pending[kind] ?? 0) + secs;
  if (!flushT) flushT = setTimeout(flush, Math.abs(secs) > 5 ? 50 : 4000);
}
if (typeof window !== "undefined") window.addEventListener("pagehide", () => { if (flushT) { clearTimeout(flushT); flush(); } });

// ---------------------------------------------------------------------------
// Voice boost: a gentle compressor (quiet parts up, loud parts down) and a lift where voices are
// clearest, with a little low rumble taken out. Only audio that comes through our own server can be
// shaped (browsers won't let a page change sound from a site that doesn't allow it); everything else
// plays as it is.
// ---------------------------------------------------------------------------

type Chain = { src: MediaElementAudioSourceNode; low: BiquadFilterNode; presence: BiquadFilterNode; comp: DynamicsCompressorNode; gain: GainNode };
let ctx: AudioContext | null = null;
const chains = new WeakMap<HTMLAudioElement, Chain>();
let boostOn = false;

export const voiceBoostSupported = () => typeof window !== "undefined" && !!(window.AudioContext || (window as any).webkitAudioContext);
/** Whether this player's sound has been routed through the boost (its sound now always goes that way). */
export const isBoosted = (a: HTMLAudioElement) => chains.has(a);

function setChain(c: Chain, on: boolean) {
  const now = ctx!.currentTime;
  c.low.frequency.setTargetAtTime(on ? 90 : 10, now, 0.05);
  c.presence.gain.setTargetAtTime(on ? 5 : 0, now, 0.05);
  c.comp.threshold.setTargetAtTime(on ? -30 : 0, now, 0.05);
  c.comp.ratio.setTargetAtTime(on ? 3.5 : 1, now, 0.05);
  c.gain.gain.setTargetAtTime(on ? 1.5 : 1, now, 0.05);
}

/**
 * Sends this player's sound through the boost. Call it in a tap (browsers start sound only then), and only
 * for audio from our own server with crossOrigin set: once routed, a player stays routed for good.
 */
export function attachVoiceBoost(a: HTMLAudioElement): boolean {
  if (chains.has(a)) return true;
  if (!voiceBoostSupported()) return false;
  try {
    if (!ctx) { const AC = window.AudioContext || (window as any).webkitAudioContext; ctx = new AC({ latencyHint: "playback" }); }
    const src = ctx.createMediaElementSource(a);
    const low = ctx.createBiquadFilter(); low.type = "highpass"; low.Q.value = 0.7;
    const presence = ctx.createBiquadFilter(); presence.type = "peaking"; presence.frequency.value = 2800; presence.Q.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.knee.value = 12; comp.attack.value = 0.01; comp.release.value = 0.25;
    const gain = ctx.createGain();
    src.connect(low); low.connect(presence); presence.connect(comp); comp.connect(gain); gain.connect(ctx.destination);
    const c = { src, low, presence, comp, gain };
    chains.set(a, c);
    setChain(c, boostOn);
    return true;
  } catch { return false; }
}

/** Turns the boost on or off for every routed player (smoothly, so nothing clicks). */
export function setVoiceBoost(on: boolean, players: HTMLAudioElement[]) {
  boostOn = on;
  for (const a of players) { const c = chains.get(a); if (c) setChain(c, on); }
}

/** Browsers pause the sound engine when nothing has played for a while, and after a phone call. */
export function resumeVoiceBoost() { if (ctx && ctx.state !== "running") void ctx.resume().catch(() => {}); }
