import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const defaultDaytonaKeyFile = resolve(process.cwd(), "..", "DAYTONA_KEY");

async function readOptionalTrimmed(path) {
  if (!path) return undefined;
  try {
    const value = (await readFile(path, "utf8")).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

export async function loadConfig() {
  const daytonaKeyFile = process.env.DAYTONA_API_KEY_FILE || defaultDaytonaKeyFile;
  const daytonaApiKey = process.env.DAYTONA_API_KEY || (await readOptionalTrimmed(daytonaKeyFile));
  const proxyApiKey = process.env.CLI_PROXY_API_KEY?.trim();

  return {
    host: process.env.HOST || "127.0.0.1",
    port: Number.parseInt(process.env.PORT || "8761", 10),
    proxyBaseUrl: (process.env.CLI_PROXY_BASE_URL || "http://127.0.0.1:8317/v1").replace(/\/$/, ""),
    proxyApiKey,
    model: process.env.OPENAI_MODEL || process.env.CLI_PROXY_MODEL || "gpt-5.6-terra",
    daytonaApiKey,
    daytonaKeyFile,
    runtimeDir: resolve(process.env.AGENTICROCKET_DATA_DIR || resolve(process.cwd(), "runtime")),
    contextSoftLimit: Math.max(2_000, Number(process.env.CONTEXT_SOFT_TOKENS) || 240_000),
    maxAgentTurns: Math.max(4, Number(process.env.MAX_AGENT_TURNS) || 36),
    credentialsReady: Boolean(proxyApiKey && daytonaApiKey),
    configurationMissing: [
      ...(proxyApiKey ? [] : ["CLI_PROXY_API_KEY"]),
      ...(daytonaApiKey ? [] : ["DAYTONA_API_KEY or DAYTONA_API_KEY_FILE"]),
    ],
  };
}
