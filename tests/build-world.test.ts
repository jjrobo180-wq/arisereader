import test from "node:test";
import assert from "node:assert/strict";
import { BLOCKS, SX, SY, SZ, World, boxHitsBlocks, decodeWorld, encodeWorld, makeWorld, raycast, spawnPoint, TEMPLATES } from "../shared/build/world";

test("every starter world saves and loads back exactly, and stays small", () => {
  for (const t of TEMPLATES) {
    const w = makeWorld(t.id, 3);
    const s = encodeWorld(w);
    assert.ok(s.length < 120_000, `${t.id} save is ${s.length} chars`);
    const back = decodeWorld(s)!;
    assert.ok(back);
    assert.deepEqual(Buffer.from(back.data), Buffer.from(w.data));
  }
  assert.equal(decodeWorld("nonsense"), null);
  assert.equal(decodeWorld("B1:AAAA"), null); // too short to be a whole world
});

test("you spawn standing on the ground, not inside it", () => {
  for (const t of TEMPLATES) {
    const w = makeWorld(t.id);
    const s = spawnPoint(w);
    assert.ok(!boxHitsBlocks(w, s.x, s.y, s.z), `${t.id} spawn is inside blocks`);
    assert.ok(boxHitsBlocks(w, s.x, s.y - 0.1, s.z) || w.get(Math.floor(s.x), Math.floor(s.y) - 1, Math.floor(s.z)) === 11, `${t.id} spawn is floating`);
  }
});

test("raycasts find the block you look at, and the face to build on", () => {
  const w = new World();
  w.set(10, 5, 10, 3);
  const hit = raycast(w, 10.5, 8.5, 10.5, 0, -1, 0)!;
  assert.deepEqual([hit.x, hit.y, hit.z, hit.ny], [10, 5, 10, 1]);
  const side = raycast(w, 5.5, 5.5, 10.5, 1, 0, 0)!;
  assert.deepEqual([side.x, side.nx], [10, -1]);
  assert.equal(raycast(w, 5.5, 5.5, 10.5, -1, 0, 0), null);
  // water doesn't stop the ray
  w.set(10, 6, 10, 11);
  assert.equal(raycast(w, 10.5, 8.5, 10.5, 0, -1, 0)!.y, 5);
  assert.equal(SX * SY * SZ, w.data.length);
  assert.ok(BLOCKS.every((b, i) => b.id === i));
});
