// Arcade car handling for A.R.I.S.E. City. Pure functions so they can be tested
// and reused for computer drivers. Heading 0 faces +z; forward = (sin h, cos h),
// matching three.js `rotation.y` for a model that faces +z.
import { resolveCircle, surfaceAt, type Box, COLLIDERS } from "./layout";

export type CarId = "car-starter" | "car-street" | "car-electric" | "car-super" | "car-suv";
export type CarStats = { id: CarId; name: string; top: number; accel: number; turn: number; grip: number; price: number; blurb: string };

/** Speeds are in units per second (about m/s). The free starter is slower than every shop car. */
export const CARS: Record<CarId, CarStats> = {
  "car-starter": { id: "car-starter", name: "City Cruiser", top: 24, accel: 9, turn: 2.0, grip: 0.9, price: 0, blurb: "Free for every reader. Easy to drive." },
  "car-street": { id: "car-street", name: "Street Bolt", top: 29, accel: 11, turn: 2.15, grip: 0.92, price: 850, blurb: "Quick off the line and nimble in town." },
  "car-suv": { id: "car-suv", name: "Summit SUV", top: 28, accel: 10, turn: 1.9, grip: 0.98, price: 1750, blurb: "Big, steady and grippy on grass." },
  "car-electric": { id: "car-electric", name: "Volt X", top: 32, accel: 15, turn: 2.25, grip: 0.94, price: 1450, blurb: "Instant electric punch." },
  "car-super": { id: "car-super", name: "Nova GT", top: 37, accel: 14, turn: 2.35, grip: 0.95, price: 2600, blurb: "The fastest car in Haven City." },
};
export const SHOP_CARS: CarId[] = ["car-street", "car-electric", "car-suv", "car-super"];

/** The car a reader drives: their equipped shop car, or the free starter. */
export const carFor = (equipped: string | null | undefined): CarId => (equipped && equipped in CARS ? (equipped as CarId) : "car-starter");

export type CarState = { x: number; z: number; heading: number; speed: number; drift: number };
export type DriveInput = { throttle: number; brake: number; steer: number; handbrake: boolean };
export const CAR_RADIUS = 1.7;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Advances a car by dt seconds. Grass slows it down (less so for the SUV);
 * hitting a wall bounces it back a little. Nothing ever gets hurt: cars just bump.
 */
export function stepCar(car: CarState, input: DriveInput, stats: CarStats, dt: number, boxes: Box[] = COLLIDERS): { car: CarState; bumped: boolean } {
  const surface = surfaceAt(car.x, car.z);
  const offRoad = surface === "grass";
  const top = stats.top * (offRoad ? 0.45 + (stats.grip - 0.9) * 2.5 : 1);
  let speed = car.speed;

  if (input.throttle > 0) {
    speed += (speed < 0 ? stats.accel * 2.2 : stats.accel * (1 - Math.max(0, speed) / (top * 1.05))) * input.throttle * dt;
  }
  if (input.brake > 0) {
    if (speed > 0.5) speed -= stats.accel * 2.6 * input.brake * dt;
    else speed -= stats.accel * 0.6 * input.brake * dt;
  }
  if (input.throttle <= 0 && input.brake <= 0) speed -= Math.sign(speed) * Math.min(Math.abs(speed), (3 + Math.abs(speed) * 0.12) * dt);
  if (offRoad && speed > top) speed -= (speed - top) * Math.min(1, dt * 2.5);
  if (input.handbrake) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 9 * dt);
  speed = clamp(speed, -8, stats.top);

  // Steering bites harder at low speed and loosens a little at top speed; the handbrake swings the tail out.
  const speedFactor = clamp(Math.abs(speed) / 7, 0, 1) * (1 - clamp(Math.abs(speed) / stats.top, 0, 1) * 0.35);
  let drift = car.drift + ((input.handbrake && Math.abs(speed) > 8 ? input.steer * 0.55 : 0) - car.drift) * Math.min(1, dt * 4);
  const turn = (input.steer * stats.turn * speedFactor * (input.handbrake ? 1.45 : 1)) * (speed >= 0 ? 1 : -1);
  const heading = car.heading + turn * dt;

  // Travel direction lags the nose while drifting.
  const travel = heading - drift * stats.grip * 0.6;
  let x = car.x + Math.sin(travel) * speed * dt;
  let z = car.z + Math.cos(travel) * speed * dt;

  const res = resolveCircle(x, z, CAR_RADIUS, boxes);
  let bumped = false;
  if (res.hit) {
    x = res.x; z = res.z;
    if (Math.abs(speed) > 3) bumped = true;
    speed *= -0.25;
    drift *= 0.3;
  }
  return { car: { x, z, heading: wrapAngle(heading), speed, drift }, bumped };
}

export function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export const WALK_SPEED = 5;
export const RUN_SPEED = 8.5;
export const WALKER_RADIUS = 0.5;

/** Moves a walker by a direction already turned to world space. */
export function stepWalker(x: number, z: number, dx: number, dz: number, run: boolean, dt: number, boxes: Box[] = COLLIDERS) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return { x, z, moving: false, facing: null as number | null };
  const v = (run ? RUN_SPEED : WALK_SPEED) * dt;
  const res = resolveCircle(x + (dx / len) * v, z + (dz / len) * v, WALKER_RADIUS, boxes);
  return { x: res.x, z: res.z, moving: true, facing: Math.atan2(dx, dz) };
}

/** Speed shown on the dashboard (the city uses "mph" so 37 u/s reads like a fast car). */
export const dashSpeed = (speed: number) => Math.round(Math.abs(speed) * 2.24);
