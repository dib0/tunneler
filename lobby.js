/* lobby.js - Client-side lobby system for managing game rooms
 * Handles room creation, joining, configuration, and player management
 */

// WebSocket connection
let socket = null;
let currentRoom = null;
let isHost = false;
let playerId = null;
let playerName = null; // Track player's name
let intentionalDisconnect = false; // Track if we're disconnecting on purpose

// Game configuration presets
const gamePresets = {
  classic: {
    maxPlayers: 4,
    maxLives: 3,
    spawnProtectionEnabled: true,
    sanctuaryZonesEnabled: true,
    antiCampingEnabled: true,
    aiCount: 0,
    aiDifficulty: 'normal'
  },
  hardcore: {
    maxPlayers: 4,
    maxLives: 1,
    spawnProtectionEnabled: false,
    sanctuaryZonesEnabled: false,
    antiCampingEnabled: true,
    aiCount: 0,
    aiDifficulty: 'hard'
  },
  casual: {
    maxPlayers: 4,
    maxLives: 5,
    spawnProtectionEnabled: true,
    sanctuaryZonesEnabled: true,
    antiCampingEnabled: true,
    aiCount: 1,
    aiDifficulty: 'easy'
  },
  chaos: {
    maxPlayers: 4,
    maxLives: 10,
    spawnProtectionEnabled: true,
    sanctuaryZonesEnabled: false,
    antiCampingEnabled: true,
    aiCount: 2,
    aiDifficulty: 'normal'
  }
};

// AI personality options
const aiPersonalities = [
  { id: 'commanderSteel', name: 'Commander Steel', personality: 'balanced' },
  { id: 'tankHunter', name: 'Tank Hunter', personality: 'aggressive' },
  { id: 'diggerDan', name: 'Digger Dan', personality: 'digger' },
  { id: 'fortressKeeper', name: 'Fortress Keeper', personality: 'defensive' }
];

// Connect to server
function connectToServer() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = location.host;
  const wsUrl = `${protocol}//${host}/`;
  
  socket = new WebSocket(wsUrl);
  
  socket.addEventListener('open', () => {
    console.log('Connected to lobby server');
  });
  
  socket.addEventListener('message', (event) => {
    handleServerMessage(event.data);
  });
  
  socket.addEventListener('close', () => {
    console.log('Disconnected from server');
    // Only show error if this was NOT an intentional disconnect (like joining game)
    if (!intentionalDisconnect) {
      showError('Disconnected from server');
    }
    intentionalDisconnect = false; // Reset flag
  });
  
  socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
    showError('Connection error');
  });
}

// Handle messages from server
function handleServerMessage(data) {
  // Only parse messages that start with { (JSON messages)
  if (!data.startsWith('{')) {
    // This is a game protocol message, ignore it in lobby
    return;
  }
  
  try {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'ROOM_CREATED':
        handleRoomCreated(message);
        break;
      case 'ROOM_JOINED':
        handleRoomJoined(message);
        break;
      case 'PLAYER_JOINED':
        handlePlayerJoined(message);
        break;
      case 'PLAYER_LEFT':
        handlePlayerLeft(message);
        break;
      case 'ROOM_CONFIG_UPDATED':
        handleConfigUpdated(message);
        break;
      case 'GAME_STARTING':
        handleGameStarting(message);
        break;
      case 'ERROR':
        showError(message.error);
        break;
    }
  } catch (e) {
    console.error('Failed to parse server message:', e);
  }
}

// Send message to server
function sendToServer(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

// UI Navigation
function showMainMenu() {
  hideAllPanels();
  document.getElementById('mainMenu').classList.remove('hidden');
}

function showCreateRoom() {
  hideAllPanels();
  document.getElementById('createRoomPanel').classList.remove('hidden');
  updateAISettings();
}

function showJoinRoom() {
  hideAllPanels();
  document.getElementById('joinRoomPanel').classList.remove('hidden');
}

function showRoomLobby() {
  hideAllPanels();
  document.getElementById('roomLobbyPanel').classList.remove('hidden');
}

function hideAllPanels() {
  const panels = ['mainMenu', 'createRoomPanel', 'joinRoomPanel', 'roomLobbyPanel'];
  panels.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

// Apply configuration preset
function applyPreset(presetName) {
  const preset = gamePresets[presetName];
  if (!preset) return;
  
  document.getElementById('maxPlayers').value = preset.maxPlayers;
  document.getElementById('maxLives').value = preset.maxLives;
  document.getElementById('spawnProtectionEnabled').checked = preset.spawnProtectionEnabled;
  document.getElementById('sanctuaryZonesEnabled').checked = preset.sanctuaryZonesEnabled;
  document.getElementById('antiCampingEnabled').checked = preset.antiCampingEnabled;
  document.getElementById('aiCount').value = preset.aiCount;
  document.getElementById('aiDifficulty').value = preset.aiDifficulty;
  
  updateAISettings();
  
  showMessage(`Applied ${presetName} preset!`);
}

// Update AI configuration UI
function updateAISettings() {
  const aiCount = parseInt(document.getElementById('aiCount').value);
  const aiConfigPanel = document.getElementById('aiPlayerConfig');
  const aiPlayerList = document.getElementById('aiPlayerList');
  
  if (aiCount > 0) {
    aiConfigPanel.classList.remove('hidden');
    aiPlayerList.innerHTML = '';
    
    for (let i = 0; i < aiCount; i++) {
      const aiPlayer = aiPersonalities[i % aiPersonalities.length];
      const aiItem = document.createElement('div');
      aiItem.className = 'ai-player-item';
      aiItem.innerHTML = `
        <div>
          <strong>${aiPlayer.name}</strong>
          <div style="font-size: 12px; color: #aaaaaa;">${aiPlayer.personality} personality</div>
        </div>
        <select class="select-field" style="width: 150px;" onchange="updateAIDifficulty(${i}, this.value)">
          <option value="easy">Easy</option>
          <option value="normal" selected>Normal</option>
          <option value="hard">Hard</option>
        </select>
      `;
      aiPlayerList.appendChild(aiItem);
    }
  } else {
    aiConfigPanel.classList.add('hidden');
  }
}

function updateAIDifficulty(index, difficulty) {
  console.log(`AI ${index} difficulty set to ${difficulty}`);
}

// Create room
function createRoom() {
  const hostName = document.getElementById('hostName').value.trim() || 'Player';
  playerName = hostName; // Store player name
  
  const config = {
    maxPlayers: parseInt(document.getElementById('maxPlayers').value),
    maxLives: parseInt(document.getElementById('maxLives').value),
    spawnProtection: {
      enabled: document.getElementById('spawnProtectionEnabled').checked
    },
    sanctuaryZones: {
      enabled: document.getElementById('sanctuaryZonesEnabled').checked
    },
    antiCamping: {
      enabled: document.getElementById('antiCampingEnabled').checked
    },
    aiOpponents: {
      enabled: parseInt(document.getElementById('aiCount').value) > 0,
      count: parseInt(document.getElementById('aiCount').value),
      difficulty: document.getElementById('aiDifficulty').value,
      aiPlayers: []
    }
  };
  
  // Add AI player configurations
  const aiCount = config.aiOpponents.count;
  for (let i = 0; i < aiCount; i++) {
    const aiPlayer = aiPersonalities[i % aiPersonalities.length];
    config.aiOpponents.aiPlayers.push({
      name: aiPlayer.name,
      personality: aiPlayer.personality,
      difficulty: config.aiOpponents.difficulty
    });
  }
  
  sendToServer({
    type: 'CREATE_ROOM',
    playerName: hostName,
    config: config
  });
}

// Join room
function joinRoom() {
  const enteredPlayerName = document.getElementById('playerName').value.trim() || 'Player';
  playerName = enteredPlayerName; // Store player name
  const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  
  if (roomCode.length !== 6) {
    showError('Room code must be 6 characters');
    return;
  }
  
  sendToServer({
    type: 'JOIN_ROOM',
    playerName: enteredPlayerName,
    roomCode: roomCode
  });
}

// Leave room
function leaveRoom() {
  sendToServer({
    type: 'LEAVE_ROOM'
  });
  
  currentRoom = null;
  isHost = false;
  playerName = null; // Clear player name
  showMainMenu();
}

// Start game
function startGame() {
  sendToServer({
    type: 'START_GAME'
  });
}

// Handle room created
function handleRoomCreated(message) {
  currentRoom = message.roomCode;
  isHost = true;
  playerId = message.playerId;
  
  showRoomLobby();
  updateRoomDisplay(message.room);
}

// Handle room joined
function handleRoomJoined(message) {
  currentRoom = message.roomCode;
  isHost = false;
  playerId = message.playerId;
  
  showRoomLobby();
  updateRoomDisplay(message.room);
  
  document.getElementById('joinError').classList.add('hidden');
}

// Handle player joined
function handlePlayerJoined(message) {
  updateRoomDisplay(message.room);
  showMessage(`${message.playerName} joined the room`);
}

// Handle player left
function handlePlayerLeft(message) {
  updateRoomDisplay(message.room);
  showMessage(`${message.playerName} left the room`);
}

// Handle config updated
function handleConfigUpdated(message) {
  updateRoomDisplay(message.room);
}

// Handle game starting
function handleGameStarting(message) {
  showMessage('Game starting...');
  
  // Use data from message if available (for late joiners), otherwise use globals
  const roomCode = message.roomCode || currentRoom;
  const playerIdToUse = message.playerId || playerId;
  const playerNameToUse = playerName; // playerName should already be set from join
  
  // Store room code, player ID, and player name for game connection
  sessionStorage.setItem('roomCode', roomCode);
  sessionStorage.setItem('playerId', playerIdToUse);
  sessionStorage.setItem('playerName', playerNameToUse);
  
  console.log('Stored for game:', {
    roomCode: roomCode,
    playerId: playerIdToUse,
    playerName: playerNameToUse
  });
  
  // DON'T send LEAVE_ROOM - just disconnect the websocket
  // The player stays in the room and will reconnect from game page
  if (socket) {
    // Mark this as an intentional disconnect (joining game)
    intentionalDisconnect = true;
    // Close the socket
    socket.close();
  }
  
  setTimeout(() => {
    window.location.href = `/index.html?room=${roomCode}`;
  }, 1000);
}

// Update room display
function updateRoomDisplay(room) {
  // Display room code
  document.getElementById('roomCodeDisplay').textContent = room.roomCode;
  
  // Update share link
  const shareUrl = `${location.protocol}//${location.host}/lobby.html?join=${room.roomCode}`;
  document.getElementById('shareLink').textContent = shareUrl;
  document.getElementById('shareLink').onclick = () => copyToClipboard(shareUrl);
  
  // Update player list
  const playerList = document.getElementById('playerListDisplay');
  playerList.innerHTML = '';
  
  room.players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    playerItem.innerHTML = `
      <div>
        <span class="player-name">${player.name}</span>
        ${player.id === room.hostId ? '<span class="player-role">(Host)</span>' : ''}
      </div>
    `;
    playerList.appendChild(playerItem);
  });
  
  // Add AI players to list
  if (room.config.aiOpponents && room.config.aiOpponents.enabled) {
    room.config.aiOpponents.aiPlayers.forEach(ai => {
      const aiItem = document.createElement('div');
      aiItem.className = 'player-item ai';
      aiItem.innerHTML = `
        <div>
          <span class="player-name">${ai.name}</span>
          <span class="player-role">(AI - ${ai.difficulty})</span>
        </div>
      `;
      playerList.appendChild(aiItem);
    });
  }
  
  // Update config display
  const configDisplay = document.getElementById('roomConfigDisplay');
  configDisplay.innerHTML = `
    <div class="config-item">
      <span class="config-label">Max Players:</span>
      <div>${room.config.maxPlayers}</div>
    </div>
    <div class="config-item">
      <span class="config-label">Max Lives:</span>
      <div>${room.config.maxLives === 0 ? 'Infinite' : room.config.maxLives}</div>
    </div>
    <div class="config-item">
      <span class="config-label">Spawn Protection:</span>
      <div>${room.config.spawnProtection.enabled ? 'Enabled' : 'Disabled'}</div>
    </div>
    <div class="config-item">
      <span class="config-label">Sanctuary Zones:</span>
      <div>${room.config.sanctuaryZones.enabled ? 'Enabled' : 'Disabled'}</div>
    </div>
    <div class="config-item">
      <span class="config-label">Anti-Camping:</span>
      <div>${room.config.antiCamping.enabled ? 'Enabled' : 'Disabled'}</div>
    </div>
    <div class="config-item">
      <span class="config-label">AI Opponents:</span>
      <div>${room.config.aiOpponents.count} (${room.config.aiOpponents.difficulty})</div>
    </div>
  `;
  
  // Show/hide start button (only host can start)
  const startButton = document.getElementById('startGameButton');
  if (isHost) {
    startButton.classList.remove('hidden');
  } else {
    startButton.classList.add('hidden');
  }
  
  // Update status
  const totalPlayers = room.players.length + (room.config.aiOpponents?.count || 0);
  document.getElementById('lobbyStatus').textContent = 
    `${room.players.length} human player${room.players.length !== 1 ? 's' : ''}, ${room.config.aiOpponents?.count || 0} AI - Ready to start!`;
}

// Copy share link to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showMessage('Share link copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showMessage('Failed to copy link');
  });
}

// Show message
function showMessage(text) {
  const status = document.getElementById('lobbyStatus');
  if (status) {
    const originalText = status.textContent;
    status.textContent = text;
    status.style.background = '#003300';
    status.style.borderColor = '#00ff00';
    status.style.color = '#00ff00';
    
    setTimeout(() => {
      status.textContent = originalText;
    }, 3000);
  }
}

// Show error
function showError(text) {
  const errorDiv = document.getElementById('joinError') || document.getElementById('lobbyError');
  if (errorDiv) {
    errorDiv.textContent = text;
    errorDiv.classList.remove('hidden');
    
    setTimeout(() => {
      errorDiv.classList.add('hidden');
    }, 5000);
  }
}

// Initialize on page load
window.addEventListener('load', () => {
  connectToServer();
  
  // Check for room code in URL
  const urlParams = new URLSearchParams(window.location.search);
  const joinRoomCode = urlParams.get('join');
  
  if (joinRoomCode) {
    // Auto-fill join room code
    document.getElementById('roomCodeInput').value = joinRoomCode;
    showJoinRoom();
  } else {
    showMainMenu();
  }
});

// Handle disconnect
window.addEventListener('beforeunload', () => {
  if (currentRoom) {
    sendToServer({ type: 'LEAVE_ROOM' });
  }
});
