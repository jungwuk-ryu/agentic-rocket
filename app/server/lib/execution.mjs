import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { shellQuote, rawOutput } from "./project.mjs";

export function checkCancelled(signal) {
  if (signal?.aborted) throw new DOMException("Session cancelled", "AbortError");
}

// A distinct remote process session per command makes ambiguous submissions
// inspectable after a disconnect, without issuing the command a second time.
export class SandboxExecutor {
  constructor(store) { this.store = store; }

  async run(sessionId, sandbox, command, cwd, { signal, timeout = 300, label = "command" } = {}) {
    checkCancelled(signal);
    const id = randomUUID();
    const processSessionId = `ar-${id}`;
    const wrapped = `cd ${shellQuote(cwd)} && ${command}`;
    const record = { id, sandboxId: sandbox.id, processSessionId, command: wrapped, label, cwd, status: "submitting", startedAt: new Date().toISOString(), timeout };
    await this.store.mutate(sessionId, async (draft) => { (draft.commands ||= []).push(record); });
    await sandbox.process.createSession(processSessionId);
    try {
      checkCancelled(signal);
      const submitted = await sandbox.process.executeSessionCommand(processSessionId, { command: wrapped, runAsync: true, suppressInputEcho: true }, 30);
      if (!submitted.cmdId) throw new Error("Daytona did not return a command id; inspect the persisted remote process session before retrying.");
      await this.update(sessionId, id, { commandId: submitted.cmdId, status: "running" });
      return await this.collect(sessionId, sandbox, { ...record, commandId: submitted.cmdId }, signal);
    } catch (error) {
      await this.update(sessionId, id, { status: signal?.aborted ? "cancelled" : "needs-inspection", error: error.message });
      if (signal?.aborted) await sandbox.process.deleteSession(processSessionId).catch(() => {});
      throw error;
    }
  }

  async collect(sessionId, sandbox, record, signal) {
    const deadline = new Date(record.startedAt).getTime() + record.timeout * 1000;
    for (;;) {
      checkCancelled(signal);
      const state = await sandbox.process.getSessionCommand(record.processSessionId, record.commandId);
      if (Number.isInteger(state.exitCode)) {
        const logs = await sandbox.process.getSessionCommandLogs(record.processSessionId, record.commandId);
        const stdout = rawOutput(logs);
        const stderr = String(logs.stderr || "");
        const artifact = await this.store.writeArtifact(sessionId, `${record.label}-${record.id}.json`, JSON.stringify({ ...record, exitCode: state.exitCode, stdout, stderr }, null, 2), "application/json");
        await this.update(sessionId, record.id, { status: "completed", exitCode: state.exitCode, logArtifactId: artifact.id, completedAt: new Date().toISOString() });
        await sandbox.process.deleteSession(record.processSessionId).catch(() => {});
        checkCancelled(signal);
        return { exitCode: state.exitCode, stdout, stderr, logArtifactId: artifact.id, commandId: record.commandId };
      }
      if (Date.now() >= deadline) {
        await sandbox.process.deleteSession(record.processSessionId).catch(() => {});
        throw new Error(`Command timed out after ${record.timeout}s: ${record.label}`);
      }
      await delay(350, undefined, { signal });
    }
  }

  async inspect(sessionId, sandbox, record) {
    if (!record.commandId) {
      const remote = await sandbox.process.getSession(record.processSessionId);
      const commands = remote.commands || [];
      if (commands.length !== 1) throw new Error("Remote submission is ambiguous; no command was retried.");
      record = { ...record, commandId: commands[0].id };
      await this.update(sessionId, record.id, { commandId: record.commandId });
    }
    return this.collect(sessionId, sandbox, record);
  }

  async update(sessionId, id, values) {
    await this.store.mutate(sessionId, async (draft) => {
      const record = draft.commands.find((item) => item.id === id);
      if (record) Object.assign(record, values);
    });
  }
}
