# AgenticRocket

AgenticRocket is an evidence-first optimization workspace for the published
`jungwuk-ryu/agenticrocket-demo-perf` project. One persistent project agent
reads and changes code in a Daytona work sandbox, freezes a candidate patch,
then compares baseline and candidate inside three separate paired benchmark
sandboxes.

## Design and runtime

- React/Vite client with an SSE-driven workspace, diff, artifacts, verification
  evidence, PR draft preparation, and persistent follow-up messages.
- Fastify server bound to localhost. Checkpoints, event history, artifact hashes,
  candidates, and sandbox IDs are written atomically under `runtime/`.
- Chat Completions loop against the existing OpenAI-compatible cli-proxy using
  `gpt-5.6-terra`; the application deliberately rebuilds retained history
  rather than relying on unsupported Responses continuation.
- `@daytona/sdk` owns every repository clone, code change, build, test, and
  benchmark command. The browser never receives a proxy or Daytona credential.
- The verdict function is deterministic and labels results `verified`,
  `rejected`, or `inconclusive`. It requires three valid paired runs and
  applies a pre-declared, noise-aware threshold.

## Server configuration

Copy no credentials into this repository. The server requires:

```sh
CLI_PROXY_API_KEY=...
CLI_PROXY_BASE_URL=http://127.0.0.1:8317/v1
DAYTONA_API_KEY_FILE=../DAYTONA_KEY
HOST=127.0.0.1
PORT=8761
```

When a credential is absent, the UI says **Configuration required** and does
not create an external sandbox. This is intentional: it never pretends an
unstarted model run is evidence.

## Run and verify

```sh
npm install
npm run build
npm test
npm run test:sites
CLI_PROXY_API_KEY=... npm run start
```

The supplied user service is at
`deploy/agenticrocket.service`. It uses `deploy/start-agenticrocket.sh`,
is bound to 127.0.0.1:8761, has restricted temporary-file access, and is meant
to be reached through the existing Cloudflare Tunnel.

## Demo sequence

1. Enter an objective and select **Optimize this project**.
2. Watch the same session pin `main`, create the work sandbox, inspect source,
   and record the agent's tool events.
3. Inspect the frozen candidate fingerprint and real diff.
4. Open each sandbox's paired timing and the verdict. Failed, noisy, and missing
   measurements stay visible.
5. Download the exact patch/report and select **Prepare PR** for a demo-only,
   evidence-backed draft. No GitHub pull request is submitted.
6. Ask a follow-up in the bottom composer; its answer uses the persisted
   session evidence.
