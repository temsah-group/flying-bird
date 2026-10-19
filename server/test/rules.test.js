const test = require("node:test");
const assert = require("node:assert");
const { validateCredentials, validateDeviceId, canLogin } = require("../src/rules");

const INACTIVE = 120000;
const now = Date.now();
const future = new Date(now + 86400000);

test("credentials validation", () => {
  assert.strictEqual(validateCredentials("saleh", "123456"), null);
  assert.ok(validateCredentials("ab", "123456"));
  assert.ok(validateCredentials("saleh", "123"));
  assert.ok(validateCredentials("bad name", "123456"));
});

test("deviceId validation", () => {
  assert.ok(validateDeviceId("a1b2c3d4-e5f6"));
  assert.ok(!validateDeviceId("x"));
  assert.ok(!validateDeviceId(undefined));
});

test("no session -> can login", () => {
  assert.ok(canLogin(null, "dev-AAAA", now, INACTIVE));
});

test("other device playing now -> blocked", () => {
  const s = { deviceId: "dev-AAAA", lastActive: new Date(now - 10000), expiresAt: future };
  assert.ok(!canLogin(s, "dev-BBBB", now, INACTIVE));
});

test("same device -> allowed", () => {
  const s = { deviceId: "dev-AAAA", lastActive: new Date(now - 10000), expiresAt: future };
  assert.ok(canLogin(s, "dev-AAAA", now, INACTIVE));
});

test("other device stopped heartbeat (crash) -> allowed", () => {
  const s = { deviceId: "dev-AAAA", lastActive: new Date(now - 300000), expiresAt: future };
  assert.ok(canLogin(s, "dev-BBBB", now, INACTIVE));
});

test("other device refresh token expired -> allowed", () => {
  const s = { deviceId: "dev-AAAA", lastActive: new Date(now - 1000), expiresAt: new Date(now - 1) };
  assert.ok(canLogin(s, "dev-BBBB", now, INACTIVE));
});
