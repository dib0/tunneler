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

  // Load image files
  loadAssets();

  // Connect to the server
  connect();

  // Initialize & start main event loop
  initCanvas();
}

// Draw the canvas and start the main loop
function initCanvas() {

  // Sleep until all assets have loaded.
  if (state < ready) {
    setTimeout(initCanvas, 100);
    return;
  }

  // Init canvas and context; set properties
  buffer = document.createElement('canvas');
  buffer.id = 'tun_buffer_canvas';
  buffer.width = MAP_WIDTH;
  buffer.height = MAP_HEIGHT;
  bufferCtx = buffer.getContext('2d');
  bufferCtx.imageSmoothingEnabled = false;

  bufferCtx.drawImage(shapesImage, 0, 0);
  shapesData = bufferCtx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;

  bufferCtx.drawImage(bgImage, 0, 0);
  bgData = bufferCtx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;

  // Nothing has been dug initially
  digData = Array(shapesData.length / 4).fill(0);

  // Draw map image in the buffer
  bufferCtx.drawImage(mapImage, 0, 0);

  // Mark transparent pixels as digged
  digTransparentAreas();

  // Init viewport and context; set smoothing and scaling properties
  viewport = document.getElementById(TARGET_CANVAS_ID);
  viewportCtx = viewport.getContext('2d');
  resizeViewport();
  window.onresize = resizeViewport;

  // Adding a tabIndex attribute makes the canvas focus-able, which will make the browser send focus events
  viewport.tabIndex = 0;
  viewport.onfocus = resetKeys;
  viewport.onblur = resetKeys;

  // Listen for mouse and touch events
  setupEventListeners();

  // Run the main event loop at a set time interval
  eventLoopInterval = setInterval(processEvents, EVENT_LOOP_INTERVAL);
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

// Main event loop: process pressed keys, process received messages, redraw screen.
function processEvents() {

  // ESC key: Show the entire map, wait for a random key, and restart.
  if (hasQuit()) {
    quitGame();
  }

  // Countdown until tank can fire again after the previous shot
  if (reload > 0) {
    reload--;
  }

  // When low on energy, redraw the screen every frame, to allow for static interference
  if (player.energy < TANK_MAX_ENERGY / 4) {
    redrawRequest = true;
  }

  // Move flying bullets forward
  if (bullets.length > 0) {
    const before = bulletsOnScreen();
    moveBullets();
    const after = bulletsOnScreen();
    if (before || after) {
      redrawRequest = true;
    }
  }

  if (alive) {
    // Regain energy and health when inside a base
    if (refuel()) {
      redrawRequest = true;
    }
    // Check energy and health status
    checkEnergy();
    checkHealth();

    // Check keys for moving/digging
    let dir = getDirectionFromKeys();
    if (dir != 0) {
      move(dir);
      centerLensOnPlayer();
      redrawRequest = true;
    }

  } else {
    // When destroyed, wait a few frames before restarting
    if (wait) {

      // Is someone occopying my starting position?
      if (! opponents.some(opp => collides({x: TANK_INIT_X, y: TANK_INIT_Y, w: TANK_WIDTH, h: TANK_HEIGHT}, area(opp)))) {
        // Countdown to restart
        if (--wait == 0) {
          restart();
        }
      }
    }
  }

  // Check for received network messages
  while (messageReceived()) {
    const msg = getMessage();

  // Server sent map seed - generate map with this seed
  if (msg.type == MSG_MAP_SEED) {
    console.log('Received map seed from server:', msg.seed);
    window.sharedMapSeed = msg.seed;

    // Regenerate map with server seed if already initialized
    if (initialized && typeof generateRandomMaps !== 'undefined') {
      generateRandomMaps(msg.seed);
      redrawRequest = true;
    }

    // Server confirmed the connection
    } else if (msg.type == MSG_INIT) {
      initGameState(msg.id);
      redrawRequest = true;
    
    // Opponent has joined
    } else if (msg.type == MSG_JOIN) {
      if (initialized) {
        displayAlert('Player' + msg.id + ' has joined the game!');
      }

    // Opponent has moved
    } else if (msg.type == MSG_MOVE) {
      const before = onScreen(msg.player.id);
      opponents.set(msg.player);
      const after = onScreen(msg.player.id);
      if (before || after) {
        redrawRequest = true;
      }
    
    // Opponent base location
    } else if (msg.type == MSG_BASE) {
      addBase(msg.base);
      if (collides(msg.base, lens)) {
        redrawRequest = true;
      }
    
    // Opponent has dug part of the map
    } else if (msg.type == MSG_DIG) {
      digRect(msg.area.x, msg.area.y, msg.area.w, msg.area.h);
      if (collides(msg.area, lens)) {
        redrawRequest = true;
      }

    // Opponent has fired
    } else if (msg.type == MSG_FIRE) {
      if (initialized) {
        fire(msg.id);
      }
      if (onScreen(msg.id)) {
        playSound(sndFire2);
        redrawRequest = true;
      }
    
    // Opponent has been destroyed
    } else if (msg.type == MSG_LOST) {
      tankDestroyed(msg.player.id, msg.player.by);
      redrawRequest = true;
    
    // Opponent has sent a chat message
    } else if (msg.type == MSG_TEXT) {
      if (initialized) {
        chatReceived(msg.message.name, msg.message.text);
      }

    // Opponent has changed name
    } else if (msg.type == MSG_NAME) {
      if (initialized) {
        displayAlert('Player' + msg.player.id + ' is now known as: ' + msg.player.name);
      }
      let opp = opponents.get(msg.player.id);
      opp.name = msg.player.name;
      opponents.set(opp);
      if (onScreen(msg.player.id)) {
        redrawRequest = true;
      }
    
    // Opponent has disconnected
    } else if (msg.type = MSG_EXIT) {
      let opp = opponents.get(msg.id);
      if (initialized) {
        displayAlert(((opp && opp.name) ? opp.name : ('Player' + msg.id)) + ' has left the game!');
      }
      opponents.remove(opponents.get(msg.id));
    }
  }

  // Check if fire key has been pressed
  if (alive && hasFired()) {
    fire(player.id);
    playSound(sndFire1);
    redrawRequest = true;
  }

  if (redrawRequest) {
    redrawScreen();
  }
  }

// Dig initial tank position and let opponents know where we are.
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
