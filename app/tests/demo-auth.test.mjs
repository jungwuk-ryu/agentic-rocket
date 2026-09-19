import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  DemoAdministratorAuth,
  DemoLoginRateLimiter,
  createDemoPasswordHash,
  demoSessionCookie,
  expiredDemoSessionCookie,
} from "../server/lib/demo-auth.mjs";

const administratorEmail = "vojougae35@gmail.com";

test("administrator demo accepts only its server-side password hash and signs a short-lived cookie", async () => {
  let now = 1_790_000_000_000;
  const passwordHash = await createDemoPasswordHash("test-only administrator secret", {
    salt: Buffer.alloc(16, 7),
  });
  const auth = new DemoAdministratorAuth({
    passwordHash,
    sessionSecret: randomBytes(32).toString("base64url"),
    administratorEmail,
    now: () => now,
  });

  assert.equal(auth.configured, true);
  assert.equal(await auth.accepts("test-only administrator secret"), true);
  assert.equal(await auth.accepts("wrong secret"), false);

  const token = auth.createSession();
  const cookie = demoSessionCookie(token, { secure: true });
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.deepEqual(auth.viewerFromHeaders({ cookie: cookie.split(";", 1)[0] }), auth.viewer());

  const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  assert.equal(auth.viewerFromHeaders({ cookie: `agenticrocket_demo=${tampered}` }), null);
  now += 8 * 60 * 60 * 1_000 + 1_000;
  assert.equal(auth.viewerFromHeaders({ cookie: cookie.split(";", 1)[0] }), null);
  assert.match(expiredDemoSessionCookie({ secure: true }), /Max-Age=0/);
});

test("administrator demo is disabled without both runtime secrets", async () => {
  const passwordHash = await createDemoPasswordHash("test-only administrator secret", {
    salt: Buffer.alloc(16, 8),
  });
  const auth = new DemoAdministratorAuth({
    passwordHash,
    sessionSecret: undefined,
    administratorEmail,
  });
  assert.equal(auth.configured, false);
  assert.equal(await auth.accepts("test-only administrator secret"), false);
});

test("administrator demo throttles repeated incorrect password attempts", () => {
  let now = 1_790_000_000_000;
  const limiter = new DemoLoginRateLimiter({ now: () => now, limit: 3, blockMilliseconds: 30_000 });
  const key = "test-address";
  limiter.recordFailure(key);
  limiter.recordFailure(key);
  assert.equal(limiter.retryAfterSeconds(key), 0);
  limiter.recordFailure(key);
  assert.equal(limiter.retryAfterSeconds(key), 30);
  now += 30_001;
  assert.equal(limiter.retryAfterSeconds(key), 0);
  limiter.recordFailure(key);
  limiter.clear(key);
  assert.equal(limiter.retryAfterSeconds(key), 0);
});
