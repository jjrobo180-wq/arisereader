// Aurora Racers — player progression: saved on the server (database), or in the browser if the server save isn't set up.
import { BODIES, UPGRADE_COST, MAX_UPGRADE, raceReward, cupReward, sanitizeSave, upgradesFor, type RacingSave, type UpgradeId } from "@shared/racing";
import { loadSave, writeSave, hasLocalSave } from "./save";

export class Profile {
  mode: "server" | "local" = "local";
  save: RacingSave;
  private constructor(private apiBase: string, private token: string, private userId: string, save: RacingSave) { this.save = save; }

  static async load(apiBase: string, token: string, userId: string | number): Promise<Profile> {
    const local = loadSave(userId);
    const p = new Profile(apiBase, token, String(userId), local);
    try {
      const r = await p.call<{ save: RacingSave | null; exists: boolean }>("GET", "/api/racing/profile");
      if (r.exists && r.save) { p.save = sanitizeSave(r.save); }
      else {
        // first time on the server: bring over progress that was kept in this browser
        const imported = await p.call<{ save: RacingSave }>("POST", "/api/racing/import", { save: hasLocalSave(userId) ? local : null });
        p.save = sanitizeSave(imported.save);
      }
      p.mode = "server";
      writeSave(userId, p.save);
    } catch {
      p.mode = "local";
    }
    return p;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.apiBase + path, {
      method, headers: { Authorization: "Bearer " + this.token, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store",
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (res.status === 503) { this.mode = "local"; throw new Error("offline"); }
    if (!res.ok) throw new Error((data && data.message) || "Something went wrong.");
    return data as T;
  }

  private async serverOr(path: string, body: unknown, local: (s: RacingSave) => void): Promise<RacingSave> {
    if (this.mode === "server") {
      try {
        const r = await this.call<{ save: RacingSave }>("POST", path, body);
        this.save = sanitizeSave(r.save);
        writeSave(this.userId, this.save);
        return this.save;
      } catch (e) {
        if (this.mode === "server") throw e; // a real refusal (e.g. not enough coins)
      }
    }
    const next = sanitizeSave(JSON.parse(JSON.stringify(this.save)));
    local(next);
    this.save = sanitizeSave(next);
    writeSave(this.userId, this.save);
    return this.save;
  }

  buyKart(bodyId: string) {
    return this.serverOr("/api/racing/buy-kart", { body: bodyId }, (s) => {
      const b = BODIES.find((x) => x.id === bodyId);
      if (!b || s.owned.includes(b.id) || s.coins < b.price) throw new Error("Not enough coins.");
      s.coins -= b.price; s.owned.push(b.id); s.body = b.id;
    });
  }

  upgrade(bodyId: string, up: UpgradeId) {
    return this.serverOr("/api/racing/upgrade", { body: bodyId, upgrade: up }, (s) => {
      const cur = upgradesFor(s, bodyId), lvl = cur[up];
      if (lvl >= MAX_UPGRADE || s.coins < UPGRADE_COST[lvl]) throw new Error("Not enough coins.");
      s.coins -= UPGRADE_COST[lvl]; s.upgrades[bodyId] = { ...cur, [up]: lvl + 1 };
    });
  }

  customize(patch: { body?: string; paint?: number; helmet?: number; driver?: number }) {
    // optimistic so colour picking feels instant
    this.save = sanitizeSave({ ...this.save, ...patch });
    return this.serverOr("/api/racing/customize", patch, (s) => { Object.assign(s, patch); });
  }

  /** Report a finished single-player race. Returns the coins awarded. */
  async result(r: { mode: "race" | "gp" | "tt"; trackId: string; place: number; time: number; bestLap: number; coins: number; cc: number }): Promise<number> {
    let reward = raceReward(r.mode, r.place, r.coins, r.cc);
    if (this.mode === "server") {
      try {
        const res = await this.call<{ save: RacingSave; reward: number }>("POST", "/api/racing/result", r);
        this.save = sanitizeSave(res.save); writeSave(this.userId, this.save);
        return res.reward;
      } catch (e) {
        if (this.mode === "server") return 0; // refused (e.g. too soon) — no reward
      }
    }
    const s = this.save;
    s.coins += reward; s.races += 1; if (r.mode !== "tt" && r.place === 1) s.wins += 1;
    const ms = Math.round(r.time * 1000), lap = Math.round(r.bestLap * 1000);
    if (!s.bestRace[r.trackId] || ms < s.bestRace[r.trackId]) s.bestRace[r.trackId] = ms;
    if (lap > 5000 && (!s.bestLap[r.trackId] || lap < s.bestLap[r.trackId])) s.bestLap[r.trackId] = lap;
    this.save = sanitizeSave(s); writeSave(this.userId, this.save);
    return reward;
  }

  async cup(place: number, cc: number): Promise<number> {
    if (this.mode === "server") {
      try {
        const res = await this.call<{ save: RacingSave; reward: number }>("POST", "/api/racing/cup", { place, cc });
        this.save = sanitizeSave(res.save); writeSave(this.userId, this.save);
        return res.reward;
      } catch { if (this.mode === "server") return 0; }
    }
    const reward = cupReward(place);
    const s = this.save; s.coins += reward;
    const k = "aurora-" + cc; s.cups[k] = Math.min(s.cups[k] || 99, place);
    this.save = sanitizeSave(s); writeSave(this.userId, this.save);
    return reward;
  }

  /** Re-read the server copy (after online races the server awards coins directly). */
  async refresh() {
    if (this.mode !== "server") return this.save;
    try {
      const r = await this.call<{ save: RacingSave | null }>("GET", "/api/racing/profile");
      if (r.save) { this.save = sanitizeSave(r.save); writeSave(this.userId, this.save); }
    } catch { /* keep current */ }
    return this.save;
  }
}
