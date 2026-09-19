import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const clone = (value) => JSON.parse(JSON.stringify(value));

export class FileSessionStore {
  #root;
  #sessions = new Map();
  #mutationQueues = new Map();

  constructor(root) {
    this.#root = root;
  }

  async init() {
    await mkdir(this.sessionsDirectory, { recursive: true });
    await mkdir(this.artifactsDirectory, { recursive: true });
    for (const file of await readdir(this.sessionsDirectory)) {
      if (/^[a-f0-9-]{36}\.json$/i.test(file)) await this.get(file.slice(0, -5));
    }
  }

  get sessionsDirectory() { return join(this.#root, "sessions"); }
  get artifactsDirectory() { return join(this.#root, "artifacts"); }

  async create({ repositoryUrl, goal }) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const session = {
      id,
      repositoryUrl,
      goal,
      createdAt: now,
      updatedAt: now,
      status: "queued",
      phase: "queued",
      sequence: 0,
      events: [],
      checkpoints: [],
      agentHistory: [],
      sandboxes: [],
      artifacts: [],
      verification: null,
      candidate: null,
      messages: [],
      pendingMessages: [],
      commands: [],
      verificationHistory: [],
      error: null,
    };
    this.#sessions.set(id, session);
    await this.#persist(session);
    return clone(session);
  }

  async get(id) {
    if (this.#sessions.has(id)) return clone(this.#sessions.get(id));
    const file = this.#sessionPath(id);
    try {
      const session = JSON.parse(await readFile(file, "utf8"));
      this.#sessions.set(id, session);
      return clone(session);
    } catch {
      return null;
    }
  }

  async recent() {
    return [...this.#sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);
  }

  async mutate(id, change) {
    const previous = this.#mutationQueues.get(id) || Promise.resolve();
    let release;
    const completion = new Promise((resolve) => { release = resolve; });
    const queued = previous.then(() => completion);
    this.#mutationQueues.set(id, queued);
    await previous;
    try {
      const session = this.#sessions.get(id) || await this.get(id);
      if (!session) throw new Error("Session not found");
      const next = clone(this.#sessions.get(id));
      await change(next);
      next.updatedAt = new Date().toISOString();
      await this.#persist(next);
      this.#sessions.set(id, next);
      return clone(next);
    } finally {
      release();
      if (this.#mutationQueues.get(id) === queued) this.#mutationQueues.delete(id);
    }
  }

  async appendEvent(id, type, summary, details = {}) {
    return this.mutate(id, async (session) => {
      session.sequence += 1;
      session.events.push({ id: session.sequence, at: new Date().toISOString(), type, summary, details });
      if (session.events.length > 250) session.events = session.events.slice(-250);
    });
  }

  async checkpoint(id, reason) {
    return this.mutate(id, async (session) => {
      session.checkpoints.push({
        at: new Date().toISOString(),
        reason,
        baselineSha: session.baselineSha || null,
        candidateFingerprint: session.candidate?.fingerprint || null,
        activeSandboxIds: session.sandboxes.map((sandbox) => sandbox.id),
        nextAction: session.nextAction || null,
        workspace: session.workspace || null,
        contract: session.contract || null,
        policy: session.policy || null,
        constraints: session.messages.filter((message) => message.role === "user").slice(-12),
        commands: (session.commands || []).filter((command) => command.status !== "completed"),
        failures: session.events.filter((event) => /error|failure/.test(event.type)).slice(-8),
      });
      session.checkpoints = session.checkpoints.slice(-12);
    });
  }

  async writeArtifact(sessionId, filename, content, contentType) {
    const safeName = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const hash = createHash("sha256").update(body).digest("hex");
    const id = randomUUID();
    const directory = resolve(this.artifactsDirectory, sessionId);
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${id}-${safeName}`);
    await writeFile(path, body, { mode: 0o600 });
    const artifact = { id, filename: safeName, path, hash, contentType, bytes: body.length, createdAt: new Date().toISOString() };
    await this.mutate(sessionId, async (session) => { session.artifacts.push(artifact); });
    return artifact;
  }

  async getArtifact(sessionId, artifactId) {
    const session = await this.get(sessionId);
    return session?.artifacts.find((artifact) => artifact.id === artifactId) || null;
  }

  async readArtifact(sessionId, artifactId) {
    const artifact = await this.getArtifact(sessionId, artifactId);
    if (!artifact) throw new Error("Artifact not found");
    const data = await readFile(artifact.path);
    if (createHash("sha256").update(data).digest("hex") !== artifact.hash) throw new Error("Artifact fingerprint mismatch");
    return { artifact, data };
  }

  #sessionPath(id) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid session id");
    return join(this.sessionsDirectory, `${id}.json`);
  }

  async #persist(session) {
    const target = this.#sessionPath(session.id);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(session, null, 2), { mode: 0o600 });
    await rename(temporary, target);
  }
}
