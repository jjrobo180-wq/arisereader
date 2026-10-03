// The corner minimap: roads, places, your position and other readers.
import { BOUNDS, CINEMA, CITY, CONNECTOR, DEALER, LOTS, PETSHOP, ROAD_HALF, ROAD_LINES, TRACK, TOWERS } from "@shared/city/layout";

export type MapDot = { x: number; z: number; color: string; size?: number };

export class Minimap {
  private base: HTMLCanvasElement;
  readonly size: number;
  constructor(size = 180) {
    this.size = size;
    this.base = document.createElement("canvas");
    this.base.width = this.base.height = size * 2;
    this.drawBase();
  }

  /** World → map pixels for the base canvas (the whole map fits; z down). */
  private worldToMap(x: number, z: number, s = this.size * 2) {
    const w = BOUNDS.maxX - BOUNDS.minX, h = BOUNDS.maxZ - BOUNDS.minZ, scale = s / Math.max(w, h);
    const ox = (s - w * scale) / 2, oz = (s - h * scale) / 2;
    return [ox + (x - BOUNDS.minX) * scale, oz + (z - BOUNDS.minZ) * scale, scale] as const;
  }

  private drawBase() {
    const g = this.base.getContext("2d")!, s = this.size * 2;
    g.fillStyle = "#1d3a2a"; g.fillRect(0, 0, s, s);
    const rect = (x0: number, z0: number, x1: number, z1: number, color: string) => {
      const [a, b] = this.worldToMap(x0, z0), [c, d] = this.worldToMap(x1, z1);
      g.fillStyle = color; g.fillRect(a, b, c - a, d - b);
    };
    rect(-CITY, -CITY, CITY, CITY, "#3a3f4c");
    for (const t of TOWERS) rect(t.minX, t.minZ, t.maxX, t.maxZ, "#596075");
    for (const r of ROAD_LINES) { rect(r - ROAD_HALF, -CITY, r + ROAD_HALF, CITY, "#c9ccd6"); rect(-CITY, r - ROAD_HALF, CITY, r + ROAD_HALF, "#c9ccd6"); }
    rect(CONNECTOR.x - ROAD_HALF, 120, CONNECTOR.x + ROAD_HALF, CONNECTOR.toZ, "#c9ccd6");
    rect(-114, 46, 114, 114, "#356b3c");
    for (const l of LOTS) rect(l.x - 5, l.z - 5, l.x + 5, l.z + 5, "#e2b07a");
    const b = (box: { minX: number; maxX: number; minZ: number; maxZ: number }, color: string) => rect(box.minX, box.minZ, box.maxX, box.maxZ, color);
    b(CINEMA.building, "#e04a6a"); b(DEALER.building, "#3ee6ff"); b(PETSHOP.building, "#ff9a3d"); b(PETSHOP.park, "#4f9a4a");
    rect(-12, -12, 12, 12, "#8a7fb0");
    // speedway
    const [cx, cz, sc] = this.worldToMap(TRACK.cx, TRACK.cz);
    g.strokeStyle = "#d9dbe3"; g.lineWidth = TRACK.width * 2 * sc;
    g.beginPath();
    g.moveTo(cx - TRACK.half * sc, cz - TRACK.radius * sc); g.lineTo(cx + TRACK.half * sc, cz - TRACK.radius * sc);
    g.arc(cx + TRACK.half * sc, cz, TRACK.radius * sc, -Math.PI / 2, Math.PI / 2);
    g.lineTo(cx - TRACK.half * sc, cz + TRACK.radius * sc);
    g.arc(cx - TRACK.half * sc, cz, TRACK.radius * sc, Math.PI / 2, Math.PI * 1.5);
    g.stroke();
  }

  /** Draws a zoomed, north-up view centred on the reader. */
  draw(ctx: CanvasRenderingContext2D, me: { x: number; z: number; heading: number }, dots: MapDot[], zoom = 2.6) {
    const s = this.size;
    const [mx, mz, scale] = this.worldToMap(me.x, me.z);
    ctx.save();
    ctx.clearRect(0, 0, s, s);
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#16261d"; ctx.fillRect(0, 0, s, s);
    ctx.translate(s / 2, s / 2); ctx.scale(zoom / 2, zoom / 2); ctx.translate(-mx, -mz);
    ctx.drawImage(this.base, 0, 0);
    for (const d of dots) {
      const [x, z] = this.worldToMap(d.x, d.z);
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(x, z, (d.size ?? 3) * (2 / zoom) * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // me: an arrow pointing where I face
    ctx.save();
    ctx.translate(s / 2, s / 2); ctx.rotate(Math.PI - me.heading);
    ctx.fillStyle = "#facc15"; ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); ctx.stroke();
    void scale;
  }
}
