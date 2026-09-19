import { createPublicKey, verify as verifySignature } from "node:crypto";

const FIREBASE_CERTIFICATES_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const MAX_TOKEN_BYTES = 16_384;
const CLOCK_SKEW_SECONDS = 300;

export class FirebaseAuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = "FirebaseAuthError";
    this.statusCode = statusCode;
    this.expose = true;
  }
}

function decodeJson(segment, label) {
  if (typeof segment !== "string" || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new FirebaseAuthError("Google sign-in token is malformed.");
  }
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    throw new FirebaseAuthError(`Google sign-in ${label} is malformed.`);
  }
}

function parseToken(token) {
  if (typeof token !== "string" || !token || Buffer.byteLength(token) > MAX_TOKEN_BYTES) {
    throw new FirebaseAuthError("Google sign-in token is invalid.");
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new FirebaseAuthError("Google sign-in token is malformed.");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader, "token header");
  const payload = decodeJson(encodedPayload, "token payload");
  if (!header || typeof header !== "object" || header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new FirebaseAuthError("Google sign-in token uses an unsupported signature.");
  }
  if (!payload || typeof payload !== "object") {
    throw new FirebaseAuthError("Google sign-in token payload is invalid.");
  }
  return {
    header,
    payload,
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature: Buffer.from(encodedSignature, "base64url"),
  };
}

function cacheLifetime(headers) {
  const header = headers?.get?.("cache-control") || "";
  const seconds = Number.parseInt(/max-age=(\d+)/i.exec(header)?.[1] || "", 10);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1_000 : 3_600_000;
  return Math.min(Math.max(milliseconds, 300_000), 86_400_000);
}

function safeProfileText(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 250) : undefined;
}

function requiredTimestamp(value, claim) {
  if (!Number.isSafeInteger(value)) {
    throw new FirebaseAuthError(`Google sign-in token ${claim} is invalid.`);
  }
  return value;
}

export class FirebaseIdTokenVerifier {
  #projectId;
  #administratorEmail;
  #fetch;
  #now;
  #certificatesUrl;
  #certificates = new Map();
  #certificatesExpireAt = 0;
  #loadingCertificates = null;

  constructor({
    projectId,
    administratorEmail,
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
    certificatesUrl = FIREBASE_CERTIFICATES_URL,
  }) {
    if (typeof projectId !== "string" || !projectId.trim()) {
      throw new Error("A Firebase project ID is required for authentication.");
    }
    this.#projectId = projectId.trim();
    this.#administratorEmail = String(administratorEmail || "").trim().toLowerCase();
    this.#fetch = fetchImpl;
    this.#now = now;
    this.#certificatesUrl = certificatesUrl;
  }

  async verifyIdToken(token) {
    const parsed = parseToken(token);
    const key = await this.#keyFor(parsed.header.kid);
    if (!verifySignature("RSA-SHA256", Buffer.from(parsed.signingInput), key, parsed.signature)) {
      throw new FirebaseAuthError("Google sign-in token signature is invalid.");
    }
    return this.#viewerFromClaims(parsed.payload);
  }

  async #keyFor(keyId) {
    let key = (await this.#loadCertificates()).get(keyId);
    if (key) return key;
    key = (await this.#loadCertificates({ force: true })).get(keyId);
    if (key) return key;
    throw new FirebaseAuthError("Google sign-in token is no longer valid.");
  }

  async #loadCertificates({ force = false } = {}) {
    if (!force && this.#certificates.size && this.#certificatesExpireAt > this.#now()) {
      return this.#certificates;
    }
    if (this.#loadingCertificates) return this.#loadingCertificates;
    this.#loadingCertificates = (async () => {
      let response;
      try {
        response = await this.#fetch(this.#certificatesUrl);
      } catch {
        throw new FirebaseAuthError("Google sign-in verification is temporarily unavailable.", 503);
      }
      if (!response?.ok) {
        throw new FirebaseAuthError("Google sign-in verification is temporarily unavailable.", 503);
      }
      let document;
      try {
        document = await response.json();
      } catch {
        throw new FirebaseAuthError("Google sign-in verification is temporarily unavailable.", 503);
      }
      const certificates = new Map();
      for (const [keyId, certificate] of Object.entries(document || {})) {
        if (typeof keyId !== "string" || !keyId || typeof certificate !== "string") continue;
        try {
          certificates.set(keyId, createPublicKey(certificate));
        } catch {
          // A malformed key must not make another valid cached key trustworthy.
        }
      }
      if (!certificates.size) {
        throw new FirebaseAuthError("Google sign-in verification is temporarily unavailable.", 503);
      }
      this.#certificates = certificates;
      this.#certificatesExpireAt = this.#now() + cacheLifetime(response.headers);
      return certificates;
    })();
    try {
      return await this.#loadingCertificates;
    } finally {
      this.#loadingCertificates = null;
    }
  }

  #viewerFromClaims(claims) {
    const now = Math.floor(this.#now() / 1_000);
    const issuer = `https://securetoken.google.com/${this.#projectId}`;
    if (claims.aud !== this.#projectId || claims.iss !== issuer) {
      throw new FirebaseAuthError("Google sign-in token belongs to another Firebase project.");
    }
    if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128) {
      throw new FirebaseAuthError("Google sign-in account is invalid.");
    }
    const expiresAt = requiredTimestamp(claims.exp, "expiration");
    const issuedAt = requiredTimestamp(claims.iat, "issued-at time");
    const authenticatedAt = requiredTimestamp(claims.auth_time, "authentication time");
    if (expiresAt <= now || issuedAt > now + CLOCK_SKEW_SECONDS || authenticatedAt > now + CLOCK_SKEW_SECONDS) {
      throw new FirebaseAuthError("Google sign-in token has expired. Sign in again.");
    }
    const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
    if (!email || email.length > 320 || !email.includes("@") || claims.email_verified !== true) {
      throw new FirebaseAuthError("A verified Google email address is required.");
    }
    if (claims.firebase?.sign_in_provider !== "google.com") {
      throw new FirebaseAuthError("This app accepts Google sign-in only.");
    }
    return Object.freeze({
      uid: claims.sub,
      email,
      name: safeProfileText(claims.name),
      photoUrl: safeProfileText(claims.picture),
      isAdmin: email === this.#administratorEmail,
      expiresAt: new Date(expiresAt * 1_000).toISOString(),
    });
  }
}
