const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const config = require("../config");
const requireAdmin = require("../middleware/requireAdmin");
const { signAdminToken, safeEqual } = require("../tokens");

const router = express.Router();

const fail = (res, status, code, message) =>
  res.status(status).json({ ok: false, code, message });

const handle = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    fail(res, 500, "SERVER_ERROR", "server error");
  });

// ---------------------------------------------------------------------------
// Brute-force protection for admin login: 5 wrong tries -> locked 5 minutes (per IP)
// ---------------------------------------------------------------------------
const attempts = new Map(); // ip -> { count, lockedUntil }
const MAX_TRIES = 5;
const LOCK_MS = 5 * 60 * 1000;

// POST /api/admin/login  { password }
router.post("/login", (req, res) => {
  if (!config.adminPassword)
    return fail(res, 503, "ADMIN_DISABLED", "set ADMIN_PASSWORD in .env to enable the dashboard");

  const ip = req.ip;
  const now = Date.now();
  const a = attempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (a.lockedUntil > now)
    return fail(res, 429, "TOO_MANY_ATTEMPTS", `try again in ${Math.ceil((a.lockedUntil - now) / 1000)}s`);

  const { password } = req.body || {};
  if (typeof password !== "string" || !safeEqual(password, config.adminPassword)) {
    a.count += 1;
    if (a.count >= MAX_TRIES) {
      a.count = 0;
      a.lockedUntil = now + LOCK_MS;
    }
    attempts.set(ip, a);
    return fail(res, 401, "WRONG_PASSWORD", "wrong admin password");
  }

  attempts.delete(ip);
  res.json({ ok: true, token: signAdminToken(), expiresIn: config.adminTokenHours * 3600 });
});

// Everything below needs the admin token.
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function onlineFilter(now) {
  return {
    "session.lastActive": { $gte: new Date(now.getTime() - config.inactiveMs) },
    "session.expiresAt": { $gt: now },
  };
}

function isOnline(u, now) {
  return (
    !!u.session &&
    new Date(u.session.expiresAt) > now &&
    now - new Date(u.session.lastActive) < config.inactiveMs
  );
}

function toAdminUser(u, now) {
  return {
    id: String(u._id),
    gameId: u.gameId,
    username: u.username,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
    online: isOnline(u, now),
    deviceId: u.session ? u.session.deviceId : null,
    lastActive: u.session ? u.session.lastActive : null,
    banned: !!u.banned,
    banReason: u.banReason || "",
    bannedAt: u.bannedAt || null,
    securityEvent: u.securityEvent && u.securityEvent.type ? u.securityEvent : null,
  };
}

function gameFilter(req) {
  const g = String(req.query.gameId || "").toLowerCase().trim();
  return g && g !== "all" ? { gameId: g } : {};
}

async function findUserOr404(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    fail(res, 404, "NOT_FOUND", "user not found");
    return null;
  }
  const user = await User.findById(req.params.id);
  if (!user) fail(res, 404, "NOT_FOUND", "user not found");
  return user;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// GET /api/admin/games
// ---------------------------------------------------------------------------
router.get("/games", (_req, res) => {
  res.json({ ok: true, games: [...config.games] });
});

// ---------------------------------------------------------------------------
// GET /api/admin/stats?gameId=flying-bird   (gameId optional = all games)
// ---------------------------------------------------------------------------
router.get("/stats", handle(async (req, res) => {
  const now = new Date();
  const base = gameFilter(req);
  const today = startOfDay(now);
  const weekAgo = new Date(today.getTime() - 6 * 86400000);

  const [totalUsers, onlineNow, bannedUsers, newToday, newLast7Days, securityAlerts] = await Promise.all([
    User.countDocuments(base),
    User.countDocuments({ ...base, ...onlineFilter(now) }),
    User.countDocuments({ ...base, banned: true }),
    User.countDocuments({ ...base, createdAt: { $gte: today } }),
    User.countDocuments({ ...base, createdAt: { $gte: weekAgo } }),
    User.countDocuments({ ...base, "securityEvent.at": { $gte: weekAgo } }),
  ]);

  // Sign-ups per day, last 14 days (oldest first)
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const from = new Date(today.getTime() - i * 86400000);
    days.push({ from, to: new Date(from.getTime() + 86400000) });
  }
  const counts = await Promise.all(
    days.map((d) => User.countDocuments({ ...base, createdAt: { $gte: d.from, $lt: d.to } }))
  );
  const signupsPerDay = days.map((d, i) => ({ date: dayKey(d.from), count: counts[i] }));

  // Users per game
  const games = [...config.games];
  const perGameCounts = await Promise.all(games.map((g) => User.countDocuments({ gameId: g })));
  const perGame = games.map((g, i) => ({ gameId: g, users: perGameCounts[i] }));

  res.json({
    ok: true,
    stats: { totalUsers, onlineNow, bannedUsers, newToday, newLast7Days, securityAlerts, signupsPerDay, perGame },
  });
}));

// ---------------------------------------------------------------------------
// GET /api/admin/users?gameId=&search=&status=all|online|banned|alerts&page=1&limit=20
// ---------------------------------------------------------------------------
router.get("/users", handle(async (req, res) => {
  const now = new Date();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search = String(req.query.search || "").trim().toLowerCase();
  const status = String(req.query.status || "all");

  const filter = { ...gameFilter(req) };
  if (search) filter.username = { $regex: escapeRegex(search) };
  if (status === "online") Object.assign(filter, onlineFilter(now));
  if (status === "banned") filter.banned = true;
  if (status === "alerts") filter["securityEvent.type"] = { $exists: true, $ne: null };

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    ok: true,
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    users: users.map((u) => toAdminUser(u, now)),
  });
}));

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id
// ---------------------------------------------------------------------------
router.get("/users/:id", handle(async (req, res) => {
  const user = await findUserOr404(req, res);
  if (user) res.json({ ok: true, user: toAdminUser(user, new Date()) });
}));

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/kick   -> logs the player out of the game now
// ---------------------------------------------------------------------------
router.post("/users/:id/kick", handle(async (req, res) => {
  const user = await findUserOr404(req, res);
  if (!user) return;
  user.session = null;
  await user.save();
  res.json({ ok: true, message: "player kicked", user: toAdminUser(user, new Date()) });
}));

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/ban  { reason }   -> kicked + cannot log in
// ---------------------------------------------------------------------------
router.post("/users/:id/ban", handle(async (req, res) => {
  const user = await findUserOr404(req, res);
  if (!user) return;
  user.banned = true;
  user.banReason = String((req.body && req.body.reason) || "").slice(0, 200);
  user.bannedAt = new Date();
  user.session = null;
  await user.save();
  res.json({ ok: true, message: "player banned", user: toAdminUser(user, new Date()) });
}));

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/unban
// ---------------------------------------------------------------------------
router.post("/users/:id/unban", handle(async (req, res) => {
  const user = await findUserOr404(req, res);
  if (!user) return;
  user.banned = false;
  user.banReason = "";
  user.bannedAt = null;
  await user.save();
  res.json({ ok: true, message: "player unbanned", user: toAdminUser(user, new Date()) });
}));

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/password  { newPassword }   -> also logs the player out
// ---------------------------------------------------------------------------
router.post("/users/:id/password", handle(async (req, res) => {
  const { newPassword } = req.body || {};
  if (typeof newPassword !== "string" || newPassword.length < 6 || newPassword.length > 72)
    return fail(res, 400, "INVALID_INPUT", "password must be 6-72 chars");
  const user = await findUserOr404(req, res);
  if (!user) return;
  user.password = await bcrypt.hash(newPassword, 10);
  user.session = null;
  user.securityEvent = null;
  await user.save();
  res.json({ ok: true, message: "password changed", user: toAdminUser(user, new Date()) });
}));

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/clear-alert   -> admin reviewed the security alert
// ---------------------------------------------------------------------------
router.post("/users/:id/clear-alert", handle(async (req, res) => {
  const user = await findUserOr404(req, res);
  if (!user) return;
  user.securityEvent = null;
  await user.save();
  res.json({ ok: true, message: "alert cleared", user: toAdminUser(user, new Date()) });
}));

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// ---------------------------------------------------------------------------
router.delete("/users/:id", handle(async (req, res) => {
  const user = await findUserOr404(req, res);
  if (!user) return;
  await User.deleteOne({ _id: user._id });
  res.json({ ok: true, message: "user deleted" });
}));

module.exports = router;
