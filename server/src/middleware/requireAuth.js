const User = require("../models/User");
const { verifyAccessToken, deviceHash } = require("../tokens");
const { revokeForTheft } = require("../security");

const fail = (res, code, message) => res.status(401).json({ ok: false, code, message });

// Put this before any endpoint that needs a logged-in player.
// Needs two headers:
//   Authorization: Bearer <accessToken>
//   X-Device-Id:   <deviceId>        (the same device that logged in)
module.exports = async function requireAuth(req, res, next) {
  const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!m) return fail(res, "NO_TOKEN", "missing access token");

  let payload;
  try {
    payload = verifyAccessToken(m[1]);
  } catch (e) {
    if (e.name === "TokenExpiredError")
      return fail(res, "TOKEN_EXPIRED", "access token expired, call /refresh");
    return fail(res, "TOKEN_INVALID", "invalid access token");
  }

  const deviceId = String(req.headers["x-device-id"] || "");
  if (!deviceId) return fail(res, "NO_DEVICE", "missing X-Device-Id header");

  try {
    // Valid token used from ANOTHER device = stolen token -> end the session.
    if (payload.dh !== deviceHash(deviceId)) {
      await revokeForTheft({ _id: payload.sub, "session.sid": payload.sid }, "ACCESS_TOKEN_OTHER_DEVICE", req);
      return fail(res, "DEVICE_MISMATCH", "token used from another device, session ended");
    }

    // The token must belong to the CURRENT session (kicked / logged-out sessions are rejected).
    const user = await User.findOne({ _id: payload.sub, "session.sid": payload.sid });
    if (!user) return fail(res, "SESSION_ENDED", "session ended, please log in again");
    req.user = user;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, code: "SERVER_ERROR", message: "server error" });
  }
};
