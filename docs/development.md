# Development and verification

## Setup

Use Node >=22.12 <23 and npm. `npm ci` installs the lockfile; `npm install` is also supported. Python 3 (standard library only) is needed for corpus checks. No database setup or secrets are required for local gameplay. `npm run dev` launches Vite (5173) and the server (3001); `dev:client` is a compatibility alias for both. To separate processes, use `npm run dev:vite-only` and `npm run dev:server` in different terminals. Vite proxies `/api` and `/socket.io`; the socket module uses the direct 3001 development URL by default.

`PORT` (default 3001), `HOST` (default 0.0.0.0), `NODE_ENV`, optional `CLIENT_ORIGIN` and build-time `VITE_SERVER_URL` configure hosting. `DETERMINISTIC_FIRST_SETTER=1` is useful for local test scenarios. `TEST_SERVER_URL` selects the integration test target. Do not point tests at production. `.env.example` documents split-origin configuration. Node start does not implicitly load arbitrary `.env` files.

Offline enrichment commands use `OPENAI_API_KEY` and optional model/rate settings described in `data/README.md`; do not run them for ordinary application verification or expose their values.

## Checks by subsystem

| Area | Commands |
| --- | --- |
| Learning / corpus runtime | `npm run test:learning`; `npm run test:vocabulary` |
| Daily | `npm run test:daily`; `npm run test:vocabulary` |
| Invitations / language routing | `npm run test:invitation`; `npm run test:localization` |
| Multiplayer UI (static markup) | `npm run test:multiplayer-ui` |
| Server domain | `npm run build:server`, then `npm run test:game`, `npm run test:chat`, `npm run test:lifecycle`, `npm run test:match`, `npm run test:n-player` |
| Offline corpus pipeline | `npm run test:vocab`; `npm run vocab:validate` |
| Types / lint | `npx tsc -b --pretty false`; `npx tsc -p server/tsconfig.json --noEmit`; `npm run lint` |
| Production / SEO | `npm run build`; `npm run test:seo` (starts its own server on 3205) |

Tests are Node assertions rather than a shared test-runner framework. TS tests run through TSX, Python tests through unittest. TSX transpiles tests but application type checks do not include the tests directory. Server suites import tracked generated JS from `dist-server`, so stale builds can hide defects.

For live integration, build first, then start a dedicated process:

```sh
PORT=3002 HOST=127.0.0.1 node dist-server/server/server.js
```

In another terminal:

```sh
TEST_SERVER_URL=http://127.0.0.1:3002 npm run test:e2e
```

Stop that test server afterward. The suite uses independent Socket.IO connections, covering multiple guessers, privacy, authorization, capacity, isolation, scoring, rotation and forgiveness. It does **not** create browser contexts or exercise React navigation/session storage; the optional browser suite below covers those boundaries. Manual browser reproduction should compare (1) two tabs in one profile, (2) duplicated/opener tabs that may inherit session storage, and (3) separate browser profiles/contexts. Record which isolation was used. Test a restored room A followed by an invitation to B, reload, same-room invitations, departure and rematch. Use at least three participants for concurrent guesser/forgiveness scenarios.

## Optional real-browser regressions

`npm run test:browser` uses Node's built-in WebSocket and Firefox WebDriver BiDi, without additional npm packages. It was verified with Firefox 157 and Node 22.23.3. Use a dedicated local built server (3002 by default) and a disposable Firefox profile:

```sh
mkdir -p /tmp/penjat-audit-firefox
firefox --headless --no-remote --profile /tmp/penjat-audit-firefox --remote-debugging-port 9222
```

In another terminal, with the dedicated server running:

```sh
TEST_SERVER_URL=http://127.0.0.1:3002 BIDI_URL=ws://127.0.0.1:9222 npm run test:browser
```

The script requires a fresh available automation session, creates browser user contexts and tabs, and closes its tabs/session afterward. Stop your temporary Firefox/server processes when finished. Never use a personal browser profile. The script refuses non-local targets. It covers homepage link navigation (modified/middle clicks, keyboard, back/forward), CA/ES homepage geometry at the 599/600, 660/661 and 860/861px boundaries, the homepage daily entry after play and with corrupt storage, 599–661px contracts for the other screens, normal shared-storage tabs, actual opener-inherited session credentials, independent contexts, invitations/reload/join/leave, all learning levels and progression, mixed summaries, and departure during word selection. Unit/static tests cover concurrent guesser notices, final rounds, rematches and score ties. This optional browser suite supplements the existing Socket.IO E2E suite; Firefox must be installed separately. Chromium/WebKit are not exercised. For a CSS change, set `RESPONSIVE_BASELINE_CSS` to a file containing the previous CSS to also assert that non-homepage screens keep identical geometry (this writes comparison screenshots under the local `design-explorations/phase-2-1-sizing/screenshots/`).

## Troubleshooting and production validation

- `EADDRINUSE`: use a free port; do not terminate an unrelated development process. `EPERM` from TSX pipes or HTTP listen in a restricted runner is an environment limitation requiring local socket permission, not an application failure.
- Rebuild `dist-server` before interpreting backend test failures. `npm run preview` alone cannot supply rooms or room previews.
- HTTP 503 with “Frontend build unavailable”: run the full build from repository root.
- Connection failures: verify server health, frontend build-time URL and origin settings. Production uses same-origin sockets by default.
- Unknown room after restart is expected: rooms are memory-only and require one service replica.
- Empty CEFR pools: inspect runtime `linguistics.cefr` coverage as well as ignored experiment outputs. `vocab:build` can consume older lexical inputs; do not blindly overwrite approved v1 data to repair metadata.

Validate production with `npm run build`, run relevant tests, then `npm start` and visit local routes. Review generated server diffs and `git diff --check`. No automatic deployment is part of verification. Existing bundle-size warnings and baseline failures are recorded in the dated audit report.

## Codex setup scope

Root `AGENTS.md` is the concise entry point; subsystem documentation carries detail. No nested AGENTS or repository skill is currently needed: existing npm scripts and this test matrix already describe the recurring workflows without duplicating instructions. Reconsider a specialized skill if a multi-step browser/corpus workflow becomes routine and cannot be expressed clearly by the scripts. This follows the scoped-instruction model in the [official AGENTS.md guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
