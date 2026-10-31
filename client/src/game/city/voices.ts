// People talking out loud in AI voices (lib/aiVoice.ts), a voice per person,
// plus the speech bubbles that show what they said.
import * as THREE from "three";
import { preloadAiVoice, type AiVoiceName } from "@/lib/aiVoice";

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

const CITY_VOICES: AiVoiceName[] = ["hannah", "austin", "diana", "daniel", "autumn", "troy"];

export class Voices {
  muted = false;
  private unlocked = false;
  private audio: HTMLAudioElement | null = null;
  private speaking = false;
  private url = "";
  private turn = 0;

  /** Call from a tap or key press: browsers only allow sound after the reader has interacted. */
  unlock() {
    this.unlocked = true;
    if (!this.audio && typeof Audio !== "undefined") { this.audio = new Audio(); this.audio.setAttribute("playsinline", ""); }
  }

  get busy() { return this.speaking; }

  /**
   * Says a line in the AI voice of person `seed` (lib/aiVoice.ts; never the robot voice). `volume`
   * fades with distance. Background chatter waits its turn; `important` lines (staff talking to you) cut in.
   */
  say(text: string, seed: number, volume = 1, important = false) {
    if (this.muted || !this.unlocked || !this.audio || volume < 0.05) return false;
    if (this.speaking && !important) return false;
    const turn = ++this.turn;
    const a = this.audio;
    a.pause();
    this.speaking = true;
    const voice = CITY_VOICES[Math.abs(seed) % CITY_VOICES.length];
    preloadAiVoice(text, voice).then((blob) => {
      if (turn !== this.turn) return;
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = URL.createObjectURL(blob);
      a.src = this.url;
      a.volume = Math.max(0, Math.min(1, volume));
      a.playbackRate = 0.95 + ((seed * 13) % 12) / 100;
      a.onended = () => { if (turn === this.turn) this.speaking = false; };
      a.onerror = a.onended as any;
      return a.play();
    }).catch(() => { if (turn === this.turn) this.speaking = false; });
    return true;
  }

  stop() { this.turn++; this.speaking = false; this.audio?.pause(); }
}
