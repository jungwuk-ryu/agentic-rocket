import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./lib/config.mjs";
import {
  DemoAdministratorAuth,
  DemoLoginRateLimiter,
  demoSessionCookie,
  expiredDemoSessionCookie,
} from "./lib/demo-auth.mjs";
import { FirebaseAuthError, FirebaseIdTokenVerifier } from "./lib/firebase-auth.mjs";
import { FileSessionStore } from "./lib/store.mjs";
import { SessionRunner } from "./lib/runner.mjs";
import {
  AccountSessionGate,
  activeSessionForViewer,
  canAccessSession,
  requireAgentChatAccess,
  sessionOwner,
  visibleSessions,
} from "./lib/session-access.mjs";

const repositoryUrl = "https://github.com/jungwuk-ryu/agenticrocket-demo-perf";
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(__dirname, "..", "dist", "client");
const validSessionId = (value) => /^[a-f0-9-]{36}$/i.test(value || "");

function publicSession(session) {
  if (!session) return null;
  const { agentHistory, owner, ...visible } = session;
  return visible;
}

function ensureString(value, field, maxLength = 4_000) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength)
    throw new Error(`Invalid ${field}.`);
  return value.trim();
}

function bearerToken(authorization) {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = typeof value === "string" ? /^Bearer\s+(.+)$/i.exec(value.trim()) : null;
  return match?.[1] || null;
}

function requestPath(request) {
  return request.url.split("?", 1)[0];
}

function publicViewer(viewer) {
  if (!viewer) return null;
  return {
    uid: viewer.uid,
    email: viewer.email,
    name: viewer.name || null,
    isAdmin: viewer.isAdmin === true,
    authType: viewer.authType || "google",
  };
}

function demoAttemptKey(request) {
  const connectingIp = Array.isArray(request.headers["cf-connecting-ip"])
    ? request.headers["cf-connecting-ip"][0]
    : request.headers["cf-connecting-ip"];
  const source = typeof connectingIp === "string" && connectingIp.trim()
    ? connectingIp.trim()
    : request.ip || "unknown";
  return source.slice(0, 160);
}

const config = await loadConfig();
const store = new FileSessionStore(config.runtimeDir);
await store.init();
const runner = new SessionRunner({ store, config });
await runner.recover();
const tokenVerifier = new FirebaseIdTokenVerifier({
  projectId: config.firebaseProjectId,
  administratorEmail: config.administratorEmail,
});
const demoAdministratorAuth = new DemoAdministratorAuth({
  passwordHash: config.demoAdministratorPasswordHash,
  sessionSecret: config.demoSessionSecret,
  administratorEmail: config.administratorEmail,
});
const demoLoginRateLimiter = new DemoLoginRateLimiter();
const accountSessionGate = new AccountSessionGate();

async function ownedSession(request, reply) {
  const { id } = request.params;
  if (!validSessionId(id)) {
    reply.code(400).send({ error: "Invalid session id." });
    return null;
  }
  const session = await store.get(id);
  if (!session || !canAccessSession(session, request.user)) {
    reply.code(404).send({ error: "Session not found." });
    return null;
  }
  return session;
}

function releaseWhenIdle(reservation, sessionId) {
  reservation.bind(sessionId);
  void runner.waitForIdle(sessionId).finally(() => reservation.release());
}

async function launchForViewer(request, session, launch) {
  const reservation = accountSessionGate.acquire(request.user, await store.recent(), {
    sessionId: session.id,
  });
  try {
    await launch();
    releaseWhenIdle(reservation, session.id);
  } catch (error) {
    reservation.release();
    throw error;
  }
}

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || "info" },
  bodyLimit: 48 * 1024,
});
app.addHook("onRequest", async (request, reply) => {
  reply.header("x-content-type-options", "nosniff");
  reply.header("x-frame-options", "DENY");
  reply.header("referrer-policy", "no-referrer");
  reply.header(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (request.url.startsWith("/api/"))
    reply.header("cache-control", "no-store");
});
app.addHook("preHandler", async (request) => {
  const path = requestPath(request);
  if (!path.startsWith("/api/")) return;
  if (path === "/api/auth/demo" || path === "/api/auth/logout") return;

  const token = bearerToken(request.headers.authorization);
  request.user = token
    ? await tokenVerifier.verifyIdToken(token)
    : demoAdministratorAuth.viewerFromHeaders(request.headers);
  if (request.user || path === "/api/auth/session") return;
  throw new FirebaseAuthError("Sign in to continue.");
});
app.setErrorHandler((error, _request, reply) => {
  const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
  if (statusCode >= 500) app.log.error(error);
  reply.code(statusCode).send({
    error: error.expose ? error.message : "The server could not complete that request.",
  });
});

app.get("/healthz", async () => ({
  ok: true,
  service: "agenticrocket",
  credentialsReady: config.credentialsReady,
  configurationMissing: config.configurationMissing,
  release: "evidence-v2",
}));

app.get("/api/auth/session", async (request) => ({
  viewer: publicViewer(request.user),
}));

app.post("/api/auth/demo", async (request, reply) => {
  if (!demoAdministratorAuth.configured) {
    return reply
      .code(503)
      .send({ error: "Administrator demo sign-in is not configured." });
  }

  const attemptKey = demoAttemptKey(request);
  const retryAfter = demoLoginRateLimiter.retryAfterSeconds(attemptKey);
  if (retryAfter) {
    return reply
      .code(429)
      .header("retry-after", String(retryAfter))
      .send({ error: "Too many administrator demo attempts. Please wait and try again." });
  }

  const accepted = await demoAdministratorAuth.accepts(request.body?.password);
  if (!accepted) {
    demoLoginRateLimiter.recordFailure(attemptKey);
    return reply.code(401).send({ error: "The administrator demo password is incorrect." });
  }

  demoLoginRateLimiter.clear(attemptKey);
  const token = demoAdministratorAuth.createSession();
  reply.header(
    "set-cookie",
    demoSessionCookie(token, { secure: config.demoCookieSecure }),
  );
  return { viewer: publicViewer(demoAdministratorAuth.viewer()) };
});

app.post("/api/auth/logout", async (_request, reply) => {
  reply.header(
    "set-cookie",
    expiredDemoSessionCookie({ secure: config.demoCookieSecure }),
  );
  return { ok: true };
});

app.get("/api/config", async (request) => {
  const sessions = await store.recent();
  return {
    repositoryUrl,
    model: config.model,
    credentialsReady: config.credentialsReady,
    configurationMissing: config.configurationMissing,
    activeSessionId: activeSessionForViewer(sessions, request.user)?.id || null,
    viewer: publicViewer(request.user),
    release: "evidence-v2",
  };
});

app.get("/api/sessions", async (request) => ({
  sessions: visibleSessions(await store.recent(), request.user).map(publicSession),
}));

app.post("/api/sessions", async (request, reply) => {
  let created;
  let reservation;
  try {
    if (!config.credentialsReady)
      return reply
        .code(503)
        .send({
          error:
            "Server credentials are not configured. See Connections for the missing settings.",
        });
    reservation = accountSessionGate.acquire(request.user, await store.recent());
    const body = request.body || {};
    const requestedRepository = ensureString(
      body.repositoryUrl || repositoryUrl,
      "repository URL",
      300,
    ).replace(/\.git$/, "");
    if (requestedRepository !== repositoryUrl)
      throw new Error(
        "Only the published AgenticRocket demo repository is available in this MVP.",
      );
    const goal = ensureString(body.goal, "goal", 1_000);
    const session = await store.create({
      repositoryUrl,
      goal,
      owner: sessionOwner(request.user),
    });
    created = session.id;
    await store.appendEvent(
      session.id,
      "session",
      "Session created. The agent will pin main before doing any work.",
    );
    await runner.start(session.id);
    releaseWhenIdle(reservation, session.id);
    reservation = null;
    return reply
      .code(201)
      .send({ session: publicSession(await store.get(session.id)) });
  } catch (error) {
    if (created)
      await store.mutate(created, async (draft) => {
        draft.status = "failed";
        draft.error = error.message;
      });
    return reply
      .code(error.statusCode || 400)
      .send({
        error:
          error instanceof Error ? error.message : "Could not create session.",
      });
  } finally {
    reservation?.release();
  }
});

app.get("/api/sessions/:id", async (request, reply) => {
  const session = await ownedSession(request, reply);
  if (!session) return reply;
  return { session: publicSession(session), active: runner.isActive(session.id) };
});

app.post("/api/sessions/:id/messages", async (request, reply) => {
  requireAgentChatAccess(request.user);
  const session = await ownedSession(request, reply);
  if (!session) return reply;
  try {
    const content = ensureString(request.body?.content, "message", 2_000);
    if (runner.isActive(session.id)) await runner.replyToFollowUp(session.id, content);
    else await launchForViewer(request, session, () => runner.replyToFollowUp(session.id, content));
    return reply
      .code(202)
      .send({ session: publicSession(await store.get(session.id)) });
  } catch (error) {
    return reply
      .code(
        error.statusCode || (error.message === "Session not found" ? 404 : 400),
      )
      .send({ error: error.message || "Could not send message." });
  }
});

app.post("/api/sessions/:id/cancel", async (request, reply) => {
  const session = await ownedSession(request, reply);
  if (!session) return reply;
  try {
    await runner.cancel(session.id);
    return { session: publicSession(await store.get(session.id)) };
  } catch {
    return reply.code(404).send({ error: "Session not found." });
  }
});

app.post("/api/sessions/:id/retry-verification", async (request, reply) => {
  const session = await ownedSession(request, reply);
  if (!session) return reply;
  if (!session.candidate?.plan)
    return reply
      .code(409)
      .send({
        error: "A frozen candidate is required before retrying verification.",
      });
  try {
    await launchForViewer(request, session, () => runner.retryVerification(session.id));
  } catch (error) {
    return reply.code(error.statusCode || 409).send({ error: error.message });
  }
  return reply.code(202).send({ session: publicSession(await store.get(session.id)) });
});

app.post("/api/sessions/:id/resume", async (request, reply) => {
  const session = await ownedSession(request, reply);
  if (!session) return reply;
  try {
    await launchForViewer(request, session, () => runner.resume(session.id));
    return reply
      .code(202)
      .send({ session: publicSession(await store.get(session.id)) });
  } catch (error) {
    return reply
      .code(
        error.statusCode || (error.message === "Session not found" ? 404 : 409),
      )
      .send({ error: error.message });
  }
});

app.post("/api/sessions/:id/prepare-pr", async (request, reply) => {
  const session = await ownedSession(request, reply);
  if (!session) return reply;
  if (
    !session?.candidate ||
    !session.verification ||
    session.verification.candidateFingerprint !==
      session.candidate.fingerprint ||
    session.verification.contract?.version !== "pulselog-v2"
  )
    return reply
      .code(409)
      .send({
        error:
          "Current-contract evidence matching the frozen candidate is required before preparing a PR.",
      });
  const verdict = session.verification.verdict;
  const title = `${verdict === "verified" ? "perf" : "chore"}: ${session.candidate.summary.slice(0, 88)}`;
  const body = [
    "## AgenticRocket evidence-backed candidate",
    "",
    session.candidate.summary,
    "",
    `- Baseline: \`${session.baselineSha}\``,
    `- Candidate fingerprint: \`${session.candidate.fingerprint}\``,
    `- Verdict: **${verdict}**`,
    `- Result: ${session.verification.reason}`,
    `- Metric: native ${session.verification.metric}; 3 paired sandboxes; full report attached in this session.`,
    "",
    "This is a prepared demo draft. No pull request was sent to the repository.",
  ].join("\n");
  await store.appendEvent(
    session.id,
    "artifact",
    "Pull request draft prepared from the immutable diff and verification evidence.",
  );
  return { draft: { title, body, state: "Draft prepared · Demo" } };
});

app.get("/api/sessions/:id/events", async (request, reply) => {
  const session = await ownedSession(request, reply);
  if (!session) return reply;
  const { id } = session;
  const after = Math.max(
    Number.parseInt(
      request.query?.after || request.headers["last-event-id"] || "0",
      10,
    ) || 0,
    0,
  );
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  let last = after;
  const emit = async () => {
    const current = await store.get(id);
    if (!current) return;
    for (const event of current.events.filter((item) => item.id > last)) {
      reply.raw.write(
        `id: ${event.id}\nevent: session\ndata: ${JSON.stringify(event)}\n\n`,
      );
      last = event.id;
    }
    reply.raw.write(
      `event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString(), status: current.status })}\n\n`,
    );
  };
  await emit();
  const timer = setInterval(() => {
    emit().catch(() => {});
  }, 1_500);
  request.raw.on("close", () => clearInterval(timer));
  return reply;
});

app.get(
  "/api/sessions/:id/artifacts/:artifactId/download",
  async (request, reply) => {
    const { id, artifactId } = request.params;
    if (!validSessionId(id) || !validSessionId(artifactId))
      return reply.code(400).send({ error: "Invalid artifact request." });
    const session = await store.get(id);
    if (!session || !canAccessSession(session, request.user))
      return reply.code(404).send({ error: "Artifact not found." });
    const artifact = await store.getArtifact(id, artifactId);
    if (!artifact)
      return reply.code(404).send({ error: "Artifact not found." });
    try {
      const { data } = await store.readArtifact(id, artifactId);
      reply
        .type(artifact.contentType)
        .header(
          "content-disposition",
          `attachment; filename="${artifact.filename}"`,
        );
      return reply.send(data);
    } catch {
      return reply
        .code(410)
        .send({ error: "Artifact record exists but its file is unavailable." });
    }
  },
);

// Resolve hashed assets at request time, including bundles from a newer build.
await app.register(fastifyStatic, {
  root: clientRoot,
  prefix: "/",
  wildcard: true,
  decorateReply: true,
});
app.setNotFoundHandler(async (request, reply) => {
  if (
    request.url.startsWith("/api/") ||
    request.url.startsWith("/assets/") ||
    request.method !== "GET"
  ) {
    return reply.code(404).send({ error: "Resource not found." });
  }
  return reply.sendFile("index.html");
});

await app.listen({ host: config.host, port: config.port });
