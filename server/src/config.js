require("dotenv").config();

const num = (v, def) => (Number(v) > 0 ? Number(v) : def);
const list = (v, def) =>
  (v || def)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = {
  port: num(process.env.PORT, 3000),
  mongoUri: (process.env.MONGO_URI || "mongodb://127.0.0.1:27017").trim(),
  dbName: (process.env.MONGO_DB_NAME || "game_auth").trim(),
  games: new Set(list(process.env.GAMES, "flying-bird").map((g) => g.toLowerCase())),

  jwtSecret: (process.env.JWT_SECRET || "").trim(),
  accessTtlSec: num(process.env.ACCESS_TOKEN_MIN, 15) * 60,
  refreshTtlMs: num(process.env.REFRESH_TOKEN_DAYS, 30) * 24 * 60 * 60 * 1000,

  heartbeatSec: num(process.env.HEARTBEAT_SEC, 30),
  inactiveMs: num(process.env.SESSION_TIMEOUT_SEC, 120) * 1000,

  // Brute-force protection for player login
  loginMaxAttempts: num(process.env.LOGIN_MAX_ATTEMPTS, 5),
  loginLockMs: num(process.env.LOGIN_LOCK_MIN, 15) * 60 * 1000,

  // Admin dashboard
  adminPassword: (process.env.ADMIN_PASSWORD || "").trim(),
  adminTokenHours: num(process.env.ADMIN_TOKEN_HOURS, 12),

  // Which websites may call this API from the browser (the admin dashboard).
  // "*" = any. Example: http://localhost:5173,https://admin.mygame.com
  corsOrigins: list(process.env.CORS_ORIGINS, "*"),
};
