const mongoose = require("mongoose");

// The one active login of this user (one device at a time).
const sessionSchema = new mongoose.Schema(
  {
    sid: { type: String, required: true },         // session id, also inside every access token
    refreshHash: { type: String, required: true }, // sha256 of the CURRENT refresh token (never the token itself)
    usedHashes: { type: [String], default: [] },   // last refresh tokens already used -> reuse = theft
    deviceId: { type: String, required: true },    // the only device allowed to use this session
    lastActive: { type: Date, required: true },    // updated by heartbeat / refresh
    expiresAt: { type: Date, required: true },     // refresh token expiry
  },
  { _id: false }
);

const securityEventSchema = new mongoose.Schema(
  {
    type: String, // REFRESH_TOKEN_REUSED | REFRESH_TOKEN_OTHER_DEVICE | ACCESS_TOKEN_OTHER_DEVICE
    at: Date,
    ip: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, lowercase: true, trim: true },
    username: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // bcrypt hash
    session: { type: sessionSchema, default: null },
    lastLoginAt: { type: Date, default: null },

    // Last suspicious token use (shown in the admin dashboard)
    securityEvent: { type: securityEventSchema, default: null },

    // Set by admin
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },
    bannedAt: { type: Date, default: null },
  },
  { timestamps: true } // createdAt, updatedAt
);

// Same username can exist in different games, but only once per game.
userSchema.index({ gameId: 1, username: 1 }, { unique: true });
userSchema.index({ "session.refreshHash": 1 }, { sparse: true });
userSchema.index({ "session.usedHashes": 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
