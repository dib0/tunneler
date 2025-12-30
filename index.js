/* This is the node.js script that is run as a server with room-based lobbies.
 * The server manages multiple game rooms with separate state and configurations.
 * Players can create private rooms with custom settings including AI opponents.
 * Each room has its own map, trace, and game state.
 */

const webSocketServer = require('websocket').server;
const http = require('http');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');

// Load room and AI management
const { RoomManager } = require('./RoomManager');
const { AIPlayer, AI_PERSONALITIES } = require('./AIPlayer');

// Default to port 3000
const webSocketsServerPort = 3000;

// Room manager instance
const roomManager = new RoomManager();

// Map connections to player IDs
const connectionToPlayer = new Map(); // ws -> {playerId, roomCode}

// Try to load MapManager
let MapManager = null;
try {
  const mm = require('./MapManager');
  MapManager = mm.MapManager;
  console.log('✅ MapManager loaded successfully');
} catch (error) {
  console.log('⚠️ MapManager not found, using seed-only mode');
}

// Instantiate basic HTTP server that serves static files
const serve = serveStatic("./");
const server = http.createServer(function(request, response) {
  const done = finalhandler(request, response);
  serve(request, response, done);
});

server.listen(webSocketsServerPort, function() {
  console.log('🎮 Tunneler Server with Lobby System');
  console.log('📡 Listening on port ' + webSocketsServerPort);
  console.log('🌐 Access lobby at: http://localhost:' + webSocketsServerPort + '/lobby.html');
});

// Cleanup inactive rooms every 5 minutes
setInterval(() => {
  roomManager.cleanupInactiveRooms();
}, 5 * 60 * 1000);

// Add a websocket server
const wss = new webSocketServer({ httpServer: server });

wss.on('request', function(request) {
  const ws = request.accept(null, request.origin);
  console.log('New WebSocket connection from', request.origin);

  // Handle lobby messages and game messages
  ws.on('message', function(message) {
    if (message.type === 'utf8') {
      const data = message.utf8Data;
      
      // Check if it's a JSON message (lobby or game connect)
      if (data.startsWith('{')) {
        try {
          const jsonMsg = JSON.parse(data);
          
          // Handle GAME_CONNECT specifically
          if (jsonMsg.type === 'GAME_CONNECT') {
            handleGameConnect(ws, jsonMsg);
          } else {
            // Regular lobby message
            handleLobbyMessage(ws, data);
          }
        } catch (e) {
          console.error('Error parsing JSON message:', e);
        }
      } else {
        // Game message - multicast to room
        handleGameMessage(ws, data);
      }
    }
  });

  ws.on('close', function() {
    handleDisconnect(ws);
  });
});

// Handle game connection from client
function handleGameConnect(ws, message) {
  const { roomCode, playerId, playerName } = message;
  
  console.log(`🎮 Game connection request - Room: ${roomCode}, Player: ${playerId}, Name: ${playerName}`);
  
  const room = roomManager.getRoom(roomCode);
  if (!room) {
    console.error(`❌ Room ${roomCode} not found for game connection`);
    sendError(ws, `Room ${roomCode} not found`);
    return;
  }
  
  if (!room.gameStarted) {
    console.error(`❌ Game not started in room ${roomCode}`);
    sendError(ws, 'Game not started yet');
    return;
  }
  
  // Check if player exists in room
  let playerObj = room.players.get(playerId);
  if (!playerObj) {
    console.error(`❌ Player ${playerId} not found in room ${roomCode}`);
    console.error(`   Available players:`, Array.from(room.players.keys()));
    sendError(ws, `Player ${playerId} not found in room`);
    return;
  }
  
  // Update player's name if provided
  if (playerName && playerName !== 'undefined' && playerName !== 'null') {
    playerObj.playerData.name = playerName;
    console.log(`   Updated player name to: ${playerName}`);
  }
  
  // Update player's WebSocket connection
  playerObj.ws = ws;
  connectionToPlayer.set(ws, { playerId, roomCode: room.roomCode });
  
  console.log(`✅ Player ${playerId} (${playerObj.playerData.name}) game connection established for room ${roomCode}`);
  
  // Send game initialization
  initializePlayerInGame(ws, playerId, room);
}

// Handle lobby messages (room creation, joining, configuration)
function handleLobbyMessage(ws, data) {
  try {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'CREATE_ROOM':
        handleCreateRoom(ws, message);
        break;
      case 'JOIN_ROOM':
        handleJoinRoom(ws, message);
        break;
      case 'LEAVE_ROOM':
        handleLeaveRoom(ws);
        break;
      case 'UPDATE_CONFIG':
        handleUpdateConfig(ws, message);
        break;
      case 'START_GAME':
        handleStartGame(ws);
        break;
    }
  } catch (e) {
    console.error('Error handling lobby message:', e);
    sendError(ws, 'Invalid message format');
  }
}

// Handle game messages (movement, shooting, etc.)
function handleGameMessage(ws, data) {
  const playerInfo = connectionToPlayer.get(ws);
  if (!playerInfo) return;
  
  const room = roomManager.getRoom(playerInfo.roomCode);
  if (!room) return;
  
  // Add to trace
  room.addToTrace(data);
  
  // Multicast to all players in room except sender
  room.broadcastToRoom(data, playerInfo.playerId);
  
  // Update AI players based on game state
  if (room.aiPlayers.length > 0) {
    processAIPlayers(room);
  }
}

// Create a new room
function handleCreateRoom(ws, message) {
  const room = roomManager.createRoom(null, message.config);
  const playerId = room.addPlayer(ws, message.playerName);
  
  room.hostId = playerId; // Set creator as host
  connectionToPlayer.set(ws, { playerId, roomCode: room.roomCode });
  
  // Generate map for room
  room.mapSeed = Math.floor(Date.now() / 1000);
  if (MapManager) {
    try {
      const mapManager = new MapManager();
      room.mapData = mapManager.generateMapForGame(room.mapSeed);
      console.log('✅ Generated map for room', room.roomCode);
    } catch (error) {
      console.error('❌ Error generating map:', error);
    }
  }
  
  // Send room created confirmation
  sendJSON(ws, {
    type: 'ROOM_CREATED',
    roomCode: room.roomCode,
    playerId: playerId,
    room: getRoomData(room)
  });
  
  console.log('✅ Room created:', room.roomCode, 'by', message.playerName);
}

// Join an existing room
function handleJoinRoom(ws, message) {
  const room = roomManager.getRoom(message.roomCode);
  
  if (!room) {
    sendError(ws, 'Room not found');
    return;
  }
  
  if (room.players.size >= room.config.maxPlayers) {
    sendError(ws, 'Room is full');
    return;
  }
  
  if (room.gameStarted) {
    sendError(ws, 'Game already started');
    return;
  }
  
  const playerId = room.addPlayer(ws, message.playerName);
  connectionToPlayer.set(ws, { playerId, roomCode: room.roomCode });
  
  // Send join confirmation to joining player
  sendJSON(ws, {
    type: 'ROOM_JOINED',
    roomCode: room.roomCode,
    playerId: playerId,
    room: getRoomData(room)
  });
  
  // Notify other players
  room.broadcastToRoom(JSON.stringify({
    type: 'PLAYER_JOINED',
    playerId: playerId,
    playerName: message.playerName,
    room: getRoomData(room)
  }), playerId);
  
  console.log('✅ Player', message.playerName, 'joined room', room.roomCode);
}

// Leave current room
function handleLeaveRoom(ws) {
  const playerInfo = connectionToPlayer.get(ws);
  if (!playerInfo) return;
  
  const room = roomManager.getRoom(playerInfo.roomCode);
  if (!room) return;
  
  const playerObj = room.players.get(playerInfo.playerId);
  const playerName = playerObj?.playerData?.name || 'Unknown';
  
  room.removePlayer(playerInfo.playerId);
  connectionToPlayer.delete(ws);
  
  // Notify other players
  room.broadcastToRoom(JSON.stringify({
    type: 'PLAYER_LEFT',
    playerId: playerInfo.playerId,
    playerName: playerName,
    room: getRoomData(room)
  }));
  
  console.log('👋 Player', playerName, 'left room', room.roomCode);
}

// Update room configuration
function handleUpdateConfig(ws, message) {
  const playerInfo = connectionToPlayer.get(ws);
  if (!playerInfo) return;
  
  const room = roomManager.getRoom(playerInfo.roomCode);
  if (!room) return;
  
  // Only host can update config
  if (!room.isHost(playerInfo.playerId)) {
    sendError(ws, 'Only host can update configuration');
    return;
  }
  
  room.updateConfig(message.config);
  
  // Notify all players
  room.broadcastToRoom(JSON.stringify({
    type: 'ROOM_CONFIG_UPDATED',
    room: getRoomData(room)
  }));
}

// Start the game
function handleStartGame(ws) {
  const playerInfo = connectionToPlayer.get(ws);
  if (!playerInfo) {
    console.error('❌ No player info for websocket in handleStartGame');
    return;
  }
  
  const room = roomManager.getRoom(playerInfo.roomCode);
  if (!room) {
    console.error(`❌ Room ${playerInfo.roomCode} not found`);
    return;
  }
  
  // Only host can start
  if (!room.isHost(playerInfo.playerId)) {
    console.error(`❌ Player ${playerInfo.playerId} tried to start but is not host`);
    sendError(ws, 'Only host can start the game');
    return;
  }
  
  if (!room.canStart()) {
    console.error('❌ Room cannot start yet');
    sendError(ws, 'Cannot start game yet');
    return;
  }
  
  console.log('🎮 ============================================');
  console.log('🎮 STARTING GAME IN ROOM:', room.roomCode);
  console.log('🎮 ============================================');
  console.log('   Host player ID:', playerInfo.playerId);
  console.log('   Total players in room:', room.players.size);
  console.log('   Player IDs:', Array.from(room.players.keys()));
  
  // Check each player's connection status BEFORE setting gameStarted
  room.players.forEach((playerObj, playerId) => {
    if (!playerObj.ws) {
      console.error(`   ❌ Player ${playerId}: NO WEBSOCKET!`);
    } else {
      console.log(`   ✅ Player ${playerId}: WebSocket exists, connected=${playerObj.ws.connected}`);
    }
  });
  
  // Initialize AI players FIRST (before setting gameStarted)
  if (room.config.aiOpponents && room.config.aiOpponents.enabled && room.config.aiOpponents.count > 0) {
    console.log(`🤖 Initializing ${room.config.aiOpponents.count} AI players...`);
    initializeAIPlayers(room);
  }
  
  // Create the start message BEFORE setting gameStarted
  const startMessage = JSON.stringify({
    type: 'GAME_STARTING',
    roomCode: room.roomCode
  });
  
  console.log('📢 Sending GAME_STARTING to ALL players BEFORE marking game as started...');
  console.log('   Message:', startMessage);
  
  // Send to ALL players FIRST, THEN set gameStarted
  let successCount = 0;
  let failCount = 0;
  const sendPromises = [];
  
  room.players.forEach((playerObj, playerId) => {
    try {
      if (playerObj.ws) {
        // Try to send synchronously
        playerObj.ws.sendUTF(startMessage);
        successCount++;
        console.log(`   ✅ SENT to player ${playerId} (${playerObj.playerData.name})`);
      } else {
        failCount++;
        console.error(`   ❌ FAILED to send to player ${playerId} - No WebSocket`);
      }
    } catch (error) {
      failCount++;
      console.error(`   ❌ ERROR sending to player ${playerId}:`, error.message);
    }
  });
  
  console.log('📊 GAME_STARTING broadcast complete:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  
  // NOW set gameStarted AFTER messages are sent
  room.gameStarted = true;
  console.log('✅ room.gameStarted NOW set to TRUE (after broadcast)');
  
  console.log('🎮 All players should now redirect and reconnect from game page...');
  console.log('🎮 ============================================');
}

// Initialize a player in the game
function initializePlayerInGame(ws, playerId, room) {
  // Get player data
  const playerObj = room.players.get(playerId);
  const playerName = playerObj?.playerData?.name || `Player${playerId}`;
  
  console.log(`📤 Initializing game for player ${playerId} (${playerName})`);
  
  // Send trace
  room.getTrace().forEach(action => ws.sendUTF(action));
  
  // Send map data
  if (room.mapData) {
    try {
      const mapPayload = {
        bgLayer: Array.from(room.mapData.bgLayer),
        shapesLayer: Array.from(room.mapData.shapesLayer),
        mapLayer: Array.from(room.mapData.mapLayer),
        width: room.mapData.width,
        height: room.mapData.height,
        seed: room.mapData.seed
      };
      
      const mapMessage = 'M ' + JSON.stringify(mapPayload);
      ws.sendUTF(mapMessage);
    } catch (error) {
      console.error('Error sending map data:', error);
      ws.sendUTF('S ' + room.mapSeed);
    }
  } else {
    ws.sendUTF('S ' + room.mapSeed);
  }
  
  // Send INIT message with player ID and name
  ws.sendUTF(`I ${playerId} ${btoa(playerName)}`);
  
  console.log(`✅ Game initialized for player ${playerId} (${playerName})`);
}

// Initialize AI players in room
function initializeAIPlayers(room) {
  const aiConfig = room.config.aiOpponents;
  
  console.log(`🤖 Initializing ${aiConfig.count} AI players...`);
  
  aiConfig.aiPlayers.forEach((aiPlayerConfig, index) => {
    const aiId = 1000 + room.playerIdCounter + index; // Use high IDs for AI
    const aiPlayer = new AIPlayer(
      aiId,
      aiPlayerConfig.name,
      aiPlayerConfig.difficulty,
      aiPlayerConfig.personality
    );
    
    // Set initial position for base (spread them out)
    const mapWidth = room.mapData?.width || 1200;
    const mapHeight = room.mapData?.height || 600;
    const baseSpacing = mapWidth / (aiConfig.count + room.players.size + 1);
    
    aiPlayer.x = baseSpacing * (room.players.size + index + 1) + 5;
    aiPlayer.y = mapHeight / 2 + (index % 2 === 0 ? 100 : -100);
    
    // Assign a base for the AI player
    const baseX = Math.floor(aiPlayer.x - 20);
    const baseY = Math.floor(aiPlayer.y - 20);
    const baseMsg = `B ${aiId} ${baseX} ${baseY} 40 40`;
    
    room.aiPlayers.push(aiPlayer);
    
    // Add AI to trace so new players see them
    const joinMsg = 'J ' + aiId;
    const nameMsg = `N ${aiId} ${btoa(aiPlayer.name)}`;
    const moveMsg = `M ${aiId} ${Math.floor(aiPlayer.x)} ${Math.floor(aiPlayer.y)} 2 1000 10 0 ${btoa(aiPlayer.name)} ${aiPlayer.lives}`;
    
    room.addToTrace(joinMsg);
    room.addToTrace(nameMsg);
    room.addToTrace(baseMsg);
    room.addToTrace(moveMsg);
    
    console.log(`🤖 AI Player ${aiPlayer.name} (ID: ${aiId}) added at (${Math.floor(aiPlayer.x)}, ${Math.floor(aiPlayer.y)}) with base at (${baseX}, ${baseY})`);
  });
  
  // Broadcast AI join messages to all human players currently connected
  room.aiPlayers.forEach(ai => {
    const joinMsg = 'J ' + ai.id;
    const nameMsg = `N ${ai.id} ${btoa(ai.name)}`;
    const baseX = Math.floor(ai.x - 20);
    const baseY = Math.floor(ai.y - 20);
    const baseMsg = `B ${ai.id} ${baseX} ${baseY} 40 40`;
    const moveMsg = `M ${ai.id} ${Math.floor(ai.x)} ${Math.floor(ai.y)} 2 1000 10 0 ${btoa(ai.name)} ${ai.lives}`;
    
    room.players.forEach((playerObj, playerId) => {
      if (playerObj.ws && playerObj.ws.connected) {
        playerObj.ws.sendUTF(joinMsg);
        playerObj.ws.sendUTF(nameMsg);
        playerObj.ws.sendUTF(baseMsg);
        playerObj.ws.sendUTF(moveMsg);
      }
    });
  });
  
  console.log(`✅ ${room.aiPlayers.length} AI players initialized with bases for room ${room.roomCode}`);
}

// Process AI player actions
function processAIPlayers(room) {
  if (!room.gameStarted || room.aiPlayers.length === 0) return;
  
  // Collect actual game state for AI
  const gameState = {
    players: [],
    bases: [],
    mapWidth: room.mapData?.width || 1200,
    mapHeight: room.mapData?.height || 600
  };
  
  // Add human players to game state
  room.players.forEach((playerObj, playerId) => {
    // Note: We don't have real-time player positions here
    // In a full implementation, you'd track this from MSG_MOVE
    gameState.players.push({
      id: playerId,
      x: 0, // Would come from tracked state
      y: 0,
      health: 10,
      energy: 1000,
      isAI: false
    });
  });
  
  // Add AI players to game state
  room.aiPlayers.forEach(ai => {
    gameState.players.push({
      id: ai.id,
      x: ai.x,
      y: ai.y,
      health: ai.health,
      energy: ai.energy,
      isAI: true
    });
  });
  
  // Add bases to game state
  gameState.bases = Array.from(room.players.keys()).map(id => ({
    id: id,
    x: 0, // Would come from tracked state
    y: 0,
    w: 40,
    h: 40
  }));
  
  room.aiPlayers.forEach(ai => {
    // Calculate AI base position
    const baseX = Math.floor(ai.x - 20);
    const baseY = Math.floor(ai.y - 20);
    gameState.bases.push({
      id: ai.id,
      x: baseX,
      y: baseY,
      w: 40,
      h: 40
    });
  });
  
  // Update each AI
  room.aiPlayers.forEach(ai => {
    const actions = ai.update(gameState);
    
    actions.forEach(action => {
      let message = '';
      
      if (action.type === 'move') {
        // Update AI position based on direction
        let dx = 0, dy = 0;
        const dir = action.dir || ai.dir;
        
        if ([9, 6, 3].includes(dir)) dx = 1;
        if ([1, 2, 3].includes(dir)) dy = 1;
        if ([7, 4, 1].includes(dir)) dx = -1;
        if ([9, 8, 7].includes(dir)) dy = -1;
        
        ai.x = Math.max(10, Math.min(1190, ai.x + dx));
        ai.y = Math.max(10, Math.min(590, ai.y + dy));
        ai.dir = dir;
        
        message = `M ${ai.id} ${Math.floor(ai.x)} ${Math.floor(ai.y)} ${ai.dir} ${ai.energy} ${ai.health} ${ai.score} ${btoa(ai.name)} ${ai.lives}`;
        room.broadcastToRoom(message);
        room.addToTrace(message);
      } else if (action.type === 'fire') {
        message = `F ${ai.id}`;
        room.broadcastToRoom(message);
        room.addToTrace(message);
      } else if (action.type === 'dig') {
        // AI is digging - consume energy
        ai.energy = Math.max(0, ai.energy - 1);
      }
    });
  });
}

// Start AI processing loop for all rooms
setInterval(() => {
  roomManager.rooms.forEach((room, roomCode) => {
    if (room.gameStarted && room.aiPlayers.length > 0) {
      processAIPlayers(room);
    }
  });
}, 200); // Process AI every 200ms

// Handle disconnect
function handleDisconnect(ws) {
  const playerInfo = connectionToPlayer.get(ws);
  if (!playerInfo) return;
  
  const room = roomManager.getRoom(playerInfo.roomCode);
  if (room) {
    const playerObj = room.players.get(playerInfo.playerId);
    const playerName = playerObj?.playerData?.name || 'Unknown';
    
    // If game has started, player is just switching from lobby to game connection
    // Don't remove them, just update the connection mapping
    if (room.gameStarted) {
      console.log(`🔄 Player ${playerName} disconnecting lobby connection (switching to game)`);
      // Just remove the connection mapping, keep player in room
      connectionToPlayer.delete(ws);
      return;
    }
    
    // Game not started - player is actually leaving the lobby
    room.removePlayer(playerInfo.playerId);
    
    // Notify remaining players
    if (room.players.size > 0) {
      room.broadcastToRoom(JSON.stringify({
        type: 'PLAYER_LEFT',
        playerId: playerInfo.playerId,
        playerName: playerName,
        room: getRoomData(room)
      }));
    }
    
    console.log('👋 Player', playerName, 'left room', room.roomCode);
  }
  
  connectionToPlayer.delete(ws);
}

// Helper functions
function getRoomData(room) {
  const players = [];
  room.players.forEach((playerObj, playerId) => {
    players.push({
      id: playerId,
      name: playerObj.playerData.name
    });
  });
  
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    players: players,
    config: room.config,
    gameStarted: room.gameStarted
  };
}

function sendJSON(ws, data) {
  if (ws.connected) {
    ws.sendUTF(JSON.stringify(data));
  }
}

function sendError(ws, error) {
  sendJSON(ws, { type: 'ERROR', error });
}

function btoa(str) {
  return Buffer.from(str).toString('base64');
}

console.log('🚀 Server initialized with lobby system and AI player support');
