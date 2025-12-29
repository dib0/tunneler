/* AIPlayer.js - AI opponent logic with strategic behavior and difficulty levels
 * Implements pathfinding, combat tactics, resource management, and base defense
 */

class AIPlayer {
  constructor(id, name, difficulty = 'normal', personality = 'balanced') {
    this.id = id;
    this.name = name;
    this.difficulty = difficulty; // easy, normal, hard
    this.personality = personality; // aggressive, defensive, balanced, digger
    
    // Player state
    this.x = 0;
    this.y = 0;
    this.dir = 2;
    this.energy = 1000;
    this.health = 10;
    this.score = 0;
    this.lives = 3;
    this.isAI = true;
    
    // AI decision making
    this.target = null;
    this.state = 'idle'; // idle, attacking, defending, retreating, refueling, exploring
    this.lastDecision = Date.now();
    this.decisionInterval = this.getDecisionInterval();
    this.frameCounter = 0;
    
    // Memory and learning
    this.knownEnemyPositions = new Map();
    this.knownBases = new Map();
    this.exploredAreas = new Set();
    this.lastFiredFrame = 0;
    
    // Strategy parameters based on difficulty
    this.params = this.getDifficultyParams();
  }

  getDifficultyParams() {
    const params = {
      easy: {
        reactionTime: 800,
        aimAccuracy: 0.4,
        pathfindingDepth: 50,
        aggressionLevel: 0.3,
        retreatThreshold: 3,
        energyManagement: 0.5,
        firingFrequency: 0.2
      },
      normal: {
        reactionTime: 400,
        aimAccuracy: 0.7,
        pathfindingDepth: 100,
        aggressionLevel: 0.6,
        retreatThreshold: 5,
        energyManagement: 0.7,
        firingFrequency: 0.5
      },
      hard: {
        reactionTime: 150,
        aimAccuracy: 0.9,
        pathfindingDepth: 200,
        aggressionLevel: 0.8,
        retreatThreshold: 7,
        energyManagement: 0.9,
        firingFrequency: 0.8
      }
    };
    return params[this.difficulty] || params.normal;
  }

  getDecisionInterval() {
    // How often AI makes strategic decisions (ms)
    const intervals = {
      easy: 1000,
      normal: 500,
      hard: 200
    };
    return intervals[this.difficulty] || 500;
  }

  update(gameState) {
    this.frameCounter++;
    
    // Make strategic decisions periodically
    const now = Date.now();
    if (now - this.lastDecision > this.decisionInterval) {
      this.makeStrategicDecision(gameState);
      this.lastDecision = now;
    }
    
    // Execute current strategy
    return this.executeStrategy(gameState);
  }

  makeStrategicDecision(gameState) {
    const { players, bases, mapWidth, mapHeight } = gameState;
    
    // Update knowledge
    this.updateKnowledge(players, bases);
    
    // Determine state based on health, energy, and threats
    const healthPercent = this.health / 10;
    const energyPercent = this.energy / 1000;
    const nearbyEnemies = this.findNearbyEnemies(players, 150);
    
    // State machine
    if (healthPercent < 0.3 || energyPercent < 0.2) {
      this.state = 'refueling';
    } else if (nearbyEnemies.length > 0 && healthPercent < 0.5) {
      this.state = 'retreating';
    } else if (this.personality === 'aggressive' && nearbyEnemies.length > 0) {
      this.state = 'attacking';
      this.target = this.selectTarget(nearbyEnemies);
    } else if (this.personality === 'defensive') {
      this.state = 'defending';
    } else if (energyPercent < this.params.energyManagement) {
      this.state = 'refueling';
    } else if (nearbyEnemies.length > 0 && Math.random() < this.params.aggressionLevel) {
      this.state = 'attacking';
      this.target = this.selectTarget(nearbyEnemies);
    } else {
      this.state = 'exploring';
    }
  }

  executeStrategy(gameState) {
    const actions = [];
    
    switch (this.state) {
      case 'attacking':
        actions.push(...this.executeAttack(gameState));
        break;
      case 'defending':
        actions.push(...this.executeDefense(gameState));
        break;
      case 'retreating':
        actions.push(...this.executeRetreat(gameState));
        break;
      case 'refueling':
        actions.push(...this.executeRefuel(gameState));
        break;
      case 'exploring':
        actions.push(...this.executeExplore(gameState));
        break;
      default:
        actions.push(...this.executeExplore(gameState));
    }
    
    return actions;
  }

  executeAttack(gameState) {
    const actions = [];
    
    if (!this.target) {
      return this.executeExplore(gameState);
    }
    
    // Calculate direction to target
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If in firing range and can see target
    if (distance < 200 && this.canSeeTarget(this.target, gameState)) {
      // Aim at target
      const targetDir = this.calculateDirection(dx, dy);
      
      // Add some inaccuracy based on difficulty
      const accuracy = this.params.aimAccuracy;
      if (Math.random() < accuracy) {
        if (this.dir !== targetDir) {
          this.dir = targetDir;
          actions.push({ type: 'move', dir: targetDir });
        } else if (Math.random() < this.params.firingFrequency && this.frameCounter - this.lastFiredFrame > 10) {
          actions.push({ type: 'fire' });
          this.lastFiredFrame = this.frameCounter;
        }
      }
    } else {
      // Move toward target
      const moveDir = this.calculateDirection(dx, dy);
      actions.push({ type: 'move', dir: moveDir });
    }
    
    return actions;
  }

  executeDefense(gameState) {
    const actions = [];
    const myBase = this.knownBases.get(this.id);
    
    if (!myBase) {
      return this.executeExplore(gameState);
    }
    
    // Stay near base
    const dx = myBase.x - this.x;
    const dy = myBase.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If too far from base, return
    if (distance > 100) {
      const moveDir = this.calculateDirection(dx, dy);
      actions.push({ type: 'move', dir: moveDir });
    } else {
      // Look for nearby threats
      const threats = this.findNearbyEnemies(gameState.players, 150);
      if (threats.length > 0) {
        return this.executeAttack(gameState);
      } else {
        // Patrol around base
        const patrolDir = this.getPatrolDirection();
        actions.push({ type: 'move', dir: patrolDir });
      }
    }
    
    return actions;
  }

  executeRetreat(gameState) {
    const actions = [];
    const myBase = this.knownBases.get(this.id);
    
    if (!myBase) {
      // Find nearest safe area
      const safeDir = this.findSafeDirection(gameState);
      actions.push({ type: 'move', dir: safeDir });
    } else {
      // Return to base
      const dx = myBase.x - this.x;
      const dy = myBase.y - this.y;
      const moveDir = this.calculateDirection(dx, dy);
      actions.push({ type: 'move', dir: moveDir });
    }
    
    return actions;
  }

  executeRefuel(gameState) {
    const actions = [];
    const myBase = this.knownBases.get(this.id);
    
    if (!myBase) {
      return this.executeExplore(gameState);
    }
    
    // Navigate to base
    const dx = myBase.x + 20 - this.x; // Center of base
    const dy = myBase.y + 20 - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 10) {
      const moveDir = this.calculateDirection(dx, dy);
      actions.push({ type: 'move', dir: moveDir });
    } else {
      // Inside base, wait until refueled
      if (this.energy > 800 && this.health > 8) {
        this.state = 'exploring';
      }
    }
    
    return actions;
  }

  executeExplore(gameState) {
    const actions = [];
    
    // Simple exploration: move in a semi-random direction
    // avoiding walls and previously explored areas
    const exploreDir = this.getExplorationDirection(gameState);
    actions.push({ type: 'move', dir: exploreDir });
    
    // Occasionally dig
    if (Math.random() < 0.3 && this.energy > 500) {
      actions.push({ type: 'dig' });
    }
    
    return actions;
  }

  calculateDirection(dx, dy) {
    // Convert dx, dy to numpad direction
    const angle = Math.atan2(dy, dx);
    const degree = angle * 180 / Math.PI;
    
    if (degree > -22.5 && degree <= 22.5) return 6;
    if (degree > 22.5 && degree <= 67.5) return 3;
    if (degree > 67.5 && degree <= 112.5) return 2;
    if (degree > 112.5 && degree <= 157.5) return 1;
    if (degree > 157.5 || degree <= -157.5) return 4;
    if (degree > -157.5 && degree <= -112.5) return 7;
    if (degree > -112.5 && degree <= -67.5) return 8;
    if (degree > -67.5 && degree <= -22.5) return 9;
    
    return 6;
  }

  findNearbyEnemies(players, radius) {
    const nearby = [];
    players.forEach(player => {
      if (player.id !== this.id && !player.isAI) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < radius) {
          nearby.push({ player, distance });
        }
      }
    });
    return nearby.sort((a, b) => a.distance - b.distance);
  }

  selectTarget(enemies) {
    if (enemies.length === 0) return null;
    
    // Select based on personality
    switch (this.personality) {
      case 'aggressive':
        // Target closest enemy
        return enemies[0].player;
      case 'defensive':
        // Target enemy closest to base
        return enemies[0].player;
      case 'balanced':
        // Target weakest enemy
        return enemies.sort((a, b) => a.player.health - b.player.health)[0].player;
      default:
        return enemies[0].player;
    }
  }

  canSeeTarget(target, gameState) {
    // Simplified line-of-sight check
    // In production, should raycast through terrain
    const dx = Math.abs(target.x - this.x);
    const dy = Math.abs(target.y - this.y);
    return dx < 300 && dy < 300;
  }

  getExplorationDirection(gameState) {
    // Generate semi-random exploration pattern
    // Prefer unexplored areas
    const directions = [1, 2, 3, 4, 6, 7, 8, 9];
    const weights = directions.map(dir => {
      const exploreKey = `${this.x}_${this.y}_${dir}`;
      return this.exploredAreas.has(exploreKey) ? 0.3 : 1.0;
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < directions.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return directions[i];
      }
    }
    
    return directions[Math.floor(Math.random() * directions.length)];
  }

  getPatrolDirection() {
    // Patrol in a circular pattern
    const patrolPattern = [6, 3, 2, 1, 4, 7, 8, 9];
    const index = Math.floor(this.frameCounter / 20) % patrolPattern.length;
    return patrolPattern[index];
  }

  findSafeDirection(gameState) {
    // Find direction away from enemies
    const enemies = this.findNearbyEnemies(gameState.players, 300);
    if (enemies.length === 0) {
      return this.dir;
    }
    
    // Calculate average enemy position
    let avgX = 0, avgY = 0;
    enemies.forEach(e => {
      avgX += e.player.x;
      avgY += e.player.y;
    });
    avgX /= enemies.length;
    avgY /= enemies.length;
    
    // Move opposite direction
    const dx = this.x - avgX;
    const dy = this.y - avgY;
    return this.calculateDirection(dx, dy);
  }

  updateKnowledge(players, bases) {
    // Update known enemy positions
    players.forEach(player => {
      if (player.id !== this.id) {
        this.knownEnemyPositions.set(player.id, { x: player.x, y: player.y, lastSeen: Date.now() });
      }
    });
    
    // Update known bases
    bases.forEach(base => {
      this.knownBases.set(base.id, base);
    });
    
    // Mark current area as explored
    const exploreKey = `${Math.floor(this.x / 50)}_${Math.floor(this.y / 50)}`;
    this.exploredAreas.add(exploreKey);
  }

  toPlayerObject() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      dir: this.dir,
      energy: this.energy,
      health: this.health,
      score: this.score,
      name: this.name,
      lives: this.lives,
      isAI: true
    };
  }
}

// Predefined AI personalities
const AI_PERSONALITIES = {
  commanderSteel: {
    name: 'Commander Steel',
    personality: 'balanced',
    description: 'Balanced tactical approach'
  },
  tankHunter: {
    name: 'Tank Hunter',
    personality: 'aggressive',
    description: 'Aggressive combat style'
  },
  diggerDan: {
    name: 'Digger Dan',
    personality: 'digger',
    description: 'Focuses on tunneling and exploration'
  },
  fortressKeeper: {
    name: 'Fortress Keeper',
    personality: 'defensive',
    description: 'Defensive base protection'
  }
};

module.exports = { AIPlayer, AI_PERSONALITIES };
