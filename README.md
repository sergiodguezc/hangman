# Penjat

Catalan hangman ([penjat.cat](https://penjat.cat)) with Catalan and Spanish interfaces:

- **Multiplayer:** private 2–10-player rooms in real time. Players take turns choosing words, guess simultaneously, chat, keep score across turns, and can use the playful “Perdonar la vida” mechanic.
- **Aprèn català:** vocabulary practice by CEFR level, with definitions and translations.
- **Paraula del dia:** the same daily word for everyone, saved in the browser.

The production application is a single Node.js service: it serves the built React application and hosts Socket.IO on the same HTTP server and public origin.

## Contributor documentation

Start with [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md), [development](docs/development.md) (setup, tests, troubleshooting) and [gameplay contracts](docs/gameplay-contracts.md). Vocabulary work: [Vocabulary v1](docs/vocabulary-v1.md) and [data workflow](data/README.md).

## Requirements

- Node.js 22.12 or newer in the Node 22 release line
- npm

## Local development

```bash
npm install
npm run dev
```

This starts Vite at `http://localhost:5173` and the Socket.IO server at `http://127.0.0.1:3001`. The browser connects directly to port 3001 during development.

The legacy `npm run dev:client` command is an alias for the same full-stack workflow. To debug the processes separately, run these in two terminals:

```bash
npm run dev:vite-only
npm run dev:server
```

## Production locally

```bash
npm install
npm run build
npm start
```

Open `http://localhost:3001`. Only the Node process is needed after building; it serves `dist/`, handles SPA fallback requests, exposes Socket.IO at `/socket.io`, and provides `GET /health`.

Production uses same-origin Socket.IO, so the browser does not connect to localhost or require CORS configuration after deployment.

## Environment variables

No environment variables are required for a normal same-origin deployment.

- `PORT`: HTTP port. Defaults to `3001`; Render and Railway provide it automatically.
- `HOST`: bind address. Defaults to `0.0.0.0`.
- `CLIENT_ORIGIN`: optional allowed origin for an unusual split-origin deployment.
- `VITE_SERVER_URL`: optional frontend Socket.IO URL for a split-origin deployment. It must be present while running `npm run build`.

See [.env.example](.env.example). Do not set the split-origin variables for the recommended single-service deployment.

## Vocabulary

The Catalan vocabulary (`data/vocabulary.json`) is generated offline and bundled; the app never calls an LLM or external API at runtime. The `vocab:*` pipeline commands, sources, licences and optional LLM enrichment (`OPENAI_API_KEY`, `VOCAB_LLM_MODEL`, `VOCAB_LLM_REQUEST_INTERVAL` for the delay between requests, default 6.5 s) are documented in [data/README.md](data/README.md).

## Deploy to Render

The included `render.yaml` supports a Render Blueprint:

1. Push this project to a GitHub repository.
2. In Render, choose **New → Blueprint**.
3. Connect the repository and apply the detected service.
4. Wait for `npm ci && npm run build` and `npm start` to complete.
5. Open the generated HTTPS URL.

Alternatively, create a Node Web Service manually with:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/health`

No application environment variables are required.

## Deploy to Railway

1. Push this project to GitHub.
2. Create a Railway project and choose **Deploy from GitHub repo**.
3. Select the repository.
4. Railway can use the package scripts automatically. If prompted, set:
   - Build command: `npm run build`
   - Start command: `npm start`
5. Generate a public domain in the service networking settings.
6. Open the generated HTTPS URL.

Railway supplies `PORT`; do not override it. Use one replica.

## Verification

`npm run build` and `npm run lint`, then the suites for the area you changed; the full matrix, E2E and browser suites are in [development](docs/development.md#checks-by-subsystem).

## Important limitations

Rooms, scores, words, and chat history are stored only in server memory. A server restart removes active matches. Multiple server replicas do not share state, so deploy this version as exactly one Node process/Render instance. Browser refreshes and transient disconnects can resume within the 25-second grace period, but cannot survive a server restart or a request routed to another replica.
