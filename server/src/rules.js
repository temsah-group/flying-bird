// Pure helpers (no database) so they are easy to test.

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const DEVICE_RE = /^[a-zA-Z0-9-]{8,64}$/;

function validateCredentials(username, password) {
  if (typeof username !== "string" || typeof password !== "string")
    return "username and password are required";
  if (!USERNAME_RE.test(username.trim()))
    return "username must be 3-20 chars: letters, numbers, _";
  if (password.length < 6 || password.length > 72)
    return "password must be 6-72 chars";
  return null;
}

function validateDeviceId(deviceId) {
  return typeof deviceId === "string" && DEVICE_RE.test(deviceId);
}

// A device counts as "currently playing" if its refresh token is still valid
// AND it sent a heartbeat/refresh recently.
function isDeviceActive(session, now, inactiveMs) {
  if (!session) return false;
  if (new Date(session.expiresAt).getTime() <= now) return false;
  return now - new Date(session.lastActive).getTime() < inactiveMs;
}

// Login is allowed if no device is active, or the active device is this same device.
function canLogin(session, deviceId, now, inactiveMs) {
  return !isDeviceActive(session, now, inactiveMs) || session.deviceId === deviceId;
}

module.exports = { validateCredentials, validateDeviceId, isDeviceActive, canLogin };
