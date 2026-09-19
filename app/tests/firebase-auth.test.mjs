import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { FirebaseIdTokenVerifier } from "../server/lib/firebase-auth.mjs";

const projectId = "daytona-70675";
const now = 1_790_000_000_000;

function signedToken(privateKey, claims = {}, header = {}) {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key", ...header })).toString("base64url");
  const encodedClaims = Buffer.from(JSON.stringify({
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: "firebase-user-123",
    iat: Math.floor(now / 1_000) - 60,
    auth_time: Math.floor(now / 1_000) - 60,
    exp: Math.floor(now / 1_000) + 3_600,
    email: "owner@example.com",
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
    ...claims,
  })).toString("base64url");
  const input = `${encodedHeader}.${encodedClaims}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

function verifierFor(publicKey, fetchImpl) {
  return new FirebaseIdTokenVerifier({
    projectId,
    administratorEmail: "vojougae35@gmail.com",
    now: () => now,
    fetchImpl: fetchImpl || (async () => new Response(
      JSON.stringify({ "test-key": publicKey.export({ type: "spki", format: "pem" }) }),
      { headers: { "cache-control": "public, max-age=3600" } },
    )),
  });
}

test("verifies a Google Firebase token and caches Google's signing key", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let certificateReads = 0;
  const verifier = verifierFor(publicKey, async () => {
    certificateReads += 1;
    return new Response(JSON.stringify({ "test-key": publicKey.export({ type: "spki", format: "pem" }) }), {
      headers: { "cache-control": "public, max-age=3600" },
    });
  });
  const token = signedToken(privateKey, { email: "vojougae35@gmail.com", name: "Administrator" });

  const first = await verifier.verifyIdToken(token);
  const second = await verifier.verifyIdToken(token);

  assert.deepEqual(first, second);
  assert.equal(first.uid, "firebase-user-123");
  assert.equal(first.email, "vojougae35@gmail.com");
  assert.equal(first.isAdmin, true);
  assert.equal(certificateReads, 1);
});

test("rejects expired, unverified, and non-Google Firebase identities", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const verifier = verifierFor(publicKey);
  const cases = [
    signedToken(privateKey, { exp: Math.floor(now / 1_000) - 1 }),
    signedToken(privateKey, { email_verified: false }),
    signedToken(privateKey, { firebase: { sign_in_provider: "password" } }),
  ];

  for (const token of cases) {
    await assert.rejects(() => verifier.verifyIdToken(token), (error) => error.statusCode === 401);
  }
});

test("fails closed when Google's signing keys cannot be read", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const verifier = verifierFor(publicKey, async () => {
    throw new Error("network unavailable");
  });

  await assert.rejects(
    () => verifier.verifyIdToken(signedToken(privateKey)),
    (error) => error.statusCode === 503,
  );
});
