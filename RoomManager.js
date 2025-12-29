/* RoomManager.js - Manages multiple game rooms with separate state and configurations
 * Each room has its own players, game state, configuration, and AI opponents
 */

class GameRoom {
  constructor(roomCode, hostId, config = null) {
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.config = config || this.getDefaultConfig();
    this.players = new Map(); // playerId -> {ws, playerData}
    this.aiPlayers = []; // Array of AI player instances
    this.trace = []; // Message history for new players
    this.mapSeed = Math.floor(Date.now() / 1000);
    this.mapData = null;
    this.playerIdCounter = 0;
    this.gameStarted = false;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  getDefaultConfig() {
    return {
      maxPlayers: 4,
      maxLives: 3,
      spawnProtection: { enabled: true, duration: 50, showShield: true },
      sanctuaryZones: { enabled: true, showVisuals: true, radius: 60 },
      antiCamping: { enabled: true, detectionRadius: 80, penaltyTime: 100, damagePerFrame: 0.5 },
      aiOpponents: {
        enabled: false,
        count: 0,
        difficulty: 'normal', // easy, normal, hard
        aiPlayers: [] // {name, difficulty, personality}
      }
    };
  }

  addPlayer(ws, name) {
    const playerId = ++this.playerIdCounter;
    this.players.set(playerId, { 
      ws, 
      playerData: { name }
    });
    this.lastActivity = Date.now();
    return playerId;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.lastActivity = Date.now();
  }

  getPlayerCount() {
    return this.players.size;
  }

  isHost(playerId) {
    return playerId === this.hostId;
  }

  canStart() {
    // Can start if there's at least one human player
    // AI players will be added when game starts
    return this.players.size > 0 && this.players.size + this.config.aiOpponents.count <= this.config.maxPlayers;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.lastActivity = Date.now();
  }

  broadcastToRoom(message, excludePlayerId = null) {
    this.players.forEach((playerObj, playerId) => {
      if (playerId !== excludePlayerId && playerObj.ws.connected) {
        playerObj.ws.sendUTF(message);
      }
    });
  }

  addToTrace(message) {
    this.trace.push(message);
  }

  getTrace() {
    return this.trace;
  }

  isActive() {
    // Room is active if it has players or was active in last 30 minutes
    return this.players.size > 0 || (Date.now() - this.lastActivity < 30 * 60 * 1000);
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> GameRoom
    this.playerToRoom = new Map(); // playerId -> roomCode
  }

  generateRoomCode() {
    // Generate 6-character alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure uniqueness
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    
    return code;
  }

  createRoom(hostId, config = null) {
    const roomCode = this.generateRoomCode();
    const room = new GameRoom(roomCode, hostId, config);
    this.rooms.set(roomCode, room);
    console.log(`Created room ${roomCode} by host ${hostId}`);
    return room;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  joinRoom(roomCode, playerId, ws, playerData) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.players.size >= room.config.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }

    room.addPlayer(playerId, ws, playerData);
    this.playerToRoom.set(playerId, roomCode);
    
    console.log(`Player ${playerId} joined room ${roomCode}`);
    return { success: true, room };
  }

  leaveRoom(playerId) {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (room) {
      room.removePlayer(playerId);
      
      // If room is empty or only has AI, clean it up
      if (room.getPlayerCount() === 0) {
        console.log(`Room ${roomCode} is empty, removing`);
        this.rooms.delete(roomCode);
      }
    }
    
    this.playerToRoom.delete(playerId);
  }

  getRoomForPlayer(playerId) {
    const roomCode = this.playerToRoom.get(playerId);
    return roomCode ? this.rooms.get(roomCode) : null;
  }

  cleanupInactiveRooms() {
    const now = Date.now();
    const roomsToDelete = [];
    
    this.rooms.forEach((room, roomCode) => {
      if (!room.isActive()) {
        console.log(`Cleaning up inactive room ${roomCode}`);
        roomsToDelete.push(roomCode);
      }
    });
    
    roomsToDelete.forEach(roomCode => {
      const room = this.rooms.get(roomCode);
      // Clean up player mappings
      room.players.forEach((_, playerId) => {
        this.playerToRoom.delete(playerId);
      });
      this.rooms.delete(roomCode);
    });
  }

  getRoomList() {
    const roomList = [];
    this.rooms.forEach((room, roomCode) => {
      roomList.push({
        roomCode,
        playerCount: room.getPlayerCount(),
        maxPlayers: room.config.maxPlayers,
        gameStarted: room.gameStarted,
        aiCount: room.config.aiOpponents.count
      });
    });
    return roomList;
  }
}

module.exports = { RoomManager, GameRoom };
