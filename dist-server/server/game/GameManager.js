import { GameRoom } from './GameRoom.js';
import { randomUUID } from 'node:crypto';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class GameManager {
    random;
    rooms = new Map();
    playerRooms = new Map();
    socketPlayers = new Map();
    constructor(random = Math.random) {
        this.random = random;
    }
    create(socketId, name, language, matchTarget = null) {
        let code = this.code();
        while (this.rooms.has(code))
            code = this.code();
        const room = new GameRoom(code, language, matchTarget, this.random);
        const playerId = randomUUID(), reconnectToken = randomUUID();
        room.addPlayer(playerId, socketId, reconnectToken, name);
        this.rooms.set(code, room);
        this.playerRooms.set(playerId, code);
        this.socketPlayers.set(socketId, playerId);
        return { room, playerId, reconnectToken };
    }
    join(socketId, name, rawCode) {
        const code = rawCode.trim().toUpperCase();
        const room = this.rooms.get(code);
        if (!room)
            throw new Error('room-not-found');
        const playerId = randomUUID(), reconnectToken = randomUUID();
        room.addPlayer(playerId, socketId, reconnectToken, name);
        this.playerRooms.set(playerId, code);
        this.socketPlayers.set(socketId, playerId);
        return { room, playerId, reconnectToken };
    }
    roomForPlayer(playerId) {
        const code = this.playerRooms.get(playerId);
        return code ? this.rooms.get(code) : undefined;
    }
    identityForSocket(socketId) {
        const playerId = this.socketPlayers.get(socketId);
        const room = playerId ? this.roomForPlayer(playerId) : undefined;
        return playerId && room ? { playerId, room } : undefined;
    }
    resume(socketId, code, playerId, token) {
        const room = this.rooms.get(code.trim().toUpperCase());
        if (!room || this.playerRooms.get(playerId) !== room.code)
            throw new Error('room-not-found');
        const previousSocketId = room.player(playerId)?.socketId;
        room.resume(playerId, token, socketId);
        if (previousSocketId && previousSocketId !== socketId)
            this.socketPlayers.delete(previousSocketId);
        this.socketPlayers.set(socketId, playerId);
        return room;
    }
    markReconnecting(socketId) {
        const identity = this.identityForSocket(socketId);
        this.socketPlayers.delete(socketId);
        if (!identity || !identity.room.markReconnecting(identity.playerId, socketId))
            return undefined;
        return identity;
    }
    leaveSocket(socketId) {
        const identity = this.identityForSocket(socketId);
        if (!identity)
            return undefined;
        return this.removePlayer(identity.playerId, socketId);
    }
    removePlayer(playerId, socketId) {
        const room = this.roomForPlayer(playerId);
        if (!room)
            return undefined;
        room.disconnect(playerId);
        this.playerRooms.delete(playerId);
        if (socketId)
            this.socketPlayers.delete(socketId);
        if (!room.players.length)
            this.rooms.delete(room.code);
        return room;
    }
    code() {
        return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    }
}
