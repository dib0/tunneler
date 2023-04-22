/* draw.js contains a function redrawScreen() that in turn calls several
 * functions to draw tanks, sparks, bases, bullets, static interference, and the status bars.
 */

/* globals player, lens, alive, sparks, wrecks, player, bullets, bases, opponents,
 * redrawRequest, tankImages, bulletImages, viewportCtx, buffer, 
 * collides, area, drawBaseWalls,
 * TANK_WIDTH, TANK_HEIGHT, TANK_MAX_ENERGY, TANK_MAX_HEALTH
 */

const ENERGY_CANVAS_ID = 'tun_energy_canvas';
const HEALTH_CANVAS_ID = 'tun_health_canvas';

function redrawScreen() {

  // Display what the lens "sees": move the image below the viewport around
  viewportCtx.drawImage(buffer, -lens.x, -lens.y);

  // Draw destroyed tank wrecks
  wrecks.forEach(drawWreck);

  // Draw sparks
  let sparkling = drawSparks();

  // Draw the tanks
  if (alive) {
    drawTank(player);
  }
  opponents.forEach(drawTank);

  // Draw the bullets
  bullets.forEach(drawBullet);

  // Draw the bases
  bases.forEach(drawBase);

  // Draw the energy and health bars
  drawBars();

  // Draw low-energy effects
  if (! (drawStatic() || sparkling)) {
    redrawRequest = false;
  }
}

function drawTank(t) {
  if (collides(area(t), lens)) {
    // 10 * player number (1-4) + direction
    viewportCtx.drawImage(tankImages.get((10 * (t.id % 4 == 0 ? 4 : t.id % 4)) + t.dir), t.x - lens.x, t.y - lens.y);
    // Draw opponent's name under the tank
    if (t.id != player.id) {
      viewportCtx.fillStyle = 'white';
      viewportCtx.fillText(t.name, t.x - lens.x + (TANK_WIDTH / 2), t.y - lens.y + TANK_HEIGHT + 1);
    }
  }
}

function drawWreck(t) {
  if (collides(area(t), lens)) {
    viewportCtx.drawImage(tankImages.get(t.dir), t.x - lens.x, t.y - lens.y);
  }
}

function drawBullet(b) {
  if (collides(b, lens)) {
    viewportCtx.drawImage(bulletImages.get(b.dir), b.x - lens.x, b.y - lens.y);
  }
}

function drawBase(b) {
  if (collides(b, lens)) {
    drawBaseWalls(viewportCtx, b, b.x - lens.x, b.y - lens.y);
  }
}

// Draw little 1x1 pixels around bullet impact, exploding tanks, and on wrecks of destroyed tanks
// Except for the sparks on the wrecks (that are randomly displayed continuously), all sparks
// are in the global array [sparks]. Each spark has a location and an age. When age == 0, the 
// spark is removed. (To add an extra random effect, some sparks are randomly removed earlier.)
function drawSparks() {
  
  // 'sparkled' is the return value. If true, the next frame the screen will be redrawn again.
  // If we don't redraw the screen, the sparkles would stay on the screen until the player moves.
  let sparkled = false;

  // Draw sparkles on wrecks
  wrecks.forEach(t => {
    if (collides(area(t), lens)) {
      for (let y = t.y; y < t.y + TANK_HEIGHT; y++) {
        for (let x = t.x; x < t.x + TANK_WIDTH; x++) {
          if (Math.random() < 0.01) {
            let color = Math.round(Math.random() * 3);
            if (color < 1) {
              viewportCtx.fillStyle = '#ba2318';
            } else if (color < 2) {
              viewportCtx.fillStyle = '#700e07';
            } else {
              viewportCtx.fillStyle = '#fffc4d';
            }
            viewportCtx.fillRect(x - lens.x, y - lens.y, 1, 1);
          }
        }
      }
      sparkled = true; // Continuously redraw when wrecks are on-screen, because of the sparkles
    }
  });

  // Draw sparkles in craters
  for (let s = 0; s < sparks.length; s++) {
    if (collides({x: sparks[s].x, y: sparks[s].y, w: 1, h: 1}, lens)) {
      if (sparks[s].color < 1) {
        viewportCtx.fillStyle = '#ba2318';
      } else if (sparks[s].color < 2) {
        viewportCtx.fillStyle = '#700e07';
      } else if (sparks[s].color < 3) {
        viewportCtx.fillStyle = '#421d09';
      }
      sparks[s].color = Math.round(Math.random() * 3);
      sparks[s].age--;
      viewportCtx.fillRect(sparks[s].x - lens.x, sparks[s].y - lens.y, 1, 1);
      if (sparks[s].color > 2 || sparks[s].age <= 0) {
        sparks.splice(s--, 1);
      }
      sparkled = true;
    } else {
      sparks.splice(s--, 1);
    }
  }
  return sparkled;
}

// Generate interference when player is low on energy
function drawStatic() {
  if (player.energy < TANK_MAX_ENERGY / 3) {
    if (Math.round(Math.random() * (1 - player.energy / TANK_MAX_ENERGY))) {
      viewportCtx.fillStyle = 'grey';
      let y = Math.round(Math.random()) ? 0 : Math.random() * lens.h;
      let h = Math.round(Math.random()) ? lens.h : Math.random() * lens.h;
      viewportCtx.fillRect(0, y, lens.w, h);
      return true;
    }
  }
  return false;
}

// Update the energy and health bars
function drawBars() {
  drawBar(ENERGY_CANVAS_ID, 0, 0, player.energy / TANK_MAX_ENERGY, 240, 20, "yellow");
  drawBar(HEALTH_CANVAS_ID, 0, 0, player.health / TANK_MAX_HEALTH, 240, 20, "cyan");
}

// Helper function for drawBars()
function drawBar(canvasId, x, y, per, w, h, fillStyle) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(x, y, w, h);
  ctx.beginPath();
  ctx.rect(x, y, w * per, h);
  ctx.fillStyle = fillStyle;
  ctx.closePath();
  ctx.fill();
}
