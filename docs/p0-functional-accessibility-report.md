# Phase 1 — functional and accessibility fixes

Implemented and validated locally on 2026-10-09. No commit, push or deployment. Existing untracked design and vocabulary-analysis work was preserved. Node 22.23.3; Firefox 157.0.1; no new dependencies.

## Findings and corrections

| Finding | Actual cause | Correction |
| --- | --- | --- |
| F03: impossible rematch | The match-over UI offered rematch regardless of active membership, then showed waiting text whenever the local ID was ready. The server correctly requires at least two active players and unanimous readiness. | Derive availability and readiness from public `players[].active` and `match.rematchReadyPlayerIds`. Reconnecting members remain eligible; departed members do not count. With fewer than two active members, show a localized explanation and the existing leave-to-multiplayer flow. Show readiness counts and reconnect status when a rematch is available. Server rules are unchanged. |
| F04: wordless round result | The board used the retained round's `round-over` status independently of the effective match phase, including snapshots with no word. | Match-over takes precedence. Public word/display data distinguishes a selected word from an empty snapshot. Suppress empty boards, word labels and ordinary round results; say only that the turn ended without a word. Retain `FinalScores` and the server's historical match result, including after later departures. No invented departure/completion reason. |
| F05: escaped modal focus | The overlays used `role=dialog`, `aria-modal` and autofocus but did not isolate the background or contain focus. | Shared native `dialog.showModal()` primitive supplies top-layer inertness. Explicit initial focus, Tab/Shift+Tab wrapping, native Escape cancellation, opener restoration and contained keyboard events preserve game/confirmation semantics. Titles are associated; the exit copy is the dialog description. |
| F06: inaccessible reactions | Hidden picker buttons became visible only through hover or focus within a message, which a reaction-free message could not receive. The bubble click handler was not keyboard accessible. | A small real button always exposes the picker. Localized labels, `aria-expanded`/`aria-controls`, first-reaction focus, Escape/selection restoration and blur dismissal work with keyboard and touch. Existing active reactions expose counts and pressed state; removing the final reaction restores focus to the surviving trigger. Socket.IO mutations remain unchanged. |
| F07: contrast/focus | Light hard-coded empty/ranking colors and an orange focus outline had insufficient contrast; inputs also suppressed their default outlines. | Reuse the stronger muted green-gray token, add dark-green/cream focus tokens and a consistent two-color focus treatment. Keep an inset ring within the clipping observer strip. Also correct readable placeholder/divider text and the low-contrast forgiven-points gold using the existing darker gold. |

The existing effective-phase helper had already fixed some active controls after match completion, but the separate retained-round rendering still bypassed it. None of the five reported issues was fully resolved before this change.

## Changed files and boundaries

- `src/components/Modal.tsx`: reusable native modal lifecycle, initial focus, keyboard containment and restoration.
- `src/App.tsx`: adopt Modal for exit confirmation; pass the existing leave handler into GamePage.
- `src/pages/LearningPage.tsx`: adopt Modal for level selection; retain level-selection semantics.
- `src/components/RoomChat.tsx`: per-message reaction controls and focus behavior; preserve chat/reaction transport.
- `src/pages/GamePage.tsx`: effective-phase rendering, wordless interruption copy, active-roster rematch availability/readiness and leave navigation.
- `src/multiplayer/presentation.ts`: pure public-state helpers for rematch availability and presence of a selected word.
- `src/multiplayer/i18n.ts`: synchronized CA/ES reaction labels, neutral interruption copy, rematch explanation/readiness and plural waiting text.
- `src/App.css`, `src/index.css`: native dialog styling, compact reaction controls, contrast/focus tokens and narrowly scoped clipping corrections. The level dialog uses two columns at <=420px so all choices fit; its typography is unchanged. Results get 6px vertical padding to retain the focus outline inside their clipping card.
- `tests/multiplayer-ui-test.tsx`: actual GameRoom transitions plus rendering assertions for 2/1 active members, reconnect grace, departures, changing ready rosters, unanimity, both setter/guesser departure during word choice, and completed results surviving later departure.
- `scripts/p0-browser-checks.mjs`, `scripts/browser-audit-test.mjs`: real Firefox keyboard/pointer regressions integrated into the existing browser suite; computed contrast, page/dialog overflow and focus-ring containment checks.
- `docs/development.md`, this report: execution notes and validation evidence.

No server or shared-protocol changes were needed. Building produced no tracked `dist-server` diff. Scoring, rankings/ties, turn rotation, forgiveness, privacy, reconnection rules, vocabulary, daily storage/date logic and SEO/routing were not changed.

## Commands and outcomes

| Command | Outcome |
| --- | --- |
| `npm run build` | Passed, including frontend and backend types/build. Existing >500kB client chunk warning remains. |
| `npm run build:client` after final CSS refinements | Passed. |
| `npm run lint` | Passed with three existing `no-unused-expressions` warnings in untracked `design-explorations/phase-2-1-{multiplayer-first,tablet,final}/capture.mjs`; no warnings from changed implementation/tests. |
| `npx tsc -b --pretty false` | Passed. |
| `npx tsc -p server/tsconfig.json --noEmit` | Passed. |
| `npm run test:multiplayer-ui` | Passed, including new state/rendering regressions. Initial sandbox attempt hit the documented TSX Unix-socket `EPERM`; rerun with local socket permission passed. |
| `npm run test:game` | Passed. |
| `npm run test:chat` | Passed. |
| `npm run test:lifecycle` | Passed. |
| `npm run test:match` | Passed. |
| `npm run test:n-player` | Passed. |
| `TSX_TSCONFIG_PATH=tsconfig.app.json node --import tsx tests/learning-test.ts` | Passed. |
| Same Node/TSX entry point with `tests/localization-test.ts` | Passed. |
| Same Node/TSX entry point with `tests/vocabulary-contract-test.ts` | Passed. |
| Same Node/TSX entry point with `tests/daily-test.ts` | Passed. |
| Same Node/TSX entry point with `tests/invitation-test.ts` | Passed. |
| `TEST_SERVER_URL=http://127.0.0.1:3002 npm run test:e2e` | Passed against a dedicated local built server. |
| `npm run test:seo` | Passed. |
| `TEST_SERVER_URL=http://127.0.0.1:3002 BIDI_URL=ws://127.0.0.1:9222 npm run test:browser` | Passed with the new P0 checks and existing navigation, storage, learning and responsive regressions. |
| `npm run test:vocab` | All 52 tests passed. The audit's missing ignored-fixture errors did not occur in this workspace. |
| `npm run vocab:validate` | Validated 544 entries. No enrichment or dataset regeneration. |
| `git diff --check` | Passed. |

Sandboxing initially blocked the local server's listen socket and the Firefox launch. Both ran with the required local process/socket permissions afterward. One initial browser assertion incorrectly expected `:focus-visible` immediately after pointer interaction; it now establishes real Tab input first. Screenshot review then exposed internal level-dialog clipping not detected by page overflow alone; the fix and stricter internal-overflow assertions passed. Final browser runs had no error-level entries reported by the subscribed BiDi console stream. On process cleanup, Firefox stderr also showed animation-frame timeout warnings and script-termination warnings pointing to the bundled Engine.IO polling-request abort/cleanup function (`Ge`). These did not fail the interaction assertions. Their cause was not established; do not treat the clean BiDi error list as evidence that Firefox emitted no warnings.

## Interactive and visual evidence

Firefox WebDriver BiDi exercised both CA and ES at **1440×900, 1366×768, 768×1024, 390×844 and 320×568**:

- Both dialogs: initial focus; repeated forward/backward Tab cycles; Escape and pointer Cancel; restoration; real pointer attempts on background language controls; denied background focus; no game-letter guesses behind the dialog; confirmation still reaches the learning summary.
- Chat: reaction-free message discovery with Tab; Enter and Space opening/activation; Escape; first-reaction and return focus; live Socket.IO add/remove and count/pressed-state updates; synthesized touch opening without hover; leaving the picker preserves the new focus target.
- Word-selection departure: no wordless board, keyboard, normal round details or actionable rematch. Localized explanatory text wraps; return navigation clears room credentials and opens multiplayer setup.
- No horizontal page overflow in these changed flows. Dialog content and all dialog controls fit horizontally. Return-button focus rings fit inside their clipping card.

40 screenshots are written to `/tmp/penjat-p0-validation/` (two dialogs, chat picker and terminal match × two languages × five sizes). Representative screenshots were visually inspected across all five sizes, including both languages, the repaired narrow level dialog and narrow terminal navigation. Existing browser geometry checks also passed at 599/600/660/661px and the homepage boundaries.

Measured from browser-computed styles: empty-chat text **5.55:1** against its card; ranking numbers **5.05:1** against their actual row. The dark focus color has **11.85:1** against cream, **10.67:1** against paper, **12.04:1** against white and >10:1 against the relevant pale-green fills (sRGB calculations). A cream gap separates it from dark filled buttons. Browser assertions check focus contrast in the dialogs and reaction control; visual inspection checks its appearance on filled and outlined controls.

## Remaining limits and Phase 2

This is focused Firefox verification, not full accessibility certification. Chromium/WebKit, screen readers, forced-colors mode and physical mobile touch/virtual keyboards were not exercised. Touch tests use Firefox's synthesized pointer input. The existing bundle warning and unrelated lint warnings remain. Firefox navigation/teardown warnings described above remain unresolved and merit a separate browser/transport investigation if reproducible during ordinary use. No Socket.IO client library or transport setting was changed.

Keep `FinalScores` as the historical match-ranking boundary in Phase 2; the existing round-results component remains for ordinary completed rounds. The pure presentation helpers can be reused by a future results layout, without inferring winners or completion reasons from departed membership. The protocol still has no dedicated completion-reason field: later departure must not relabel a valid completed match as cancelled. Native Modal and reaction controls are independent of result typography; preserve focus-ring space and repeat the narrow-dialog checks when font sizes change. No competing results interface or broad breakpoint/type redesign was introduced.
