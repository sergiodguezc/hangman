# Phase 2.1 — F1 + T1 homepage implementation

2026-10-09. **Implemented with S0 as the production default. The user approved S0 after the S0/S1 comparison; S1 is not adopted and exists only as the isolated `s1.css` override in the uncommitted sizing gallery.** The design is frozen for release.

The `design-explorations/` links below point to local, uncommitted working artifacts (galleries, screenshots, capture scripts). The committed record is this report, the approved [F1](../design/phase-2-1-final.md) and [T1](../design/phase-2-1-tablet.md) specifications, and the regression tests.

[Open the S0/S1 gallery](../../design-explorations/phase-2-1-sizing/index.html) · [Capture instructions](../../design-explorations/phase-2-1-sizing/README.md) · [Measured geometry](../../design-explorations/phase-2-1-sizing/screenshots/metrics.json)

## Session history

The implementation was written by an earlier session, which was interrupted after producing this report. A follow-up session (same day) audited and completed it:

- **Inherited and kept as-is:** all source, CSS, test, browser-script and gallery work listed in §A. A review against [F1 §6](../design/phase-2-1-final.md#6-implementation-specification) and [T1 §7](../design/phase-2-1-tablet.md#7-recommendation) found no deviations requiring change. Markup matches §6.3 almost verbatim; CSS values match §6.3/§6.4, the T1 block matches §7.1, and the ≤599 block matches the F1 prototype's mobile rules with the T1 §7.2 `17ch` H1 cap.
- **Gap found and closed:** the localization test compared rendered markup with `homeTranslations` itself, so a typo in the translation module would have passed. `tests/localization-test.ts` now pins every homepage string and the daily title/caption/won/lost/tomorrow strings literally against F1 §6.2, in CA and ES.
- **Stale-evidence check:** `src/App.css` was last edited (00:43) after most screenshots were taken (00:30–00:36). The full build, test and capture pipeline was re-run on the final source. All **113 screenshots re-rendered byte-identical**, including the reduced-motion capture, so the gallery reflects the final CSS. The build's asset hashes were also unchanged.
- No other source changes were needed.

## A. Implementation summary

The approved [F1 specification](../design/phase-2-1-final.md) and overriding [T1 tablet specification](../design/phase-2-1-tablet.md) are implemented in the existing React homepage.

| File | Change |
| --- | --- |
| `src/pages/HomePage.tsx` | Labelled navigation with three real links; supporting descriptions; editorial daily entry with current challenge number; completed-state summary; real help links; safe initial daily storage read and refresh on focus/storage/date polling. Multiplayer form and invitation markup retain their existing behavior. |
| `src/home/i18n.ts` | Approved CA/ES subtitle, mode labels and captions. H1 wording is unchanged. |
| `src/daily/homeSummary.ts` | Small pure helper reads the current attempt and replays guesses through `createDailyRound`. Returns only status and mistakes. |
| `src/daily/i18n.ts` | Shared localized daily caption, zero/singular/plural win summaries and tomorrow reminder. |
| `src/App.css` | F1 typography, horizontal/stacked controls, borderless daily entry, illustration proportions/shadow, caption contrast, interaction states and T1 tablet composition. Home styles move to 599px; other screens retain 660px. |
| `src/multiplayer/socket.ts` | Optional access to Vite's `import.meta.env` permits Node static-render tests to import HomePage. Vite development/production URL selection and socket behavior are unchanged. |
| `tests/localization-test.ts`, `tests/daily-test.ts`, `tests/seo-test.mjs` | Semantic markup, translation, replay/privacy/storage, and homepage metadata coverage. |
| `scripts/browser-audit-test.mjs`, `scripts/homepage-browser-checks.mjs`, `scripts/responsive-scope-checks.mjs` | Actual browser navigation, daily return, responsive geometry, and checks for unaffected screens. |
| `design-explorations/phase-2-1-sizing/` | Isolated S1 override, reproducible capture script, screenshots, measurements, gallery, instructions and verification log. |

Multiplayer is first, green-filled, and at least 200px wide above phone sizes. Learning remains outlined and second. Daily is a left-aligned typographic link under a hairline, with its arrow and number. The preview preserves the existing HangmanDrawing, sway and `_ E _ J _ T` motif. No alternative icon, font, palette or mode was introduced.

S0 uses 48px mode buttons, a 560px tablet column, a 196px tablet drawing, 56px maximum desktop headline, 14px captions and an 18px daily title. Desktop drawing/card dimensions are 250/440px; phone drawing is 100px. Headline width is capped at 17ch, including intermediate phone widths.

Ordinary clicks use existing client routing. Modified clicks retain native defaults; Ctrl-click and middle-click were also tested through real browser input and opened new tabs. Keyboard and history navigation work. Both help links are anchors. Focus uses the approved dark inner ring and amber outline; hover/pressed styling is scoped to homepage links. Reduced motion removes transitions, sway and the arrow nudge.

Daily completion reuses existing persistence and replay. Stored completion flags and mistake counts are not trusted. Missing, malformed, outdated and throwing storage fall back safely; in-progress attempts retain the basic caption. Zero/one/two-error wins and loss are covered. Neither the word, its definition nor its length is rendered by the homepage summary. Daily completion never changes the multiplayer action. Re-entry mounts a fresh summary, and focus/storage events plus a minute timer refresh an open homepage.

## B. Responsive and visual verification

All entries below were captured from the built React app in **both CA and ES, for S0 and S1**. Positions are rounded CSS pixels. Primary positions in this table are S0 Catalan; Spanish differs only at the narrow phone, where its shorter H1 occupies two lines.

| Viewport | S0 primary top–bottom | Checked result |
| --- | --- | --- |
| 1440×900 | 528–576 | F1 two columns; 56px/two-line H1; compact pair; 440×407px illustration card. |
| 1024×768 | 447–495 | Compact desktop retains two columns; primary fully above fold; 425×393px card. |
| 768×1024 | 391–439 | T1 column x=104, width=560; header/copy/separator/card/footer share edges; 196px stacked drawing. |
| 820×1180 | 472–520 | T1 column x=130, width=560; H1 reaches 46px, still two lines. |
| 390×844 | 313–361 | Stacked 48px buttons; two-line H1; daily fully visible; 100px illustration and collapsed iOS hint visible. Footer requires scrolling. |
| 320×568 | 341–389 | Primary fully visible; Catalan H1 three lines; daily title visible, caption below fold. ES primary 306–354, H1 two lines. Full-page images show no clipping. |
| 599×960 | 319–367 | Phone layout; stacked actions, 17ch H1, two-line subtitle. |
| 600×960 | 356–404 | T1 starts; 552px available column, horizontal actions and full-width separator/card. |
| 660×1000 | 376–424 | T1, 560px centered column. |
| 661×1000 | 376–424 | No old 660/661 homepage discontinuity. |
| 860×1180 | 472–520 | Upper T1 boundary, 560px column. |
| 861×1180 | 649–697 | Approved recomposition to compact desktop; two columns and 40px H1. |
| 1024×1366 | 746–794 | Approved desktop rules apply; primary visible but composition floats low in the tall viewport. No orientation redesign added. |
| 844×390 | 365–413 | Known landscape limitation: primary is partly below the fold and needs scrolling. S1 ends at 417px. No height-based redesign added. |

No horizontal overflow occurred in any of the 56 CA/ES sizing captures. Assertions also check target heights, text sizes, headline line count, action order/alignment, tablet centering and shared edges. On the scrolling landscape viewport, centering uses the layout viewport excluding Firefox's scrollbar.

The gallery includes the approved F1/T1 screenshots beside the implemented S0. Desktop, laptop and tablet primary positions match the reference values to the rounded pixel. Phone and 599px positions differ by about **+3px**, within the specified ±12px tolerance. Tablet cards measure 560×336px, matching T1. An initial wide-phone subtitle discrepancy was corrected by retaining the approved 34ch measure. The existing animated figure differs from the static prototype pose by design; captures pause its sway at the same instant in both sizes. Daily #55 reflects the capture date; the older F1 reference shows #54.

Caption color is the approved `#5f6a62`; its specified contrast is approximately 5:1 on paper. All captions are 14px. Focus rings, all three controls' hover/pressed states, phone focus, completed daily summaries in both languages, and the narrow-phone reminder line break are captured. The iOS prompt uses the quieter transparent surface and 14px/600 summary; an expanded Spanish capture verifies readable instructions. A separate tablet capture exercises the MacIntel/touch detection branch and shows the prompt aligned to the column.

**Other screens:** the existing browser scenarios render real multiplayer setup, invitation, help, lobby and choosing-phase match pages. At **599/600/660/661px**, their content geometry and relevant computed styles match the saved original CSS. Help/match/lobby retain their 660px transitions. Setup and invitation shells center at 600–660 as approved; their internal layouts are unchanged. Their original phone padding is explicitly preserved.

**Environment limits:** Firefox 157.0.1 / Gecko on Linux only, with Noto fallbacks for unavailable Georgia/Inter. Phone and iPad detection are simulated; no real Safari, Chrome mobile, touch interaction, safe-area or physical-device validation is claimed. Large accessibility font overrides were not part of this run. The tall 1024px iPad and short landscape-phone limitations remain visible in the gallery.

## C. Controlled sizing comparison

S1 has exactly three overrides: 52px minimum button height at ≥600px, 600px maximum tablet column and 220px tablet drawing. Padding, typography, colors, spacing rules and phone illustration sizes are identical. There is no runtime flag or query parameter in the app; the capture tool injects [s1.css](../../design-explorations/phase-2-1-sizing/s1.css) into an isolated browser page.

| Evidence, CA | S0 | S1 |
| --- | --- | --- |
| Desktop primary | y=528–576; 48px | y=526–578; 52px |
| Laptop primary | y=447–495; 48px | y=445–497; 52px |
| 768px tablet column/card | 560×336; x=104 | 600×362; x=84 |
| 768px tablet drawing | 196px (35% of card width) | 220px (36.7%) |
| 768px tablet primary | y=391–439 | y=376–428 |
| 768px tablet footer bottom | y=968 | y=983 |
| 820px tablet primary | y=472–520 | y=457–509 |
| 600×960 footer bottom | y=933 | y=960, plus page bottom padding; vertical scrolling appears |
| 390px / 320px phones | 48px buttons, 100px drawing | Identical; S0/S1 PNG files are byte-identical in both languages |

At 600px, the S1 scrollbar reduces the available card width to 540px, versus S0's 552px. This is the browser's available content width, not an additional S1 style change. On normal portrait tablets, the taller shell moves the primary approximately 15px upward while moving the footer approximately 15px downward because the whole composition is centered.

| Criterion | Assessment |
| --- | --- |
| Multiplayer prominence | Clear in both. The filled primary remains first and wider than learning. S1 increases both buttons equally, so it adds little to their relative hierarchy. |
| Typography/control balance | S1's 4px increase is comfortable and unobtrusive on desktop. S0 already has enough button weight alongside the unchanged heading. |
| Tablet measure | S0's 560px column better contains the compact copy/action group. S1 adds 40px of width without lengthening the text or controls. |
| Drawing/card proportion | S1's drawing fills slightly more of its card and feels more playful. This is its clearest visual benefit. The entire card also becomes more prominent. |
| Whitespace/rhythm | S0 retains the approved column's restraint. S1 reduces outer margins and increases empty space to the right of the unchanged action pair. |
| Mobile/tablet consistency | Phones are identical. S1 makes the phone-to-tablet scale jump somewhat larger; both retain the stacked drawing motif. |
| Accessibility/targets | Both meet the approved 48px target. S1 adds 4px on larger screens; this is a modest comfort gain, not a measured usability result. |
| Fold risk | No primary disappears in the normal portrait/laptop captures. S1 consumes more vertical space below the actions and adds scrolling at 600×960. Both retain the landscape limitation. |
| Approved-design fidelity | S0 matches F1/T1. S1 remains an intentionally limited alternative and is not adopted. |

Direct evidence: [768px S0](../../design-explorations/phase-2-1-sizing/screenshots/s0-tablet-ca.png) / [S1](../../design-explorations/phase-2-1-sizing/screenshots/s1-tablet-ca.png), [820px S0](../../design-explorations/phase-2-1-sizing/screenshots/s0-tablet-large-ca.png) / [S1](../../design-explorations/phase-2-1-sizing/screenshots/s1-tablet-large-ca.png), [desktop S0](../../design-explorations/phase-2-1-sizing/screenshots/s0-desktop-ca.png) / [S1](../../design-explorations/phase-2-1-sizing/screenshots/s1-desktop-ca.png). The gallery provides all Spanish, boundary and full-page equivalents.

## D. Recommendation

**Retain S0.** S1 is slightly worse overall for this editorial direction: the broader, taller tablet card gains visual weight while the text/control group stays compact. Its larger drawing is appealing and the taller targets are reasonable, but those benefits do not outweigh the weaker column balance and extra height at 600px. The desktop difference is small; neither result is a usability study.

The follow-up session reviewed the 768px and 1440px S0/S1 captures directly and agrees, but considers it **close**. S1's 220px drawing is the most appealing single change. If more presence is wanted on tablets, the least risky option is to adopt only that, rather than the full S1 set.

**Decision (2026-10-09): S0 approved.** Production remains S0; no S1 values have been adopted.

## E. Verification

Every row below was re-run on the final source in the follow-up session (Node 22.23.3, Firefox 157.0.1 headless, dedicated server on 127.0.0.1:3002, disposable profiles), with the same results as the original run.

| Command/check | Result |
| --- | --- |
| `npm run build` | Pass; client and generated server built. Existing >500kB bundle warning remains (approximately 754kB JS before gzip). |
| `npm run lint` | Pass, exit 0. Three pre-existing unused-expression warnings in the older F1/tablet/multiplayer-first capture scripts. No warning from the new implementation/capture code. |
| `npx tsc -b --pretty false` | Pass. |
| `npx tsc -p server/tsconfig.json --noEmit` | Pass. |
| `npm run test:localization` | Pass; CA/ES static homepage, semantic links/descriptions, single unchanged H1, challenge number, completion copy and privacy, plus literal F1 §6.2 string pins (added in the follow-up session). |
| `npm run test:daily` | Pass; replay, zero/one/two mistakes, loss, missing/corrupt/outdated/throwing storage and forged flags. |
| `npm run test:invitation` | Pass. |
| `npm run test:multiplayer-ui` | Pass. |
| `npm run test:learning` | Pass. |
| `npm run test:game`, `test:chat`, `test:lifecycle`, `test:match`, `test:n-player` (after the build) | Pass. No server source changed; run as a regression guard. |
| `npm run test:seo` | Pass; existing daily tests plus explicit homepage title/description/canonical/Open Graph checks. |
| `TEST_SERVER_URL=http://127.0.0.1:3002 BIDI_URL=ws://127.0.0.1:9231 RESPONSIVE_BASELINE_CSS=<HEAD index.css + App.css> npm run test:browser` | Pass; navigation, actual Ctrl/middle new tabs, keyboard, back/forward, CA/ES layouts, daily return, non-homepage CSS comparison and all existing browser regressions. No captured browser console errors. |
| Normal capture script and reduced-motion profile run | Pass; 85 measured homepage captures, all with `overflow false`, with viewport/full-page and scope evidence totaling 113 PNGs. The re-run output was byte-identical to the previous capture set. Gallery image references checked. |
| `git diff --check` | Pass. |

The initial TSX run was blocked by the sandbox's local IPC restriction (`EPERM`); the authorized run outside that sandbox passed. The first reduced-motion capture attempt encountered an unsupported Firefox BiDi command; a dedicated `ui.prefersReducedMotion=1` profile verified the real media query, disabled sway, zero transition duration and no arrow movement. Screenshot/test harness corrections accounted for scrollbars, equivalent quoted font serialization, zero-size `display: contents` geometry, the choosing-phase match DOM and completion of focus transitions before color assertions. These are resolved harness/environment issues, not remaining application failures.

Outstanding observations are the documented landscape fold limitation, tall desktop-width portrait-iPad composition, existing lint/bundle warnings and lack of physical-device/browser-engine coverage. Final selector/containment review also fixed two implementation issues: the homepage reminder is isolated from the daily results page’s 13px styling, and the compact desktop card can grow to contain its letter slots at 861px (the old `min-height: 0` allowed them to spill below it). Focused browser assertions cover both. No gameplay, scoring, vocabulary, route or SEO metadata implementation changed. Generated `dist-server` files have no diff.

## F. Git status and scope

When the original implementation session started, there were **no tracked changes**. Existing untracked content was:

- `design-explorations/` (earlier exploration galleries/prototypes/screenshots).
- `docs/design/` (including the approved specification reports).
- `docs/cefr-classification-stability.md`, `docs/cefr-full-vocabulary-analysis.md`, `docs/cefr-sample-data-quality.md`.
- `docs/vocabulary-audit.md`, `docs/vocabulary-repair-analysis.md`.

Those files were preserved. Only the new `design-explorations/phase-2-1-sizing/` subtree was added to the exploration directory.

Tracked files modified by this task:

- `src/App.css`, `src/pages/HomePage.tsx`, `src/daily/i18n.ts`, `src/multiplayer/socket.ts`.
- `tests/localization-test.ts`, `tests/daily-test.ts`, `tests/seo-test.mjs`.
- `scripts/browser-audit-test.mjs`.

New implementation/verification files:

- `src/home/i18n.ts`, `src/daily/homeSummary.ts`.
- `scripts/homepage-browser-checks.mjs`, `scripts/responsive-scope-checks.mjs`.
- `docs/implementation/phase-2-1-homepage.md` (this report).
- `design-explorations/phase-2-1-sizing/{README.md,index.html,s1.css,capture.mjs,browser-verification.txt,screenshots/}`.

The follow-up session changed only `tests/localization-test.ts` (string pins), this report and `design-explorations/phase-2-1-sizing/browser-verification.txt` (refreshed log). The screenshots were re-rendered but are unchanged. Its temporary baseline CSS, Firefox profiles and server ran from the session scratch directory, and all of them were stopped afterward.

No dependency/package changes, staging, commits, pushes or deployments were made.
