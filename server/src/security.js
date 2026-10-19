const User = require("./models/User");

/**
 * Someone used a token in a way only a thief would (old refresh token, or a token
 * from the wrong device). Kill the session so BOTH the thief and the real player are
 * logged out. The real player logs in again with the password; the thief can't.
 * The event is saved on the user so the admin sees it in the dashboard.
 */
async function revokeForTheft(filter, type, req) {
  const user = await User.findOneAndUpdate(
    filter,
    {
      $set: {
        session: null,
        securityEvent: { type, at: new Date(), ip: req.ip || "" },
      },
    },
    { new: true }
  );
  if (user) {
    console.warn(`[SECURITY] ${type} user=${user.gameId}/${user.username} ip=${req.ip} -> session revoked`);
  }
  return user;
}

module.exports = { revokeForTheft };
