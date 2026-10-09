# Phase 2D — Release hardening (INTERIM: work stopped at usage limit)

Status on 2026-10-09: partially complete. Nothing committed, pushed or deployed; earlier uncommitted work preserved.

## 1. Changes implemented

- **Server soft-lock fixes (`server/game/GameRoom.ts`, `dist-server` rebuilt).** I found these with the new real 10-player browser match and confirmed both with sockets and unit tests:
  1. If a guesser left during word selection, `setWord` reopened them as `playing`, so the round never finished. Departed guessers now stay `eliminated`.
  2. If every remaining turn belonged to departed players, or the only remaining setter left during `round-over`, the round waited forever (`nextSetterId: null`). The match now ends.

  Regressions are in `scripts/n-player-test.mjs`.
- **Long words (multiplayer).** The new `MultiplayerWord` component and the `src/multiplayer/wordRows.ts` helper replace the hidden sideways scroll.
  - Before, a 23-letter word was cut off at every width, 1920px included, with no visible cue.
  - Tiles fill the board down to 18px. A word that still doesn't fit wraps onto the fewest balanced rows, with a light continuation hyphen.
  - The glyph follows the tile width, so letters no longer crowd.
  - Screen readers get a named group ("…, 23 lletres") and text with every position ("buit"/"hueco" for blanks). Before, blanks were silent.
  - The board is focusable only if it still overflows.
- **Learning and daily word.** Tiles fit from the character count via container units. This fixes the scroll of 13–15-character entries and a Chromium-only 34px page overflow at 320px.
- **1000–1299px.** The existing compact ranking is reused below the three-column layout, with no new component. With ten players the chat now starts at about 456px instead of about 1009px. 1300px and wider is unchanged.
- **Localized game-language chip and invitation language.** The Spanish UI shows "Catalán", and the Catalan UI shows "Castellà". Pickers keep their own-language names.
- **Learning result.** The duplicate header "Nivell" link is hidden once the word is completed.
- **Not changed:**
  - The phone room pills still wrap. One row would need dropping or abbreviating information (ES needs 377px of 348px available at 390).
  - The "Torn 3/10" pill shows completed turns during turn 4; noted, not changed.

## 2. Tests and browsers (actual runs)

- **Engines:** Firefox 157 (BiDi), Chromium 151 (CDP, Playwright-downloaded binary, no npm dependency) and system WebKitGTK 2.54 (WebKitWebDriver under Xvfb). Driver: `scripts/browser-driver.mjs`.
  - Phone widths are simulated viewports. In WebKit, widths below 440px use an exact-size iframe.
  - Playwright's own WebKit build cannot run on Arch (missing Ubuntu libraries).
  - No real Safari, iOS or Android testing was done.
- **WebKitGTK focus rings:** not painted under Xvfb without a window manager. Focus there was verified via `activeElement` and `:focus-visible`.
- **`npm run test:browser:multiplayer` (new), Firefox: pass.** Real Socket.IO matches:
  - **4 players:** 3 browsers.
  - **10 players:** 4 browsers (390 CA, 1100 ES, 1366 CA, 320 ES; two named "Marc") and 6 bots.
  - **Covered:** ranks versus server state after every turn, a tie for first, "you" by ID, expand/collapse with Enter/Space, focus kept across live updates, chat draft and focus kept, reconnecting status and notice, departure section, skipped turn, results and rematch.
  - **Not yet run** in Chromium or WebKit.
- **Passing:** `test:multiplayer-ui`, `test:match-results`, `test:learning`, `test:n-player`, `test:game`, `test:chat`, `test:lifecycle`, `test:match`, client and server type checks, lint (pre-existing warnings only), build.
- **Visual matrix (`design-explorations/phase-2d/capture.mjs`):**
  - Deterministic data: fixed learning words via a constant `Math.random`, fixed daily date, fixtures. 19 screens × 9 widths.
  - **Before:** Firefox CA+ES and Chromium/WebKit CA, in `screenshots/before/`.
  - **After, Chromium (CA+ES):** 333 renders with 0 layout, contrast, target or scroll flags. 9 renders at es-1299 timed out while I restarted the dev servers mid-run (a harness interruption, not the app); re-run them. Firefox and WebKit after runs, before/after composites, and a final flag review are **not done**.
- **Not run after the changes:** `test:e2e`, `test:seo`, `test:browser`, `test:vocabulary`, `test:daily`, `test:invitation`, `test:localization`, the vocabulary checks, the Phase 2A/2B/2C matrices and the interaction checks.

## 3. Remaining work

1. Run the multiplayer test with `BROWSER=chromium` and `BROWSER=webkit`.
2. Run the Firefox and WebKit after matrices. Build the compare images (same tag in `before/` and `after/`) and review the flags.
3. Run the full suite listed above.
4. Update `docs/architecture.md`, `docs/gameplay-contracts.md` (compact ranking below 1300px; the departure fixes) and `docs/development.md` (driver and new script).

## 4. Recommendation

**NO-GO until the remaining suites pass.** The two server fixes remove real soft-locks reachable in normal 3+ player play, which pre-existed Phase 2. They should ship once verified by the E2E and browser suites.

## 5. Phone checklist (iPhone Safari, Android Chrome)

- Join a 4+ player room. The ranking summary shows; "Veure tot" expands it, and expansion survives a round end.
- Set a 20+ letter word. The whole word is visible on two rows with the hyphen mark, and the alphabet is reachable.
- Type in the chat with the on-screen keyboard. The input stays visible and the draft survives a round end.
- Lock the phone for 10 s and return: "Reconnectant…" appears, then clears.
- Finish a learning word and a daily word. The next action is visible, with no duplicate level link.
