# Phase 2A — Multiplayer match results

Implements the approved outcome-first end-of-match surface (audit 2026-10-09, findings F01, F02 and F15; F03–F07 from Phase 1 preserved). No protocol, scoring, rotation, forgiveness, daily, vocabulary or SEO changes.

## What changed

When `roomStatus === 'match-over'`, `GamePage` renders a mutually exclusive branch. The board, alphabet, word form, round banner, forgiveness tray and live sidebar scoreboard are no longer rendered. `RoomChat` keeps its React slot, so a chat draft survives the transition. The header drops the turn and volta counters and keeps the room code and game language.

Results card order: eyebrow → outcome heading (Georgia, clamped 30–44px; 24–30px on viewports shorter than 480px) → one supporting sentence (17–19px) → actions and readiness → **Classificació final / Clasificación final** → collapsed `<details>` for the last round. Chat is a 320px sticky column at ≥1000px and stacks below at 999px and narrower (no three-column shell, and no layout risk around 1100–1200px).

| File | Responsibility |
|---|---|
| `src/multiplayer/matchResults.ts` | Pure helpers. `matchStandings` builds rows from the `matchResult` snapshot with `rankByScore`. It includes departed players and unknown IDs, flags the current player by ID, and returns `null` for a missing or incomplete snapshot. `matchOutcome` derives the outcome from the top-score group. `outcomeCopy` produces the localized heading and supporting sentence. |
| `src/components/MatchResults.tsx` | Results surface: `FinalStandings`, `RematchActions` and `LastRound`. Handles the focus/announcement transition and measures the phone action bar. |
| `src/pages/GamePage.tsx` | Match-over branch. After a rematch starts, restores focus into the game instead of leaving it on `<body>`. |
| `src/App.tsx` | `leave(destination)`: "Surt al menú" leaves and goes to `/`; "Crea una sala nova" and the back button keep `/multijugador/`. |
| `src/components/RoundResults.tsx` | Optional `showTitle` so the disclosure doesn't repeat its heading. |
| `src/components/Scoreboard.tsx` | `FinalScores` retired; the live sidebar is unchanged. |
| `src/multiplayer/i18n.ts` | Paired CA/ES copy. Readiness shortened to "2 de 9 jugadors preparats" / "2 de 9 jugadores listos". `cannot-rematch` maps to an explanation. Three keys orphaned by the old block were removed. |
| `src/App.css` | Scoped `.match-over-page` block with local tokens (`--results-heading-font`, `--results-heading-size`, …). The old `.match-result` and `.final-scores` rules were removed. |

## Decisions

- **Outcome:** a unique leader is a win (including a departed leader). Several leaders share first place; three or fewer other names are listed with `Intl.ListFormat` (so Spanish gets "y" or "e" as needed), and larger groups are summarised with a count. Lower-place ties only change the player's own line ("Comparteixes el 2n lloc amb 5 punts"). All-zero tops are ties. An absent, empty or score-incomplete snapshot shows "Resultat no disponible" with no standings.
- **Names have no Catalan personal article** ("Júlia ha guanyat", not "La Júlia"): gender cannot be inferred from a display name. The same applies to gendered adjectives, so the copy uses "Revenja sol·licitada" rather than "Estàs preparat/da".
- **Completion reason:** I don't show "ended early". `completedTurns` counts cancelled turns as completed, so it isn't a reliable signal, and the snapshot has no reason field (audit F04).
- **Rematch:** the action comes before the classification. Pressing it sets `aria-disabled` and `aria-busy` and shows "Enviant…". Repeat activations are ignored. A late `rematch-already-ready` acknowledgement is treated as success. Once ready, the button is replaced by a non-button status (check badge), and focus moves to it if it was on the button. Readiness counts and dots come from `rematchAvailability`: active roster only, with reconnecting players counted. Reconnecting names appear above the actions. With fewer than two active players, an explanation plus "Crea una sala nova" / "Surt al menú" replace the rematch.
- **Phones (≤660px wide and ≥480px tall):** `.match-actions` is `position: fixed` at the bottom, with safe-area padding. A `ResizeObserver` writes its height to `--match-actions-height`. That variable reserves page bottom padding and sets `scroll-padding-bottom`, so Tab-focused rows and the summary scroll clear of the bar. While the chat input has focus, the bar slides out of view (transform only, so the layout doesn't jump), leaving room for the on-screen keyboard. The DOM order is unchanged, so screen readers meet the actions right after the outcome. Shorter viewports (landscape phones, heavy zoom) keep the actions inline directly after the outcome rather than letting a fixed bar take half the screen.
- **Focus and announcement:** on mount, `MatchResults` scrolls to the top and focuses the heading (`tabIndex=-1`, described by the supporting sentence). That is the single announcement. If a text field still has focus (e.g. the chat input), it does not steal focus and instead fills an empty polite status region once. Readiness has its own short polite text. Language switches and readiness or reconnection changes neither refocus nor re-announce. The heading has no focus ring because it isn't a control. The `<summary>` gets the app focus ring (Firefox otherwise showed its blue UA ring).
- **Rows:** grid of rank, name block and score. Names wrap (`overflow-wrap: anywhere`) and the "Tu/Tú" pill wraps with them, so it never truncates. Leader rows get a green tint and border. The self row gets a green border and an inset accent. Departed rows get a dashed border on a near-white background with full-contrast score text and "Ha sortit de la sala". Screen-reader text gives "1r lloc: Name, Tu, 27 punts"; the "Punts" column label is visual only.

## Verification

Node 22.23.3, Firefox 157 headless (WebDriver BiDi). All commands exited 0:

| Command | Result |
|---|---|
| `npm run build`, `npm run lint`, `npx tsc -b`, `npx tsc -p server/tsconfig.json --noEmit` | pass (lint: 3 pre-existing warnings in untracked `design-explorations/phase-2-1*` scripts; build: existing chunk-size warning) |
| `test:match-results` (new) | pass: standings, outcomes, CA/ES copy, ordinals, key parity, gameplay removal for every scenario, 10 players, long/duplicate names, 128-point scores, departed/reconnecting, details collapsed, interrupted round, every rematch state, real `GameRoom` 2- and 10-player snapshots, a11y structure |
| `test:multiplayer-ui` (updated to the new standings) | pass |
| `test:game`, `test:chat`, `test:lifecycle`, `test:match`, `test:n-player` | pass (`dist-server` unchanged: no server source changes) |
| `TEST_SERVER_URL=http://127.0.0.1:3002 npm run test:e2e` | pass |
| `test:learning`, `test:vocabulary`, `test:daily`, `test:invitation`, `test:localization`, `test:seo` | pass |
| `test:vocab` (52 tests), `vocab:validate` (544 entries) | pass |
| `npm run test:browser` (local built server 3002) | pass, including the updated P0 terminal check and the new real-match flow |

**Fixture matrix** (`design-explorations/phase-2a/`: `fixtures.html` renders the real `GamePage` with snapshots from `tests/match-results-fixtures.ts`; `capture.mjs` runs the checks). It covers 14 scenarios × 14 viewports (1920×1080, 1440×900, 1366×768, 1180×820, 1100×800, 1024×768, 1000/999×800, 768×1024, 661/660×900, 390×844, 320×568, 844×390) × CA/ES = 392 renders. Each render asserts:
- no horizontal overflow or clipped rows/buttons, and the self pill inside its row;
- heading in Georgia within 30–44px (24–30px when shorter than 480px), and focused on load;
- primary action inside the initial viewport, and above the standings unless the bar is fixed;
- chat beside the results at ≥1000px and below otherwise;
- the fixed bar only on phones;
- after scrolling to the end, the bar still pinned and nothing ending behind it, and every row can be revealed above it.

Additional checks in the same script:
- Tab order (rematch → menu → summary) and Shift+Tab back to the rematch.
- Enter/Space toggle the disclosure.
- Pending state blocks a repeat press.
- Chat focus hides the bar.
- Zoom equivalents (195×422 and 640×450).
- Forced serif/monospace fallback fonts.

Measured heading sizes: 44px at 1920/1440, 37px at 1024, 33px at 768, 30px at 390. Supporting sentence: 19px desktop, 17px phone. Rank contrast 7.89:1.

Screenshots are in `design-explorations/phase-2a/screenshots/` (`{ca,es}-{viewport}-{scenario}.png`; `-full` for whole pages):
- two-win, two-tie, two-loss
- four-tie-departed, others-tied, many-leaders, ten (+ `-full`, `-details-open`)
- long-names (+ `-fallback-fonts`), departed-winner, reconnecting
- ready-waiting, `es-390x844-two-win-pending`
- unavailable, interrupted, missing-result
- `ca-390x844-ten-chat-focused`, zoom variants

Real-app captures are written to `/tmp/penjat-phase-2a-validation/` by `test:browser`.

## Limitations

- Firefox only (no Chromium/WebKit, no physical iOS/Android). `env(safe-area-inset-bottom)` and the on-screen-keyboard interaction are reasoned, not device-tested. No screen-reader session was run; announcements were verified structurally (focus target, live-region contents) only.
- Below 320 CSS px (e.g. 200% zoom on a 390px phone), the app-wide `body { min-width: 320px }` scrolls the page horizontally. The results themselves don't clip. Headless Firefox's classic scrollbars produce the same effect at exactly 320px.
- A missing result still offers a rematch when the server allows one. The UI never decides rematch eligibility itself.
- The game-language chip shows the language's own name ("Català") in the Spanish UI. This is pre-existing (audit F16).

## Deferred to Phase 2B

- Source Sans 3 and the application-wide type scale: swap the `--results-*` tokens.
- Shared spacing, radius and surface tokens (F18).
- Compact live ranking during play (F13).
- Applying the focus/announcement convention to the learning and daily results (rest of F15).
