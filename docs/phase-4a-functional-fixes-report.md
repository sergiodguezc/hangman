# Phase 4A — Post-redesign functional fixes

Source: production QA report of 10 October 2026 (QA-01, QA-A1, mode inventory). No visual redesign.

## QA-01 — Browser history and the exit confirmation

**Root cause.** `App` guarded header links (`navigate` → `ExitConfirmationDialog`) but its `popstate` handler ignored both the guard and any open dialog. Back changed the route immediately, unmounting `LearningPage` (whose session lives only in component state) while `pendingExit` stayed in `App` state, so the dialog survived on the destination page. Cancel then closed it there; Forward remounted a fresh learning setup. Daily progress survived only because it is persisted; in a room, Back changed the URL under a still-rendered room.

**Fix.** `src/navigation/history.ts` (pure, unit-tested) plus `App.handlePopState`:

- Every entry the app writes stores `{ penjatIndex }`, so a popstate knows its distance (`delta`) and direction.
- The guard is shared with header links (`exitGuard`: waiting room → `room`; active match, unfinished learning word/round, unfinished daily → `game`).
- A guarded Back/Forward is undone with `history.go(-delta)` (or the shown URL is pushed again for an unknown entry). The dialog opens on the page it protects; the forward stack is kept.
- Cancel keeps the game. Confirm replays the move (`history.go(delta)`), which is then applied normally.
- Any applied move closes a pending dialog and, like header links, leaves a room. The undo's own popstate and fragment-only changes are ignored.

Behaviour change: Back/Forward out of an unfinished game or a waiting/active room now asks first, the same as header links. Back from a completed match now leaves the room (as the header does) instead of leaving it rendered under the wrong URL.

## QA-A1 — Secret-word label

The visible badge “✎ Tria la paraula secreta / Elige la palabra secreta” is now a `<label for="secret-word-input">` (pencil `aria-hidden`). The now-unused `.word-form label` selector was removed so the badge keeps its `.role-badge` styling. In Firefox, `input.labels` is populated and the accessibility tree exposes a textbox named exactly “Tria la paraula secreta” / “Elige la palabra secreta”.

## Standalone single-player mode

This is a product decision, not a regression. The first commit (`edbe9cc`) was multiplayer-only (Home/Lobby/Game). `dde0353` added learning as the first solo mode; the “Single-Mode” commit (`8c3b819`) refers to learning vocabulary. Daily came later. No route, page or view for a generic solo game has ever existed, and `architecture.md` states “there is no separate solo mode”. Navigation was left unchanged. `src/game/game.ts` is an unused first-commit multiplayer helper, not a mode.

## Verification

- `test:navigation` (new), `test:multiplayer-ui` (new secret-label CA/ES checks), `test:learning`, `test:vocabulary`, `test:daily`, `test:invitation`, `test:localization`, `test:match-results`: pass.
- `npm run build`, both `tsc` checks and `npm run lint` (warnings only, in local `design-explorations/`): pass. Generated `dist-server` is unchanged.
- Backend `test:game`, `test:chat`, `test:lifecycle`, `test:match`, `test:n-player` and `test:e2e` against a local server: pass.
- Browser (Firefox 157 headless, BiDi): the new `history-guard-browser-checks.mjs` passed three times standalone and inside the suite. Against the unmodified client it fails at the original reproduction (URL leaves `/aprendre/`).

## Unresolved evidence

`npm run test:browser` stops in `checkSiteHeader` (`header-browser-checks.mjs:88`): “Crea una partida” stays busy and no `room:create` reaches the server. This was reproduced five times in the suite, including with the unmodified `App.tsx`, and was intermittent when the check ran alone (it passed twice and failed twice). It looks like a lost Socket.IO acknowledgement after a polling session reset. Closing leftover Ctrl/middle-click tabs or activating the tab did not fix it.

With only that check skipped (in a scratch copy), the rest of the suite passed with this change: P0 dialogs/chat, homepage, history guard, setup, responsive contracts, invitations, learning, terminal match and Phase 2A. It also passed without this change.

Not run: `test:seo`, `test:browser:multiplayer`, Chromium/WebKit and real devices.
