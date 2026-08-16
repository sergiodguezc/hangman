import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Server } from 'socket.io';
import { ALPHABETS } from '../shared/game.js';
import { GameManager } from './game/GameManager.js';
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const frontendDist = resolve(process.cwd(), 'dist');
const mimeTypes = {
    '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8',
};
const httpServer = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/socket.io/'))
        return;
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const previewMatch = /^\/api\/rooms\/([A-Z2-9]{5})\/preview$/i.exec(url.pathname);
    if (previewMatch) {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
            response.writeHead(405, { Allow: 'GET, HEAD' });
            response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ ok: false, error: 'method-not-allowed' }));
            return;
        }
        const result = roomPreview(previewMatch[1]);
        response.writeHead(result.ok ? 200 : result.error === 'room-full' ? 409 : 404);
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify(result));
        return;
    }
    if (url.pathname === '/health') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ ok: true }));
        return;
    }
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
    }
    if (url.pathname === '/es' || url.pathname.startsWith('/es/')) {
        const trimmedPath = url.pathname.replace(/\/+$/, '');
        const canonicalPath = trimmedPath === '/es'
            ? '/'
            : trimmedPath === '/es/como-jugar'
                ? '/com-es-juga/'
                : `${trimmedPath.slice(3)}/`;
        response.writeHead(308, { Location: `${canonicalPath}${url.search}` });
        response.end();
        return;
    }
    try {
        const requestedPath = decodeURIComponent(url.pathname);
        let filePath = resolve(frontendDist, `.${requestedPath === '/' ? '/index.html' : requestedPath}`);
        if (filePath !== frontendDist && !filePath.startsWith(`${frontendDist}${sep}`))
            throw new Error('Invalid path');
        const fileStats = await stat(filePath).catch(() => null);
        if (!fileStats?.isFile())
            filePath = resolve(frontendDist, 'index.html');
        const body = await readFile(filePath);
        const isAsset = filePath.includes(`${sep}assets${sep}`);
        response.writeHead(200, {
            'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
        });
        response.end(request.method === 'HEAD' ? undefined : body);
    }
    catch {
        response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Frontend build unavailable. Run npm run build before starting the server.');
    }
});
const localDevelopmentOrigins = [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/];
const allowedOrigins = CLIENT_ORIGIN || (IS_PRODUCTION ? undefined : localDevelopmentOrigins);
const io = new Server(httpServer, {
    ...(allowedOrigins ? { cors: { origin: allowedOrigins } } : {}),
});
const games = new GameManager(process.env.DETERMINISTIC_FIRST_SETTER === '1' ? () => 0 : Math.random);
const DISCONNECT_GRACE_MS = 25_000;
const disconnectTimers = new Map();
const timerKey = (code, playerId) => `${code}:${playerId}`;
const cleanName = (value) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 24 ? value.trim() : null;
const cleanMatchTarget = (value) => value === null || value === 3 || value === 5 || value === 10 ? value : undefined;
const roomPreview = (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    const room = games.rooms.get(code);
    if (!room)
        return { ok: false, error: 'room-not-found' };
    if (room.players.length >= 2)
        return { ok: false, error: 'room-full' };
    return { ok: true, data: { code: room.code, gameLanguage: room.language, matchTarget: room.matchTarget, players: room.players.length } };
};
io.on('connection', (socket) => {
    console.info('socket connected', { socketId: socket.id });
    const broadcast = (code) => {
        const room = games.rooms.get(code);
        if (!room)
            return;
        for (const player of room.players)
            if (player.socketId)
                io.to(player.socketId).emit('room:state', room.viewFor(player.id));
    };
    const action = (ack, operation) => {
        try {
            operation();
            ack({ ok: true, data: undefined });
        }
        catch (error) {
            ack({ ok: false, error: error instanceof Error ? error.message : 'unknown-error' });
        }
    };
    socket.on('room:create', (payload, ack) => {
        const name = cleanName(payload?.name);
        const gameLanguage = payload?.gameLanguage;
        const matchTarget = cleanMatchTarget(payload?.matchTarget);
        if (!name || !(gameLanguage in ALPHABETS) || matchTarget === undefined)
            return ack({ ok: false, error: 'invalid-details' });
        const { room, playerId, reconnectToken } = games.create(socket.id, name, gameLanguage, matchTarget);
        socket.join(room.code);
        ack({ ok: true, data: { view: room.viewFor(playerId), session: { roomCode: room.code, playerId, reconnectToken } } });
        socket.emit('chat:history', room.chatHistory);
        console.info('player created room', { roomCode: room.code, playerId, socketId: socket.id });
    });
    socket.on('room:join', (payload, ack) => {
        const name = cleanName(payload?.name);
        if (!name || typeof payload?.code !== 'string')
            return ack({ ok: false, error: 'invalid-details' });
        try {
            const { room, playerId, reconnectToken } = games.join(socket.id, name, payload.code);
            socket.join(room.code);
            ack({ ok: true, data: { view: room.viewFor(playerId), session: { roomCode: room.code, playerId, reconnectToken } } });
            socket.emit('chat:history', room.chatHistory);
            broadcast(room.code);
            console.info('player joined room', { roomCode: room.code, playerId, socketId: socket.id });
        }
        catch (error) {
            ack({ ok: false, error: error instanceof Error ? error.message : 'unknown-error' });
        }
    });
    socket.on('room:resume', (payload, ack) => {
        const roomCode = typeof payload?.roomCode === 'string' ? payload.roomCode.trim().toUpperCase() : '';
        const playerId = typeof payload?.playerId === 'string' ? payload.playerId : '';
        console.info('resume attempt', { roomCode, playerId, socketId: socket.id });
        try {
            const room = games.resume(socket.id, roomCode, playerId, payload?.reconnectToken);
            const key = timerKey(room.code, playerId);
            const timer = disconnectTimers.get(key);
            if (timer)
                clearTimeout(timer);
            disconnectTimers.delete(key);
            socket.join(room.code);
            ack({ ok: true, data: room.viewFor(playerId) });
            socket.emit('chat:history', room.chatHistory);
            broadcast(room.code);
            console.info('resume successful', { roomCode: room.code, playerId, socketId: socket.id });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'resume-rejected';
            ack({ ok: false, error: message });
            console.info('resume rejected', { roomCode, playerId, socketId: socket.id, reason: message });
        }
    });
    socket.on('round:set-word', (payload, ack) => action(ack, () => {
        const identity = games.identityForSocket(socket.id), room = identity?.room;
        if (!room)
            throw new Error('room-not-found');
        room.setWord(identity.playerId, payload?.word);
        broadcast(room.code);
    }));
    socket.on('game:guess', (payload, ack) => action(ack, () => {
        const identity = games.identityForSocket(socket.id), room = identity?.room;
        if (!room)
            throw new Error('room-not-found');
        room.guess(identity.playerId, payload?.letter);
        broadcast(room.code);
    }));
    socket.on('round:forgiveness', (payload, ack) => action(ack, () => {
        const identity = games.identityForSocket(socket.id), room = identity?.room;
        if (!room)
            throw new Error('room-not-found');
        room.decideForgiveness(identity.playerId, payload?.forgive);
        broadcast(room.code);
    }));
    socket.on('round:continue', (ack) => action(ack, () => {
        const identity = games.identityForSocket(socket.id), room = identity?.room;
        if (!room)
            throw new Error('room-not-found');
        room.continue(identity.playerId);
        broadcast(room.code);
    }));
    socket.on('match:rematch', (ack) => action(ack, () => {
        const identity = games.identityForSocket(socket.id), room = identity?.room;
        if (!room)
            throw new Error('room-not-found');
        room.requestRematch(identity.playerId);
        broadcast(room.code);
    }));
    socket.on('chat:typing', (payload) => {
        const identity = games.identityForSocket(socket.id), player = identity?.room.player(identity.playerId);
        if (!identity || !player || typeof payload?.isTyping !== 'boolean')
            return;
        socket.to(identity.room.code).emit('chat:typing', { playerId: player.id, playerName: player.name, isTyping: payload.isTyping });
    });
    socket.on('chat:send', (payload, ack) => {
        try {
            const identity = games.identityForSocket(socket.id), room = identity?.room;
            if (!room)
                throw new Error('not-room-member');
            const message = room.addChatMessage(identity.playerId, payload?.text);
            io.to(room.code).emit('chat:message', message);
            ack({ ok: true, data: message });
        }
        catch (error) {
            ack({ ok: false, error: error instanceof Error ? error.message : 'invalid-chat-message' });
        }
    });
    socket.on('chat:react', (payload, ack) => {
        try {
            const identity = games.identityForSocket(socket.id), room = identity?.room;
            if (!room)
                throw new Error('not-room-member');
            const update = room.toggleChatReaction(identity.playerId, payload?.messageId, payload?.reaction);
            io.to(room.code).emit('chat:reaction-updated', update);
            ack({ ok: true, data: update.reactions });
        }
        catch (error) {
            ack({ ok: false, error: error instanceof Error ? error.message : 'invalid-reaction' });
        }
    });
    socket.on('room:leave', () => {
        const identity = games.identityForSocket(socket.id);
        if (!identity)
            return;
        const key = timerKey(identity.room.code, identity.playerId), timer = disconnectTimers.get(key);
        if (timer)
            clearTimeout(timer);
        disconnectTimers.delete(key);
        socket.to(identity.room.code).emit('chat:typing', { playerId: identity.playerId, playerName: identity.room.player(identity.playerId)?.name ?? '', isTyping: false });
        const room = games.leaveSocket(socket.id);
        socket.leave(identity.room.code);
        if (room)
            broadcast(room.code);
    });
    socket.on('disconnect', (reason) => {
        console.info('socket disconnected', { socketId: socket.id, reason });
        const identity = games.markReconnecting(socket.id);
        if (!identity)
            return;
        const { room, playerId } = identity, key = timerKey(room.code, playerId);
        socket.to(room.code).emit('chat:typing', { playerId, playerName: room.player(playerId)?.name ?? '', isTyping: false });
        broadcast(room.code);
        console.info('player marked reconnecting', { roomCode: room.code, playerId });
        const timer = setTimeout(() => {
            disconnectTimers.delete(key);
            const current = room.player(playerId);
            if (!current || current.connectionState === 'connected')
                return;
            games.removePlayer(playerId);
            broadcast(room.code);
            console.info('disconnect grace period expired', { roomCode: room.code, playerId });
            if (!games.rooms.has(room.code))
                console.info('room removed', { roomCode: room.code });
        }, DISCONNECT_GRACE_MS);
        disconnectTimers.set(key, timer);
    });
});
httpServer.listen(PORT, HOST, () => console.log(`Hangman server listening on http://${HOST}:${PORT}`));
export { httpServer, games };
