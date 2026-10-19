const User = require("../models/User");
const { verifyPlayerToken, deviceHash } = require("../tokens");

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ ok: false, code, message, ...extra });

/**
 * Used by POST /api/play, and by any future game endpoint that needs a logged-in streamer.
 * The game sends:
 *   Authorization: Bearer <token from /login>
 *   X-Device-Id:   <same deviceId used in /login>
 *
 * Example (in index.js):
 *   const requireAuth = require("./middleware/requireAuth");
 *   app.post("/api/score", requireAuth, (req, res) => { req.user ... });
 */
module.exports = async function requireAuth(req, res, next) {
  const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!m) return fail(res, 401, "NO_TOKEN", "missing token");

  let payload;
  try {
    payload = verifyPlayerToken(m[1]);
  } catch (e) {
    if (e.name === "TokenExpiredError") return fail(res, 401, "TOKEN_EXPIRED", "token expired, call /login again");
    return fail(res, 401, "TOKEN_INVALID", "invalid token");
  }

  const deviceId = String(req.headers["x-device-id"] || "");
  if (!deviceId || payload.dh !== deviceHash(deviceId))
    return fail(res, 401, "DEVICE_MISMATCH", "token used from another device");

  try {
    const user = await User.findById(payload.sub);
    if (!user) return fail(res, 401, "TOKEN_INVALID", "account not found");
    if (user.banned) return fail(res, 403, "BANNED", "this account is banned", { reason: user.banReason || "" });
    if ((user.tokenVersion || 0) !== payload.tv || user.deviceId !== deviceId)
      return fail(res, 401, "SESSION_ENDED", "please log in again");
    req.user = user;
    next();
  } catch (e) {
    console.error(e);
    fail(res, 500, "SERVER_ERROR", "server error");
  }
};
