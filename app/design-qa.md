# Product Design QA — evidence-v2

Reviewed 2026-09-19 in user-approved Playwright / Chromium against the public service.

## Comparison metadata

- Source visual truth: `/home/ubuntu/.codex/generated_images/01a0b801-4335-7d62-86f3-75c1e1786103/exec-02e81d54-033c-4a9c-be00-bc1dddcbe37f.png`
- Source pixels: 1487 × 1058. Generated concept #1; the user requested its visual direction, not fictional values or a pixel-exact clone.
- Rendered implementation: `/tmp/agenticrocket-v2-design-comparison.png`, 1487 × 1058 pixels; CSS viewport 1487 × 1058, deviceScaleFactor 1. No density resampling was needed for the final comparison.
- Additional desktop checks: 1440 × 1024. Mobile: 390 × 844, `/tmp/agenticrocket-v2-final-mobile.png`.
- Route: `https://jungwuk.jungwuk.com/#/sessions/28855930-0707-4706-8502-619441483123`.
- State: completed real paired measurements, latest result inconclusive, conversation collapsed. The concept depicts a fictional verified result, so text, metric values and warning colors intentionally differ.
- Full-view evidence: source and implementation images opened together in one comparison input.
- Focused evidence: `/tmp/agenticrocket-v2-verification-focus.png`, opened with the source and full implementation to inspect labels, metrics, borders and status colors.
- Separate conversation/PR captures: `/tmp/agenticrocket-v2-final-conversation.png`, `/tmp/agenticrocket-v2-pr-draft.png`.

## Findings and comparison history

1. Earlier QA was blocked by missing in-app browser tooling. The user approved Playwright; real public screenshots and interactions now replace that limitation.
2. Functional inspection found dead navigation, a Prototype title, stale configuration status, hidden answers/errors and bodyless JSON actions. Home and collection routes, current/historical status separation, visible conversation/error states and valid action bodies were implemented. Browser checks confirmed the corrected controls.
3. First current-result visual comparison found a P2 semantic-color mismatch: the noisy third sandbox still used the same green frame and emphasis as accepted improvements. Evidence: `/tmp/agenticrocket-v2-final-verification.png`.
4. The card now uses an amber border/warning icon, the heading “Measurement is noisy”, amber outcome text, and neutral reduction text. Post-fix full and focused captures listed above were compared again. Browser computed border is `rgb(168, 120, 62)`; exactly one card is noisy.

No actionable P0/P1/P2 findings remain in this scoped comparison.

## Required fidelity surfaces

- **Typography:** the existing Manrope/system sans and DM Mono treatment retains the geometric interface/technical-data hierarchy of direction #1. Korean objectives wrap instead of being cut off; long sandbox IDs remain secondary. The concept contains a short English title, so the real longer objective necessarily increases header height. This is intentional content variation, not claimed pixel equivalence.
- **Spacing/layout:** persistent left navigation, horizontal stages, three paired cards and a right evidence rail preserve the selected structure. Real one-metric evidence replaces invented multi-metric cards. On mobile the grid stacks and navigation remains visible; document width is exactly 390px, with no horizontal page overflow.
- **Colors/tokens:** navy surfaces, fine steel-blue borders and lime accents remain consistent with the source direction. Pending, cancelled, failed, historical and inconclusive states use explicit copy; noisy measurements now have amber semantics.
- **Image quality:** the existing generated mission-grid raster remains crisp in its background treatment. Phosphor provides real consistent icons; no placeholder illustration or custom SVG artwork substitutes were added.
- **Copy/content:** menu labels lead to real pages. Current configuration is distinguished from past failure. Performance copy uses native timing, actual verdicts and observed reductions; the mock's fictional percentages, hosts and throughput are not reproduced. PR is explicitly Draft prepared · Demo.

The floating translucent conversation is an intentional separate user-requested change, preserved during integration. Its expanded state overlays content by design and can be collapsed. It is not treated as drift from the earlier concept.

## Interaction evidence

- Home/brand return, New session, all four collection pages, refresh and browser Back passed.
- Historical configuration failure is explained separately from live Connections configured.
- PR draft opened after a real 200 response; body contains actual change rationale, baseline, patch hash and verdict.
- Browser composer submitted a real follow-up (202), three fresh workers executed, and four retained conversation messages were visible.
- Current report downloaded from the actual link contains the latest inconclusive attempt, not the prior verified report.
- Resume returned 202 and Cancel returned 200 through the actual buttons; final session remained cancelled with no pending commands.
- Mobile Home navigation works; focusable buttons/labels and reduced-motion captures checked.
- No browser page errors were observed in the final interaction runs. This is a scoped functional/visual check, not an exhaustive accessibility audit.

## Implementation checklist

- [x] Preserve selected direction #1 and real assets.
- [x] Repair navigation, title, configuration and session feedback.
- [x] Exercise real actions, downloads and conversation.
- [x] Compare matched-size source/rendered captures and inspect the measurement region.
- [x] Fix the noisy-state color issue and recapture.
- [x] Verify desktop and mobile layouts against real data.

final result: passed
