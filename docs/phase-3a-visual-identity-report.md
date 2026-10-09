# Phase 3A — Paper & Magrana identity

Status: complete in the working tree (2026-10-09). Not committed, pushed or deployed. The pre-existing Phase 2A–2D changes are preserved: the server, generated-server, routing and gameplay-contract diffs match the snapshot taken before Phase 3A (`design-explorations/phase-3a/preservation.json`; the full pre-3A tracked diff is `baseline/preexisting.patch`).

## 1. What changed

The implementation adapts Lovable's SVG character and OKLCH palette. It does not import prototype dependencies or game logic.

- **Typography.** Self-hosted Fraunces (56.08 kB, OFL; Catalan/Spanish and combining-accent coverage verified) for the brand, expressive headings, dictionary words and outcomes. Penjat UI (Source Sans 3 subset) stays the functional face, with the Phase 2B semantic size scale. Both fonts preload and use `font-display: swap`.
- **Surfaces and colour.** Paper background with a faint dot grid, and magrana primary actions with ink outlines and small offset shadows. Saffron and olive accents, teal success. Pill-shaped secondary actions.
- **Alphabet.** Ink-outlined keys with saffron hover, teal for correct and struck-through error red for incorrect.
- **Character.** Static gallows; one part per error (head, torso, left/right arm, left/right leg). The barretina arrives with the head and the scarf with the torso. A win shows a smiling rescued figure; a loss shows a quiet disappointed face, with no attention-grabbing animation. A drawing beside an existing count or outcome is decorative (`aria-hidden`). A standalone drawing is `role="img"` with a localised label. New parts animate only without reduced motion.
- **Responsive.** The Phase 2C/2D layouts are unchanged: board-first phones, forgiveness requests before the board, compact ranking disclosure below 1300px, ranking then chat. Dictionary columns are slightly rebalanced for Fraunces words.

Real routes, homepage SEO copy, gameplay, protocol, scoring, vocabulary, daily selection and persistence are unchanged.

## 2. Issues found and fixed in the completion pass

1. **WebKit multiplayer timeout: test-harness bugs, not app bugs.** Restoring "Marc" works in WebKit when tested in isolation. The full suite failed because of three bugs in `scripts/browser-driver.mjs`. None were Phase 3A regressions, and WebKit multiplayer had never passed (Phase 2D listed it as not yet run).
   - Switching WebDriver windows resets the context to the top-level document, so the framed (<440px) page evaluated against its blank wrapper and never saw the lobby. Fix: re-enter the frame after a window switch.
   - The `data:` wrapper made the app's iframe cross-origin. WebKit then silently ignores `element.focus()` inside the frame, which broke the app's focus management and every keyboard check (keys reached `<body>`). Fix: the wrapper is now a same-origin static page (`/robots.txt` with its body replaced).
   - Closing a participant window left the session pointing at a dead window, so the next `newPage()` failed with "no such window". Fix: switch back to the first window after closing.

   No assertions changed. Both scenarios (4 and 10 players, ties, reconnect, departure, chat, results, rematch) now pass in WebKitGTK 2.54.
2. **Fallback fonts lost bold weight.** `font-synthesis: none` (pre-existing since Phase 2B) combined with a regular-only `Penjat UI Fallback` face rendered every 600/700 weight at 400 when the web font is unavailable. Buttons, labels and names lost their hierarchy. Added a matching bold fallback face (`src/index.css`). The re-measured blocked-font layouts show no vertical shift on desktop home/learning/daily/board/match. The one remaining shift is a 17px meta-chip rewrap on the 390px board; there is no clipping. Fraunces → Georgia can still change the line count of a large desktop headline (the earlier Spanish 1366 home measured 31px). Georgia isn't installed here to calibrate `size-adjust` against, and Android has no Georgia, so I did not guess metric overrides; both fonts are preloaded.
3. **Duplicated CSS overrides.** Phase 3A had appended an override layer that re-declared 27 selectors already defined earlier, leaving dead hard-coded colours behind (e.g. the old green key states). I folded every override that is cascade-safe into its original rule, counting equal-specificity intermediate rules, including media queries. I also deleted the original declarations that the overrides always replace, plus three more dead declarations (the old translucent back-button/language-selector backgrounds and an unnecessary `filter: none`). Four overrides stay in the labelled Phase 3A block because a media query or sibling rule makes their position significant (baseline: 2 pre-existing duplicates). **Verification:** I compared computed styles for every element and `::before`/`::after` across 24 states × 5 viewports (120 renders, 23,063 elements) before and after. They are identical, apart from mid-animation sampling of two pulses. Real-pointer hover styles for primary/secondary/daily/key/back controls are also identical.
4. **Lint.** Excluded the Lovable reference project (`lovable/**`) in `.oxlintrc.json`; it is a separate prototype with its own config. The remaining 3 warnings are in older Phase 2.1 exploration scripts and predate this phase.
5. **Harness robustness.** `font-fallback.mjs` no longer crashes when an intercepted request disappears during navigation, and it accepts `APP_URL`/`BIDI_URL`. `identity-checks.mjs` now asserts that Tab moves focus to the next key. With `WEBKIT_DISPLAY` it restores X input focus after a resize, because a bare Xvfb has no window manager and a resized MiniBrowser window would never match `:focus-visible`. With that, WebKit renders the ring at every width (see `screenshots/identity/webkit-*-focus.png`). Without `WEBKIT_DISPLAY`, the check records any unobservable WebKit ring in the report instead of passing silently.
6. **Artifacts.** Removed `screenshots/specimen/` (1.7 MB): an unreferenced intermediate capture superseded by `screenshots/after/`.

### Phase 2C interaction-check audit

I compared the Phase 2C harness with the archived original in `design-explorations/phase-2c.zip`:

- **Added (stricter):** the short-word board and full alphabet must fit the 390×844 first viewport in CA and ES. Explicit checks were also added for the compact ranking above chat at 1000/1299px.
- **Updated to the Phase 2D design:** full sidebar ranking from 1300px (was 1000px). This matches Phase 2D's documented three-column boundary and the multiplayer test's `COMPACT_MAX = 1299`.
- **Relaxed:** for a long word *plus* a reconnect notice, the alphabet at heights ≥844 must now be reachable rather than entirely in the first screen. I measured a reconstructed pre-3A tree (HEAD + `preexisting.patch`). It already put the keyboard bottom at 866px > 844 at 390×844, so this was a Phase 2D change, not a Phase 3A regression. Phase 3A moves it by 1px (867). Without the notice, the long word fits (814px) and the short word fits (774px); both are unchanged.

## 3. Test results (final tree)

All logs are in `design-explorations/phase-3a/logs/`.

| Check | Result |
| --- | --- |
| `npm run build` | pass (pre-existing >500 kB chunk warning: bundled vocabulary) |
| `npm run lint` | pass, 3 warnings in Phase 2.1 exploration scripts |
| `tsc -b`, `tsc -p server/tsconfig.json --noEmit` | pass |
| `test:learning`, `vocabulary`, `daily`, `invitation`, `localization`, `multiplayer-ui`, `match-results`, `character` | pass |
| rebuilt-server `test:game`, `chat`, `lifecycle`, `match`, `n-player` | pass |
| `test:vocab`, `vocab:validate` (offline) | pass |
| `test:e2e` (dedicated server) | pass |
| `test:seo` | pass |
| `test:browser` (Firefox BiDi, documented suite) | pass |
| Phase 2C interaction checks | 37/37 pass |
| Live multiplayer, deterministic first setter | Firefox 157, Chromium 151 and WebKitGTK 2.54: pass |
| Identity checks (contrast tokens, focus ring, board geometry, 14 renders each) | Firefox, Chromium, WebKit: pass |
| Strict capture matrix, 180 renders | 0 overflow, truncation, clipping, crushed panels, <24px targets or contrast failures |
| Real 200% text (32px default font profile), 64 renders, strict | 0 flags |
| `git diff --check` | clean |

**Remaining failures and flakes:**
- One WebKit multiplayer run aborted mid-scenario when MiniBrowser's GTK/glycin icon loader crashed (`logs/webkit-multiplayer-minibrowser-crash.txt`). That is a browser-chrome crash; the rerun passed. Earlier in the session, a full `/tmp` quota from my own style snapshots also crashed Xvfb; I deleted them.
- The random-setter Chromium log (`logs/chromium-multiplayer.txt`) still shows that the tie fixture requires `DETERMINISTIC_FIRST_SETTER=1`. This is by design of the test.

## 4. Browser coverage and limitations

- **Engines:** Firefox 157 (BiDi), Chromium 151 (CDP, Playwright-downloaded binary) and WebKitGTK 2.54 (WebKitWebDriver under Xvfb).
- **Simulated phones:** phone widths are resized desktop viewports. WebKit below 440px uses an exact-size same-origin iframe.
- **Not tested:** no physical device and no iOS/macOS Safari.
- **Reduced motion:** Chromium with `prefers-reduced-motion: reduce` has no running animations and 0s transitions on home, lobby, waiting and board. Without reduced motion, the lobby/thinking pulses run.

## 5. Accessibility and responsive verification

- **Contrast** (sRGB from rendered OKLCH): ink/paper 15.83:1, muted/paper 6.53:1, primary text/magrana 4.87:1, correct key 5.51:1, incorrect key 6.12:1, warning 7.87:1, input boundary 5.29:1.
- **Focus:** 3px solid rings in all three engines.
- **Order and disclosure:** board-first order, forgiveness before the board, and ranking disclosure Tab/Enter/Space with state and focus kept across live updates are covered by the Phase 2C and live multiplayer suites.
- **Fit and scrolling:** the 390×844 short-word board keeps the full alphabet in the first viewport. At 320×568, controls keep their size and the page scrolls. No horizontal overflow from outlines or shadows, including at 240px and at 200% text.
- **Text handling:** accents, `l·l`, spaces, hyphens and 23-letter words are covered by fixtures in both languages.

## 6. Screenshots

- Gallery: [paired before/after gallery](../design-explorations/phase-3a/index.html), 180 pairs: CA/ES × 1920×1080, 1440×900, 1366×768, 768×1024, 390×844, 320×568 × 15 states. "Before" images are in `before/` and `screenshots/before-extra/`. "After" images were regenerated on the final CSS in `screenshots/after/`. Learning words are random per capture.
- Quick comparisons: [desktop home](../design-explorations/phase-3a/comparisons/ca-1440x900-home.png), [mobile board](../design-explorations/phase-3a/comparisons/ca-390x844-guessing.png), [Spanish desktop](../design-explorations/phase-3a/comparisons/es-1440x900-home.png), [Spanish mobile](../design-explorations/phase-3a/comparisons/es-390x844-home.png).
- Contact sheets per language/width: `review/`.
- Other captures: 200% text in `screenshots/text200/`, font fallback pairs in `screenshots/fallback/`, per-engine focus in `screenshots/identity/`.

I reviewed the screenshots themselves as well as the metrics. Desktop, tablet and phone layouts are coherent and match the pre-3A geometry: playful but calm, with the clearest hierarchy on the homepage. The forgiveness, setter, 4/10-player ranking, long/duplicate-name, results and rematch states render correctly in both languages. I found no visual defect requiring change.

## 7. Outstanding low-priority items and decisions

- Fraunces has no metric-adjusted fallback (see §2.2).
- A very long winner name produces a 4–5-line outcome heading at 320px (e.g. "Maria Antònia Fernández de Castro i Vilallonga"). This was the same before Phase 3A, and the page scrolls with the action bar visible.
- "Aprèn català" stays in Catalan in the Spanish interface as the mode's name, which is existing copy.
- Lint warnings remain in the Phase 2.1 exploration scripts.
- The build chunk-size warning is pre-existing.
- `design-explorations/` holds about 400 MB from earlier phases (Phase 3A: 50 MB) and is untracked. `.gitignore`'s `logs` pattern excludes `phase-3a/logs/` from any commit, so copy the logs elsewhere if they need to travel with the changeset.

## 8. Working-tree state

- Tracked files modified: 33. That's the pre-existing Phase 2 changes plus Phase 3A in `src/App.css`, `src/index.css`, `HangmanDrawing.tsx` and related components/tests, docs, and `.oxlintrc.json`.
- New untracked files: `tests/character-test.tsx`, `src/assets/fonts/fraunces-latin-variable.woff2`, `scripts/build-display-font.py`, `public/licenses/Fraunces-OFL.txt`, `docs/phase-3a-visual-identity-report.md`, the `design-explorations/phase-3a/` harness and evidence, and the driver fixes in the untracked `scripts/browser-driver.mjs`.
- Untouched: `lovable/` (reference) and a `lovable.zip` that appeared in the repository root during this session (not created by this work).
- No commit, push or deploy.
