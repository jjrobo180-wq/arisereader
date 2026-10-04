// Study Squad: the layout of the study hall, shared by the 3D room (client)
// and the server (which keeps readers inside the walls).
import { ROOM } from "./game";

export const LOUNGE = {
  /** The hall is 40 wide (x −20…20) and 28 deep (z −14…14). The door is in the front wall (z = 14). */
  halfW: 20,
  halfD: 14,
  /** How close to a wall a reader can walk. */
  margin: 0.9,
  tables: 8,
  /** Readers per floor before the next floor opens. */
  capacity: 30,
  floors: 3,
  presenceMs: 15_000,
  tableRadius: 1.9,
  seatRadius: 2.75,
};

export const SPAWN = { x: 0, z: 11.2, facing: Math.PI };

/** Centres of the eight study tables: two rows of four. */
export const TABLE_SPOTS: { x: number; z: number }[] = [
  { x: -13.2, z: -3.6 }, { x: -4.4, z: -3.6 }, { x: 4.4, z: -3.6 }, { x: 13.2, z: -3.6 },
  { x: -13.2, z: 5.4 }, { x: -4.4, z: 5.4 }, { x: 4.4, z: 5.4 }, { x: 13.2, z: 5.4 },
];

/** Where a chair sits, and which way someone sitting in it faces (toward the table). */
export function seatSpot(table: number, seat: number) {
  const t = TABLE_SPOTS[table] ?? TABLE_SPOTS[0];
  const a = (seat / ROOM.seats) * Math.PI * 2 + Math.PI / 6;
  const x = t.x + Math.sin(a) * LOUNGE.seatRadius, z = t.z + Math.cos(a) * LOUNGE.seatRadius;
  return { x, z, facing: Math.atan2(t.x - x, t.z - z) };
}

/** Places to walk up to in the hall. */
export const STATIONS = {
  library: { x: -17.2, z: 10.2, r: 2.6, label: "Study sets" },
  cards: { x: 17.2, z: 10.2, r: 2.6, label: "Flashcards" },
  board: { x: 0, z: -11.6, r: 3.2, label: "Weekly board" },
  door: { x: 0, z: 13.1, r: 1.3, label: "Leave" },
} as const;

export function clampToHall(x: number, z: number): [number, number] {
  const w = LOUNGE.halfW - LOUNGE.margin, d = LOUNGE.halfD - LOUNGE.margin;
  return [Math.max(-w, Math.min(w, x)), Math.max(-d, Math.min(d, z))];
}

export type LoungePerson = { userId: number; name: string; characterId: string; x: number; z: number; facing: number; table: number; seat: number };
export type LoungeTable = null | {
  code: string; table: number; phase: string; mode: string; publicTable: boolean; setTitle: string; hostName: string;
  seats: { id: number; seat: number; bot: boolean; name: string }[];
};
export type LoungeView = { floor: number; floors: { floor: number; people: number }[]; people: LoungePerson[]; tables: LoungeTable[] };
