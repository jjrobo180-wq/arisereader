// The corner minimap: roads, places, your position and other readers.
import { BARN, BEACH_SHOPS, BIG_TOP, BOOTHS, BOUNDS, BUMPER, CINEMA, CITY, DEALER, FAIR, FARM, FERRIS, FIELD, FOOD_STANDS, GARDEN, HOUSES, LIBRARY, LOTS, MALL, NORTH_BLOCKS, PARK, PETSHOP, RAMPS, RESTAURANTS, RIDES, ROADS, ROAD_HALF, SEASIDE, SKATE, TRACK, TRAIL, TOWERS, TRAIN, WATER_TOWER } from "@shared/city/layout";

/** The full map is drawn once at B pixels per minimap pixel, then zoomed in. */
const B = 4;

export type MapDot = { x: number; z: number; color: string; size?: number };

export class Minimap {
  private base: HTMLCanvasElement;
  readonly size: number;
  constructor(size = 180) {
    this.size = size;
    this.base = document.createElement("canvas");
    this.base.width = this.base.height = size * B;
    this.drawBase();
  }

  /** World → map pixels for the base canvas (the whole map fits; z down). */
  private worldToMap(x: number, z: number, s = this.size * B) {
    const w = BOUNDS.maxX - BOUNDS.minX, h = BOUNDS.maxZ - BOUNDS.minZ, scale = s / Math.max(w, h);
    const ox = (s - w * scale) / 2, oz = (s - h * scale) / 2;
    return [ox + (x - BOUNDS.minX) * scale, oz + (z - BOUNDS.minZ) * scale, scale] as const;
  }

  private drawBase() {
    const g = this.base.getContext("2d")!, s = this.size * B;
    g.fillStyle = "#1d3a2a"; g.fillRect(0, 0, s, s);
    const rect = (x0: number, z0: number, x1: number, z1: number, color: string) => {
      const [a, b] = this.worldToMap(x0, z0), [c, d] = this.worldToMap(x1, z1);
      g.fillStyle = color; g.fillRect(a, b, c - a, d - b);
    };
    // the ocean, beach and boardwalk to the west
    const N = BOUNDS.minZ, S = BOUNDS.maxZ;
    rect(BOUNDS.minX - 400, N - 400, SEASIDE.ocean, S + 400, "#1f6fa8");
    rect(SEASIDE.ocean, N, SEASIDE.boardwalk.minX, S, "#e3c98e");
    rect(SEASIDE.boardwalk.minX, N, SEASIDE.boardwalk.maxX, S, "#b07a4a");
    rect(SEASIDE.boardwalk.maxX, N, SEASIDE.road, S, "#55596a");
    rect(SEASIDE.road, -CITY, -CITY, CITY, "#55596a");
    rect(SEASIDE.pier.minX, SEASIDE.pier.minZ, SEASIDE.boardwalk.minX, SEASIDE.pier.maxZ, "#b07a4a");
    // North Haven blocks
    for (const nb of NORTH_BLOCKS) rect(nb.x - 34, nb.z - 34, nb.x + 34, nb.z + 34, ["houses", "watertower", "field", "garden"].includes(nb.kind) ? "#356b3c" : "#3a3f4c");
    rect(-194, -194, 194, -126, "#3a3f4c");
    for (const h of HOUSES) rect(h.x - 4.5, h.z - 4.5, h.x + 4.5, h.z + 4.5, "#e2b07a");
    rect(FIELD.x - FIELD.w / 2, FIELD.z - FIELD.d / 2, FIELD.x + FIELD.w / 2, FIELD.z + FIELD.d / 2, "#4fae4f");
    rect(SKATE.x - 33, SKATE.z - 33, SKATE.x + 33, SKATE.z + 33, "#9a97a3");
    // the farm and the trail
    rect(FARM.minX, FARM.minZ, FARM.maxX, FARM.maxZ, "#6f9a45");
    for (const shop of BEACH_SHOPS) rect(shop.box.minX, shop.box.minZ, shop.box.maxX, shop.box.maxZ, "#" + shop.color.toString(16).padStart(6, "0"));
    rect(-CITY, -CITY, CITY, CITY, "#3a3f4c");
    for (const t of TOWERS) rect(t.minX, t.minZ, t.maxX, t.maxZ, "#596075");
    rect(PARK.stunt.minX, PARK.stunt.minZ, PARK.stunt.maxX, PARK.stunt.maxZ, "#2c2f3a");
    for (const ramp of RAMPS) rect(ramp.x - 3, ramp.z - 3, ramp.x + 3, ramp.z + 3, "#ffcf33");
    rect(-114, 46, 114, 114, "#356b3c");
    for (const l of LOTS) rect(l.x - 5, l.z - 5, l.x + 5, l.z + 5, "#e2b07a");
    const b = (box: { minX: number; maxX: number; minZ: number; maxZ: number }, color: string) => rect(box.minX, box.minZ, box.maxX, box.maxZ, color);
    for (const r of ROADS) rect(r.x1 - ROAD_HALF, r.z1 - ROAD_HALF, r.x2 + ROAD_HALF, r.z2 + ROAD_HALF, "#c9ccd6");
    b(LIBRARY.building, "#f4d58d"); b(MALL.building, "#a974ff"); b(BARN, "#b8322e");
    b(CINEMA.building, "#e04a6a"); b(DEALER.building, "#3ee6ff"); b(PETSHOP.building, "#ff9a3d"); b(PETSHOP.park, "#4f9a4a");
    rect(-12, -12, 12, 12, "#8a7fb0");
    const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");
    for (const r of RESTAURANTS) b(r.box, hex(r.color));
    // Haven Fairgrounds
    rect(FAIR.minX, FAIR.minZ, FAIR.maxX, FAIR.maxZ, "#5d7d3a");
    rect(FAIR.minX + 6, -264, FAIR.maxX - 6, -246, "#c8a874"); rect(FAIR.minX + 6, -159, FAIR.maxX - 6, -141, "#c8a874"); rect(422, FAIR.minZ + 8, 438, FAIR.maxZ - 8, "#c8a874");
    rect(BUMPER.x - BUMPER.w / 2, BUMPER.z - BUMPER.d / 2, BUMPER.x + BUMPER.w / 2, BUMPER.z + BUMPER.d / 2, "#fcc419");
    for (const bo of BOOTHS) rect(bo.x - 6, bo.z - 2.5, bo.x + 6, bo.z + 2.5, hex(bo.color));
    for (const f of FOOD_STANDS) rect(f.x - 2.5, f.z - 2.5, f.x + 2.5, f.z + 2.5, hex(f.color));
    // lake and loop road
    const circle = (x: number, z: number, r: number, color: string, line = 0) => {
      const [px, pz, sc] = this.worldToMap(x, z);
      g.beginPath(); g.arc(px, pz, r * sc, 0, Math.PI * 2);
      if (line) { g.strokeStyle = color; g.lineWidth = line * sc; g.stroke(); } else { g.fillStyle = color; g.fill(); }
    };
    circle(PARK.loop.x, PARK.loop.z, PARK.loop.r, "#c9ccd6", ROAD_HALF * 2);
    circle(PARK.lake.x, PARK.lake.z, PARK.lake.r, "#3a9bd8");
    circle(FERRIS.x, FERRIS.z, 5, "#ff5fd8");
    circle(GARDEN.x, GARDEN.z, GARDEN.pond, "#3a9bd8");
    circle(WATER_TOWER.x, WATER_TOWER.z, 5, "#8fd3ff");
    for (const r of RIDES) circle(r.x, r.z, r.id === "wheel" ? 7 : r.r, r.id === "wheel" ? "#ffd43b" : r.id === "carousel" ? "#e03131" : "#ff5fd8");
    circle(BIG_TOP.x, BIG_TOP.z, BIG_TOP.r, "#c92a2a");
    {
      // the Haven Loop's elevated track
      g.strokeStyle = "#a0714a"; g.lineWidth = 3 * this.worldToMap(0, 0)[2]; g.setLineDash([6 * B, 3 * B]); g.beginPath();
      TRAIN.loop.forEach(([x, z], i) => { const [px, pz] = this.worldToMap(x, z); if (i) g.lineTo(px, pz); else g.moveTo(px, pz); });
      g.closePath(); g.stroke(); g.setLineDash([]);
    }
    {
      const [tx, tz, ts] = this.worldToMap(TRAIL.cx, TRAIL.cz);
      g.strokeStyle = "#a07a4a"; g.lineWidth = TRAIL.width * 2 * ts; g.beginPath();
      g.moveTo(tx - TRAIL.half * ts, tz - TRAIL.radius * ts); g.lineTo(tx + TRAIL.half * ts, tz - TRAIL.radius * ts);
      g.arc(tx + TRAIL.half * ts, tz, TRAIL.radius * ts, -Math.PI / 2, Math.PI / 2);
      g.lineTo(tx - TRAIL.half * ts, tz + TRAIL.radius * ts);
      g.arc(tx - TRAIL.half * ts, tz, TRAIL.radius * ts, Math.PI / 2, Math.PI * 1.5);
      g.stroke();
    }
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
  draw(ctx: CanvasRenderingContext2D, me: { x: number; z: number; heading: number }, dots: MapDot[]) {
    const s = this.size;
    const [mx, mz, scale] = this.worldToMap(me.x, me.z);
    // the map always shows about 260 metres across, however big the world is
    const zoom = (s / 260) / scale * B;
    ctx.save();
    ctx.clearRect(0, 0, s, s);
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#16261d"; ctx.fillRect(0, 0, s, s);
    ctx.translate(s / 2, s / 2); ctx.scale(zoom / B, zoom / B); ctx.translate(-mx, -mz);
    ctx.drawImage(this.base, 0, 0);
    for (const d of dots) {
      const [x, z] = this.worldToMap(d.x, d.z);
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(x, z, (d.size ?? 3) * (B / zoom) * 2 * (s / 170), 0, Math.PI * 2); ctx.fill();
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
