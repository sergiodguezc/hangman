# Phase 2C — UI polish, mobile gameplay and learning results

Implemented and validated locally on 2026-10-09 with Node 22.23.3 and Firefox 157.0.1 (headless, WebDriver BiDi). Nothing was committed, pushed or deployed. Existing uncommitted Phase 1, 2.1, 2A and 2B work was preserved. There are no new dependencies and no server, protocol, scoring, vocabulary, daily-selection, SEO or routing changes; `dist-server` has no diff.

Inputs: `~/docs/Penjat-audit-2026-10-09.md` (F11, F13, F14, F15, F16, F17), the Phase 1/2A/2B reports, and Phase 2A/2B screenshots. No large font-specimen HTML was loaded.

## 1. Implementation summary

**Board-first mobile gameplay with a compact live ranking (F13).**
- `Scoreboard` now follows the board in the DOM. In the stacked layout (≤999px) the order is: forgiveness tray, board, ranking, chat. From 1000px the grid still places the ranking in its own column, so the desktop is visually unchanged. The ranking has no focusable content at those widths, so focus order is unaffected.
- From four participants, the stacked ranking collapses to a summary:
  - a "1r lloc / 1.er puesto" row naming up to two leaders (each with the "tu" badge if it is you), or "4 jugadors empatats" for larger first-place ties;
  - a separate row with your own place and points, marked "· empat" when shared. It is omitted when you are already named among the leaders.
- A full-width native `<button>` toggles the complete list. It is labelled "Veure tot / Veure menys" ("Ver todo / Ver menos"), the same wording as the learning history, and carries `aria-expanded` and `aria-controls`.
- The header counts active players and, separately, departures ("9 jugadors · 1 ha sortit").
- The full list keeps:
  - shared competition ranks;
  - ID-based self identification, so duplicate names are safe;
  - wrapping long names;
  - departed players in their own section with their scores.
- Reconnecting players now show "Reconnectant… / Reconectando…" (amber) instead of a round status.
- The expanded state is component state, so live score updates keep it, and focus stays on the toggle.
- Two- and three-player rooms keep the plain list.
- The ranking pill grid now uses 15rem minimum columns, so a 390px phone gets one readable column. Before, two cramped columns broke names mid-word ("Antòni / a / Fernán / dez").
- The Phase 2A final classification is untouched.

**Completed-word presentation for learning (F14, F15).** When a word ends, the hint bar, the solved tiles and the drawing column are replaced by one dictionary-style card:
- a 56px drawing tile next to the outcome ("Has encertat la paraula!" / "La paraula era…");
- a mistake summary ("2 lletres incorrectes · K W" or "Cap lletra incorrecta");
- the Catalan word once, as a Georgia heading in its real spelling (accents and `l·l` intact, no uppercase duplicate);
- a facts line with the Spanish translation and CEFR level;
- definition and example (word highlighted), the review-later note for failures, then "Paraula següent" and "Canviar el nivell".

From 900px the card uses two columns (word and actions left, definition and example right), so the next action sits about 500px from the top at 1366×768. Before, it was below the fold.

When the round ends in this visit, focus moves to the word heading (`tabIndex=-1`, described by the outcome and translation). That gives one announcement in place of the old whole-card live region, and the card scrolls back into view if the player was down at the alphabet. Tab then reaches "Paraula següent".

**Daily result (F15).** The daily result uses the same pattern:
- drawing tile, outcome and mistakes;
- "Paraula" label and the word as heading;
- definition and Spanish;
- share button, share status, "Torna demà…", and a new "Torna a l'inici" link.

It also drops some redundancy:
- The duplicate "Victòria 🎉" heading and the tiles are gone.
- "Ja has jugat avui" now appears only when the result is restored on load. Before, it showed immediately after finishing too.
- A restored result does not steal focus.

The share format, mechanics and persistence are unchanged.

**Secondary polish (Part C).**
- **Empty chat (F11):** an empty chat is a compact card (`is-empty`) during play and at match-over, not a full-height blank column. The lobby keeps its tall chat.
- **Back button (F17):** from 661px it shows its destination: "Inici", "Acaba la sessió" (active learning), "Surt de la sala" (lobby) or "Surt de la partida" (match), in CA/ES. The visible text equals the accessible name. Phones keep the 44px arrow.
- **How-to-play:**
  - New "Final de la partida" and "Paraula del dia" sections.
  - Tie sharing in scoring.
  - The 25-second reconnect window (matches `gameplay-contracts.md`).
  - Rematch unanimity.
  - Failed learning words returning later in the session.

  Routes and SEO metadata are untouched.
- **Round-over:** "Ronda completada" was shown twice; the result box now only reveals the word, in Georgia.
- **Reconnecting notice:** now an amber informational strip instead of red error text.
- **Departed-player scores:** these were grey text on the inherited green pill (1.65:1 contrast); now plain muted text.
- **Error counter on phones:** stacks its label above the count, so "Lletres incorrectes" never wraps beside a split "0 / 6", and "3 / 6" is no longer clipped at 320px in setter view.
- **Learning statistics (F16):** singular forms fixed ("1 encertada · 1 única", "1 recuperada").

## 2. Files changed (Phase 2C)

| File | Responsibility |
|---|---|
| `src/multiplayer/liveRanking.ts` (new) | Pure helper: active ranks via `rankByScore`, departed list, leaders, self rank and tie flag, whether to name leaders, collapsible threshold (≥4). |
| `src/components/Scoreboard.tsx` | Header with counts, summary rows, disclosure button, full list with reconnecting status, departed section. |
| `src/pages/GamePage.tsx` | Scoreboard moved after the board. `connection-notice` class. Round-over box reveals the word once (with game-language `lang`). |
| `src/components/LearningResultCard.tsx` | Completed-word card, heading focus, scroll-into-view. New `errors` and `incorrect` props. |
| `src/pages/LearningPage.tsx` | Playing view vs completed card. Live region only while playing. Plural fix. |
| `src/pages/DailyChallengePage.tsx` | Completed-word daily result, restored-on-load flag, focus on completion only, home link. |
| `src/components/RoomChat.tsx` | `is-empty` modifier. |
| `src/components/GlobalNavigation.tsx`, `src/App.tsx` | Visible destination label; context-specific labels. |
| `src/pages/HowToPlayPage.tsx` | Daily, match-end, ties, reconnect and learning-review guidance (CA/ES). |
| `src/multiplayer/i18n.ts`, `src/learning/i18n.ts`, `src/daily/i18n.ts` | Paired CA/ES copy. The unused daily `victory`/`defeat` keys were replaced by `home`. |
| `src/App.css` | Stacked grid order, ranking summary and disclosure, completed-word cards (learning and daily), empty chat, back label, connection notice, round-over word, phone error counter, departed score fix. Existing tokens throughout. |
| `tests/learning-test.ts`, `tests/multiplayer-ui-test.tsx`, `tests/match-results-test.tsx` | New regressions (section 7). The chat-class pattern was widened for `is-empty`. |
| `scripts/browser-audit-test.mjs` | The daily secret is now read from the result heading (`.daily-result h2`), since the word is no longer the first `dd`. |
| `docs/architecture.md`, `docs/development.md`, `docs/gameplay-contracts.md` | Layout and ranking behaviour, the Phase 2C harness, the collapsed-sidebar note. |
| `design-explorations/phase-2c/` | `fixtures.tsx/.html`, `capture.mjs`, `interaction-checks.mjs`, logs, metrics and screenshots. |

## 3. Before/after

Side-by-side images are in `design-explorations/phase-2c/screenshots/compare/` (left: before, right: after):

| File | What it shows |
|---|---|
| `ca-390x844-ten-player-first-screen.png` | Before, the first screen was entirely ranking and the board started about 1,000px down. After, the board starts at about 236px and the whole alphabet is inside 844px (asserted). |
| `ca-390x844-ten-player-gameplay-full.png`, `ca-320x568-ten-player-gameplay-full.png` | Whole page: about 2,060px before vs about 1,560px after, with the 10-row list one tap away. |
| `ca-1366x768-learning-result.png`, `ca-1920x1080-learning-result.png` | Duplicated word and tall empty gallows before; "next word" was below the fold at 1366×768. After, a compact entry with the action visible. |
| `ca-390x844-learning-result.png`, `es-390x844-learning-loss.png` | Phone learning result. Page height about 1,280px → about 970px; next word inside the first screen. |
| `es-390x844-daily-result.png`, `ca-1366x768-daily-result.png` | Daily: share button in the first screen; no repeated victory or word. |
| `es-320x568-round-over.png` | Round-over without the duplicated "Ronda completada". |

Other folders:
- `before/`, `before-full/`: renders of the pre-change code.
- `after/`: 218 renders at 1920, 1366, 390 and 320 in CA/ES; metrics for all 11 viewports are in `after/metrics-{ca,es}.json`.
- `interaction/`: screenshots from the scripted interactions (collapsed and expanded ranking, setter with forgiveness, learning win and loss, daily).
- `reflow/`, `text200/`.

## 4. Functional validation (exercised in the browser)

`interaction-checks.mjs` runs 35 scripted flows, all passing:

- **Ranking:** at 390×844, 320×568, 768×1024 and 999×800, in CA and ES:
  - board, then ranking, then chat; collapsed by default; collapsed card under 360px; word in the first screen (whole alphabet at 844px height);
  - Tab from the last alphabet key reaches the toggle;
  - Enter expands (9 active rows plus 1 departed), with focus kept;
  - a live update that reorders scores keeps it expanded and focused, and moves you to first place in the summary;
  - Space collapses;
  - Tab continues into the chat and Shift+Tab returns;
  - no page overflow.
- **Desktop ranking:** at 1000 and 1366, the full list is in the sidebar with no summary or toggle.
- **Setter with a pending forgiveness request (390, 320):** the tray precedes the board and "Perdonar la vida" is inside the first screen.
- **Learning:** real app, on-screen key presses, win then loss, at 1920, 1366, 390 and 320 in CA/ES:
  - focus lands on the word heading; the word appears once; no tiles or drawing column; drawing at most 60px;
  - next word in the first screen at 1366×768 and taller viewports;
  - Tab reaches "Paraula següent" and Enter starts the next word.
- **Daily:** at 1366, 390 and 320 in CA/ES:
  - finishing focuses the word; share is in the first screen at 768px+ height;
  - reload restores the result with "Ja has jugat avui" and without focus theft.
- **Back labels and help:** labels visible at 661 and 1366 but not at 660 or 390; the accessible name matches; nine help sections render.

The existing `test:browser` suite covers, unchanged and passing:
- all learning levels, next word, level switching, exit confirmation and the session summary;
- daily play and the homepage status;
- dialogs (focus containment, Escape, restoration);
- chat reactions with keyboard, touch and live Socket.IO;
- terminal matches;
- the real three-player Phase 2A match: rematch, focus, readiness and reconnection.

The Socket.IO E2E suite covers server-side gameplay and forgiveness.

Not exercised in a real multi-socket browser match: the compact ranking with four or more live participants. It was tested with the real `GamePage` in the fixture harness plus simulated live updates; the real-match browser flow uses three players, below the collapse threshold.

## 5. Responsive QA

- **Phase 2C matrix:** `capture.mjs`, 27 screens × 11 viewports (1920×1080, 1440×900, 1366×768, 1300/1299×800, 1100×800, 1000/999×800, 768×1024, 390×844, 320×568) × CA/ES = 594 renders.
  - Screens: home, setup, help, learning setup/game/result/loss/dialog/summary, daily and daily result, lobby, choosing, waiting, guessing (short, long, ranking open, tied leaders, empty chat), forgiveness, setter (long and short), round-over (short and long), match-over (ten players, long names, empty chat).
  - **0** overflow, truncation, contrast, small-target, clipping or squeezed-surface flags.
  - The one harness error came from an ambiguous random-word lookup in the fixture script, not from the app; a re-run passed.
- **Phase 2B strict matrix** (`phase-2b/capture.mjs --strict`, 13 viewports, 572 renders): pass, 0 flags. Metrics are in `phase-2c/2b-matrix-metrics-{ca,es}.json`; the duplicate PNGs were deleted.
- **Phase 2A matrix** (392 renders plus keyboard, disclosure, pending rematch, chat focus, zoom and fallback fonts): pass. Heading sizes are unchanged (44px at 1920, 30px at 390).
- **400% zoom reflow:** 320×256, plus 195×422 (200% on a 390px phone), 12 key screens × CA/ES = 48 renders, 0 flags.
- **200% text enlargement:** a real disposable Firefox profile with a 32px default font size, at 1366, 1024 and 390 × 9 screens × CA/ES = 54 renders, 0 flags. Because breakpoints are in em, 1366px at 200% text uses the stacked layout and therefore the compact ranking.
- **Long words and names:** 23-letter word, ten long and duplicate names, 128-point scores, `col·leccionista`, long Spanish translations and definitions (unit-tested and in the fixtures).

## 6. Accessibility

What was actually tested:
- **Disclosure:** native `button` with `aria-expanded` and `aria-controls`; real Tab, Enter, Space and Shift+Tab; focus is not lost on live updates.
- **Learning and daily:** focus moves to the result heading on completion only; Tab order continues to the primary action.
- **Phase 1 and 2A behaviour, re-run unchanged:** modal focus containment, reaction keyboard and touch access, the match-over single announcement.
- **Contrast:** computed for every visible text node in all 594 renders; this found and fixed the departed-score pill.
- **Targets:** none under 24px; the toggle, back button and share/next actions are at least 44px tall.
- **Reduced motion:** the existing global rule also covers the new chevron transition and the small swaying drawing.
- **Standings for screen readers:** a heading-labelled `aside`, an ordered list with ranks, a separate departed section.

Not done:
- no screen-reader session (VoiceOver, NVDA, TalkBack) — announcements were verified structurally only;
- no forced-colours mode;
- no physical-device touch or on-screen-keyboard testing.

This is not an accessibility certification.

## 7. Automated tests (final working tree, Node 22.23.3)

| Command | Result |
|---|---|
| `npm run build` | pass (existing >500 kB chunk warning only). CSS 72,335 B / 13,854 B gzip −9 (2B: 12,855); JS 772,720 B / 164,030 B gzip −9 (2B: 162,156). |
| `npm run lint` | pass; only the 3 pre-existing warnings in `design-explorations/phase-2-1*` |
| `npx tsc -b --pretty false`, `npx tsc -p server/tsconfig.json --noEmit` | pass |
| `test:learning` | pass, with new completed-word regressions: win/loss, single heading, no tiles, definition/example/translation, mistake counts and singulars, next-word order, accents/`l·l`, long text, CA/ES labels |
| `test:multiplayer-ui` | pass, with new compact-ranking regressions (listed below) |
| `test:match-results` | pass (chat-class pattern widened for `is-empty`) |
| `test:vocabulary`, `test:daily`, `test:invitation`, `test:localization` | pass |
| `test:game`, `test:chat`, `test:lifecycle`, `test:match`, `test:n-player` | pass (`dist-server` unchanged) |
| `test:vocab` (52), `vocab:validate` (544 entries) | pass |
| `TEST_SERVER_URL=http://127.0.0.1:3002 npm run test:e2e` | pass |
| `npm run test:seo` | pass |
| `TEST_SERVER_URL=http://127.0.0.1:3002 BIDI_URL=ws://127.0.0.1:9222 npm run test:browser` | pass (exit 0) |
| `node design-explorations/phase-2a/capture.mjs` | pass (392 renders) |
| `node design-explorations/phase-2b/capture.mjs --strict` (CA, ES) | pass (572 renders) |
| `node design-explorations/phase-2c/capture.mjs` (CA, ES) | 594 renders, 0 flags |
| `node design-explorations/phase-2c/interaction-checks.mjs` | 35/35 pass |
| `git diff --check` | pass |

The new compact-ranking regressions in `test:multiplayer-ui` cover:
- 2 and 3 players (no disclosure) and 10 players;
- the current player first, in the middle (tied), last, and tied with a leader;
- 4 and 10 tied leaders;
- duplicate and long names;
- departed players (counted apart, excluded from the ranks, kept with their score);
- reconnecting status;
- `aria-expanded`/`aria-controls` wiring and the expanded render;
- empty versus populated chat.

Problems hit during the runs, all resolved:
- **Learning test:** an assertion of mine expected one `>col·leccionista<`; the highlighted example legitimately makes two.
- **Ranking test:** a wrong expected rank (12, 11, 10, 8, 8 shares 4th place, not 5th).
- **Back label:** the label was always visible because the arrow selector `span[aria-hidden]` also matched it. Caught by the 660px check and fixed with a dedicated class.
- **Phase 2A first run:**
  - The first attempt failed on its first fixture load, probably a cold Vite compile.
  - The retry was interrupted, which left a BiDi session open, so the next attempt was refused with "Maximum number of active sessions".
  - After restarting the disposable Firefox, it passed.

## 8. Remaining issues

- **Browser coverage:** Firefox only. Chromium is not installed here, and no WebKit or physical phone was used. Safe-area insets, the on-screen keyboard over the stacked chat, and `:focus` scrolling on iOS remain unverified.
- **No live ≥4-player browser match:** there is no real browser match with four or more sockets exercising the collapsed ranking. Fixture plus unit coverage only.
- **1000–1299px sidebar:** the ranking still lists every player above the chat (no collapse). The board is unaffected, but with ten long names the chat starts low in that sidebar.
- **Phone match header:** the meta pills (room code, turn, voltes, language) wrap to two rows on phones. Tightening them would also reach the Phase 2A match-over header, so it was left.
- **Learning header duplication:** the learning meta row's "Nivell" link duplicates "Canviar el nivell" in the result card; harmless, not changed.
- **Language chip (F16):** the game-language chip still shows the language's own name in the Spanish UI.
- **Bundle (F20):** the eager vocabulary bundle remains.

## 9. Production readiness

**Recommend deploying after a short real-device pass.**

The changes are front-end only. They are covered by:
- the full unit, backend, E2E, SEO and browser suites;
- three visual matrices with zero flags;
- real-key interaction checks;
- real 200% text and 400% zoom checks.

They preserve every scoring, protocol, persistence and SEO contract, and they fix the highest-priority problems: the board is now in the first screen for a ten-player phone game, and learning and daily results lead with the vocabulary and the next action.

The remaining risk is untested engines and devices. Before release, spend about 15 minutes on one iPhone (Safari) and one Android phone (Chrome):
- play a four-player room and toggle the ranking;
- finish a learning word and a daily word;
- type in the chat with the on-screen keyboard.
