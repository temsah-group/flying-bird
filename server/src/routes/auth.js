const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const config = require("../config");
const requireAuth = require("../middleware/requireAuth");
const { createLimiter } = require("../middleware/rateLimit");
const { revokeForTheft } = require("../security");
const { validateCredentials, validateDeviceId } = require("../rules");
const {
  sha256,
  newRefreshToken,
  newSessionId,
  signAccessToken,
} = require("../tokens");

const router = express.Router();

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ ok: false, code, message, ...extra });

const handle = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    fail(res, 500, "SERVER_ERROR", "server error");
  });

// ---------------------------------------------------------------------------
// Brute-force protection
//   - same IP + same username: 5 wrong passwords -> locked 15 min
//   - same IP, any usernames: 30 wrong passwords -> locked 15 min
//   - register: 20 accounts per IP per hour
// ---------------------------------------------------------------------------
const MIN = 60 * 1000;
const userLimiter = createLimiter({ max: config.loginMaxAttempts, windowMs: 15 * MIN, lockMs: config.loginLockMs });
const ipLimiter = createLimiter({ max: 30, windowMs: 15 * MIN, lockMs: config.loginLockMs });
const registerLimiter = createLimiter({ max: 20, windowMs: 60 * MIN, lockMs: 60 * MIN });

const tooMany = (res, sec) =>
  fail(res, 429, "TOO_MANY_ATTEMPTS", `too many attempts, try again in ${sec}s`, { retryAfterSec: sec });

// Endpoints that receive gameId in the body must use a game listed in GAMES.
function requireGame(req, res, next) {
  const gameId = String((req.body && req.body.gameId) || "").toLowerCase().trim();
  if (!config.games.has(gameId)) return fail(res, 400, "UNKNOWN_GAME", "unknown gameId");
  req.gameId = gameId;
  next();
}

function tokenResponse(user, sid, refreshToken, deviceId, message) {
  return {
    ok: true,
    message,
    accessToken: signAccessToken(user, sid, deviceId),
    refreshToken,
    expiresIn: config.accessTtlSec, // seconds
    heartbeatSec: config.heartbeatSec,
    user: { username: user.username },
  };
}

// ---------------------------------------------------------------------------
// POST /api/register  { gameId, username, password }
// ---------------------------------------------------------------------------
router.post("/register", requireGame, handle(async (req, res) => {
  const regKey = `reg:${req.ip}`;
  const locked = registerLimiter.lockedFor(regKey);
  if (locked) return tooMany(res, locked);

  const { username, password } = req.body;
  const err = validateCredentials(username, password);
  if (err) return fail(res, 400, "INVALID_INPUT", err);

  registerLimiter.fail(regKey); // counts every registration attempt
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ gameId: req.gameId, username: username.trim(), password: hash });
    res.status(201).json({ ok: true, message: "account created", user: { username: user.username } });
  } catch (e) {
    if (e.code === 11000) return fail(res, 409, "USERNAME_TAKEN", "username already taken");
    throw e;
  }
}));

// ---------------------------------------------------------------------------
// POST /api/login  { gameId, username, password, deviceId }
//   -> accessToken + refreshToken (both bound to this deviceId)
// ---------------------------------------------------------------------------
router.post("/login", requireGame, handle(async (req, res) => {
  const { username, password, deviceId } = req.body;
  if (typeof username !== "string" || typeof password !== "string")
    return fail(res, 400, "INVALID_INPUT", "username and password are required");
  if (!validateDeviceId(deviceId)) return fail(res, 400, "INVALID_INPUT", "invalid deviceId");

  const uname = username.toLowerCase().trim();
  const userKey = `${req.ip}|${req.gameId}|${uname}`;
  const ipKey = `ip:${req.ip}`;
  const locked = Math.max(userLimiter.lockedFor(userKey), ipLimiter.lockedFor(ipKey));
  if (locked) return tooMany(res, locked);

  const user = await User.findOne({ gameId: req.gameId, username: uname });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    userLimiter.fail(userKey);
    ipLimiter.fail(ipKey);
    return fail(res, 401, "WRONG_CREDENTIALS", "invalid username or password");
  }
  userLimiter.reset(userKey);

  if (user.banned)
    return fail(res, 403, "BANNED", "this account is banned", { reason: user.banReason || "" });

  const now = new Date();
  const cutoff = new Date(now.getTime() - config.inactiveMs);
  const sid = newSessionId();
  const refreshToken = newRefreshToken();

  // Atomic: take the session only if no OTHER device is active right now.
  // (same rule as canLogin() in rules.js)
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [
        { session: null },
        { "session.expiresAt": { $lte: now } },
        { "session.lastActive": { $lt: cutoff } },
        { "session.deviceId": deviceId },
      ],
    },
    {
      $set: {
        session: {
          sid,
          refreshHash: sha256(refreshToken),
          usedHashes: [],
          deviceId,
          lastActive: now,
          expiresAt: new Date(now.getTime() + config.refreshTtlMs),
        },
        lastLoginAt: now,
      },
    },
    { new: true }
  );

  if (!updated)
    return fail(res, 409, "ALREADY_LOGGED_IN", "this account is already logged in on another device");

  res.json(tokenResponse(updated, sid, refreshToken, deviceId, "login successful"));
}));

// ---------------------------------------------------------------------------
// POST /api/refresh  { gameId, refreshToken, deviceId }
//   -> NEW accessToken + NEW refreshToken (old refresh token stops working)
//
// Theft detection:
//   - refresh token that was ALREADY used  -> someone copied it -> session revoked
//   - current refresh token from ANOTHER device -> stolen        -> session revoked
// ---------------------------------------------------------------------------
router.post("/refresh", requireGame, handle(async (req, res) => {
  const { refreshToken, deviceId } = req.body;
  if (typeof refreshToken !== "string" || !refreshToken)
    return fail(res, 400, "INVALID_INPUT", "refreshToken required");
  if (!validateDeviceId(deviceId)) return fail(res, 400, "INVALID_INPUT", "invalid deviceId");

  const now = new Date();
  const hash = sha256(refreshToken);
  const newRefresh = newRefreshToken();

  // Normal case. Atomic rotation: the same refresh token can never be used twice.
  const user = await User.findOneAndUpdate(
    {
      gameId: req.gameId,
      "session.refreshHash": hash,
      "session.deviceId": deviceId,
      "session.expiresAt": { $gt: now },
      banned: { $ne: true },
    },
    {
      $set: {
        "session.refreshHash": sha256(newRefresh),
        "session.lastActive": now,
        "session.expiresAt": new Date(now.getTime() + config.refreshTtlMs),
      },
      $push: { "session.usedHashes": { $each: [hash], $slice: -10 } },
    },
    { new: true }
  );

  if (user) return res.json(tokenResponse(user, user.session.sid, newRefresh, deviceId, "token refreshed"));

  // ---- Not accepted. Find out if this looks like theft. ----

  // 1) An old refresh token that was already used.
  const reused = await revokeForTheft(
    { gameId: req.gameId, "session.usedHashes": hash },
    "REFRESH_TOKEN_REUSED",
    req
  );
  if (reused)
    return fail(res, 401, "REFRESH_REUSED", "this refresh token was already used; session ended for safety");

  // 2) The current refresh token, but from a different device.
  const otherDevice = await revokeForTheft(
    { gameId: req.gameId, "session.refreshHash": hash, "session.deviceId": { $ne: deviceId } },
    "REFRESH_TOKEN_OTHER_DEVICE",
    req
  );
  if (otherDevice)
    return fail(res, 401, "DEVICE_MISMATCH", "refresh token used from another device; session ended");

  return fail(res, 401, "REFRESH_INVALID", "refresh token invalid or expired, please log in");
}));

// ---------------------------------------------------------------------------
// POST /api/heartbeat   Headers: Authorization: Bearer <accessToken>, X-Device-Id
// ---------------------------------------------------------------------------
router.post("/heartbeat", requireAuth, handle(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id, "session.sid": req.user.session.sid },
    { $set: { "session.lastActive": new Date() } }
  );
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// GET /api/me   Headers: Authorization: Bearer <accessToken>, X-Device-Id
// ---------------------------------------------------------------------------
router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: { username: req.user.username, gameId: req.user.gameId } });
});

// ---------------------------------------------------------------------------
// POST /api/logout  { gameId, refreshToken }
// ---------------------------------------------------------------------------
router.post("/logout", requireGame, handle(async (req, res) => {
  const { refreshToken } = req.body;
  if (typeof refreshToken === "string" && refreshToken) {
    await User.updateOne(
      { gameId: req.gameId, "session.refreshHash": sha256(refreshToken) },
      { $set: { session: null } }
    );
  }
  res.json({ ok: true, message: "logged out" });
}));

module.exports = router;
