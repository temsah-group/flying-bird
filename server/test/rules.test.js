const test = require("node:test");
const assert = require("node:assert");
const { validateUsername, validatePassword, validateDeviceId, deviceDecision } = require("../src/rules");

test("username validation", () => {
  assert.strictEqual(validateUsername("streamer_01"), null);
  assert.strictEqual(validateUsername("ahmed.live"), null);
  assert.ok(validateUsername("ab"));
  assert.ok(validateUsername("bad name"));
  assert.ok(validateUsername(undefined));
});

test("password validation", () => {
  assert.strictEqual(validatePassword("123456"), null);
  assert.ok(validatePassword("123"));
  assert.ok(validatePassword(undefined));
});

test("deviceId validation", () => {
  assert.ok(validateDeviceId("a1b2c3d4-e5f6"));
  assert.ok(!validateDeviceId("x"));
  assert.ok(!validateDeviceId("8-64 chars"));
  assert.ok(!validateDeviceId(undefined));
});

test("first login binds the device", () => {
  assert.strictEqual(deviceDecision(null, "PC-AAAA1111"), "bind");
});

test("same device is allowed", () => {
  assert.strictEqual(deviceDecision("PC-AAAA1111", "PC-AAAA1111"), "ok");
});

test("another device is rejected", () => {
  assert.strictEqual(deviceDecision("PC-AAAA1111", "PC-BBBB2222"), "wrong");
});
