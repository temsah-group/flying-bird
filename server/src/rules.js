// Pure helpers (no database) so they are easy to test.

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
const DEVICE_RE = /^[a-zA-Z0-9-]{8,64}$/;

function validateUsername(username) {
  if (typeof username !== "string" || !USERNAME_RE.test(username.trim()))
    return "username must be 3-30 chars: letters, numbers, _ . -";
  return null;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 6 || password.length > 72)
    return "password must be 6-72 chars";
  return null;
}

function validateDeviceId(deviceId) {
  return typeof deviceId === "string" && DEVICE_RE.test(deviceId);
}

/**
 * Device lock decision for a login with the right password.
 *   "bind"  -> account has no device yet: lock it to this one
 *   "ok"    -> same device as the locked one
 *   "wrong" -> account is locked to another device
 */
function deviceDecision(boundDeviceId, deviceId) {
  if (!boundDeviceId) return "bind";
  return boundDeviceId === deviceId ? "ok" : "wrong";
}

module.exports = { validateUsername, validatePassword, validateDeviceId, deviceDecision };
