/* gameConfig.js - Centralized game configuration
 * All game settings are defined here for easy management.
 * This file will be used by a future game room/lobby system.
 */

'use strict';

// ============================================================================
// GAME CONFIGURATION OBJECT
// ============================================================================

var GameConfig = {
  
  // === GAME ROOM METADATA ===
  roomName: 'Default Room',
  roomId: null,              // Will be set by server
  maxPlayers: 4,
  gameMode: 'classic',       // Future: 'classic', 'team', 'deathmatch', etc.
  
  // === MAP SETTINGS ===
  mapWidth: 1200,
  mapHeight: 600,
  mapSeed: null,             // null = random, number = specific seed
  
  // === SPAWN PROTECTION ===
  spawnProtection: {
    enabled: true,           // Enable/disable spawn protection
    duration: 50,            // Frames (50 = 5 seconds at 10 FPS)
    showShield: true,        // Show visual shield indicator
    removeOnFire: true,      // Remove protection when player fires
    showNotifications: true  // Show chat notifications
  },
  
  // === SANCTUARY ZONES ===
  sanctuaryZones: {
    enabled: false,           // Enable/disable sanctuary zones
    showVisuals: true,       // Show dashed circles and indicators
    radius: 60,              // Distance from base entrance in pixels
    allowEnemyRefuel: true   // Allow enemies to refuel energy in your base
  },
  
  // === ANTI-CAMPING SYSTEM ===
  antiCamping: {
    enabled: true,           // Enable/disable camping detection
    detectionRadius: 60,     // Detection distance from enemy base in pixels
    warningTime: 50,         // Frames before warning (50 = 5 seconds)
    penaltyTime: 100,        // Frames before damage starts (100 = 10 seconds)
    damagePerFrame: 0.5,     // Health damage per frame while camping
    showWarnings: true       // Show warning messages
  },
  
  // === TANK/PLAYER SETTINGS ===
  tank: {
    width: 5,
    height: 5,
    maxEnergy: 1000,
    maxHealth: 10,
    startingScore: 0,
    energyDepletionRate: 1,  // Energy lost per movement
    
    // Respawn settings
    respawnDelay: 30,        // Frames to wait before respawn (30 = 3 seconds)
    respawnInvulnerability: true  // Use spawn protection on respawn
  },
  
  // === WEAPON SETTINGS ===
  weapons: {
    bulletSpeed: 2,          // Pixels per frame
    bulletDamage: 1,         // Health damage per hit
    reloadTime: 3,           // Frames between shots
    maxBullets: 10,          // Max bullets per player in air
    energyCostPerShot: 1     // Energy cost to fire
  },
  
  // === BASE SETTINGS ===
  base: {
    width: 40,
    height: 40,
    refuelRate: 5,           // Energy gained per frame in own base
    repairRate: 0.2,         // Health gained per frame in own base
    enemyRefuelRate: 3       // Energy gained per frame in enemy base
  },
  
  // === GAME MECHANICS ===
  mechanics: {
    friendlyFire: false,     // Can teammates damage each other
    selfDamage: false,       // Can you damage yourself
    mapBorders: 'solid',     // 'solid', 'wrap', 'death'
    scoringSystem: 'kills'   // 'kills', 'objectives', 'survival'
  },
  
  // === UI/VISUAL SETTINGS ===
  ui: {
    showPlayerNames: true,
    showScoreboard: true,
    showMinimap: false,      // Future feature
    particleEffects: true,
    soundEffects: true
  }
};

// ============================================================================
// CONFIGURATION PRESETS
// ============================================================================

var GamePresets = {
  
  // Default balanced gameplay
  classic: {
    spawnProtection: { enabled: true, duration: 50, showShield: true },
    sanctuaryZones: { enabled: true, showVisuals: true, radius: 60 },
    antiCamping: { enabled: true, detectionRadius: 80, penaltyTime: 100, damagePerFrame: 0.5 }
  },
  
  // No protection, pure skill
  hardcore: {
    spawnProtection: { enabled: false, duration: 0, showShield: false },
    sanctuaryZones: { enabled: false, showVisuals: false, radius: 40 },
    antiCamping: { enabled: true, detectionRadius: 60, penaltyTime: 50, damagePerFrame: 1.0 }
  },
  
  // Beginner friendly with extra protection
  casual: {
    spawnProtection: { enabled: true, duration: 100, showShield: true },
    sanctuaryZones: { enabled: true, showVisuals: true, radius: 100 },
    antiCamping: { enabled: true, detectionRadius: 120, penaltyTime: 150, damagePerFrame: 0.3 },
    tank: { respawnDelay: 20 }
  },
  
  // Tournament/competitive settings
  tournament: {
    spawnProtection: { enabled: true, duration: 50, showShield: true },
    sanctuaryZones: { enabled: true, showVisuals: true, radius: 60 },
    antiCamping: { enabled: true, detectionRadius: 80, penaltyTime: 100, damagePerFrame: 0.5 },
    tank: { maxHealth: 10, maxEnergy: 1000 }
  },
  
  // Fast-paced action
  chaos: {
    spawnProtection: { enabled: true, duration: 30, showShield: true },
    sanctuaryZones: { enabled: false, showVisuals: false, radius: 40 },
    antiCamping: { enabled: true, detectionRadius: 60, penaltyTime: 50, damagePerFrame: 1.0 },
    tank: { respawnDelay: 10, maxHealth: 5 },
    weapons: { reloadTime: 1, maxBullets: 20 }
  }
};

// ============================================================================
// CONFIGURATION FUNCTIONS
// ============================================================================

// Apply a preset to the current configuration
function applyPreset(presetName) {
  if (!GamePresets[presetName]) {
    console.error('Unknown preset:', presetName);
    return false;
  }
  
  const preset = GamePresets[presetName];
  
  // Deep merge preset into GameConfig
  for (let category in preset) {
    if (typeof preset[category] === 'object' && !Array.isArray(preset[category])) {
      GameConfig[category] = Object.assign({}, GameConfig[category], preset[category]);
    } else {
      GameConfig[category] = preset[category];
    }
  }
  
  console.log('Applied preset:', presetName);
  return true;
}

// Update specific config value
function updateConfig(category, key, value) {
  if (GameConfig[category] && GameConfig[category].hasOwnProperty(key)) {
    GameConfig[category][key] = value;
    console.log(`Config updated: ${category}.${key} = ${value}`);
    return true;
  }
  console.error(`Invalid config path: ${category}.${key}`);
  return false;
}

// Get config value
function getConfig(category, key) {
  if (key) {
    return GameConfig[category] ? GameConfig[category][key] : undefined;
  }
  return GameConfig[category];
}

// Export entire config as JSON (for sending to server)
function exportConfig() {
  return JSON.stringify(GameConfig);
}

// Import config from JSON (for receiving from server)
function importConfig(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    // Merge imported config with defaults to preserve any new settings
    for (let category in imported) {
      if (typeof imported[category] === 'object' && !Array.isArray(imported[category])) {
        GameConfig[category] = Object.assign({}, GameConfig[category], imported[category]);
      } else {
        GameConfig[category] = imported[category];
      }
    }
    console.log('Config imported successfully');
    return true;
  } catch (e) {
    console.error('Failed to import config:', e);
    return false;
  }
}

// Validate configuration (ensure all values are within acceptable ranges)
function validateConfig() {
  const errors = [];
  
  // Validate spawn protection
  if (GameConfig.spawnProtection.duration < 0 || GameConfig.spawnProtection.duration > 500) {
    errors.push('Spawn protection duration must be between 0 and 500 frames');
  }
  
  // Validate sanctuary zones
  if (GameConfig.sanctuaryZones.radius < 0 || GameConfig.sanctuaryZones.radius > 200) {
    errors.push('Sanctuary zone radius must be between 0 and 200 pixels');
  }
  
  // Validate anti-camping
  if (GameConfig.antiCamping.damagePerFrame < 0 || GameConfig.antiCamping.damagePerFrame > 10) {
    errors.push('Camping damage must be between 0 and 10');
  }
  
  // Validate tank settings
  if (GameConfig.tank.maxHealth < 1 || GameConfig.tank.maxHealth > 100) {
    errors.push('Tank max health must be between 1 and 100');
  }
  
  if (GameConfig.tank.maxEnergy < 100 || GameConfig.tank.maxEnergy > 10000) {
    errors.push('Tank max energy must be between 100 and 10000');
  }
  
  if (errors.length > 0) {
    console.error('Config validation errors:', errors);
    return { valid: false, errors: errors };
  }
  
  return { valid: true, errors: [] };
}

// Reset to default configuration
function resetConfig() {
  // Store the original defaults
  const defaults = {
    spawnProtection: { enabled: true, duration: 50, showShield: true, removeOnFire: true, showNotifications: true },
    sanctuaryZones: { enabled: true, showVisuals: true, radius: 60, allowEnemyRefuel: true },
    antiCamping: { enabled: true, detectionRadius: 80, warningTime: 50, penaltyTime: 100, damagePerFrame: 0.5, showWarnings: true }
  };
  
  for (let category in defaults) {
    GameConfig[category] = Object.assign({}, defaults[category]);
  }
  
  console.log('Config reset to defaults');
}

// ============================================================================
// FUTURE GAME ROOM INTEGRATION
// ============================================================================

/* 
 * Future game room system will use these functions:
 * 
 * 1. Creating a room:
 *    - Host selects preset or custom settings
 *    - Call exportConfig() to send to server
 *    - Server stores config with room ID
 * 
 * 2. Joining a room:
 *    - Server sends room config to client
 *    - Call importConfig(serverData) to apply settings
 * 
 * 3. Room lobby:
 *    - Display GameConfig values in UI
 *    - Allow host to modify with updateConfig()
 *    - Broadcast changes to all players
 * 
 * 4. Starting game:
 *    - Server validates config with validateConfig()
 *    - All clients apply same config before game starts
 */

// ============================================================================
// BACKWARD COMPATIBILITY HELPERS
// ============================================================================

// These maintain compatibility with existing code while using the new config system

// For bullet.js
function ENABLE_SPAWN_PROTECTION() { return GameConfig.spawnProtection.enabled; }
function SPAWN_PROTECTION_FRAMES() { return GameConfig.spawnProtection.duration; }
function SHOW_SPAWN_PROTECTION_SHIELD() { return GameConfig.spawnProtection.showShield; }

// For base.js
function SHOW_SANCTUARY_ZONES() { return GameConfig.sanctuaryZones.showVisuals; }
function SANCTUARY_ZONE_RADIUS() { return GameConfig.sanctuaryZones.radius; }
function ENABLE_ANTI_CAMPING() { return GameConfig.antiCamping.enabled; }
function CAMPING_DETECTION_RADIUS() { return GameConfig.antiCamping.detectionRadius; }
function CAMPING_TIME_THRESHOLD() { return GameConfig.antiCamping.penaltyTime; }
function CAMPING_PENALTY_DAMAGE() { return GameConfig.antiCamping.damagePerFrame; }

console.log('Game configuration loaded');
