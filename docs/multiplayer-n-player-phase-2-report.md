# Multiplayer N-player Phase 2 report

## 1. Final architecture

Multiplayer is now one server-authoritative architecture for 2–10 players. `GameManager` owns room and socket/player lookup; `GameRoom` owns the lobby, match roster, turn schedule, round state, per-guesser state, scoring, forgiveness, reconnect/departure handling, rematch consensus, and chat history. The server serializes a separate `PlayerGameView` for every recipient. The React client renders that view and does not calculate authoritative game outcomes.

There is no separate two-player engine: N=2 uses the same roster, turn, round, ranking, privacy, and rematch paths as larger rooms.

## 2. Major files changed

- `shared/protocol.ts`, `shared/game.ts`: N-player protocol types, `voltes`, room capacity, and shared error limit.
- `server/game/GameRoom.ts`: authoritative N-player room/match implementation.
- `server/game/GameManager.ts`, `server/server.ts`: room creation, per-player Socket.IO views, event handlers, reconnect timers, and leave handling.
- `src/App.tsx`, `src/pages/HomePage.tsx`, `src/pages/LobbyPage.tsx`, `src/pages/GamePage.tsx`: N-player room flow and game rendering.
- `src/components/Scoreboard.tsx`, `src/components/RoomChat.tsx`, `src/App.css`, `src/multiplayer/i18n.ts`: public player state, multiple typing users, supporting styles, and copy.
- `scripts/n-player-test.mjs`, `scripts/e2e.mjs`, `scripts/forgiveness-test.mjs`, `scripts/lifecycle-test.mjs`, `scripts/match-features-test.mjs`, `scripts/chat-test.mjs`: new and adapted multiplayer coverage.
- `package.json`, `README.md`: test command and documented room behavior.
- `dist-server/**`: regenerated tracked server build output.

## 3. Shared protocol changes

The protocol defines a fixed `MAX_ROOM_PLAYERS` of 10, supported `voltes` values `1 | 3 | 5`, room/round/player statuses, connection state, public player summaries, private `PlayerRoundView`, `RoundView`, `MatchView`, `MatchResult`, and independently identified `ForgivenessRequest` records.

`PlayerGameView` contains public player rows plus only the recipient's `self` state. A setter may additionally receive one explicitly selected `observedPlayer`. Room previews now expose `voltes`, active player count, and whether the room accepts joins.

## 4. Socket.IO events added or changed

Added:

- `room:start`: host starts a waiting room.
- `round:observe-player { playerId }`: setter selects one guesser to inspect.

Changed:

- `room:create` now accepts `{ name, gameLanguage, voltes }`.
- `round:forgiveness` now accepts `{ requestId, forgive }`, rather than addressing a singleton request.
- `room:state` is generated per recipient instead of broadcasting one shared private state.
- Existing set-word, guess, continue, rematch, leave, chat, reaction, and typing events operate on N-player room membership.

## 5. Room, lobby, and start behavior

A created room remains in `waiting`; joining does not auto-start it. The host can start once at least two active players are present. Waiting rooms accept up to 10 active players; joins after start are rejected. The lobby exposes the player list, host, selected language and `voltes`, and start eligibility.

## 6. `voltes` implementation

`voltes` is selected at room creation and validated server-side against `1`, `3`, and `5`. At match start, the active roster is frozen and `totalTurns = initial roster size × voltes`. Each roster member therefore receives one scheduled setter slot per volta, subject to later departure skips. Round and match views expose both the current volta and turn progress.

## 7. Turn rotation

The initial active roster is rotated from one randomly selected first setter, then reused in stable cyclic order for every volta. A completed round advances one slot. Future slots belonging to permanently departed players are skipped; no replacement slots are added. `nextSetterId` reports the next active scheduled setter.

## 8. Player round state

Every non-setter has an independent state containing status, guessed letters, error count, forgiveness flag, start/finish timestamps, resolution time, and final round rank. Guesses mutate only that player's state. A round ends only when all participating guessers are terminal (`solved`, `failed`, or `eliminated`). The setter has no synthetic guess board.

## 9. Ranking and scoring

Round ranking sorts:

1. solved players before unsolved players;
2. fewer errors first;
3. lower resolution time first;
4. original match-roster order as a deterministic tie-break.

With `G` guessers, the solved player at zero-based ranking position `i` receives `G - i` points. Unsolved players and the setter receive zero. Match ranking sorts by accumulated score, then stable roster order.

## 10. Forgiveness implementation

Reaching the normal error limit creates a distinct pending request and puts only that guesser in `awaiting-forgiveness`. Several requests can coexist and are addressed by UUID. Only the current setter can grant or deny them.

Granting forgiveness resumes that player and sets `forgiven = true`; it deliberately does not decrement, clear, or otherwise remove existing errors. The next wrong guess eliminates the forgiven player. Denial fails the player. A player cannot create a second forgiveness request in the same round, and pending requests are cancelled when their player or setter permanently leaves.

## 11. Setter observation and privacy

All players receive names, scores, connection/activity state, and coarse public round status. A guesser receives detailed letters, errors, display word, timing, and rank only for `self`; other guessers' private boards are omitted. The setter can inspect exactly one selected guesser through `observedPlayer`; non-setters cannot use the observation event. The secret word is sent only to the setter while active, and to everyone only after round/match reveal.

## 12. Disconnect, reconnect, and leave behavior

Socket loss marks only that player as `reconnecting` and starts a 25-second grace timer. Their state is frozen while connected players continue; a valid room/player/token resume restores the same identity and state. Explicit leave, or grace expiry, is permanent: the player becomes inactive and disconnected.

A departed guesser is eliminated from an active round and their pending forgiveness request is cancelled. A departed setter cancels the unfinished setter turn and advances the schedule. Remaining setter slots for departed players are skipped. The match ends when fewer than two active players remain.

## 13. Host transfer

If the host permanently leaves, ownership transfers to the first remaining active player in stable join order. Temporary reconnecting status does not transfer ownership.

## 14. Rematch behavior

At match end, every active player must opt in. Once all eligible players are ready, the room starts a new match using the current active roster, resets scores, round state, turn progress, match result, observations, forgiveness state, and readiness, and retains the room, language, `voltes`, players, and chat history. This path supports any N ≥ 2.

## 15. Chat and typing changes

Chat remains room-wide, with bounded history and reactions. Client typing state is now keyed by player ID, allowing several simultaneous typing indicators. Typing state is cleared on stop, leave, or socket disconnect rather than represented by one global typing user.

## 16. Tests added or updated

- `test:n-player`: six-player positional scoring, simultaneous forgiveness requests, privacy/observation, N=2 with three voltes, independent reconnect state, permanent departure, and host transfer.
- `test:e2e`: three-player create/join/start, previews, active-room rejection, private views, forgiveness, observation, turn completion, match result, and N-player rematch through Socket.IO.
- `test:game`: forgiveness lifecycle, including retained errors after grant.
- `test:lifecycle`: reconnect, expiry/leave behavior, and host ownership.
- `test:match`: N-player turns, scoring/result, and rematch behavior.
- `test:chat`: chat/typing compatibility with the new room setup.
- Existing invitation, localization, learning, daily, vocabulary-contract, and SEO route regressions were also rerun.

## 17. Commands run and results

All product checks passed:

| Command | Result |
| --- | --- |
| `npm run build` | Passed: client TypeScript/Vite and server TypeScript build |
| `npm run lint` | Passed |
| `npm run test:game` | Passed |
| `npm run test:chat` | Passed |
| `npm run test:lifecycle` | Passed |
| `npm run test:match` | Passed |
| `npm run test:n-player` | Passed |
| `PORT=3002 node dist-server/server/server.js ... TEST_SERVER_URL=http://127.0.0.1:3002 npm run test:e2e` | Passed after the test synchronization fix below |
| `npm run test:invitation && npm run test:localization && npm run test:learning && npm run test:daily && npm run test:vocabulary` | Passed |
| `npm run test:seo` | Passed |
| `git diff --check` | Passed |

The first in-sandbox attempt to run the `tsx` regression group could not create its IPC socket under `/tmp` (`EPERM`). The identical command was rerun with the required execution permission and passed; this was an execution-environment restriction, not a repository failure. Vite emitted its existing advisory that the main client chunk exceeds 500 kB, but completed successfully.

## 18. Issues found and fixed during verification

The E2E test had a reproducible synchronization race: several assertions consumed the next `room:state` event even when an older broadcast was still in transit. This could make the test observe pre-action state and fail intermittently. `scripts/e2e.mjs` now waits for states matching the semantic outcome of each action (pending request, selected observation, elimination, next round, round end, and rematch). The corrected E2E was rerun against the built server and passed. No game-engine regression was found.

## 19. Known limitations

- Rooms and reconnect tokens are in-memory and single-process; server restart loses them and horizontal scaling would need shared state/sticky routing.
- Room capacity and reconnect grace are fixed constants rather than deployment or room settings.
- Active matches do not admit replacement/spectator joins.
- The Phase 2 UI is functional but intentionally basic, especially on small screens and for dense rooms.
- The Vite bundle-size advisory remains.

## 20. Work intentionally deferred to Phase 3

Phase 3 should focus on UI/UX rather than changing the authoritative model: responsive dense-player layouts, clearer public status/ranking visualization, a persistent forgiveness queue, improved setter observation controls, richer reconnect/departure feedback, accessibility and keyboard review, copy/i18n polish, and client bundle splitting. Persistence, multi-instance deployment, configurable limits, and spectator/late-join behavior require separate product and infrastructure decisions.
