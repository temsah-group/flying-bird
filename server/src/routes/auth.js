const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const LoginEvent = require("../models/LoginEvent");
const config = require("../config");
const { createLimiter } = require("../middleware/rateLimit");
const { validateDeviceId, deviceDecision } = require("../rules");
const { signPlayerToken } = require("../tokens");

const router = express.Router();

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ ok: false, code, message, ...extra });

const handle = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    fail(res, 500, "SERVER_ERROR", "server error");
  });

// Brute-force protection:
//   same IP + same username: LOGIN_MAX_ATTEMPTS wrong passwords -> locked LOGIN_LOCK_MIN
//   same IP, any usernames : 30 wrong passwords                 -> locked LOGIN_LOCK_MIN
const MIN = 60 * 1000;
const userLimiter = createLimiter({ max: config.loginMaxAttempts, windowMs: 15 * MIN, lockMs: config.loginLockMs });
const ipLimiter = createLimiter({ max: 30, windowMs: 15 * MIN, lockMs: config.loginLockMs });

// Save one login attempt to the history (never blocks the response).
function logAttempt(req, { user, username, ok, code, deviceId }) {
  LoginEvent.create({
    gameId: req.gameId,
    userId: user ? user._id : null,
    username,
    ok,
    code: code || "",
    deviceId,
    ip: req.ip || "",
  }).catch((e) => console.error("login log failed:", e.message));
}

// ---------------------------------------------------------------------------
// POST /api/login  { gameId, username, password, deviceId }
//
//   First successful login locks the account to that deviceId.
//   After that, only the same deviceId can log in.
//
//   200 { ok: true, token, expiresIn, user }
//   401 WRONG_CREDENTIALS  | 403 WRONG_DEVICE | 403 BANNED | 429 TOO_MANY_ATTEMPTS
// ---------------------------------------------------------------------------
router.post("/login", handle(async (req, res) => {
  const gameId = String((req.body && req.body.gameId) || "").toLowerCase().trim();
  if (!config.games.has(gameId)) return fail(res, 400, "UNKNOWN_GAME", "unknown gameId");
  req.gameId = gameId;

  const { username, password, deviceId } = req.body;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password)
    return fail(res, 400, "INVALID_INPUT", "username and password are required");
  if (!validateDeviceId(deviceId))
    return fail(res, 400, "INVALID_INPUT", "deviceId must be 8-64 chars: letters, numbers, -");

  const uname = username.toLowerCase().trim();
  const userKey = `${req.ip}|${gameId}|${uname}`;
  const ipKey = `ip:${req.ip}`;
  const locked = Math.max(userLimiter.lockedFor(userKey), ipLimiter.lockedFor(ipKey));
  if (locked)
    return fail(res, 429, "TOO_MANY_ATTEMPTS", `too many attempts, try again in ${locked}s`, { retryAfterSec: locked });

  // 1) username + password
  let user = await User.findOne({ gameId, username: uname });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    userLimiter.fail(userKey);
    ipLimiter.fail(ipKey);
    logAttempt(req, { user, username: uname, ok: false, code: "WRONG_CREDENTIALS", deviceId });
    return fail(res, 401, "WRONG_CREDENTIALS", "invalid username or password");
  }
  userLimiter.reset(userKey);

  // 2) banned?
  if (user.banned) {
    logAttempt(req, { user, username: uname, ok: false, code: "BANNED", deviceId });
    return fail(res, 403, "BANNED", "this account is banned", { reason: user.banReason || "" });
  }

  // 3) device lock
  const now = new Date();
  let decision = deviceDecision(user.deviceId, deviceId);

  if (decision === "bind") {
    // Atomic: only binds if still unbound (two devices at the same second -> only one wins).
    const bound = await User.findOneAndUpdate(
      { _id: user._id, deviceId: null },
      { $set: { deviceId, deviceBoundAt: now } },
      { new: true }
    );
    user = bound || (await User.findById(user._id));
    decision = deviceDecision(user.deviceId, deviceId) === "ok" ? "ok" : "wrong";
  }

  if (decision === "wrong") {
    await User.updateOne(
      { _id: user._id },
      { $set: { lastRejectedDeviceAt: now, lastRejectedDeviceId: deviceId } }
    );
    logAttempt(req, { user, username: uname, ok: false, code: "WRONG_DEVICE", deviceId });
    return fail(res, 403, "WRONG_DEVICE", "this account is locked to another device");
  }

  // 4) success
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: now, lastLoginIp: req.ip || "" } });
  logAttempt(req, { user, username: uname, ok: true, deviceId });

  res.json({
    ok: true,
    message: "login successful",
    token: signPlayerToken(user, deviceId),
    expiresIn: config.tokenTtlSec,
    user: { username: user.username, gameId: user.gameId },
  });
}));

module.exports = router;
