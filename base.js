/* base.js contains a function to search a random location on the map for a new base,
 * a function refuel() to regain energy and shield when inside a base, 
 * and several functions to add a new base to the game.
 */

/* global player, shapesData
 * MAP_WIDTH, MAP_HEIGHT, TANK_WIDTH, TANK_HEIGHT, TANK_MAX_ENERGY, TANK_MAX_HEALTH,
 * collision, digBase
 */

const BASE_WIDTH = 40;
const BASE_HEIGHT = 40;

// List of bases
const bases = [];

// Generate a random location for a new base
function randomBaseLocation(id) {
  let rect;

  do {
    rect = {
      id: id,
      x: Math.floor(Math.random() * MAP_WIDTH - (BASE_WIDTH * 2)),
      y: Math.floor(Math.random() * MAP_HEIGHT - (BASE_HEIGHT * 2)),
      w: BASE_WIDTH,
      h: BASE_HEIGHT
    };
  } while (collision(rect));

  return rect;
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
  digBase(base);
  blockBaseWalls(base.x, base.y);
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
