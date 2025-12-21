'use strict';

/* tunneler.js is the main script of the game (client side).
 */

/* global loadAssets, connect, digTransparentAreas, getDirectionFromKeys, resetKeys,
 * setupEventListeners, redrawScreen, hasQuit, bulletsOnScreen, moveBullets, move,
 * refuel, messageReceived, collides, getMessage, displayAlert, onScreen, addBase,
 * digRect, fire, playSound, chatReceived, hasFired, sendMessage, digCrater,
 * randomBaseLocation, displayWelcomeMessage, 
 * state, ready, reload, bullets, opponents, alive, quit,
 * fgImage, bgImage, shapesImage, mapImage, sndFire1, sndFire2, sndLost,
 * MSG_INIT, MSG_JOIN, MSG_MOVE, MSG_BASE, MSG_DIG, MSG_FIRE, MSG_LOST, MSG_TEXT, MSG_NAME, MSG_EXIT,
 * WAIT_FRAMES_ON_RESTART, MSG_MAP_SEED
 */

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 600;

const SCALE_X = 10;
const SCALE_Y = 10;

const TANK_WIDTH = 5;
const TANK_HEIGHT = 5;
const TANK_INIT_DIR = 8;
const TANK_MAX_ENERGY = 1000;
const TANK_MAX_HEALTH = 10;
const TANK_INIT_SCORE = 0;
let   TANK_INIT_X = 0;
let   TANK_INIT_Y = 0;

const TARGET_CANVAS_ID = 'tun_viewport_canvas';

const EVENT_LOOP_INTERVAL = 100;

// ============================================================================
// LOADING SCREEN OVERLAY
// ============================================================================

class TunnelerLoadingOverlay {
    constructor() {
        this.overlay = null;
        this.progressBar = null;
        this.statusText = null;
        this.percentText = null;
        this.isVisible = false;
        this.currentStage = 0;
        this.stages = [
            'Connecting to server...',
            'Loading game assets...',
            'Receiving map data...',
            'Processing terrain...',
            'Initializing canvas...',
            'Setting up game world...',
            'Ready to play!'
        ];
    }

    show() {
        if (this.isVisible) return;
        
        this.createOverlay();
        this.isVisible = true;
        this.updateProgress(0, this.stages[0]);
    }

    hide() {
        if (!this.isVisible || !this.overlay) return;
        
        this.updateProgress(100, 'Complete!');
        
        setTimeout(() => {
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                this.overlay = null;
                this.isVisible = false;
            }, 500);
        }, 300);
    }

    updateProgress(percent, message = null) {
        if (!this.isVisible) return;
        
        percent = Math.max(0, Math.min(100, percent));
        
        if (this.progressBar) {
            this.progressBar.style.width = percent + '%';
        }
        
        if (this.percentText) {
            this.percentText.textContent = Math.round(percent) + '%';
        }
        
        if (message && this.statusText) {
            this.statusText.textContent = message;
        }
        
        // Auto-advance through stages based on progress
        const stageIndex = Math.floor((percent / 100) * (this.stages.length - 1));
        if (!message && stageIndex !== this.currentStage && stageIndex < this.stages.length) {
            this.currentStage = stageIndex;
            if (this.statusText) {
                this.statusText.textContent = this.stages[stageIndex];
            }
        }
    }

    createOverlay() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'tunneler-loading-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Courier New', monospace;
            color: #fff;
            transition: opacity 0.5s ease;
        `;

        // Create container
        const container = document.createElement('div');
        container.style.cssText = `
            text-align: center;
            max-width: 450px;
            padding: 40px;
            background: rgba(26, 26, 26, 0.95);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
            border: 2px solid #4CAF50;
        `;

        // Title
        const title = document.createElement('div');
        title.textContent = 'TUNNELER';
        title.style.cssText = `
            font-size: 3em;
            margin-bottom: 30px;
            color: #4CAF50;
            text-shadow: 0 0 20px #4CAF50;
            font-weight: bold;
            letter-spacing: 4px;
        `;

        // Animated spinner
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 60px;
            height: 60px;
            border: 5px solid #333;
            border-top: 5px solid #4CAF50;
            border-radius: 50%;
            animation: tunneler-spin 1s linear infinite;
            margin: 0 auto 25px;
        `;

        // Progress label
        const progressLabel = document.createElement('div');
        progressLabel.textContent = 'Loading Game...';
        progressLabel.style.cssText = `
            font-size: 1.4em;
            margin-bottom: 20px;
            color: #fff;
        `;

        // Progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 100%;
            height: 25px;
            background: #333;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 15px;
            box-shadow: inset 0 3px 6px rgba(0,0,0,0.4);
        `;

        // Progress bar
        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #66BB6A);
            width: 0%;
            transition: width 0.4s ease;
            border-radius: 12px;
            box-shadow: 0 0 15px rgba(76, 175, 80, 0.6);
        `;

        // Percentage
        this.percentText = document.createElement('div');
        this.percentText.textContent = '0%';
        this.percentText.style.cssText = `
            font-size: 1.2em;
            margin-bottom: 20px;
            color: #4CAF50;
            font-weight: bold;
        `;

        // Status text
        this.statusText = document.createElement('div');
        this.statusText.textContent = 'Initializing...';
        this.statusText.style.cssText = `
            font-size: 1em;
            color: #bbb;
            margin-bottom: 30px;
            min-height: 24px;
        `;

        // Game tip
        const tip = document.createElement('div');
        tip.innerHTML = '🎯 <em>Use arrow keys to move • Space to shoot • Enter to chat</em>';
        tip.style.cssText = `
            font-size: 0.85em;
            color: #888;
            font-style: italic;
        `;

        // Add spinner animation to document
        if (!document.getElementById('tunneler-loading-styles')) {
            const style = document.createElement('style');
            style.id = 'tunneler-loading-styles';
            style.textContent = `
                @keyframes tunneler-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        // Assemble
        progressContainer.appendChild(this.progressBar);
        container.appendChild(title);
        container.appendChild(spinner);
        container.appendChild(progressLabel);
        container.appendChild(progressContainer);
        container.appendChild(this.percentText);
        container.appendChild(this.statusText);
        container.appendChild(tip);
        this.overlay.appendChild(container);

        // Add to page
        document.body.appendChild(this.overlay);
    }
}

// Create global loading overlay instance
const loadingOverlay = new TunnelerLoadingOverlay();

// ============================================================================
// GAME VARIABLES AND FUNCTIONS
// ============================================================================

let pendingMessages = [];
let processingQueuedMessages = false;
let expectingServerMap = false;
let pendingInitMessage = null;

// Pointer to the Javascript function interval that runs the main event loop. It is cleared when the user quits the game.
let eventLoopInterval;

// Coordinates of the visible part of the map (lens) on-screen. Recalculated every frame to follow the players current position.
const lens = {x: 0, y: 0, w: 0, h: 0};

// Coordinates and direction of the local player
let player = {id: 0, x: 0, y: 0, dir: 0, energy: 0, health: 0, score: 0, name: ""};

// Wait varies between 0 and WAIT_FRAMES_ON_RESTART.
let wait = 0;

// Initially not alive, only after INIT message has been received from the server.
let alive = false;

// Don't redraw the screen or play sounds when not yet initialized
let initialized = false;

// List of destroyed tank wrecks
const wrecks = [];

// Double-buffer canvas, context, and the pixel data of the background
let buffer, bufferCtx, bgData, shapesData, digData;

// Double-buffer tank images, context
let tankCanvas, tankCanvasCtx;

// Viewport context
let viewport, viewportCtx;

// Where to show sparks
const sparks = [];

// Whether we need to redraw the screen
let redrawRequest = false;

// Prevent zoom on all platforms
function preventZoom() {
  // Prevent Ctrl/Cmd + Plus/Minus/0
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && 
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
      return false;
    }
  }, { passive: false });

  // Prevent Ctrl/Cmd + Mouse Wheel zoom
  document.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      return false;
    }
  }, { passive: false });

  // Prevent pinch zoom on touch devices
  document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
      e.preventDefault();
      return false;
    }
  }, { passive: false });

  // Prevent double-tap zoom on mobile
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // Additional prevention for gesturestart (Safari)
  document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
  }, false);
}

// Start the game client: Load all image and sound files, connect to the server,
// and initialize the canvas.
// initCanvas() will start a timer to run the main event loop: procesEvents()
function tunneler() {
  preventZoom();
  
  // === SHOW LOADING OVERLAY AT THE VERY START ===
  loadingOverlay.show();
  loadingOverlay.updateProgress(5, 'Starting game...');

  // Set flag to expect server map data
  expectingServerMap = true;
  loadingOverlay.updateProgress(10, 'Connecting to server...');

  // Load image files
  loadAssets();
  loadingOverlay.updateProgress(20, 'Loading game assets...');

  // Connect to the server
  connect();
  loadingOverlay.updateProgress(30, 'Establishing connection...');

  // START EVENT LOOP IMMEDIATELY - before canvas initialization
  console.log('Starting event loop early to process server messages...');
  eventLoopInterval = setInterval(processEvents, EVENT_LOOP_INTERVAL);  

  // Initialize & start main event loop
  initCanvas();
}

// Draw the canvas and start the main loop
function initCanvas() {
  console.log('initCanvas - state:', state, 'ready:', ready, 'expectingServerMap:', expectingServerMap);

  // Wait for assets to load
  if (state < ready) {
    loadingOverlay.updateProgress(25, 'Loading assets...');
    setTimeout(initCanvas, 100);
    return;
  }

  loadingOverlay.updateProgress(35, 'Assets loaded...');

  // If we're expecting server map data, wait for it
  if (expectingServerMap && (!bgImage || !shapesImage || !mapImage)) {
    console.log('Waiting for server map data...');
    loadingOverlay.updateProgress(40, 'Waiting for map data...');
    setTimeout(initCanvas, 100);
    return;
  }

  console.log('Assets loaded, initializing canvas...');
  loadingOverlay.updateProgress(50, 'Initializing canvas...');

  // Init canvas and context
  buffer = document.createElement('canvas');
  buffer.id = 'tun_buffer_canvas';
  buffer.width = MAP_WIDTH;
  buffer.height = MAP_HEIGHT;
  bufferCtx = buffer.getContext('2d');
  bufferCtx.imageSmoothingEnabled = false;

  loadingOverlay.updateProgress(60, 'Processing shapes...');

  // Check if images are loaded before using them
  if (shapesImage && shapesImage.complete) {
    bufferCtx.drawImage(shapesImage, 0, 0);
    shapesData = bufferCtx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
  } else {
    console.error('shapesImage not ready');
    loadingOverlay.updateProgress(45, 'Waiting for shapes...');
    setTimeout(initCanvas, 100);
    return;
  }

  loadingOverlay.updateProgress(70, 'Processing background...');

  if (bgImage && bgImage.complete) {
    bufferCtx.drawImage(bgImage, 0, 0);
    bgData = bufferCtx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
  } else {
    console.error('bgImage not ready');
    loadingOverlay.updateProgress(55, 'Waiting for background...');
    setTimeout(initCanvas, 100);
    return;
  }

  // Initialize digData
  digData = Array(shapesData.length / 4).fill(0);

  loadingOverlay.updateProgress(80, 'Processing map terrain...');

  if (mapImage && mapImage.complete) {
    bufferCtx.drawImage(mapImage, 0, 0);
    digTransparentAreas();
  } else {
    console.error('mapImage not ready');
    loadingOverlay.updateProgress(65, 'Waiting for map...');
    setTimeout(initCanvas, 100);
    return;
  }

  loadingOverlay.updateProgress(85, 'Setting up viewport...');

  // Init viewport
  viewport = document.getElementById(TARGET_CANVAS_ID);
  viewportCtx = viewport.getContext('2d');
  resizeViewport();
  window.onresize = resizeViewport;

  viewport.tabIndex = 0;
  viewport.onfocus = resetKeys;
  viewport.onblur = resetKeys;

  loadingOverlay.updateProgress(90, 'Initializing game world...');

  // Redraw all existing bases on the new canvas
  if (bases.length > 0) {
    console.log('Redrawing', bases.length, 'existing bases on initialized canvas');
    bases.forEach(base => {
      if (typeof digBase !== 'undefined') {
        digBase(base);
        blockBaseWalls(base.x, base.y);
      }
    });
  }  

  setupEventListeners();
  
  loadingOverlay.updateProgress(95, 'Finalizing...');
}

// When the browser window is resized, recalculate the zoom scale, lens size and lens location, and redraw the screen.
function resizeViewport() {
  const dsb = document.getElementById('tun_dashboard_container');
  const dsbHeight = dsb.clientHeight;
  viewport.width = window.innerWidth - 40; // Keep 40px for left and right margins
  viewport.height = window.innerHeight - dsbHeight - 70; // Reserve space for the dashboard below the viewport
  lens.w = viewport.width / SCALE_X;
  lens.h = viewport.height / SCALE_Y;
  viewportCtx.imageSmoothingEnabled = false;
  viewportCtx.scale(SCALE_X, SCALE_Y);
  viewportCtx.font = '1px Lucida Console';
  viewportCtx.textAlign = 'center';
  centerLensOnPlayer();
  if (initialized) {
    redrawScreen();
  }
}

function initGameState(id) {
  // Reset base manager for new game
  if (typeof resetBaseManager !== 'undefined') {
    resetBaseManager();
  }
  
  loadingOverlay.updateProgress(98, 'Generating spawn point...');
  
  // Generate base
  let base = randomBaseLocation(id);
  addBase(base);

  // Generate player
  TANK_INIT_X = Math.ceil(base.x + (base.w / 2) - (TANK_WIDTH / 2));
  TANK_INIT_Y = Math.ceil(base.y + (base.h / 2) - (TANK_HEIGHT / 2) - 10);
  player = {id: id, x: TANK_INIT_X, y: TANK_INIT_Y, dir: TANK_INIT_DIR, energy: TANK_MAX_ENERGY, health: TANK_MAX_HEALTH, score: TANK_INIT_SCORE, name: 'Player' + id};
  centerLensOnPlayer();

  // Broadcast location
  sendMessage(MSG_JOIN, player.id);
  sendMessage(MSG_BASE, base);
  sendMessage(MSG_MOVE, player);

  // Display message in chat area
  displayWelcomeMessage();
  alive = true;
  initialized = true;

  // === HIDE LOADING OVERLAY WHEN GAME IS READY ===
  loadingOverlay.updateProgress(100, 'Game ready!');
  setTimeout(() => {
    loadingOverlay.hide();
  }, 800);
}

function processEvents() {
  // Only process new messages if we're not currently processing queued messages
  if (!processingQueuedMessages) {
    while (messageReceived()) {
      const msg = getMessage();
    
      if (!msg) {
        console.log('⚠️ Received null message');
        continue;
      }

      console.log('📨 Processing message type:', msg.type);

      // Always process these immediately
      if (msg.type == 'MAP_DATA') {
        console.log('Received MAP_DATA message from server');
        expectingServerMap = false;
        initializeBufferWithServerMap(msg.mapData);
        redrawRequest = true;    
      } else if (msg.type == MSG_MAP_SEED) {
        console.log('🌱 Received MAP_SEED from server:', msg.seed);
        expectingServerMap = false;
        window.sharedMapSeed = msg.seed;
        window.serverMapReceived = true;
        if (initialized && typeof generateRandomMaps !== 'undefined') {
          generateRandomMaps(msg.seed);
          redrawRequest = true;
        }
      } else if (msg.type == MSG_INIT) {
        if (!viewport || !viewportCtx || !buffer) {
          console.log('Canvas not ready, storing INIT message for later, ID:', msg.id);
          pendingInitMessage = msg;
        } else {
          console.log('🎮 Processing INIT message immediately, ID:', msg.id);
          initGameState(msg.id);
          redrawRequest = true;
        }
      // Queue other messages if canvas isn't ready
      } else if (!viewport || !viewportCtx || !buffer) {
        console.log('Canvas not ready, queuing message:', msg.type);
        pendingMessages.push(msg);
      } else {
        // Process immediately if canvas is ready
        processGameMessage(msg);
      }
    }
  }

  // Process pending INIT and then all queued messages
  if (pendingInitMessage && viewport && viewportCtx && buffer) {
    console.log('🎮 Processing pending INIT message, ID:', pendingInitMessage.id);
    initGameState(pendingInitMessage.id);
    pendingInitMessage = null;
    
    // Set flag to prevent processing new incoming messages during queue processing
    processingQueuedMessages = true;
    
    console.log('Processing', pendingMessages.length, 'queued messages');
    
    // Temporarily disable redraw requests
    let batchRedrawNeeded = false;
    const originalRedrawRequest = redrawRequest;
    
    while (pendingMessages.length > 0) {
      const queuedMsg = pendingMessages.shift();
      
      // Clear redraw flag before processing
      redrawRequest = false;
      
      processGameMessage(queuedMsg);
      
      // Check if this message needed a redraw
      if (redrawRequest) {
        batchRedrawNeeded = true;
      }
    }
    
    // Clear the flag
    processingQueuedMessages = false;
    pendingMessages = []; // Clear any remaining messages
    
    // Restore original redraw state and trigger single redraw if needed
    redrawRequest = originalRedrawRequest || batchRedrawNeeded;
    
    if (batchRedrawNeeded) {
      console.log('Batch processing complete, triggering single redraw');
    }
  }
  

  // Don't process game logic until canvas is initialized
  if (!viewport || !viewportCtx || !buffer) {
    return;
  }

  // Rest of your game logic stays the same...
  if (hasQuit()) {
    quitGame();
  }

  if (reload > 0) {
    reload--;
  }

  if (player.energy < TANK_MAX_ENERGY / 4) {
    redrawRequest = true;
  }

  if (bullets.length > 0) {
    const before = bulletsOnScreen();
    moveBullets();
    const after = bulletsOnScreen();
    if (before || after) {
      redrawRequest = true;
    }
  }

  if (alive) {
    if (refuel()) {
      redrawRequest = true;
    }
    checkEnergy();
    checkHealth();

    let dir = getDirectionFromKeys();
    if (dir != 0) {
      move(dir);
      centerLensOnPlayer();
      redrawRequest = true;
    }
  } else {
    if (wait) {
      if (! opponents.some(opp => collides({x: TANK_INIT_X, y: TANK_INIT_Y, w: TANK_WIDTH, h: TANK_HEIGHT}, area(opp)))) {
        if (--wait == 0) {
          restart();
        }
      }
    }
  }

  if (alive && hasFired()) {
    fire(player.id);
    playSound(sndFire1);
    redrawRequest = true;
  }

  if (redrawRequest) {
    redrawScreen();
  }
}

function processHistoricalFireImpact(firingPlayer) {
  // Simulate a bullet fired from the player's position in their direction
  // This is a simplified version that assumes the bullet hits terrain quickly
  
  let bulletX = firingPlayer.x;
  let bulletY = firingPlayer.y;
  const bulletDir = firingPlayer.dir;
  
  // Calculate bullet starting position based on tank direction
  if ([1, 4, 7].includes(bulletDir)) {
    bulletX = firingPlayer.x - 2;
  }
  if ([8, 2].includes(bulletDir)) {
    bulletX = firingPlayer.x + Math.floor(TANK_WIDTH / 2);
  }
  if ([3, 6, 9].includes(bulletDir)) {
    bulletX = firingPlayer.x + TANK_WIDTH;
  }
  if ([7, 8, 9].includes(bulletDir)) {
    bulletY = firingPlayer.y - 2;
  }
  if ([4, 6].includes(bulletDir)) {
    bulletY = firingPlayer.y + Math.floor(TANK_HEIGHT / 2);
  }
  if ([1, 2, 3].includes(bulletDir)) {
    bulletY = firingPlayer.y + TANK_HEIGHT;
  }
  
  // Trace bullet path until it hits terrain
  const maxSteps = 200; // Prevent infinite loops
  for (let step = 0; step < maxSteps; step++) {
    // Move bullet forward
    if ([9, 6, 3].includes(bulletDir)) {
      bulletX += 2;
    }
    if ([1, 2, 3].includes(bulletDir)) {
      bulletY += 2;
    }
    if ([7, 4, 1].includes(bulletDir)) {
      bulletX -= 2;
    }
    if ([9, 8, 7].includes(bulletDir)) {
      bulletY -= 2;
    }
    
    // Check if bullet is out of bounds
    if (bulletX < 0 || bulletY < 0 || bulletX > MAP_WIDTH || bulletY > MAP_HEIGHT) {
      break;
    }
    
    // Check if bullet hit terrain (dig a small area and see if anything was dug)
    const dugPixels = digRect(Math.floor(bulletX), Math.floor(bulletY), 2, 2);
    if (dugPixels > 0) {
      // Bullet hit terrain, create crater
      digCrater(Math.floor(bulletX), Math.floor(bulletY), 3, 3);
      break;
    }
  }
}

function processGameMessage(msg) {
  if (msg.type == MSG_JOIN) {
    if (initialized) {
      displayAlert('Player' + msg.id + ' has joined the game!');
    }
  } else if (msg.type == MSG_MOVE) {
    const before = onScreen(msg.player.id);
    opponents.set(msg.player);
    const after = onScreen(msg.player.id);
    if (before || after) {
      redrawRequest = true;
    }
  } else if (msg.type == MSG_BASE) {
    console.log('Processing BASE message for player', msg.base.id);
    addBase(msg.base);
    if (collides && lens && collides(msg.base, lens)) {
      redrawRequest = true;
    }
  } else if (msg.type == MSG_DIG) {
    digRect(msg.area.x, msg.area.y, msg.area.w, msg.area.h);
    if (collides && lens && collides(msg.area, lens)) {
      redrawRequest = true;
    }
  } else if (msg.type == MSG_FIRE) {
  if (processingQueuedMessages) {
    // For historical fire messages, apply the impact effects without creating bullets
    console.log('Processing historical FIRE impact for player', msg.id);
    
    const firingPlayer = (msg.id == player.id) ? player : opponents.get(msg.id);
    if (firingPlayer) {
      processHistoricalFireImpact(firingPlayer);
    }
      } else {
      // Process normal real-time fire messages
      if (initialized) {
        const firingPlayer = (msg.id == player.id) ? player : opponents.get(msg.id);
        if (firingPlayer) {
          fire(msg.id);
          if (onScreen && onScreen(msg.id)) {
            playSound(sndFire2);
            redrawRequest = true;
          }
        } else {
          console.log('Fire message from unknown player:', msg.id);
        }
      }
    }
  } else if (msg.type == MSG_LOST) {
    tankDestroyed(msg.player.id, msg.player.by);
    redrawRequest = true;
  } else if (msg.type == MSG_TEXT) {
    if (initialized) {
      chatReceived(msg.message.name, msg.message.text);
    }
  } else if (msg.type == MSG_NAME) {
    if (initialized) {
      displayAlert('Player' + msg.player.id + ' is now known as: ' + msg.player.name);
    }
    let opp = opponents.get(msg.player.id);
    if (opp) {
      opp.name = msg.player.name;
      opponents.set(opp);
      if (onScreen && onScreen(msg.player.id)) {
        redrawRequest = true;
      }
    }
  } else if (msg.type == MSG_EXIT) {
    let opp = opponents.get(msg.id);
    if (initialized) {
      displayAlert(((opp && opp.name) ? opp.name : ('Player' + msg.id)) + ' has left the game!');
    }
    if (opp) {
      opponents.remove(opp);
    }
  }
}

// Center the lens on the player, except when near the edge
function centerLensOnPlayer() {
  // Center on player position
  lens.x = player.x - (lens.w / 2) + (TANK_WIDTH / 2);
  lens.y = player.y - (lens.h / 2) + (TANK_HEIGHT / 2);

  // Prevent the lens from being positioned outside the image
  if (lens.x > MAP_WIDTH - lens.w) {
    lens.x = MAP_WIDTH - lens.w;
  } else if (lens.x < 0) {
    lens.x = 0;
  }
  if (lens.y > MAP_HEIGHT - lens.h) {
    lens.y = MAP_HEIGHT - lens.h;
  } else if (lens.y < 0) {
    lens.y = 0;
  }
}

// Small helper function to get a rectangle of a player's tank
function area(player) {
  return {x: player.x, y: player.y, w: TANK_WIDTH, h: TANK_HEIGHT};
}

// When energy is 0, self-destruct
function checkEnergy() {
  if (player.energy <= 0) {
    player.health = 0;
    redrawRequest = true;
  }
}

// Self-destruct when health is zero.
function checkHealth() {
  if (player.health <= 0) {
    if (--player.score < 0) {
      player.score = 0;
    }
    displayAlert("You self-destructed! Your score is now: " + player.score);
    sendMessage(MSG_LOST, {id: player.id, by: player.id});
    playSound(sndLost);
    alive = false;

    digCrater(player.x + Math.floor(TANK_WIDTH / 2), player.y + Math.floor(TANK_HEIGHT / 2), 4 * TANK_WIDTH + 1, 4 * TANK_HEIGHT + 1);
    wrecks.push(player);

    // Wait a few frames, then restart player on starting position.
    wait = WAIT_FRAMES_ON_RESTART;
    redrawRequest = true;
  }
}

// Delete the destroyed tank and dig a large crater.
function tankDestroyed(id, by) {
  let victim = opponents.get(id);
  if (victim) {
    opponents.remove(victim);
    digCrater(victim.x + Math.floor(TANK_WIDTH / 2), victim.y + Math.floor(TANK_HEIGHT / 2), 4 * TANK_WIDTH + 1, 4 * TANK_HEIGHT + 1);
    wrecks.push(victim);
    playSound(sndLost);
    
    // Update scores and display a chat message.
    if (by == player.id) {
      player.score++;
      displayAlert("You destroyed " + victim.name + "! Your score is now: " + player.score);
    } else if (id == by) {
      displayAlert(victim.name + " self-destructed!");
    } else {
      let winner = opponents.get(by);
      winner.score++;
      opponents.set(winner);
      displayAlert(winner.name + " destroyed " + victim.name + "! " + winner.name + "s score is now: " + winner.score);
    }
  }
}

// Move player back to starting position with full energy and health, but keep id and score.
function restart() {
  player = {id: player.id, x: TANK_INIT_X, y: TANK_INIT_Y, dir: TANK_INIT_DIR, energy: TANK_MAX_ENERGY, health: TANK_MAX_HEALTH, score: player.score, name: player.name};
  centerLensOnPlayer();
  sendMessage(MSG_MOVE, player);
  alive = true;
  redrawScreen();
}

// Show the entire map, and then reload the page.
function quitGame() {
  quit = false;
  clearInterval(eventLoopInterval);
  viewportCtx.scale(lens.w / MAP_WIDTH, lens.h / MAP_HEIGHT);
  lens.x = 0;
  lens.y = 0;
  redrawScreen();
  document.onkeyup = null;
  document.onkeydown = () => window.location.reload();
  document.onmousedown = () => window.location.reload();
  document.ontouchdown = () => window.location.reload();
}

function initializeBufferWithServerMap(mapData) {
  console.log('Replacing fallback map with server map data');
  loadingOverlay.updateProgress(45, 'Receiving server map...');
  
  try {
    // IMMEDIATELY set terrain data - this is critical for base placement
    window.gameTerrainData = mapData.terrain;
    console.log('Terrain data set for base placement');

    loadingOverlay.updateProgress(50, 'Processing map layers...');

    // Convert server data
    const bgImageData = new Uint8ClampedArray(mapData.bgLayer);
    const shapesImageData = new Uint8ClampedArray(mapData.shapesLayer);
    const mapImageData = new Uint8ClampedArray(mapData.mapLayer);
    
    // CREATE THE ACTUAL IMAGE OBJECTS that initCanvas() expects
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = mapData.width;
    bgCanvas.height = mapData.height;
    const bgCtx = bgCanvas.getContext('2d');
    const bgData = new ImageData(bgImageData, mapData.width, mapData.height);
    bgCtx.putImageData(bgData, 0, 0);
    
    const shapesCanvas = document.createElement('canvas');
    shapesCanvas.width = mapData.width;
    shapesCanvas.height = mapData.height;
    const shapesCtx = shapesCanvas.getContext('2d');
    const shapesData = new ImageData(shapesImageData, mapData.width, mapData.height);
    shapesCtx.putImageData(shapesData, 0, 0);
    
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = mapData.width;
    mapCanvas.height = mapData.height;
    const mapCtx = mapCanvas.getContext('2d');
    const mapData_img = new ImageData(mapImageData, mapData.width, mapData.height);
    mapCtx.putImageData(mapData_img, 0, 0);
    
    loadingOverlay.updateProgress(55, 'Creating map images...');
    
    // Create the global image objects
    bgImage = new Image();
    shapesImage = new Image();
    mapImage = new Image();
    
    // Set up loading handlers
    let imagesLoaded = 0;
    const onImageLoad = () => {
      imagesLoaded++;
      loadingOverlay.updateProgress(55 + (imagesLoaded * 5), `Loading image ${imagesLoaded}/3...`);
      
      if (imagesLoaded === 3) {
        console.log('Server map images loaded, triggering canvas initialization');
        loadingOverlay.updateProgress(70, 'Map images ready...');
        // Force canvas initialization now that images are ready
        setTimeout(() => {
          if (!buffer) {
            initCanvas();
          }
        }, 10);
      }
    };
    
    bgImage.onload = onImageLoad;
    shapesImage.onload = onImageLoad;
    mapImage.onload = onImageLoad;
    
    // Set the image sources (this triggers loading)
    bgImage.src = bgCanvas.toDataURL();
    shapesImage.src = shapesCanvas.toDataURL();
    mapImage.src = mapCanvas.toDataURL();
    
    // Reset base manager
    if (typeof resetBaseManager !== 'undefined') {
      resetBaseManager();
    }
    
    console.log('Server map objects created, waiting for image loading...');
    
  } catch (error) {
    console.error('Error applying server map:', error);
    loadingOverlay.updateProgress(0, 'Error loading map!');
  }
}
