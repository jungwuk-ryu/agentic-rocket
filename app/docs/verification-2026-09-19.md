# Evidence-v2 release verification

Date: 2026-09-19, Asia/Seoul. Public service: https://jungwuk.jungwuk.com, origin port 8761.

This is the historical execution record for the evidence-v2 repair and its live
candidate. Subsequent authentication changes require sign-in to access sessions;
the legacy demonstration session is available only to the administrator. Session
admission now uses account ownership and one active session per ordinary account,
with an administrator concurrency exception. The project-wide lock and test
counts recorded below describe the earlier verification snapshot, not the latest
access policy. Free-form follow-up chat is now administrator-only in the public
demo. These access changes do not replace the recorded measurements.

## Scope

Repairs cover all eight P1 findings and four P2 findings in the supplied review,
plus home navigation, real sidebar pages, document title and configuration status.
Old session records and artifacts remain available; their previous performance
claims are not considered current-contract evidence.

| Concern | Implemented boundary | Verification |
| --- | --- | --- |
| Corrupt patch | Preserve bytes via base64, Git application checks, artifact SHA-256 | Real local Git regression and downloaded live candidate |
| Incorrect correctness | Service-owned tests/build/workload; protected paths; exact CLI output and all checksum comparisons | Checksum mismatch regression; live paired output checks |
| Wrong metric / warm-up | Native median_ms, explicit warm-up for both sides, balanced six-command order | Parser regression and actual raw sample logs |
| Follow-up execution | Persistent messages plus actual diff and execution tools | Mock tool/history test and live browser follow-up |
| Cancellation | Abort signal, process termination, late-creation cleanup, terminal-state guard | Race regression, real remote process cancellation and API cancellation |
| Restart recovery | Load disk sessions, record remote IDs before submission, reconcile before continuation | Real service restart at submission boundary in the session below |
| UI evidence | Visible messages/errors; Home; collection pages; controls; precise attempt/sandbox/report binding | Public desktop/mobile browser interaction checks |
| Verdict uncertainty | Distinct environment/correctness failure, both-side CV, mixed results inconclusive | Table-driven regression cases |
| Compaction / raw logs | Configurable budget, original archives, read_artifact, valid tool boundaries | Forced compaction test with 33 KB original output retrieval |
| Project ownership | One project lock across session IDs | Concurrent public API start rejected with 409 |
| PR summary | Actual candidate rationale and matching current report | Live PR modal with Draft prepared · Demo; no PR submitted |

## Live candidate

- Session: `28855930-0707-4706-8502-619441483123`
- Baseline: `dcbf1d2031195e42a2cad8725c32dd285c7f5dc7`
- Patch SHA-256: `c0e875fb04b66b14222593d6ec8ef882e851a89feb93740a56ada8522ba3eed1`
- Change: retain function-local static UUID/numeric regex objects in `normalize_route` instead of constructing them per record.
- Model: `gpt-5.6-terra`, local cli-proxy Chat Completions, real tool/result iterations.
- Work sandbox: `48d7d5ab-9b13-4708-b1ca-ac6f7126bb5c`; stopped after evidence retention.
- Native benchmark checksum: `7196562011672513786` on all checked invocations.
- CLI fixture: records=2, errors=1, routes=2, checksum=`9608618260582721622`.
- Downloaded patch retains its final LF and matches the saved/verified fingerprint.

First attempt `1713a999-9524-4745-ae20-08a1de447da3` completed with **verified**.
Creation to result took 200.604 seconds including the deliberate server restart.

| Sandbox ID | Baseline native medians (ms) | Candidate native medians (ms) | Reduction |
| --- | --- | --- | ---: |
| `4a16459c-716c-4b90-bebe-ed67890d711d` | 454.892, 433.213, 478.865 | 6.467, 6.496, 6.580 | 98.5703% |
| `2e1c3f74-2c36-4b84-a789-2643fd44364c` | 499.091, 482.836, 477.753 | 7.129, 6.843, 7.029 | 98.5613% |
| `0ac2175d-f4e8-4d9e-8f18-7002872d22f6` | 506.006, 502.376, 488.963 | 6.967, 7.518, 7.153 | 98.5549% |

Calibration CV was 4.995843%; policy was saved before editing. All three tests,
CLI output and checksum checks passed. Both-side variation stayed within the
fixed policy. All three benchmark resources were deleted after evidence capture.

## Restart and cancellation

The service was restarted while the session was active. Disk reload returned
`interrupted`, retaining the work sandbox and remote process session
`ar-17a28388-942f-463f-bbd5-de9d255b7ce3`. Reconciliation found no remote command had
been submitted in that process session, recorded `not-submitted`, and continued
in the same checkout. It did not assume a lost request meant a command had run.

Cancellation smoke `9ba0a64c-bab3-4371-aab4-f5414735b80b` ended `cancelled`, with its
active benchmark command cancelled, no candidate/verification workers created,
and work sandbox `ba0b1ec0-cc28-4531-a8ef-e26da780c008` stopped. An isolated real
Daytona process cancellation also returned AbortError, saved partial output,
and independently confirmed the remote process session no longer existed.
The corrected browser buttons were then exercised on this same cancellation
session: Resume returned 202 and Cancel returned 200. Final status stayed
cancelled, one original work sandbox remained stopped, and there were zero
unfinished commands and zero verification sandboxes.

## Browser and unit evidence

- User-approved Playwright / Chromium; public URL, 1440px desktop and 390px mobile.
- Title is AgenticRocket | Evidence-backed optimization.
- Home return and Sessions/Benchmarks/Evidence/Connections links rendered their actual pages.
- Historic configuration failures show an explanation while current settings show Connections configured.
- Mobile document scroll width equals its 390px viewport; navigation remains available.
- Actual button QA exposed empty JSON POST bodies; the shared action client now sends `{}` for bodyless actions. PR preparation then returned 200 and opened the actual draft.
- 17 focused tests pass in under one second. Compaction/provider-mismatch tests use mocks and are not described as live provider evidence.
- Screenshots: `/tmp/agenticrocket-v2-home.png`, `/tmp/agenticrocket-v2-session-desktop.png`, `/tmp/agenticrocket-v2-session-mobile.png`, `/tmp/agenticrocket-v2-connections.png`, `/tmp/agenticrocket-v2-pr-draft.png`.

## Live follow-up remeasurement

The user instruction was submitted through the actual browser composer (HTTP
202), retained in the same session, and invoked `remeasure_candidate`. New attempt
`ff640c55-1cd5-4a71-8b2a-a9483ec83348` used the exact same patch fingerprint and
policy. It completed with **inconclusive**, correctly preserving the noisy result.

| Sandbox ID | Baseline native medians (ms) | Candidate native medians (ms) | Outcome |
| --- | --- | --- | --- |
| `57d55ffe-939a-4728-a2a9-4c821f4d64aa` | 458.466, 447.941, 442.236 | 6.488, 7.083, 6.632 | improved |
| `d94965bb-e42c-4f44-8553-7efac34ad365` | 457.036, 460.801, 475.649 | 6.738, 6.661, 6.719 | improved |
| `7651a6c2-2073-4fc4-9fcc-c613d72ac199` | 432.508, 428.878, 559.807 | 6.514, 6.410, 6.379 | noisy |

Every correctness check passed. Sandbox 3 baseline CV was approximately 15.74%,
above the fixed 8% limit, so an observed large reduction was **not** promoted to a
verified verdict. The first verified report remains in history; the current
report/link refers to this inconclusive attempt. No favorable-only rerun was
performed to hide the noise. The model's Korean response explains the difference
using both actual attempts.
The next follow-up correctly recalled the preceding request, unchanged patch and
reason for the different verdict without running another command. All four
conversation messages were rendered in the public browser. The current report
link was independently downloaded and contained the inconclusive attempt, not
the earlier verified report.

Provider readback confirmed all six benchmark sandbox IDs were absent and the
work sandbox was stopped. Final deployment runs Node.js 24 under the existing
user service; health reports `release: evidence-v2`. Final checks: 17 tests pass,
production build succeeds, task-owned diff whitespace checks pass, and unknown
API/asset paths return 404 instead of the application HTML.

## Limits

The adapter is deliberately limited to the published PulseLog repository. Its
checks cover the fixed tests/workloads, not universal program equivalence. Three
sandboxes do not prove three independent physical hosts. PR preparation creates
only a draft in the browser. Stopped work sandboxes are retained for continuation;
their storage lifecycle is distinct from deleting completed benchmark resources.
