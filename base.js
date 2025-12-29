/* base.js contains a function to search a random location on the map for a new base,
 * a function refuel() to regain energy and shield when inside a base, 
 * and several functions to add a new base to the game.
 */

/* global player, shapesData
 * MAP_WIDTH, MAP_HEIGHT, TANK_WIDTH, TANK_HEIGHT, TANK_MAX_ENERGY, TANK_MAX_HEALTH,
 * collision, digBase, GameConfig
 */

const BASE_WIDTH = 40;
const BASE_HEIGHT = 40;

// Track camping behavior
const campingTrackers = new Map(); // playerId -> {baseId, frames, lastWarned}

// List of bases
const bases = [];

// Check if a position is within a sanctuary zone (protected area around base entrance)
function isInSanctuaryZone(x, y, baseId) {
  if (!GameConfig.sanctuaryZones.enabled) return false;
  
  const base = bases.find(b => b.id == baseId);
  if (!base) return false;
  
  // Calculate center of base entrance (bottom of base)
  const entranceX = base.x + BASE_WIDTH / 2;
  const entranceY = base.y + BASE_HEIGHT;
  
  // Check distance from entrance
  const dx = x + TANK_WIDTH / 2 - entranceX;
  const dy = y + TANK_HEIGHT / 2 - entranceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance <= GameConfig.sanctuaryZones.radius;
}

// Check if player is in their own base's sanctuary zone
function isInOwnSanctuary() {
  return isInSanctuaryZone(player.x, player.y, player.id);
}

// Detect and penalize camping behavior
function updateCampingDetection() {
  if (!GameConfig.antiCamping.enabled) {
    return; // Anti-camping disabled
  }
  
  let isCamping = false;
  
  // Check if player is near any enemy base
  for (const base of bases) {
    if (base.id === player.id) continue; // Skip own base
    
    const baseX = base.x + BASE_WIDTH / 2;
    const baseY = base.y + BASE_HEIGHT / 2;
    const playerX = player.x + TANK_WIDTH / 2;
    const playerY = player.y + TANK_HEIGHT / 2;
    
    const dx = playerX - baseX;
    const dy = playerY - baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= GameConfig.antiCamping.detectionRadius) {
      isCamping = true;
      const trackingKey = `${player.id}-${base.id}`;
      
      if (!campingTrackers.has(trackingKey)) {
        campingTrackers.set(trackingKey, {
          baseId: base.id,
          frames: 0,
          lastWarned: 0
        });
      }
      
      const tracker = campingTrackers.get(trackingKey);
      tracker.frames++;
      
      // Warn player at warning threshold
      if (GameConfig.antiCamping.showWarnings && 
          tracker.frames === GameConfig.antiCamping.warningTime && 
          tracker.lastWarned < tracker.frames) {
        displayAlert('⚠️ Warning: Stop camping or take damage!');
        tracker.lastWarned = tracker.frames;
      }
      
      // Apply camping penalty
      if (tracker.frames >= GameConfig.antiCamping.penaltyTime) {
        if (GameConfig.antiCamping.showWarnings && tracker.frames % 10 === 0) { // Warn every second
          displayAlert('🔥 Camping penalty! Taking damage...');
        }
        player.health -= GameConfig.antiCamping.damagePerFrame;
        
        if (player.health <= 0) {
          displayAlert("Destroyed by camping penalty!");
          sendMessage(MSG_LOST, {id: player.id, by: player.id});
          alive = false;
          digCrater(player.x + Math.floor(TANK_WIDTH / 2), player.y + Math.floor(TANK_HEIGHT / 2), 4 * TANK_WIDTH + 1, 4 * TANK_HEIGHT + 1);
          wrecks.push(player);
          playSound(sndLost);
          wait = WAIT_FRAMES_ON_RESTART;
        }
      }
      
      break; // Only track one base at a time
    }
  }
  
  // Reset camping tracker if not camping
  if (!isCamping) {
    campingTrackers.clear();
  }
}

// Generate a random location for a new base (with logic to place
// bases not too close to each other)
function randomBaseLocation(id) {
  // Use the optimal placement if available AND terrain data exists
  if (typeof generateOptimalBaseLocation !== 'undefined' && window.gameTerrainData) {
    const optimalLocation = generateOptimalBaseLocation(id);
    if (optimalLocation) {
      return optimalLocation;
    }
    // If optimal placement fails, fall through to random method
  }
  
  // Improved fallback method with distance checking
  const MIN_DISTANCE_BETWEEN_BASES = 400; // Match mapgen.js setting
  const attempts = 400; // More attempts for better placement
  
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rect = {
      id: id,
      x: Math.floor(Math.random() * (MAP_WIDTH - BASE_WIDTH * 3)) + BASE_WIDTH * 1.5,
      y: Math.floor(Math.random() * (MAP_HEIGHT - BASE_HEIGHT * 3)) + BASE_HEIGHT * 1.5,
      w: BASE_WIDTH,
      h: BASE_HEIGHT
    };
    
    // Check collision with terrain
    if (collision(rect)) {
      continue;
    }
    
    // Check distance from all existing bases
    let tooClose = false;
    for (const existingBase of bases) {
      const distance = Math.sqrt(
        Math.pow(rect.x - existingBase.x, 2) + 
        Math.pow(rect.y - existingBase.y, 2)
      );
      
      if (distance < MIN_DISTANCE_BETWEEN_BASES) {
        tooClose = true;
        break;
      }
    }
    
    if (!tooClose) {
      console.log('Found suitable base location at', rect.x, rect.y, 'after', attempt + 1, 'attempts');
      return rect;
    }
  }
  
  // Last resort: just avoid collisions
  console.warn('Could not find well-spaced base location, using any valid location');
  for (let attempt = 0; attempt < 100; attempt++) {
    const rect = {
      id: id,
      x: Math.floor(Math.random() * (MAP_WIDTH - BASE_WIDTH * 2)) + BASE_WIDTH,
      y: Math.floor(Math.random() * (MAP_HEIGHT - BASE_HEIGHT * 2)) + BASE_HEIGHT,
      w: BASE_WIDTH,
      h: BASE_HEIGHT
    };
    
    if (!collision(rect)) {
      return rect;
    }
  }
  
  // Absolute last resort
  return {
    id: id,
    x: BASE_WIDTH * 2,
    y: BASE_HEIGHT * 2,
    w: BASE_WIDTH,
    h: BASE_HEIGHT
  };
}

// Check if inside a base, to refuel/repair
function refuel() {
  let fueled = false;

  for (const base of bases) {

    // Am I in a base?
    if  (player.x >= base.x
      && player.y >= base.y
      && player.x + TANK_WIDTH <= base.x + base.w
      && player.y + TANK_HEIGHT <= base.y + base.h
      && (! (player.x < base.x + 15 && player.y < base.y + 15))
      && (! (player.x > base.x + 25 && player.y < base.y + 15))
      && (! (player.x < base.x + 15 && player.y > base.y + 25))
      && (! (player.x > base.x + 25 && player.y > base.y + 25))) {

      // My own base?
      if (player.id == base.id) {
        if (player.energy < TANK_MAX_ENERGY) {
          player.energy += 5;
          fueled = true;
        }
        if (player.health < TANK_MAX_HEALTH) {
          player.health += 0.2;
          fueled = true;
        }
      // Some elses base?
      } else {
        if (player.energy < TANK_MAX_ENERGY) {
          player.energy += 3;
          fueled = true;
        }
      }
      if (player.energy > TANK_MAX_ENERGY) {
        player.energy = TANK_MAX_ENERGY;
      }
      if (player.health > TANK_MAX_HEALTH) {
        player.health = TANK_MAX_HEALTH;
      }
    }
  }
  return fueled;
}

// Dig a base and add the walls as blocking objects on the map
function addBase(base) {
  bases.push(base);

  // Only dig and block if buffer is available
  if (typeof digBase !== 'undefined' && bufferCtx) {
    digBase(base);
    blockBaseWalls(base.x, base.y);
    console.log('Base visual elements added for player', base.id);
  } else {
    console.log('Base added to list but visual elements skipped - buffer not ready');
  }
}

// Add the walls of the base at this location in shapesData (map of all shapes that block movement and bullets)
function blockBaseWalls(x, y) {
  const data = baseDigData();
  for (let ry = 0; ry < BASE_HEIGHT; ry++) {
    for (let rx = 0; rx < BASE_WIDTH; rx++) {
      if (data[ry][rx] == '2') {
        let a = ((ry + y) * MAP_WIDTH * 4) + ((rx + x) * 4) + 3;
        shapesData[a] = 255;
      }
    }
  }
}

// Draw picture of the base on the canvas context
function drawBaseWalls(ctx, base, x, y) {
  const data = baseDigData();
  
  // Tank colors matching your new palette
  const TANK_COLORS = [
    '#00ff00', // Player 1 - Green
    '#0000ff', // Player 2 - Blue  
    '#ff0000', // Player 3 - Red
    '#800080'  // Player 4 - Purple
  ];
  
  // Function to darken color by 50%
  function darkenColor(color, factor = 0.5) {
    const hex = color.replace('#', '');
    const r = Math.floor(parseInt(hex.substr(0, 2), 16) * factor);
    const g = Math.floor(parseInt(hex.substr(2, 2), 16) * factor);
    const b = Math.floor(parseInt(hex.substr(4, 2), 16) * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  // Get player colors
  const playerIndex = (parseInt(base.id) - 1) % 4;
  const roofColor = TANK_COLORS[playerIndex];
  const wallColor = darkenColor(roofColor, 0.5);
  
  // Draw the walls (50% darker than roof)
  ctx.fillStyle = wallColor;
  for (let ry = 0; ry < BASE_HEIGHT; ry++) {
    for (let rx = 0; rx < BASE_WIDTH; rx++) {
      if (data[ry][rx] == '2') {
        ctx.fillRect(x + rx, y + ry, 1, 1);
      }
    }
  }
  
  // Draw the roof (tank color)
  ctx.fillStyle = roofColor;
  for (let ry = 0; ry < BASE_HEIGHT; ry++) {
    for (let rx = 0; rx < BASE_WIDTH; rx++) {
      if (data[ry][rx] == '3') {
        ctx.fillRect(x + rx, y + ry, 1, 1);
      }
    }
  }
  
  // Draw player name at bottom of base, centered horizontally
  // Find the player object to get the name
  let playerName = '';
  if (typeof player !== 'undefined' && player.id == base.id) {
    playerName = player.name;
  } else if (typeof opponents !== 'undefined') {
    const opponent = opponents.get(base.id);
    if (opponent) {
      playerName = opponent.name;
    }
  }
  
  // Only draw name if we found one and it's not empty
  if (playerName && playerName.length > 0) {
    // Set text properties - smaller font for all names
    ctx.font = '6px monospace'; // Smaller monospace font
    ctx.textAlign = 'center'; // Center alignment horizontally
    ctx.textBaseline = 'top'; // Align from top so we can position at bottom precisely
    
    // Calculate horizontal center of the base
    const centerX = x + BASE_WIDTH / 2;
    
    // Position at bottom of the base (just below the base structure)
    const textY = y + BASE_HEIGHT + 1; // 1 pixel below the base
    
    // Draw text with a subtle shadow for better readability
    ctx.fillStyle = '#000000';
    ctx.fillText(playerName, centerX + 1, textY + 1); // Shadow
    ctx.fillStyle = '#ffffff';
    ctx.fillText(playerName, centerX, textY); // Main text
  }
}

// This is the pixel data of the base image. 0 = sand, 1 = dug, 2 = wall, 3 = roof
// Because the picture is symmetrical, we define only the top half, and concatenate
// the reversal to get the entire picture.
function baseDigData() {
  const tophalf = [
    '0000000000000221111111111220000000000000',
    '0000000000002211111111111122000000000000',
    '0000000000022111111111111112200000000000',
    '0000000000221111111111111111220000000000',
    '0000000002211111111111111111122000000000',
    '0000000022111111111111111111112200000000',
    '0000000221111111111111111111111220000000',
    '0000002211111111111111111111111122000000',
    '0000022131111111111111111111111312200000',
    '0000221113111111111111111111113111220000',
    '0002211111311111111111111111131111122000',
    '0022111111131111111111111111311111112200',
    '0221111111113111111111111113111111111220',
    '2211111111111311111111111131111111111122',
    '2111111111111131111111111311111111111112',
    '1111111111111113111111113111111111111111',
    '1111111111111111311111131111111111111111',
    '1111111111111111131111311111111111111111',
    '1111111111111111113333111111111111111111',
    '1111111111111111113333111111111111111111'
  ];
  const bottomhalf = tophalf.slice().reverse();
  return tophalf.concat(bottomhalf);
}
