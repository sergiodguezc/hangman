# Phase 2B — Typography, responsive layout and visual system

Implemented and validated locally on 2026-10-09 with Node 22.23.3 and Firefox 157.0.1 (headless, WebDriver BiDi). Nothing was committed, pushed or deployed. Existing uncommitted Phase 1, 2.1 and 2A work was preserved. There are no new npm dependencies.

Inputs: `~/docs/Penjat-audit-2026-10-09.md` (sections C and F08–F12, F18, F19), `docs/p0-functional-accessibility-report.md` and `docs/phase-2a-match-results-report.md`. The design-comparison HTML was not loaded; it is 1.4 MB of embedded font specimens, and the audit already records the decision it supports.

## 1. Implementation summary

**Font.** Source Sans 3 is self-hosted as **Penjat UI**:
- One variable WOFF2 file of 30,580 bytes, covering weights 400–700, roman only.
- It is subset from the upstream Google Fonts file (SHA-256 recorded).
- The upstream OFL reserves the name "Source", so the subset is renamed in its `name` table. Its copyright, trademark and license records are kept.
- The OFL is shipped at `/licenses/source-sans-3-OFL.txt`.
- The face uses `font-display: swap` with a matching `unicode-range`.
- The build adds a `<link rel="preload">` for the hashed asset, which is served with `immutable` caching.
- A `Penjat UI Fallback` face (`local(Arial/Helvetica/Liberation Sans)`) has `size-adjust: 93.3%`, `ascent-override: 109.8%`, `descent-override: 42.9%` and `line-gap-override: 0%`. These values were computed from the font's metrics and a Catalan letter-frequency sample, so a swap barely reflows.
- Georgia is not shipped. It stays local, with `ui-serif`/`serif` fallbacks.

**Role split.**
- Georgia (`--font-display`) is used for: brand, hero, page titles, help section titles, Spanish hint, word tiles, room code, learning and daily outcome words, the match outcome heading and the "rival is choosing" message.
- Penjat UI (`--font-ui`) is used for everything functional:
  - body text, buttons, inputs, labels and chat;
  - ranks and scores (tabular figures);
  - functional panel titles: Classificació, Xat, Classificació final, Resultat de la ronda and the forgiveness tray.

**Semantic tokens** (`src/index.css`, in rem; the root font size is left at the browser default):

| Token | Phone | ≥661px | ≥1200px |
|---|---:|---:|---:|
| `--text-body`, `--text-control`, `--text-name` | 16 | 17 | 18 |
| `--text-chat` | 16 | 16 | 17 |
| `--text-lede` | 17 | 18 | 19 |
| `--text-meta` (status, metadata, captions) | 14 | 14 | 15 |
| `--text-label` (eyebrows, chat authors, dt) | 13 | 13 | 14 |
| `--text-panel-title` | 20 | 22 | 24 |
| `--text-page-title` | 24 | 28 | 30 |
| `--text-score` | 18 | 20 | 22 |
| `--text-outcome` | clamp 30→44 | | |

Alongside these:
- line heights: `--leading-tight`, `-heading`, `-ui`, `-body`;
- weights: 400, 600 and 700. No 800/900 weights remain; the font file stops at 700;
- `--tracking-label`, used for uppercase labels only;
- `--measure` (62ch);
- spacing `--space-1…8`;
- radii: `--radius-control`, `-inner`, `-card`, `-dialog`, `-pill`;
- `--shadow-card`, `--shadow-dialog`, `--control-height` (44px).

All Phase 2A `--results-*` tokens now map onto this scale.

**Layout.** Breakpoints are now in em (px ÷ 16). At default text size they behave identically; with larger default text the narrower layouts take over.

- **Gameplay shell.** Previously it switched at 1100px between three columns of 240/310px and a full stack.
  - **≥1300px:** three columns. The ranking is `min(17.5rem, 21vw)`, the chat `min(19.5rem, 23vw)`, and the board keeps at least about 640px.
  - **1000–1299px:** the board is wide, with forgiveness, ranking and chat in a `min(18.5rem, 30vw)` sidebar. This removes the audit's 1101–1200px squeeze (F12).
  - **≤999px:** everything stacks, matching the match-results boundary.
- **Card alignment.** Grid rows have no row gap; margins provide the spacing. An absent forgiveness tray no longer pushes the chat or sidebar one gap below the board (F11).
- **Chat height.** In three columns the chat follows the board's height, capped at `max(38rem, 100dvh − 9rem)`.
- **Live scoreboard (F09).** Each row is a grid of rank | identity | score.
  - Names wrap with `overflow-wrap: anywhere` instead of being ellipsized.
  - "tu/tú" is a separate pill (`.player-self`) outside the name, and the row gets `.is-self`.
  - Scores are tabular pills that grow with the number of digits instead of a fixed 29px circle.
  - When stacked, the list uses `auto-fill` columns: four at 768px, two on a 390px phone, one below about 330px.
- **Other wrapping.** Observer tabs, round-result names and departed names now wrap instead of truncating. Observer tabs still scroll horizontally as a strip.
- **Keyboard keys.** 36×40px on phones (up from 33×35), 38×40 on tablets, 42×44 at ≥1200px, and 33×38 below 360px. The row count stays four on a 390px phone.
- **Text enlargement.** Sidebar and column widths are capped with viewport-relative `min()`, so enlarged text can't squeeze the board.
- **Reflow.** The global `body { min-width: 320px }` is removed. A narrow rule at ≤359px slims gutters and card padding, wraps headers, scales the room code, and lets help titles, standings, statuses and match actions wrap.
- **Container query.** The learning level picker shows four buttons only when "Intermedio" fits, and two otherwise. This replaces the 420px `!important` rule.

**Smaller fixes found during inspection:**
- `.learning-next-level` ("Paraula següent: Tots") was unstyled and flush with the card edge. It now has padding and meta styling.
- The learning and daily headers now align with their cards.
- The setup card's pale footnote, previously #9a9f9b (about 2.6:1), now uses the muted colour.
- The CA/ES separator (2.91:1) and the setter's "+0/+2" round points (4.499:1) were darkened.
- Small targets were enlarged: the copy-code link, level and invitation links, and the round-results summary now reach 44px; active reaction chips grow from 29×27 to 36×32.

Unchanged: colours other than those three, radii semantics, all behaviour and copy, the protocol, scoring, daily selection and persistence, vocabulary, SEO metadata and routes, and the Phase 2A logic.

## 2. Files changed (Phase 2B only)

| File | Purpose |
|---|---|
| `src/index.css` | `@font-face` (web font plus metric-matched fallback); font, type, leading, weight, space, radius and shadow tokens; the two type-scale steps; `min-width` removed. |
| `src/App.css` | Every font declaration migrated to tokens. New gameplay grid (1300/1000 boundaries, no-row-gap alignment, capped columns), scoreboard rows, wrapping in observer, round and departed lists, keyboard sizing, chat sizing, lobby and dialog widths, Phase 2A results tokens mapped, em breakpoints, ≤359px reflow rules, contrast and target fixes. |
| `src/components/Scoreboard.tsx` | `player-identity` wrapper; separate `.player-self` badge; `.is-self` row class. Markup only. |
| `vite.config.ts` | Build-only plugin that preloads the hashed UI font. |
| `src/assets/fonts/penjat-ui-variable.woff2`, `src/assets/fonts/README.md` | Font asset and its provenance and licence notes. |
| `public/licenses/source-sans-3-OFL.txt` | OFL 1.1 text served with the site. |
| `scripts/build-ui-font.py` | Deterministic subset, rename and WOFF2 build; `--compare` writes the static alternatives. |
| `tests/multiplayer-ui-test.tsx` | Scoreboard assertions updated to the new markup. They now also assert exactly one self badge and no " · tú" suffix on the name. |
| `scripts/homepage-browser-checks.mjs`, `scripts/browser-audit-test.mjs` | Pinned 14px/18px/48px and 13px values now follow the scale: 15px, 20px and 52px at ≥1200px, and 14px for the daily-result footnote. |
| `design-explorations/phase-2a/capture.mjs` | Zoom check tightened. Page overflow is now measured against the real 195px viewport instead of being tolerated up to 320px. |
| `design-explorations/phase-2b/` | Local QA harness: `fixtures.html/.tsx`, `capture.mjs`, `font-check.html`, `font-fallback.mjs`, logs and screenshots. |
| `docs/architecture.md`, `docs/development.md`, `AGENTS.md` | Styling-system section, QA harness and font rebuild instructions, and a one-line styling convention. |

## 3. Before/after visual examples

Side-by-side comparisons are in `design-explorations/phase-2b/screenshots/compare/`:

- `ca-1366x768-setter.png`: ten long names. Before, they were truncated, including "Sergio · tu" fitting only by luck. After, names wrap, the "tu" pill is separate, and observer tabs show full names.
- `ca-1100x800-guessing.png`: before, the ranking was stacked above the board with the board below the fold. After, the board sits beside a sidebar holding the ranking and chat.
- `ca-1920x1080-learning-result.png`, `ca-1440x900-home.png`, `es-1440x900-help.png`: desktop body, labels and captions at 18px/15px/14px instead of 16px/13–14px/10–11px.
- `es-1366x768-round-over-long.png`, `es-768x1024-round-over.png`: sans-serif tabular round points, wrapped names and readable metadata.
- `ca-390x844-guessing.png`, `ca-390x844-daily-result.png`, `es-390x844-learning-result.png`, `ca-320x568-guessing-long.png`: phones keep a 16px body. Labels go from 10–11px to 13px, and keyboard keys are larger.
- `ca-1366x768-match-long.png`: Phase 2A results with the new type.

The full sets are `screenshots/before/` (396 renders) and `screenshots/after/` (572 renders), named `{lang}-{w}x{h}-{screen}.png`, with per-render metrics in `before.log` and `after.log`. Also captured: `reflow/`, `text200/`, `a11y/`, `fallback/` and `font-specimen.png`.

## 4. Responsive QA results

**Screens** (real app plus fixtures that render the real `GamePage`/`LobbyPage`):
- home, multiplayer setup and help;
- learning: setup, game, result, loss, level dialog, summary;
- daily: in progress and result;
- lobby, chat with real messages and reactions, and typing indicator;
- word choice, waiting, guessing (short and long), forgiveness wait, setter with forgiveness tray and ten long names, round over (short, and long with typing);
- match results (ten players; long and duplicate names).

**Viewports:** 1920×1080, 1440×900, 1366×768, 1300/1299×800, 1200×800, 1100×800, 1024×768, 1000/999×800, 768×1024, 390×844 and 320×568, in **CA and ES**. That is 13 × 2 × 22 = 572 renders. Each render recorded page overflow, ellipsized or truncated text, the minimum text size, WCAG text contrast, targets under 24px, clipped controls and squeezed primary surfaces.

| | Before (9 viewports, 396 renders) | After (13 viewports, 572 renders) |
|---|---|---|
| Smallest rendered text | 10px (54 renders), 11px (252), 12px (90) | 13px on phones and tablets, 14px from 1200px |
| Renders with truncated text | 74 (scoreboard, observer tabs, "Sergio · tu" on phones) | 0 |
| Horizontal overflow | 0 at ≥320px (masked by `min-width`) | 0 |
| Contrast, target, clip and squeeze flags | not measured | 0 |

**Breakpoint neighbours checked:** 1299/1300, 999/1000 and the 1100/1200 transitions, plus 599/600, 660/661 and 860/861 in the existing browser suite. Phase 2A's 392-render match-results matrix (14 viewports, including 661/660 and 844×390) passes unchanged.

**Visually reviewed after iterating:**
- 1920 and 1300 three-column layouts, 1100 two-column, and 768, 390 and 320 stacks;
- help at 1440, learning result at 1366 and 1920, daily result at 390;
- lobby at 1100 and 320, the dialog at 390, Spanish round results at 768, and match-long at 1366.

**Problems those reviews caught and fixed:**
- the one-gap offset of the sidebar and chat;
- "Perdonar la vida" wrapping inside its button;
- the serif fallback getting worse after I briefly added 'Times New Roman' (reverted);
- the learning header misaligned with its card;
- chat shorter than the board at 1920.

## 5. Accessibility findings

- **Reflow (WCAG 1.4.10).**
  - 320×256 CSS px (400% zoom of 1280×1024): no horizontal scrolling on any of the 22 screens, in CA or ES.
  - Below the WCAG requirement, 256×512 and 195×422 (200% zoom on a 390px phone) also show no overflow on any screen, now that the global `min-width: 320px` is gone.
  - That `min-width` was the cause of the earlier zoomed-phone scrolling noted in Phase 2A: it forced a 320px-wide canvas.
  - Remaining horizontal scroll: word strips for very long words (for example, 23 letters in a 360px column). This is the intended two-dimensional exception. The strip is focusable and keeps letters at 18px or more.
- **200% text enlargement (WCAG 1.4.4).**
  - Tested in a separate disposable Firefox profile with a 32px default font size, which is a real browser setting, not an emulation.
  - At 1366, 1024 and 390 in CA and ES, no overflow, clipping, truncation or squeezed surfaces were found.
  - Before the em breakpoints and `min()` caps, emulated 200% text at 1366px left the board about 40px wide while the rem-sized sidebars doubled. The overflow metric missed this because the card hides overflow, so I added the squeezed-surface metric.
  - The hero headline was px-only and is now rem-based.
  - Word tiles and the brand mark remain px-sized by design.
- **Contrast.** Computed foreground against the nearest opaque background for every visible text node at six viewports in CA and ES: 0 failures after the separator and setter-points fixes. The scanner itself caught both failures, which confirms it detects problems. Translucent and gradient backgrounds are approximated by their nearest opaque ancestor.
- **Targets.** No visible control under 24px. Primary controls are 44px or more. Reaction picker buttons are 34px.
- **Phase 1 and 2A behaviour preserved**, as shown by the browser suite:
  - native-dialog focus containment, Escape and focus restoration;
  - reaction trigger keyboard and touch flows;
  - visible focus rings, which were not changed;
  - match-results focus and the single announcement;
  - the phone action bar and scroll padding.

  Reduced-motion rules are unchanged.
- **Language switching.** Both languages are measured in every check. Spanish labels ("Intermedio", "Clasificación final", "Esperando la reconexión de …") wrap without clipping.
- **Limitations.**
  - Firefox only, so no Chromium/WebKit, physical devices or screen-reader session.
  - Safe-area insets and on-screen keyboard behaviour are reasoned from CSS, not device-tested.
  - Firefox's text-only zoom (as opposed to the default font-size preference) was not separately exercised.

## 6. Performance impact

| Asset | Before | After |
|---|---:|---:|
| Fonts | 0 B (Inter declared but never delivered; audit F10) | **30,580 B**, 1 request, preloaded, `immutable` |
| CSS | 52,191 B (10,979 B gzip -9) | 65,175 B (12,855 B gzip -9) |
| JS | 766,573 B (162,132 B gzip -9) | 766,717 B (162,156 B gzip -9) |

- **Weights:** the variable axis is limited to 400–700, so 400, 600 and 700 are all served from one file.
- **Alternatives measured:** three static instances would total 46,896 B (15,676 + 15,692 + 15,528). The full upstream variable WOFF2 is 169,952 B.
- **Budget:** the ≤60 KB target is met with about half to spare.
- **CSS growth:** +1.9 KB gzip, mostly verbose `var(--…)` names and the new layout rules.
- **Build warnings:** no new ones. The existing >500 kB JS chunk warning remains (F20).
- **Layout shift.** Measured by comparing geometry with Penjat UI against the fallback stack (`font-fallback.mjs`) at 1366×768 and 390×844 across five pages:
  - no measurable shift on desktop;
  - on phones, one line (21px) on two pages (learning and guessing) and 0 on the other three.

  Arial/Helvetica are not installed on this machine, so the comparison used the system sans (Noto), not the metric-matched Arial face; on Windows and macOS the shift should be smaller. Cold-network timing, real CLS and Core Web Vitals were **not** measured, and no CWV improvement is claimed.
- **Glyph coverage, verified on the shipped file in the browser** (`font-check.html`):
  - every character in à è é í ï ò ó ú ü ç ñ and their capitals, `·`/`l·l`/`L·L`, `Ŀ ŀ`, `¡ ¿ « »`, typographic quotes, dashes, `…`, `€` and arrows comes from Penjat UI at 400, 600 and 700;
  - so do decomposed sequences (`a + U+0300`, `c + U+0327`, `n + U+0303`, and others), with marks positioned by `mark`/`ccmp`;
  - emoji, `✓` and `★` intentionally fall back to system fonts.

## 7. Test results

All commands were run on the final working tree with Node 22.23.3.

| Command | Result |
|---|---|
| `npm run build` | pass (existing chunk-size warning only) |
| `npm run lint` | pass. 3 warnings, all in the pre-existing untracked `design-explorations/phase-2-1*` scripts. The Phase 2B scripts are lint-clean. |
| `npx tsc -b --pretty false`, `npx tsc -p server/tsconfig.json --noEmit` | pass |
| `test:learning`, `test:vocabulary`, `test:daily`, `test:invitation`, `test:localization`, `test:multiplayer-ui`, `test:match-results` | pass |
| `test:game`, `test:chat`, `test:lifecycle`, `test:match`, `test:n-player` | pass. `dist-server` unchanged, since there were no server source changes. |
| `test:vocab`, `vocab:validate` | pass |
| `TEST_SERVER_URL=http://127.0.0.1:3002 npm run test:e2e` | pass |
| `npm run test:seo` | pass |
| `TEST_SERVER_URL=http://127.0.0.1:3002 BIDI_URL=ws://127.0.0.1:9222 npm run test:browser` | pass: P0 dialogs and chat, homepage geometry and navigation, 599–661 contracts, invitations, learning, terminal match and the Phase 2A real-match flow |
| `node design-explorations/phase-2a/capture.mjs` | pass: 392 renders, keyboard and disclosure checks, zoom and fallback-font checks |
| `node design-explorations/phase-2b/capture.mjs` (matrix, reflow, `--text200` and 32px profile, a11y) | 0 flags (section 4) |

**Problems hit during the runs, all resolved:**
- One `test:browser` run failed its final "no console errors" assertion. The error came from a leftover tab my own ad-hoc BiDi helper had left open on the QA harness with a malformed URL. I made the helper close its tabs and the harness default unknown views, then re-ran successfully twice.
- The long capture loses its BiDi socket after about 490 renders in one session. The remaining viewports were captured in a fresh session, and the script now fails loudly on socket close.
- Lint caught a regex-escape bug in my contrast scanner: `\d` inside a template literal. The scan was re-run after the fix, and that run found the two real contrast issues listed in section 5.

## 8. Phase 2C recommendations

- **Learning result layout (F14).** The answer still appears twice: as solved tiles and as a large heading. The drawing column stays tall beside a long definition card. Consider a compact mistake summary and putting the vocabulary card first.
- **Compact live ranking on phones (F13).** With ten players at 320–390px the ranking takes several screens before the board. The rows are now readable but long. A collapsible "top 3 + you" summary would put the board first.
- **Long words in narrow columns.** In the setter view at 1300–1366px, words over about 18 letters scroll inside their strip. A smaller drawing column in setter and observer view, or a smaller minimum letter width, would avoid most of that.
- **Test on real devices:** iOS and Android safe areas, the on-screen keyboard with the chat and the fixed results bar, and Chromium/WebKit rendering of the fallback metrics.
- **Firefox text-only zoom:** measure it separately from the default-font-size preference.
- **Bundle (F20):** split the bundled vocabulary by route. It is unrelated to the font but remains the largest performance item.
