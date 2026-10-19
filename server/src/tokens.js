const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("./config");

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const newRefreshToken = () => crypto.randomBytes(32).toString("hex");
const newSessionId = () => crypto.randomBytes(12).toString("hex");

// Short fingerprint of the device, stored inside the access token.
const deviceHash = (deviceId) => sha256("device:" + deviceId).slice(0, 32);

// ---------- Player access token (short lived, not stored in the database) ----------
// Bound to: the session (sid) + the device (dh). Useless on another device.
function signAccessToken(user, sid, deviceId) {
  return jwt.sign(
    { sub: String(user._id), game: user.gameId, name: user.username, sid, dh: deviceHash(deviceId) },
    config.jwtSecret,
    { expiresIn: config.accessTtlSec, audience: "player" }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, { audience: "player" }); // throws on expired/invalid
}

// ---------- Admin token (dashboard) ----------
function signAdminToken() {
  return jwt.sign({ role: "admin" }, config.jwtSecret, {
    expiresIn: config.adminTokenHours * 3600,
    audience: "admin",
  });
}

function verifyAdminToken(token) {
  return jwt.verify(token, config.jwtSecret, { audience: "admin" });
}

// Compare secrets without leaking timing information.
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = {
  sha256,
  newRefreshToken,
  newSessionId,
  deviceHash,
  signAccessToken,
  verifyAccessToken,
  signAdminToken,
  verifyAdminToken,
  safeEqual,
};
