/* bullets.js contains the functions for firing new bullets, moving existing bullets forward,
 * and checking for impact with the ground, a shape, or a player.
 */

/* global player, alive, opponents, victim, wrecks, wait, lens, sndDig3, sndHit, sndLost,
 * sendMessage, collides, collision, digRect, digCrater, playSound, displayAlert
 * MSG_FIRE, TANK_WIDTH, TANK_HEIGHT, MAP_WIDTH, MAP_HEIGHT,
 * HIT_OBJECT, HIT_PLAYER,
 * MSG_LOST
 */

const BULLET_DIAMETER = 1;
const BULLET_LENGTH = 2;

// Wait 2 frames before the tank can fire again. One tank can have 10 bullets mid-air concurrently.
const RELOAD_TIME = 3;
const MAX_BULLETS_FIRED = 10;

// Wait 30 event loops (3 seconds) after destroyed
const WAIT_FRAMES_ON_RESTART = 30;

// Spawn protection - 5 seconds of invulnerability after respawn (50 frames at 10fps)
const SPAWN_PROTECTION_FRAMES = 50;
var spawnProtectionTimer = 0;

// Reload varies between 0 and RELOAD_TIME.
var reload = 0;

// List of bullets flying around
var bullets = [];

// Check if player has spawn protection active
function hasSpawnProtection() {
  return spawnProtectionTimer > 0;
}

// Activate spawn protection
function activateSpawnProtection() {
  spawnProtectionTimer = SPAWN_PROTECTION_FRAMES;
}

// Update spawn protection timer (call this every frame)
function updateSpawnProtection() {
  if (spawnProtectionTimer > 0) {
    spawnProtectionTimer--;
    if (spawnProtectionTimer === 0) {
      displayAlert('Spawn protection expired');
    }
  }
}

// Deactivate spawn protection (when player fires)
function deactivateSpawnProtection() {
  if (spawnProtectionTimer > 0) {
    spawnProtectionTimer = 0;
    displayAlert('Spawn protection removed - you fired a weapon');
  }
}

// Count whether the player has too many bullets on-air concurrently.
function tooManyBullets() {
  return bullets.reduce((c, b) => b.id == player.id ? c + 1 : c, 0) >= MAX_BULLETS_FIRED;
}

// Add a bullet to the list of bullets, in the correct position and direction
function fire(id) {
  if (id == player.id) {
    if ((reload > 0) || tooManyBullets()) {
      return;
    }
    player.energy--;
    sendMessage(MSG_FIRE, player.id);
    reload = RELOAD_TIME;
    
    // Firing removes spawn protection
    deactivateSpawnProtection();
  }

  const tank = (id == player.id ? player : opponents.get(id));
  const bullet = {id: id, x: 0, y: 0, w: BULLET_LENGTH, h: BULLET_LENGTH, dir: tank.dir, age: 0};

  // Set bullet width and height
  if ([8, 2].includes(tank.dir)) {
    bullet.w = BULLET_DIAMETER;
  } else if ([4, 6].includes(tank.dir)) {
    bullet.h = BULLET_DIAMETER;
  }

  // Set bullet x and y (depending on the direction of the tank)
  if ([1, 4, 7].includes(tank.dir)) {
    bullet.x = tank.x - BULLET_LENGTH;
  }
  if ([8, 2].includes(tank.dir)) {
    bullet.x = tank.x + Math.floor(TANK_WIDTH / 2);
  }
  if ([3, 6, 9].includes(tank.dir)) {
    bullet.x = tank.x + TANK_WIDTH;
  }
  if ([7, 8, 9].includes(tank.dir)) {
    bullet.y = tank.y - BULLET_LENGTH;
  }
  if ([4, 6].includes(tank.dir)) {
    bullet.y = tank.y + Math.floor(TANK_HEIGHT / 2);
  }
  if ([1, 2, 3].includes(tank.dir)) {
    bullet.y = tank.y + TANK_HEIGHT;
  }

  bullets.push(bullet);
}

// Move position of all bullets forward; on impact, remove the bullet.
function moveBullets() {
  for (let i = 0; i < bullets.length; i++) {
    let b = bullets[i];
    
    // After every 10 movements, double the bullet's speed
    for (let j = 0; j <= b.age; j += 10) {
      if (impact(b)) {
        bullets.splice(i--, 1);
        break;
      } else {
        if ([9, 6, 3].includes(b.dir)) {
          b.x += BULLET_LENGTH;
        }
        if ([1, 2, 3].includes(b.dir)) {
          b.y += BULLET_LENGTH;
        }
        if ([7, 4, 1].includes(b.dir)) {
          b.x -= BULLET_LENGTH;
        }
        if ([9, 8, 7].includes(b.dir)) {
          b.y -= BULLET_LENGTH;
        }
      }
      b.age += 1;
    }
  }
}

// Check if one or more bullets are visible on-screen (inside the lens)
function bulletsOnScreen() {
  return bullets.some(b => collides(b, lens));
}

// Check if a bullet hit something
function impact(b) {
  // When a bullet leaves the map, remove it
  if (b.x < 0 || b.y < 0 || b.x > MAP_WIDTH || b.y > MAP_HEIGHT) {
    return true;
  }

  // If we hit the ground, create a small crater
  if (digRect(b.x, b.y, b.w, b.h)) {
    let headX = b.x, headY = b.y;
    if ([9, 6, 3].includes(b.dir)) {
      headX = b.x + BULLET_LENGTH - 1;
    }
    if ([1, 2, 3].includes(b.dir)) {
      headY = b.y + BULLET_LENGTH - 1;
    }
    digCrater(headX, headY, 3, 3);
    if (collides(b, lens)) {
      playSound(sndDig3);
    }
    return true;
  }

  // Impact with an object on the map?
  let c = collision(b, includeSelf = true);
  if (c == HIT_OBJECT) {
    if (collides(b, lens)) {
      playSound(sndDig3);
    }
    return true;

  // Impact with a player?
  } else if (c == HIT_PLAYER) {
    if (collides(b, lens)) {
      playSound(sndHit);
    }
    if (alive && (b.id != player.id) && (victim.id == player.id)) {
        // Check spawn protection
        if (hasSpawnProtection()) {
          displayAlert('Protected! Spawn protection active');
          return true; // Bullet is destroyed but no damage dealt
        }
        
        // OUCH!
        player.health -= 1;

        // Destroyed?
        if (player.health <= 0) {
          let winner = opponents.get(b.id);
          winner.score++;
          opponents.set(winner);
          displayAlert("You were destroyed by " + winner.name + "! " + winner.name + "s score is now: " + winner.score);
          sendMessage(MSG_LOST, {id: player.id, by: b.id});
          alive = false;

          digCrater(player.x + Math.floor(TANK_WIDTH / 2), player.y + Math.floor(TANK_HEIGHT / 2), 4 * TANK_WIDTH + 1, 4 * TANK_HEIGHT + 1);
          wrecks.push(player);
          playSound(sndLost);

          // Wait a few frames, then restart player on starting position.
          wait = WAIT_FRAMES_ON_RESTART;
        }
      }
      return victim;
    }
    return false;
}
