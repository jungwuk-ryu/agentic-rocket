import { createHash } from "node:crypto";

export const REPOSITORY_URL = "https://github.com/jungwuk-ryu/agenticrocket-demo-perf";
export const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
export const fingerprint = (value) => createHash("sha256").update(value).digest("hex");
export const rawOutput = (result) => String(result?.stdout ?? result?.artifacts?.stdout ?? result?.output ?? result?.result ?? "");

// One repository adapter, with a service-owned measurement contract.
const buildDirectory = ".agenticrocket-build";
const compiler = "g++ -std=c++17 -O3 -Wall -Wextra -Wpedantic -Iinclude";
export const PROJECT_CONTRACT = Object.freeze({
  version: "pulselog-v2",
  buildCommand: [
    `mkdir -p ${buildDirectory}`,
    `${compiler} src/analyzer.cpp src/main.cpp -o ${buildDirectory}/pulselog_cli`,
    `${compiler} src/analyzer.cpp tests/test_analyzer.cpp -o ${buildDirectory}/pulselog_tests`,
    `${compiler} src/analyzer.cpp bench/benchmark.cpp -o ${buildDirectory}/pulselog_bench`,
  ].join(" && "),
  testCommand: `./${buildDirectory}/pulselog_tests`,
  benchmarkCommand: `./${buildDirectory}/pulselog_bench 6000 3`,
  outputCommand: `./${buildDirectory}/pulselog_bench 6000 3`,
  metric: "median_ms", records: 6000, iterations: 3, warmupRuns: 1, sampleRuns: 3,
  order: ["baseline", "candidate", "candidate", "baseline", "baseline", "candidate"],
});
export const ENVIRONMENT_COMMAND = [
  "g++ --version | head -1", "uname -sm",
  "for f in /sys/fs/cgroup/cpu.max /sys/fs/cgroup/memory.max /sys/fs/cgroup/cpuset.cpus.effective; do if [ -r \"$f\" ]; then printf '%s=' \"$f\"; cat \"$f\"; fi; done",
].join("; ");

export class CorrectnessError extends Error {
  constructor(message) { super(message); this.name = "CorrectnessError"; }
}

export function parseBenchmark(output, contract = PROJECT_CONTRACT) {
  const fields = Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
    const match = line.trim().match(/^(records|iterations|median_ms|mean_ms|checksum)=([0-9]+(?:\.[0-9]+)?)$/);
    return match ? [[match[1], match[2]]] : [];
  }));
  const milliseconds = Number(fields.median_ms);
  if (Number(fields.records) !== contract.records || Number(fields.iterations) !== contract.iterations
      || !fields.checksum || !Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error("Benchmark did not produce the fixed workload, native median_ms, and checksum.");
  }
  return { milliseconds, checksum: fields.checksum, records: contract.records, iterations: contract.iterations };
}

export function assertSameOutput(baseline, candidate) {
  if (baseline.checksum !== candidate.checksum) {
    throw new CorrectnessError(`Benchmark checksum mismatch: baseline=${baseline.checksum}, candidate=${candidate.checksum}`);
  }
}

export function assertSourceOnly(changedFiles, untrackedFiles = []) {
  const paths = changedFiles.split(/\r?\n/).filter(Boolean);
  if (!paths.length) throw new Error("There is no source change to freeze.");
  const invalid = paths.filter((path) => !/^(src\/[^/]+\.cpp|include\/pulselog\/[^/]+\.hpp)$/.test(path));
  const untrackedSource = untrackedFiles.filter((path) => !path.startsWith(`${buildDirectory}/`) && /\.(?:c|cc|cpp|h|hpp)$/.test(path));
  if (invalid.length || untrackedSource.length) {
    throw new CorrectnessError(`The frozen contract forbids changes to tests, benchmark, build configuration, or untracked source: ${[...invalid, ...untrackedSource].join(", ")}`);
  }
  return paths;
}

export async function uploadText(sandbox, path, content, workDir) {
  try {
    await sandbox.fs.uploadFile(Buffer.from(content, "utf8"), path, 60);
  } catch {
    // Byte-preserving fallback for ESM SDK builds without multipart support.
    const encoded = Buffer.from(content, "utf8").toString("base64");
    const result = await sandbox.process.executeCommand(
      `printf %s ${shellQuote(encoded)} | base64 -d > ${shellQuote(`${path}.tmp`)} && mv ${shellQuote(`${path}.tmp`)} ${shellQuote(path)}`,
      workDir, undefined, 60,
    );
    if (result.exitCode !== 0) throw new Error(`Could not transport artifact: ${rawOutput(result).slice(-500)}`);
  }
}
