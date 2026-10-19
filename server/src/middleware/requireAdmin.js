const { verifyAdminToken } = require("../tokens");

// Protects /api/admin/* — needs "Authorization: Bearer <adminToken>" from POST /api/admin/login
module.exports = function requireAdmin(req, res, next) {
  const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ ok: false, code: "NO_TOKEN", message: "admin token required" });
  try {
    verifyAdminToken(m[1]);
    next();
  } catch (e) {
    const code = e.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    res.status(401).json({ ok: false, code, message: "admin login required" });
  }
};
