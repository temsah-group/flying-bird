const mongoose = require("mongoose");
const config = require("../config");

// One row per /login attempt. Deleted automatically after LOGIN_LOG_DAYS.
const loginEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    gameId: String,
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    username: String,
    ok: Boolean,
    code: String, // "" on success, else WRONG_CREDENTIALS / WRONG_DEVICE / BANNED
    deviceId: String,
    ip: String,
  },
  { versionKey: false }
);

loginEventSchema.index({ at: 1 }, { expireAfterSeconds: config.loginLogDays * 86400 });
loginEventSchema.index({ userId: 1, at: -1 });

module.exports = mongoose.model("LoginEvent", loginEventSchema);
