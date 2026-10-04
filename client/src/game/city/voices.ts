// People talking out loud: the browser's built-in speech voices, varied per
// person by voice, pitch and speed (nothing is downloaded), plus the speech
// bubbles that show what they said.
import * as THREE from "three";

/** A white speech bubble with a tail; long lines wrap onto two rows. */
export function speechBubble(text: string, accent = "#0f766e") {
  const words = text.split(" "), rows: string[] = [""];
  for (const w of words) { const cur = rows[rows.length - 1]; if ((cur + " " + w).trim().length > 26 && rows.length < 2) rows.push(w); else rows[rows.length - 1] = (cur + " " + w).trim(); }
  const W = 720, H = rows.length > 1 ? 230 : 160;
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); (c as any).roundRect(16, 14, W - 28, H - 52, 40); c.fill();
  c.fillStyle = "#ffffff"; c.beginPath(); (c as any).roundRect(10, 8, W - 28, H - 52, 40); c.fill();
  c.beginPath(); c.moveTo(W / 2 - 26, H - 46); c.lineTo(W / 2, H - 8); c.lineTo(W / 2 + 22, H - 46); c.fill();
  c.fillStyle = accent; c.fillRect(34, 20, 10, H - 76);
  c.font = "700 46px system-ui";
  const widest = Math.max(...rows.map((r) => c.measureText(r).width));
  c.fillStyle = "#111827"; c.font = `700 ${Math.floor(46 * Math.min(1, (W - 100) / widest))}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle";
  rows.forEach((r, i) => c.fillText(r, W / 2 + 8, 8 + (H - 52) / 2 + (i - (rows.length - 1) / 2) * 56));
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(3.9, (3.9 * H) / W, 1); sprite.renderOrder = 21;
  return sprite;
}

export const CHATTER = [
  "Have you tried the noodles on the plaza? So good.",
  "The fair is open late tonight!",
  "I just finished a really good book.",
  "Taxi! Over here!",
  "Hold on, the light's about to change.",
  "Yeah, I'm on my way. Five minutes!",
  "Let's grab a slice before the movie.",
  "The train is right on time today.",
  "Did you see the line at the diner?",
  "I'm going to ride the Big Wheel later.",
  "This city never sleeps.",
  "Coffee first, then the library.",
  "Excuse me, which way to the beach?",
  "Wow, look at that car!",
  "I love the arcade on the boardwalk.",
  "Two more chapters and I'm done.",
  "Have a great day!",
  "The tacos at Taco Loco are the best.",
  "Is that the express train?",
  "Okay, see you at the fountain!",
  "My dog loves this walk.",
  "I can smell the pizza from here.",
];

export const GREETINGS = ["Hi there!", "Hey!", "Nice day, huh?", "Hello!", "Morning!", "Love the outfit!", "Hey, how's it going?", "Have a good one!"];

export class Voices {
  muted = false;
  private voices: SpeechSynthesisVoice[] = [];
  private readonly ok = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  private unlocked = false;

  constructor() {
    if (!this.ok) return;
    const load = () => { this.voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
  }

  /** Call from a tap or key press: browsers only allow speech after the reader has interacted. */
  unlock() { this.unlocked = true; }

  get busy() { return this.ok && window.speechSynthesis.speaking; }

  /**
   * Says a line in the voice of person `seed`. `volume` fades with distance.
   * Background chatter waits its turn; `important` lines (staff talking to you) cut in.
   */
  say(text: string, seed: number, volume = 1, important = false) {
    if (!this.ok || this.muted || !this.unlocked || volume < 0.05) return false;
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) { if (!important) return false; synth.cancel(); }
    const u = new SpeechSynthesisUtterance(text);
    if (this.voices.length) u.voice = this.voices[Math.abs(seed) % this.voices.length];
    u.pitch = 0.75 + ((seed * 37) % 60) / 100;
    u.rate = 0.95 + ((seed * 13) % 18) / 100;
    u.volume = Math.max(0, Math.min(1, volume));
    try { synth.speak(u); } catch { return false; }
    return true;
  }

  stop() { if (this.ok) try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
}
