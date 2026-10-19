// Simple in-memory attempt limiter (fine for ONE server process).
// If you run several server instances later, move this to Redis or MongoDB.

function createLimiter({ max, windowMs, lockMs }) {
  const map = new Map(); // key -> { count, first, lockedUntil }

  // cleanup old keys every minute
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of map) {
      if (v.lockedUntil < now && v.first + windowMs < now) map.delete(k);
    }
  }, 60000).unref();

  return {
    /** seconds left if locked, else 0 */
    lockedFor(key) {
      const v = map.get(key);
      const now = Date.now();
      return v && v.lockedUntil > now ? Math.ceil((v.lockedUntil - now) / 1000) : 0;
    },
    /** count one failed attempt */
    fail(key) {
      const now = Date.now();
      let v = map.get(key);
      if (!v || v.first + windowMs < now) v = { count: 0, first: now, lockedUntil: 0 };
      v.count += 1;
      if (v.count >= max) {
        v.lockedUntil = now + lockMs;
        v.count = 0;
        v.first = now;
      }
      map.set(key, v);
    },
    reset(key) {
      map.delete(key);
    },
  };
}

module.exports = { createLimiter };
