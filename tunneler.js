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

// Start the game client: Load all image and sound files, connect to the server,
// and initialize the canvas.
// initCanvas() will start a timer to run the main event loop: procesEvents()
function tunneler() {

  // Set flag to expect server map data
  expectingServerMap = true;

  // Load image files
  loadAssets();

  // Connect to the server
  connect();

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
    setTimeout(initCanvas, 100);
    return;
  }

  // If we're expecting server map data, wait for it
  if (expectingServerMap && (!bgImage || !shapesImage || !mapImage)) {
    console.log('Waiting for server map data...');
    setTimeout(initCanvas, 100);
    return;
  }

  console.log('Assets loaded, initializing canvas...');

  // Init canvas and context
  buffer = document.createElement('canvas');
  buffer.id = 'tun_buffer_canvas';
  buffer.width = MAP_WIDTH;
  buffer.height = MAP_HEIGHT;
  bufferCtx = buffer.getContext('2d');
  bufferCtx.imageSmoothingEnabled = false;

  // Check if images are loaded before using them
  if (shapesImage && shapesImage.complete) {
    bufferCtx.drawImage(shapesImage, 0, 0);
    shapesData = bufferCtx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
  } else {
    console.error('shapesImage not ready');
    setTimeout(initCanvas, 100);
    return;
  }

  if (bgImage && bgImage.complete) {
    bufferCtx.drawImage(bgImage, 0, 0);
    bgData = bufferCtx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
  } else {
    console.error('bgImage not ready');
    setTimeout(initCanvas, 100);
    return;
  }

  // Initialize digData
  digData = Array(shapesData.length / 4).fill(0);

  if (mapImage && mapImage.complete) {
    bufferCtx.drawImage(mapImage, 0, 0);
    digTransparentAreas();
  } else {
    console.error('mapImage not ready');
    setTimeout(initCanvas, 100);
    return;
  }

  // Init viewport
  viewport = document.getElementById(TARGET_CANVAS_ID);
  viewportCtx = viewport.getContext('2d');
  resizeViewport();
  window.onresize = resizeViewport;

  viewport.tabIndex = 0;
  viewport.onfocus = resetKeys;
  viewport.onblur = resetKeys;

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
}

// Main event loop: process pressed keys, process received messages, redraw screen.
function processEvents() {

  // ALWAYS process network messages first, regardless of canvas state
  while (messageReceived()) {
    const msg = getMessage();
  
    if (!msg) {
      console.log('⚠️ Received null message');
      continue;
    }

    console.log('📨 Processing message type:', msg.type);

    // Handle complete map data from server - ALWAYS process this
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
    } else if (msg.type == MSG_JOIN) {
      if (initialized) {
        displayAlert('Player' + msg.id + ' has joined the game!');
      }
    } else if (msg.type == MSG_MOVE) {
      if (buffer) { // Only need buffer, not full canvas
        const before = onScreen(msg.player.id);
        opponents.set(msg.player);
        const after = onScreen(msg.player.id);
        if (before || after) {
          redrawRequest = true;
        }
      }
    } else if (msg.type == MSG_BASE) {
      // Process base messages even if canvas isn't fully ready
      if (buffer && bufferCtx) {
        console.log('Adding base for player', msg.base.id, 'at', msg.base.x, msg.base.y);
        addBase(msg.base);
        
        // Force a redraw to ensure the base is visible
        redrawRequest = true;
      } else {
        console.log('Buffer not ready for base placement, skipping');
      }
    } else if (msg.type == MSG_DIG) {
      // Process dig messages even if canvas isn't fully ready  
      if (buffer && bufferCtx) { // Only need buffer context
        digRect(msg.area.x, msg.area.y, msg.area.w, msg.area.h);
        if (collides && lens && collides(msg.area, lens)) {
          redrawRequest = true;
        }
      }      
    } else if (msg.type == MSG_FIRE) {
      if (initialized) {
        // Check if the firing player exists before calling fire
        const firingPlayer = (msg.id == player.id) ? player : opponents.get(msg.id);
        if (firingPlayer) {
          fire(msg.id);
        } else {
          console.log('Fire message from unknown player:', msg.id);
        }
      }
      if (onScreen(msg.id)) {
        playSound(sndFire2);
        redrawRequest = true;
      }
    } else if (msg.type == MSG_LOST) {
      if (buffer) { // Only need buffer, not full canvas
        tankDestroyed(msg.player.id, msg.player.by);
        redrawRequest = true;
      }
    } else if (msg.type == MSG_TEXT) {
      if (initialized) {
        chatReceived(msg.message.name, msg.message.text);
      }
    } else if (msg.type == MSG_NAME) {
      if (initialized) {
        displayAlert('Player' + msg.player.id + ' is now known as: ' + msg.player.name);
      }
      if (buffer) { // Only need buffer, not full canvas
        let opp = opponents.get(msg.player.id);
        opp.name = msg.player.name;
        opponents.set(opp);
        if (onScreen(msg.player.id)) {
          redrawRequest = true;
        }
      }
    } else if (msg.type == MSG_EXIT) {
      let opp = opponents.get(msg.id);
      if (initialized) {
        displayAlert(((opp && opp.name) ? opp.name : ('Player' + msg.id)) + ' has left the game!');
      }
      opponents.remove(opponents.get(msg.id));
    }
  }

  // Process pending INIT message if canvas is now ready
  if (pendingInitMessage && viewport && viewportCtx && buffer) {
    console.log('🎮 Processing pending INIT message, ID:', pendingInitMessage.id);
    initGameState(pendingInitMessage.id);
    pendingInitMessage = null;
    redrawRequest = true;
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

function assetsReady() {
  // Check if essential tank images are loaded
  const testTankImage = tankImages.get(18); // Player 1, direction 8
  return testTankImage && testTankImage.complete && testTankImage.naturalWidth > 0;
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
  
  try {
    // IMMEDIATELY set terrain data - this is critical for base placement
    window.gameTerrainData = mapData.terrain;
    console.log('Terrain data set for base placement');

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
    
    // Create the global image objects
    bgImage = new Image();
    shapesImage = new Image();
    mapImage = new Image();
    
    // Set up loading handlers
    let imagesLoaded = 0;
    const onImageLoad = () => {
      imagesLoaded++;
      if (imagesLoaded === 3) {
        console.log('Server map images loaded, triggering canvas initialization');
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
  }
}
