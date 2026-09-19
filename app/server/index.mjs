import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./lib/config.mjs";
import { FileSessionStore } from "./lib/store.mjs";
import { SessionRunner } from "./lib/runner.mjs";

const repositoryUrl = "https://github.com/jungwuk-ryu/agenticrocket-demo-perf";
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(__dirname, "..", "dist", "client");
const validSessionId = (value) => /^[a-f0-9-]{36}$/i.test(value || "");

function publicSession(session) {
  if (!session) return null;
  const { agentHistory, ...visible } = session;
  return visible;
}

function ensureString(value, field, maxLength = 4_000) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) throw new Error(`Invalid ${field}.`);
  return value.trim();
}

const config = await loadConfig();
const store = new FileSessionStore(config.runtimeDir);
await store.init();
const runner = new SessionRunner({ store, config });

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" }, bodyLimit: 48 * 1024 });
app.addHook("onRequest", async (request, reply) => {
  reply.header("x-content-type-options", "nosniff");
  reply.header("x-frame-options", "DENY");
  reply.header("referrer-policy", "no-referrer");
  reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (request.url.startsWith("/api/")) reply.header("cache-control", "no-store");
});

app.get("/healthz", async () => ({
  ok: true,
  service: "agenticrocket",
  credentialsReady: config.credentialsReady,
  configurationMissing: config.configurationMissing,
}));

app.get("/api/config", async () => ({
  repositoryUrl,
  model: config.model,
  credentialsReady: config.credentialsReady,
  configurationMissing: config.configurationMissing,
}));

app.get("/api/sessions", async () => ({ sessions: (await store.recent()).map(publicSession) }));

app.post("/api/sessions", async (request, reply) => {
  try {
    const body = request.body || {};
    const requestedRepository = ensureString(body.repositoryUrl || repositoryUrl, "repository URL", 300).replace(/\.git$/, "");
    if (requestedRepository !== repositoryUrl) throw new Error("Only the published AgenticRocket demo repository is available in this MVP.");
    const goal = ensureString(body.goal, "goal", 1_000);
    const session = await store.create({ repositoryUrl, goal });
    await store.appendEvent(session.id, "session", "Session created. The agent will pin main before doing any work.");
    runner.start(session.id);
    return reply.code(201).send({ session: publicSession(await store.get(session.id)) });
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : "Could not create session." });
  }
});

app.get("/api/sessions/:id", async (request, reply) => {
  const { id } = request.params;
  if (!validSessionId(id)) return reply.code(400).send({ error: "Invalid session id." });
  const session = await store.get(id);
  return session ? { session: publicSession(session), active: runner.isActive(id) } : reply.code(404).send({ error: "Session not found." });
});

app.post("/api/sessions/:id/messages", async (request, reply) => {
  const { id } = request.params;
  if (!validSessionId(id)) return reply.code(400).send({ error: "Invalid session id." });
  try {
    const content = ensureString(request.body?.content, "message", 2_000);
    await runner.replyToFollowUp(id, content);
    return reply.code(202).send({ session: publicSession(await store.get(id)) });
  } catch (error) {
    return reply.code(error instanceof Error && error.message === "Session not found" ? 404 : 400).send({ error: error instanceof Error ? error.message : "Could not send message." });
  }
});

app.post("/api/sessions/:id/cancel", async (request, reply) => {
  const { id } = request.params;
  if (!validSessionId(id)) return reply.code(400).send({ error: "Invalid session id." });
  try {
    await runner.cancel(id);
    return { session: publicSession(await store.get(id)) };
  } catch {
    return reply.code(404).send({ error: "Session not found." });
  }
});

app.post("/api/sessions/:id/retry-verification", async (request, reply) => {
  const { id } = request.params;
  if (!validSessionId(id)) return reply.code(400).send({ error: "Invalid session id." });
  const session = await store.get(id);
  if (!session?.candidate?.plan) return reply.code(409).send({ error: "A frozen candidate is required before retrying verification." });
  if (!runner.retryVerification(id)) return reply.code(409).send({ error: "This session already has an active operation." });
  return reply.code(202).send({ session: publicSession(await store.get(id)) });
});

app.post("/api/sessions/:id/prepare-pr", async (request, reply) => {
  const { id } = request.params;
  if (!validSessionId(id)) return reply.code(400).send({ error: "Invalid session id." });
  const session = await store.get(id);
  if (!session?.candidate || !session.verification) return reply.code(409).send({ error: "A candidate and verification result are required before preparing a PR." });
  const verdict = session.verification.verdict;
  const title = `${verdict === "verified" ? "perf" : "chore"}: ${session.candidate.summary.slice(0, 88)}`;
  const body = [
    "## AgenticRocket evidence-backed candidate",
    "",
    `- Baseline: \`${session.baselineSha}\``,
    `- Candidate fingerprint: \`${session.candidate.fingerprint}\``,
    `- Verdict: **${verdict}**`,
    `- Result: ${session.verification.reason}`,
    "",
    "This is a prepared demo draft. No pull request was sent to the repository.",
  ].join("\n");
  await store.appendEvent(id, "artifact", "Pull request draft prepared from the immutable diff and verification evidence.");
  return { draft: { title, body, state: "Draft prepared · Demo" } };
});

app.get("/api/sessions/:id/events", async (request, reply) => {
  const { id } = request.params;
  if (!validSessionId(id) || !(await store.get(id))) return reply.code(404).send({ error: "Session not found." });
  const after = Math.max(Number.parseInt(request.query?.after || request.headers["last-event-id"] || "0", 10) || 0, 0);
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  let last = after;
  const emit = async () => {
    const session = await store.get(id);
    if (!session) return;
    for (const event of session.events.filter((item) => item.id > last)) {
      reply.raw.write(`id: ${event.id}\nevent: session\ndata: ${JSON.stringify(event)}\n\n`);
      last = event.id;
    }
    reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString(), status: session.status })}\n\n`);
  };
  await emit();
  const timer = setInterval(() => { emit().catch(() => {}); }, 1_500);
  request.raw.on("close", () => clearInterval(timer));
  return reply;
});

app.get("/api/sessions/:id/artifacts/:artifactId/download", async (request, reply) => {
  const { id, artifactId } = request.params;
  if (!validSessionId(id) || !validSessionId(artifactId)) return reply.code(400).send({ error: "Invalid artifact request." });
  const artifact = await store.getArtifact(id, artifactId);
  if (!artifact) return reply.code(404).send({ error: "Artifact not found." });
  try {
    await access(artifact.path);
    reply.type(artifact.contentType).header("content-disposition", `attachment; filename="${artifact.filename}"`);
    return reply.send(createReadStream(artifact.path));
  } catch {
    return reply.code(410).send({ error: "Artifact record exists but its file is unavailable." });
  }
});

await app.register(fastifyStatic, { root: clientRoot, prefix: "/", wildcard: false, decorateReply: true });
app.get("/*", async (_request, reply) => reply.sendFile("index.html"));

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500).send({ error: "The server could not complete that request." });
});

await app.listen({ host: config.host, port: config.port });
