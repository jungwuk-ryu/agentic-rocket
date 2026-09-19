import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HASH_PREFIX = "scrypt-v1";
const HASH_BYTES = 32;
const SALT_BYTES = 16;
const SCRYPT_OPTIONS = {
  N: 32_768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const MAX_TOKEN_BYTES = 8_192;
const DEMO_COOKIE_NAME = "agenticrocket_demo";

export class DemoAuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = "DemoAuthError";
    this.statusCode = statusCode;
    this.expose = true;
  }
}

function validPassword(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1_024;
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parsePasswordHash(value) {
  const [prefix, encodedSalt, encodedHash, ...extra] = String(value || "").split("$");
  if (
    prefix !== HASH_PREFIX ||
    extra.length ||
    !/^[A-Za-z0-9_-]+$/.test(encodedSalt || "") ||
    !/^[A-Za-z0-9_-]+$/.test(encodedHash || "")
  ) {
    return null;
  }
  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const hash = Buffer.from(encodedHash, "base64url");
    return salt.length >= SALT_BYTES && hash.length === HASH_BYTES ? { salt, hash } : null;
  } catch {
    return null;
  }
}

function sessionSecret(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const secret = Buffer.from(value, "base64url");
    return secret.length >= HASH_BYTES ? secret : null;
  } catch {
    return null;
  }
}

function signature(input, secret) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function requestCookie(headers) {
  const cookie = Array.isArray(headers?.cookie) ? headers.cookie[0] : headers?.cookie;
  if (typeof cookie !== "string") return null;
  for (const item of cookie.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 1) continue;
    if (item.slice(0, separator).trim() !== DEMO_COOKIE_NAME) continue;
    const value = item.slice(separator + 1).trim();
    return value || null;
  }
  return null;
}

function cookieAttributes({ secure, maxAge = SESSION_LIFETIME_SECONDS } = {}) {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : null,
  ].filter(Boolean);
}

export function demoSessionCookie(token, options) {
  return [`${DEMO_COOKIE_NAME}=${token}`, ...cookieAttributes(options)].join("; ");
}

export function expiredDemoSessionCookie({ secure } = {}) {
  return [
    `${DEMO_COOKIE_NAME}=`,
    ...cookieAttributes({ secure, maxAge: 0 }),
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export async function createDemoPasswordHash(password, { salt = randomBytes(SALT_BYTES) } = {}) {
  if (!validPassword(password)) throw new Error("A demo password is required.");
  const derived = await scrypt(password, salt, HASH_BYTES, SCRYPT_OPTIONS);
  return `${HASH_PREFIX}$${Buffer.from(salt).toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyDemoPassword(password, encodedHash) {
  const parsed = parsePasswordHash(encodedHash);
  if (!parsed || !validPassword(password)) return false;
  const derived = await scrypt(password, parsed.salt, HASH_BYTES, SCRYPT_OPTIONS);
  return timingSafeEqual(Buffer.from(derived), parsed.hash);
}

export class DemoLoginRateLimiter {
  #attempts = new Map();
  #now;
  #limit;
  #blockMilliseconds;

  constructor({ now = () => Date.now(), limit = 5, blockMilliseconds = 5 * 60_000 } = {}) {
    this.#now = now;
    this.#limit = limit;
    this.#blockMilliseconds = blockMilliseconds;
  }

  retryAfterSeconds(key) {
    const record = this.#attempts.get(key);
    if (!record || record.blockedUntil <= this.#now()) return 0;
    return Math.ceil((record.blockedUntil - this.#now()) / 1_000);
  }

  recordFailure(key) {
    const now = this.#now();
    this.#prune(now);
    const record = this.#attempts.get(key) || { failures: 0, blockedUntil: 0, lastSeen: now };
    record.failures += 1;
    record.lastSeen = now;
    if (record.failures >= this.#limit) {
      record.failures = 0;
      record.blockedUntil = now + this.#blockMilliseconds;
    }
    this.#attempts.set(key, record);
  }

  clear(key) {
    this.#attempts.delete(key);
  }

  #prune(now) {
    for (const [key, record] of this.#attempts) {
      if (record.lastSeen < now - 3_600_000 && record.blockedUntil <= now) {
        this.#attempts.delete(key);
      }
    }
  }
}

export class DemoAdministratorAuth {
  #passwordHash;
  #sessionSecret;
  #administratorEmail;
  #now;
  #lifetimeSeconds;

  constructor({
    passwordHash,
    sessionSecret: configuredSecret,
    administratorEmail,
    now = () => Date.now(),
    lifetimeSeconds = SESSION_LIFETIME_SECONDS,
  }) {
    this.#passwordHash = parsePasswordHash(passwordHash) ? passwordHash : null;
    this.#sessionSecret = sessionSecret(configuredSecret);
    this.#administratorEmail = String(administratorEmail || "").trim().toLowerCase();
    this.#now = now;
    this.#lifetimeSeconds = lifetimeSeconds;
  }

  get configured() {
    return Boolean(this.#passwordHash && this.#sessionSecret && this.#administratorEmail);
  }

  viewer() {
    return Object.freeze({
      uid: `demo-admin:${this.#administratorEmail}`,
      email: this.#administratorEmail,
      name: "Administrator demo",
      isAdmin: true,
      authType: "demo",
    });
  }

  async accepts(password) {
    if (!this.configured) return false;
    return verifyDemoPassword(password, this.#passwordHash);
  }

  createSession() {
    if (!this.configured) throw new DemoAuthError("Administrator demo sign-in is not configured.", 503);
    const nowSeconds = Math.floor(this.#now() / 1_000);
    const viewer = this.viewer();
    const header = encodeJson({ alg: "HS256", typ: "AGENTICROCKET_DEMO" });
    const payload = encodeJson({
      v: 1,
      uid: viewer.uid,
      email: viewer.email,
      role: "administrator-demo",
      iat: nowSeconds,
      exp: nowSeconds + this.#lifetimeSeconds,
      nonce: randomBytes(12).toString("base64url"),
    });
    const input = `${header}.${payload}`;
    return `${input}.${signature(input, this.#sessionSecret)}`;
  }

  viewerFromHeaders(headers) {
    if (!this.configured) return null;
    const token = requestCookie(headers);
    if (!token || Buffer.byteLength(token) > MAX_TOKEN_BYTES) return null;
    const [encodedHeader, encodedPayload, encodedSignature, ...extra] = token.split(".");
    if (extra.length || !encodedHeader || !encodedPayload || !encodedSignature) return null;
    const header = decodeJson(encodedHeader);
    const payload = decodeJson(encodedPayload);
    const expected = signature(`${encodedHeader}.${encodedPayload}`, this.#sessionSecret);
    if (
      !header ||
      header.alg !== "HS256" ||
      header.typ !== "AGENTICROCKET_DEMO" ||
      !payload ||
      !/^[A-Za-z0-9_-]+$/.test(encodedSignature) ||
      Buffer.byteLength(encodedSignature) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(encodedSignature), Buffer.from(expected))
    ) {
      return null;
    }
    const nowSeconds = Math.floor(this.#now() / 1_000);
    const viewer = this.viewer();
    if (
      payload.v !== 1 ||
      payload.uid !== viewer.uid ||
      payload.email !== viewer.email ||
      payload.role !== "administrator-demo" ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= nowSeconds ||
      payload.iat > nowSeconds + 300
    ) {
      return null;
    }
    return viewer;
  }
}

export { DEMO_COOKIE_NAME, SESSION_LIFETIME_SECONDS };
