# AgenticRocket UI Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

## Priority: functionality first

The user's latest direction (2026-09-19) prioritizes functional completeness, correctness, reliable recovery, and real end-to-end verification over matching Product Design. Treat visual references as guidance, not a release gate. Change presentation when needed for usability; do not delay essential fixes or deployment for visual polish. With the final ten-minute deadline, fix only release-critical issues and use focused verification rather than expanding features or the test suite.

## Accepted product decisions

- Use selected design direction 1 as a secondary styling reference where compatible with functionality: dark navy workspace, restrained lime actions, and evidence-led information hierarchy.
- Graphics and animation should feel like a modern SaaS product: use restrained, precise motion across pages, architectural graphics, subtle hover light, and smooth navigation. Avoid novelty effects or theatrical copy. Honor reduced motion, provide a pause control, and keep decorative graphics distinct from real measurement and provider status.
- Home must remain accessible from every session. Use durable hash routes so refresh and browser back preserve navigation.
- Every visible navigation item must lead to a real, useful page. Sessions, Benchmarks, Evidence, and Connections use actual server records; never add decorative search or dead settings links.
- Distinguish current server configuration from historical session failures. Do not reopen an old session automatically from local storage on a home visit.
- Show the conversation, concrete failure reason, recovery action, and operation controls in the session workspace.
- Bind displayed sandboxes to attempt IDs and actual sandbox IDs, never asynchronous array order. Bind the current report to the current candidate fingerprint.
- Results preceding the `pulselog-v2` contract remain historical and unverified. Do not repeat their performance percentages as accepted evidence.
- The document title must identify AgenticRocket, not Prototype. Navigation must remain visible and operable on mobile.
- The session agent chat is centered along the bottom; history and composer are separate neutral-black translucent panels with Gaussian-style background blur, no chat icons, and a collapsed live two-line preview of the most recent agent response while real send and queue states remain visible. Only the configured administrator may send chat messages; non-administrators see the Korean malicious-use prevention notice and the server rejects their message requests.
- Google sign-in gates every session API. Persist ownership by Firebase UID; ordinary accounts may operate one active session at a time, while the configured administrator account may operate concurrent sessions without gaining other users' session data.

When implementing from a selected generated mock, adapt its layout, component anatomy, and content to real functions, evidence, and accessibility. Visual mismatch alone is not a blocker or a reason to delay deployment.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
