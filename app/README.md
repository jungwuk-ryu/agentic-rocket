# AgenticRocket

AgenticRocket is an evidence-first optimization workspace for the published
`jungwuk-ryu/agenticrocket-demo-perf` project. One persistent project agent
reads and changes code in a Daytona work sandbox, freezes a candidate patch,
then compares baseline and candidate inside three separate paired benchmark
sandboxes.

## Design and runtime

- React/Vite client with Firebase Google sign-in, authenticated workspace polling,
  diff, artifacts, verification evidence, PR draft preparation, and persistent
  follow-up messages.
- Fastify server bound to localhost. Checkpoints, event history, artifact hashes,
  candidates, remote process/command IDs, and sandbox IDs are written atomically
  under `runtime/`. Startup reloads disk records and marks unfinished operations
  `interrupted`; Resume inspects the recorded remote execution before new work.
- Chat Completions loop against the existing OpenAI-compatible cli-proxy using
  `gpt-5.6-terra`; the application deliberately rebuilds retained history
  rather than relying on unsupported Responses continuation.
- `@daytona/sdk` owns every repository clone, code change, build, test, and
  benchmark command. The browser never receives a proxy or Daytona credential.
- The verdict function is deterministic and labels results `verified`,
  `rejected`, or `inconclusive`. It requires three valid paired runs and
  applies a pre-declared, noise-aware threshold.

The UI includes Home, saved Sessions, Benchmarks, an Evidence library, and
Connections. Hash routes survive refresh and browser back/forward. Historic
results without the current verification contract remain downloadable but are
not presented as verified improvements.

## Verification contract

`server/lib/project.mjs` owns the PulseLog adapter, not the model. Only tracked
implementation changes under `src/*.cpp` and `include/pulselog/*.hpp` can be
frozen. Tests, benchmark, build settings and workload are fixed.

- Baseline: pinned commit, direct C++17 `g++ -O3` builds, existing tests,
  deterministic CLI fixture, and baseline calibration before candidate creation.
- Patch: binary Git diff transported as base64 without altering its bytes;
  application checks and SHA-256 connect the download to the measured candidate.
- Timing: benchmark-native `median_ms` for 6,000 records / 3 internal iterations,
  never process startup, input generation, network or model latency.
- Each of three fresh sandboxes builds/tests both revisions, compares exact CLI
  output and every benchmark checksum, warms both sides, then executes
  **baseline, candidate, candidate, baseline, baseline, candidate**.
- Per-side representative time is the mean of three native medians. Aggregate
  latency reduction is the mean of the three sandbox percentage reductions.
- Fixed policy: minimum 2% reduction; minimum three samples/side; baseline and
  candidate coefficient of variation at most 8%. Each meaningful-effect threshold
  is `max(2%, 1.5 × max(baseline CV, candidate CV, calibration CV))`. Calibration
  CV must also be at most 8%. The policy and calibration are saved before editing.
- Correctness failures reject a candidate. Infrastructure failures, missing
  checks, excessive noise, and conflicting environments are inconclusive.

Every attempt is retained. Remeasurement does not replace the prior report or
change the frozen patch. Separate sandboxes do not establish physical-host
independence; passing checks is evidence only for the tested inputs.

## Persistence and lifecycle

Sessions are owned by the Firebase UID that created them. Ordinary Google
accounts are limited to one active session; the configured administrator account
is exempt from that limit but does not receive access to another user's session.
Follow-up messages retain the conversation,
actual patch and measurement evidence; requests to remeasure or continue editing
invoke execution tools. Instructions arriving during analysis enter at the next
completed tool boundary. A failed follow-up is not retried forever.

Cancellation aborts model requests, terminates remote process sessions and checks
the cancellation signal before later work or final publication. Benchmark
sandboxes are deleted after logs are saved, including on failure. Work sandboxes
are stopped and retained for continuation. Cleanup errors remain visible.

Full command stdout/stderr and conversation archives are artifacts. The model
receives bounded previews and can retrieve additional ranges with `read_artifact`.
Compaction defaults to a configurable 240,000 estimated tokens, not a message-count
cutoff; checkpoints and complete tool-call/result boundaries survive compaction.

## Server configuration

Copy no credentials into this repository. The server requires:

```sh
CLI_PROXY_API_KEY=...
CLI_PROXY_BASE_URL=http://127.0.0.1:8317/v1
DAYTONA_API_KEY_FILE=../DAYTONA_KEY
HOST=127.0.0.1
PORT=8761
CONTEXT_SOFT_TOKENS=240000
MAX_AGENT_TURNS=36
FIREBASE_PROJECT_ID=daytona-70675
AGENTICROCKET_ADMIN_EMAIL=vojougae35@gmail.com
```

When a credential is absent, Connections says **Configuration required** and does
not create an external sandbox. This is intentional: it never pretends an
unstarted model run is evidence. **Connections configured** means server settings
exist, not that a provider request has succeeded. Earlier configuration failures
remain historical session records and do not override current configuration.

## Run and verify

Use Node.js 22 or newer (the deployed service runs Node.js 24).

```sh
npm install
npm run build
npm test
npm run test:sites
npm run start
```

The supplied user service is at
`deploy/agenticrocket.service`. It uses `deploy/start-agenticrocket.sh`,
is bound to 127.0.0.1:8761, has restricted temporary-file access, and is meant
to be reached through the existing Cloudflare Tunnel.
Inject secrets with a restrictive external environment file; do not put them in
shell history, the client bundle or repository. The local service uses
`/home/ubuntu/.config/agenticrocket/runtime.env`.

Enable **Google** in Firebase Authentication and add the deployed hostname (and
the local development host, when needed) to Firebase's Authorized domains. The
server validates Firebase ID tokens against Google's signing certificates; the
web configuration in `.env.example` is public Firebase configuration, not a
server credential. Keep `FIREBASE_PROJECT_ID` and `VITE_FIREBASE_PROJECT_ID`
aligned if you override the supplied project.

## Demo sequence

1. Enter an objective and select **Optimize this project**.
2. Watch the same session pin `main`, create the work sandbox, inspect source,
   and record the agent's tool events.
3. Inspect the frozen candidate fingerprint and real diff.
4. Open each sandbox's paired timing and the verdict. Failed, noisy, and missing
   measurements stay visible.
5. Download the exact patch/report and select **Prepare PR** for a demo-only,
   evidence-backed draft. No GitHub pull request is submitted.
6. Ask “이 패치로 다시 측정해줘” in the composer: three new measurements run with
   the same fingerprint and policy, then the answer appears in the conversation.
7. Cancel an operation, or resume an interrupted/failed session. Reopening the
   URL does not start a second execution.

## Checked release

The `evidence-v2` release is served at [jungwuk.jungwuk.com](https://jungwuk.jungwuk.com).
The focused suite has 23 tests, including Firebase token validation, account-session
admission, byte-preserving real Git patch application,
checksum rejection, noisy/mixed verdicts, disk reload, cancellation, tool-backed
follow-ups and forced compaction. Provider calls in unit tests are mocked; those
tests are not a substitute for the real Daytona evidence described in
[the release verification record](docs/verification-2026-09-19.md).
