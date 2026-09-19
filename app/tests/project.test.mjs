import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertSameOutput,
  assertSourceOnly,
  CorrectnessError,
  fingerprint,
  parseBenchmark,
  rawOutput,
} from "../server/lib/project.mjs";

test("uses the fixed workload's native median and exact checksum, not process elapsed time", () => {
  const output =
    "records=6000\niterations=3\nmedian_ms=6.329\nmean_ms=6.5\nchecksum=18446744073709551615\n__elapsed=50\n";
  const benchmark = parseBenchmark(output);

  assert.equal(benchmark.milliseconds, 6.329);
  assert.equal(benchmark.checksum, "18446744073709551615");
  assertSameOutput(benchmark, { ...benchmark });
  assert.throws(
    () => assertSameOutput(benchmark, { ...benchmark, checksum: "999" }),
    CorrectnessError,
  );
  for (const invalid of [
    output.replace("median_ms=6.329\n", ""),
    output.replace("records=6000", "records=1"),
  ]) {
    assert.throws(() => parseBenchmark(invalid), /fixed workload/);
  }
});

test("freezes tests, benchmark, and build configuration while allowing tracked implementation files", () => {
  assert.deepEqual(
    assertSourceOnly("src/analyzer.cpp\ninclude/pulselog/analyzer.hpp\n"),
    ["src/analyzer.cpp", "include/pulselog/analyzer.hpp"],
  );
  for (const protectedPath of [
    "tests/test_analyzer.cpp",
    "bench/benchmark.cpp",
    "CMakeLists.txt",
    "package.json",
    "src/../tests/test_analyzer.cpp",
  ]) {
    assert.throws(
      () => assertSourceOnly(`src/analyzer.cpp\n${protectedPath}\n`),
      CorrectnessError,
      protectedPath,
    );
  }
  assert.throws(
    () => assertSourceOnly("src/analyzer.cpp\n", ["injected.cpp"]),
    CorrectnessError,
  );
  assert.throws(() => assertSourceOnly(""), /no source change/);
});

test("preserves patch bytes and the final newline through output/base64 transport and real git apply", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agenticrocket-patch-"));
  const original = "int value() {\n  return 1;\n}\n";
  const candidate = original.replace("return 1", "return 2");
  const source = join(directory, "source.cpp");
  const git = (...args) => execFileSync("git", args, { cwd: directory });
  try {
    git("init", "--quiet");
    await writeFile(source, original);
    git("add", "source.cpp");
    await writeFile(source, candidate);
    const patch = git("diff", "--binary", "--no-ext-diff");
    const transported = Buffer.from(
      rawOutput({ stdout: patch.toString("base64") }).trim(),
      "base64",
    );

    assert.deepEqual(transported, patch);
    assert.equal(transported.at(-1), 10);
    assert.equal(fingerprint(transported), fingerprint(patch));
    assert.equal(
      rawOutput({ stdout: patch.toString("utf8") }),
      patch.toString("utf8"),
    );
    await writeFile(source, original);
    const invalid = spawnSync("git", ["apply", "--check", "-"], {
      cwd: directory,
      input: patch.toString("utf8").trim(),
    });
    assert.notEqual(
      invalid.status,
      0,
      "The regression fixture must detect stripped patch newlines",
    );
    execFileSync("git", ["apply", "--check", "-"], {
      cwd: directory,
      input: transported,
    });
    execFileSync("git", ["apply", "-"], { cwd: directory, input: transported });
    assert.equal(await readFile(source, "utf8"), candidate);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
