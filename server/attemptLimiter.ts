// Counts failed tries (wrong passwords, wrong proctor codes) so nobody can guess forever.
// Kept in memory: a restart clears it, which is fine for slowing down guessing.

export type AttemptLimiter = ReturnType<typeof createAttemptLimiter>;

export function createAttemptLimiter(opts: { max: number; windowMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const fails = new Map<string, number[]>();
  const recent = (key: string) => {
    const cutoff = now() - opts.windowMs;
    const list = (fails.get(key) || []).filter((t) => t > cutoff);
    if (list.length) fails.set(key, list);
    else fails.delete(key);
    return list;
  };
  return {
    /** Milliseconds until this key may try again (0 when it may try now). */
    retryAfter(key: string): number {
      const list = recent(key);
      return list.length >= opts.max ? Math.max(1000, list[0] + opts.windowMs - now()) : 0;
    },
    fail(key: string) {
      const list = recent(key);
      list.push(now());
      fails.set(key, list);
      // keep memory small if someone sprays many different keys
      if (fails.size > 20_000) for (const k of Array.from(fails.keys()).slice(0, 5_000)) fails.delete(k);
    },
    reset(key: string) {
      fails.delete(key);
    },
  };
}

/** "Try again in 12 minutes" style wording. */
export function waitWords(ms: number) {
  const minutes = Math.ceil(ms / 60_000);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

/** The visitor's address (the first one Render's proxy saw). */
export function clientAddress(req: { headers?: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}
