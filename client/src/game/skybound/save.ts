// Skybound Sprint — progress lives on the server (your account); the browser keeps a copy for offline play.
import { applyClear, sanitizeSave, type ClearReport, type SkySave } from "@shared/skybound/progress";

const localKey = (uid: string | number) => "skybound-save-" + uid;
export const SETTINGS_KEY = "skybound-settings";
export type SkySettings = { quality: "low" | "medium" | "high"; music: number; sfx: number };

export function loadSettings(): SkySettings {
  const phone = Math.min(window.innerWidth, window.innerHeight) < 600 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const def: SkySettings = { quality: phone ? "medium" : "high", music: 0.5, sfx: 0.8 };
  try { const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null"); if (raw && typeof raw === "object") return { ...def, ...raw }; } catch { /* use defaults */ }
  return def;
}
export function saveSettings(s: SkySettings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

function readLocal(uid: string | number) { try { return sanitizeSave(JSON.parse(localStorage.getItem(localKey(uid)) || "null")); } catch { return sanitizeSave(null); } }
function writeLocal(uid: string | number, s: SkySave) { try { localStorage.setItem(localKey(uid), JSON.stringify(s)); } catch { /* ignore */ } }

export class SkyProgress {
  mode: "server" | "local" = "local";
  constructor(private apiBase: string, private token: string, private uid: string | number, public save: SkySave) { }

  static async load(apiBase: string, token: string, uid: string | number) {
    const p = new SkyProgress(apiBase, token, uid, readLocal(uid));
    try {
      const r = await fetch(apiBase + "/api/skybound/progress", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      if (r.ok) { const d = await r.json(); p.save = sanitizeSave(d.save); p.mode = "server"; writeLocal(uid, p.save); }
    } catch { /* offline: keep the local copy */ }
    return p;
  }

  async clear(report: ClearReport): Promise<{ coins: number; firstClear: boolean; newShards: number; newBest: boolean; error?: string }> {
    if (this.mode === "server") {
      try {
        const r = await fetch(this.apiBase + "/api/skybound/clear", { method: "POST", headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" }, body: JSON.stringify(report) });
        const d = await r.json().catch(() => ({}));
        if (r.ok) { this.save = sanitizeSave(d.save); writeLocal(this.uid, this.save); return d; }
        if (r.status < 500) {
          const out = applyClear(this.save, report); this.save = out.save; writeLocal(this.uid, this.save);
          return { ...out, coins: 0, error: d.message || "Your run was not saved." };
        }
      } catch { /* fall back to local */ }
    }
    const out = applyClear(this.save, report); this.save = out.save; writeLocal(this.uid, this.save);
    return { ...out, coins: 0, error: this.mode === "server" ? "Couldn't reach the server — progress saved on this device." : undefined };
  }
}
