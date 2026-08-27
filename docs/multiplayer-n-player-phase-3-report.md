# Multiplayer N-player Phase 3 report

## Outcome

Phase 3 fixes forgiveness privacy and the reported multiplayer UX problems without replacing the Phase 2 architecture. It also adds an authoritative per-round result payload and focused scoring regressions. The full relevant verification suite passes.

## Bugs found

### Forgiveness privacy

`GameRoom.viewFor()` serialized the complete `forgivenessRequests` collection to every room member. React hid the decision buttons from guessers, but request IDs, requesting player IDs, timestamps, and decisions still reached their clients. This was a server privacy defect.

The serialized list is now populated only when the recipient is the current setter. Guessers receive `[]`; their own `self.status` and public coarse player statuses still communicate `awaiting-forgiveness` where appropriate. Multiple setter-visible requests remain separate and independently actionable.

### Missing terminal feedback

Solved and eliminated guessers previously saw only a disabled keyboard and a compact scoreboard status. They now receive a non-blocking board message confirming success or elimination and explaining that they can wait for the other players while continuing to use chat.

## Scoring investigation and root cause

The authoritative score mutation was traced from `GameRoom.maybeFinishRound()` through recipient serialization and scoreboard rendering. There is one score mutation path: it iterates only `round.playerStates`, which never contains the setter, resolves each player by stable ID, and awards points only when that state is `solved`. There is no remaining 1v1 scoring path and the client does not mutate scores.

Direct and Socket.IO reproductions produced:

- A setter, B solves, C fails: `A +0, B +2, C +0`.
- A setter, B solves first, C solves second: `A +0, B +2, C +1`.

The reported incorrect behavior was a presentation/timing ambiguity rather than an authoritative score mutation bug:

- the UI showed only cumulative match totals, never the points gained in the current turn;
- points are finalized only when all guessers become terminal, so an early solver remains visually at the previous total while another player is still playing or awaiting forgiveness;
- after rotation, the current setter can legitimately retain points earned as a guesser in an earlier turn, which made that cumulative score look like setter-turn points.

To remove that ambiguity, the server now stores and serializes `RoundResultEntry[]` after finalization. Each row contains the authoritative player ID, position, terminal result, errors, resolution time, and `pointsAwarded`. The setter is explicitly included with `+0`. The client renders these entries directly and does not recalculate ranking or points.

## Scoring behavior after Phase 3

For `G` guessers, solved players keep the Phase 2 ordering and receive `G - i`; unsolved players receive zero. The setter is excluded from guesser ranking and always receives zero for that turn. Score mutation remains once per completed round, while round results make the exact delta visible separately from cumulative match score.

## Setter observation and forgiveness UI

Each round now selects the first active guesser as the setter's initial observation, so the setter immediately sees one board without rendering N boards. A compact horizontally scrollable selector switches the observed player without modifying round state. The setter still has no keyboard and retains the public scoreboard and chat.

Pending requests render through the new `ForgivenessTray` only for the setter. Requests stack in one tray with player name and grant/deny controls; the tray is absent when there are no pending requests.

On desktop the tray occupies its own area adjacent to and above chat. At tablet and mobile widths the grid orders it before the game and chat; on phones it remains sticky below the fixed navigation. This keeps pending requests discoverable without a popup or scrolling inside chat.

## Guesser and round-result UI

- Solved: explicit localized success message, waiting guidance, disabled guessing, public status, and chat remain available.
- Failed/eliminated: explicit localized terminal message and waiting guidance.
- Privacy: guessers still receive only their own detailed board; other players remain coarse public rows.
- Round end: a compact responsive table shows position, player, result, errors, time, and authoritative points gained. The setter row visibly shows `+0`.
- Scoreboard status copy now identifies the setter role throughout guessing instead of saying they are still choosing a word, and the “you” label is localized.

## Main files changed in Phase 3

- `shared/protocol.ts`: `RoundResultEntry` and `RoundView.results`.
- `server/game/GameRoom.ts`: setter-only request serialization, default observation, and authoritative stored round results.
- `src/pages/GamePage.tsx`: terminal messages, result rendering, setter tray placement, and streamlined roles.
- `src/components/ForgivenessTray.tsx`: setter request management.
- `src/components/PlayerRoundStatusNotice.tsx`: solved/eliminated feedback.
- `src/components/RoundResults.tsx`: authoritative round-result table.
- `src/components/Scoreboard.tsx`, `src/multiplayer/i18n.ts`, `src/App.css`: status copy, Catalan/Spanish messages, and responsive layout.
- `scripts/n-player-test.mjs`, `scripts/forgiveness-test.mjs`, `scripts/e2e.mjs`, `tests/multiplayer-ui-test.tsx`, `package.json`: regression coverage and UI test command.
- `dist-server/**`: regenerated server output.

## Tests added or updated

- Exact three-player `+0/+2/+0` and `+0/+2/+1` score attribution.
- Score retention by player ID when the successful guesser becomes the next setter.
- Authoritative result rows, including setter `+0`.
- Setter receives full requests; guessers receive no request objects.
- Simultaneous forgiveness requests remain independent.
- Setter switches observed players without changing their board state.
- Socket.IO solved state and one-solver score result.
- Rendered Catalan/Spanish success state, elimination state, round result, and disappearing/visible forgiveness tray.
- Existing N=2 rotation, rematch, lifecycle, chat, invitation, localization, learning, daily, vocabulary-contract, and SEO regressions.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run build` | Passed: client TypeScript/Vite and server TypeScript |
| `npm run lint` | Passed |
| `npm run test:game` | Passed |
| `npm run test:chat` | Passed |
| `npm run test:lifecycle` | Passed |
| `npm run test:match` | Passed |
| `npm run test:n-player` | Passed |
| `npm run test:multiplayer-ui` | Passed |
| `npm run test:localization` | Passed |
| `npm run test:invitation` | Passed |
| `npm run test:learning` | Passed |
| `npm run test:daily` | Passed |
| `npm run test:vocabulary` | Passed |
| `npm run test:seo` | Passed |
| compiled server on port 3002 + `npm run test:e2e` | Passed |
| `git diff --check` | Passed |

The sandboxed `tsx` attempts initially failed because the runner could not create its IPC pipe under `/tmp` (`EPERM`); the same tests passed with the required execution permission. The first new UI-test run then exposed a missing `React` runner import, which was fixed before rerunning successfully. Vite still emits its existing advisory for a client chunk over 500 kB.

## Remaining known issues

- There is no automated screenshot/visual-regression harness; the mobile behavior was verified from component order and responsive grid/sticky rules rather than pixel comparison on multiple devices.
- The client bundle-size warning remains.
- Rooms remain in-memory and single-process, as documented in Phase 2.
- Further visual tuning for unusually long player names or the full 10-player limit may benefit from real-device testing.
