// Merging two devices' changes, the way Google Docs or Notes do it, so nobody is ever asked "which copy?".
// A three-way merge: `base` is the copy both devices started from, `mine` has this device's changes and
// `theirs` the other device's. Whatever only one side changed is kept from that side. When both changed
// the same thing:
//   - objects merge key by key, all the way down;
//   - lists of things with an `id` merge item by item (an item added on either device is kept, one deleted
//     on either device is gone unless the other device edited it, and each item merges by itself);
//   - anything else (a title, a number, a plain list) takes this device's value, the newest edit.
// Pure and deterministic, shared by every app's saving and the tests.

type J = unknown;
const isObj = (v: J): v is Record<string, J> => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: J, b: J) => a === b || JSON.stringify(a) === JSON.stringify(b);
const idOf = (v: J): string | null => (isObj(v) && (typeof v.id === "string" || typeof v.id === "number") ? String(v.id) : null);
const keyed = (a: J): a is Record<string, J>[] => Array.isArray(a) && a.length > 0 && a.every((x) => idOf(x) != null);

function mergeLists(base: J[], mine: J[], theirs: J[]): J[] {
  const b = new Map(base.map((x) => [idOf(x)!, x])), m = new Map(mine.map((x) => [idOf(x)!, x])), t = new Map(theirs.map((x) => [idOf(x)!, x]));
  const out: J[] = [];
  const seen = new Set<string>();
  const take = (id: string) => {
    if (seen.has(id)) return; seen.add(id);
    const inB = b.has(id), inM = m.has(id), inT = t.has(id);
    if (inM && inT) { out.push(merge3(inB ? b.get(id) : undefined, m.get(id), t.get(id))); return; }
    if (inM && !inT) { if (!inB || !same(b.get(id), m.get(id))) out.push(m.get(id)); return; } // new here, or deleted there but edited here
    if (inT && !inM) { if (!inB || !same(b.get(id), t.get(id))) out.push(t.get(id)); return; }
  };
  // This device's order first (what the person is looking at), then anything only the other device has, in its place.
  for (const x of mine) take(idOf(x)!);
  theirs.forEach((x, n) => {
    const id = idOf(x)!; if (seen.has(id)) return;
    const before = out.length; take(id);
    if (out.length > before) {
      // Put it after the item it followed on the other device, when that item is here.
      const prev = n > 0 ? idOf(theirs[n - 1]) : null;
      const at = prev ? out.findIndex((y) => idOf(y) === prev) : -1;
      if (at >= 0 && at < out.length - 2) out.splice(at + 1, 0, out.pop()!);
    }
  });
  return out;
}

export function merge3<T>(base: T | undefined, mine: T, theirs: T): T {
  if (same(mine, theirs)) return mine;
  if (base !== undefined && same(base, mine)) return theirs;
  if (base !== undefined && same(base, theirs)) return mine;
  if (isObj(mine) && isObj(theirs)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, J> = {};
    for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      const inM = k in mine, inT = k in theirs, inB = k in b;
      if (inM && inT) out[k] = merge3(inB ? b[k] : undefined, mine[k], theirs[k]);
      else if (inM) { if (!inB || !same(b[k], mine[k])) out[k] = mine[k]; } // removed there and untouched here: removed
      else if (!inB || !same(b[k], theirs[k])) out[k] = theirs[k];
    }
    return out as T;
  }
  if (Array.isArray(mine) && Array.isArray(theirs) && (keyed(mine) || keyed(theirs)) && mine.every((x) => idOf(x) != null) && theirs.every((x) => idOf(x) != null)) {
    const b = Array.isArray(base) && base.every((x) => idOf(x) != null) ? base : [];
    return mergeLists(b, mine, theirs) as T;
  }
  // A plain list of words or numbers that both changed: keep everything from both, this device's order first.
  // Any other list both changed (words, numbers, dated entries like weigh-ins): keep everything from both,
  // minus what one device removed, this device's order first.
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const k = (x: J) => (typeof x === "string" || typeof x === "number" ? `${typeof x}:${x}` : JSON.stringify(x));
    const b = new Set(Array.isArray(base) ? (base as J[]).map(k) : []);
    const t = new Set(theirs.map(k)), m = new Set(mine.map(k));
    const keep = mine.filter((x) => t.has(k(x)) || !b.has(k(x)));
    for (const x of theirs) if (!m.has(k(x)) && !b.has(k(x))) keep.push(x);
    return keep as T;
  }
  return mine;
}
