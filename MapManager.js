class SeededRandom {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  
  next() {
    this.seed = this.seed * 16807 % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  
  range(min, max) {
    return min + this.next() * (max - min);
  }
  
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

// Server-side map generator
class ServerMapGenerator {
  constructor(seed, width = 1200, height = 600) {
    this.rng = new SeededRandom(seed);
    this.width = width;
    this.height = height;
  }
  
  generateCompleteMap() {
    console.log(`Generating server map with seed: ${this.rng.seed}`);
    
    // Generate terrain using your existing algorithm
    const terrain = this.generateClassicTerrain();
    
    // Convert to the three layers your client expects
    const bgLayer = this.generateBackgroundLayer(terrain);
    const shapesLayer = this.generateShapesLayer(terrain);
    const mapLayer = this.generateForegroundLayer(terrain);
    
    return {
      terrain: terrain,
      bgLayer: bgLayer,
      shapesLayer: shapesLayer,
      mapLayer: mapLayer,
      width: this.width,
      height: this.height,
      seed: this.rng.seed,
      generatedAt: Date.now()
    };
  }
  
  generateClassicTerrain() {
    const terrain = new Array(this.width * this.height).fill(1);
    
    // Generate height map using fractal algorithm (from your mapgen.js)
    const heightMap = this.generateHeightMap();
    
    // Convert height map to terrain
    this.createCaveSystemFromHeightMap(terrain, heightMap);
    
    // Add main tunnels
    this.addMainTunnels(terrain);
    
    // Smooth terrain
    this.smoothClassicTerrain(terrain);
    
    // Clear borders
    this.clearBorders(terrain);
    
    return terrain;
  }
  
  generateHeightMap() {
    const heightMap = new Array(this.width * this.height);
    
    // Initialize with random heights
    for (let i = 0; i < heightMap.length; i++) {
      heightMap[i] = this.rng.next();
    }
    
    const iterations = 6;
    const TERRAIN_ROUGHNESS = 0.4;
    const INITIAL_HEIGHT_VARIATION = 0.4;
    
    for (let iter = 0; iter < iterations; iter++) {
      const scale = Math.pow(2, iterations - iter);
      const amplitude = INITIAL_HEIGHT_VARIATION * Math.pow(TERRAIN_ROUGHNESS, iter);
      
      for (let y = 0; y < this.height; y += scale) {
        for (let x = 0; x < this.width; x += scale) {
          if (x + scale < this.width && y + scale < this.height) {
            this.midpointDisplacement(heightMap, x, y, scale, amplitude);
          }
        }
      }
    }
    
    return heightMap;
  }
  
  midpointDisplacement(heightMap, x, y, size, amplitude) {
    const half = size / 2;
    if (half < 1) return;
    
    const topLeft = this.getHeight(heightMap, x, y);
    const topRight = this.getHeight(heightMap, x + size, y);
    const bottomLeft = this.getHeight(heightMap, x, y + size);
    const bottomRight = this.getHeight(heightMap, x + size, y + size);
    
    const center = (topLeft + topRight + bottomLeft + bottomRight) / 4 + 
                   (this.rng.next() - 0.5) * amplitude;
    const top = (topLeft + topRight) / 2 + (this.rng.next() - 0.5) * amplitude;
    const left = (topLeft + bottomLeft) / 2 + (this.rng.next() - 0.5) * amplitude;
    const right = (topRight + bottomRight) / 2 + (this.rng.next() - 0.5) * amplitude;
    const bottom = (bottomLeft + bottomRight) / 2 + (this.rng.next() - 0.5) * amplitude;
    
    this.setHeight(heightMap, x + half, y + half, center);
    this.setHeight(heightMap, x + half, y, top);
    this.setHeight(heightMap, x, y + half, left);
    this.setHeight(heightMap, x + size, y + half, right);
    this.setHeight(heightMap, x + half, y + size, bottom);
  }
  
  getHeight(heightMap, x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return 0.5;
    }
    return heightMap[y * this.width + x] || 0.5;
  }
  
  setHeight(heightMap, x, y, height) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      heightMap[y * this.width + x] = Math.max(0, Math.min(1, height));
    }
  }
  
  createCaveSystemFromHeightMap(terrain, heightMap) {
    const threshold = 0.45;
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        const heightValue = heightMap[index];
        
        if (heightValue < threshold) {
          terrain[index] = 0;
          
          const wallSmoothing = 0.15;
          if (heightValue > threshold - wallSmoothing) {
            const probability = (threshold - heightValue) / wallSmoothing;
            if (this.rng.next() > probability * 0.7) {
              terrain[index] = 1;
            }
          }
        }
      }
    }
  }
  
  addMainTunnels(terrain) {
    const TUNNEL_COUNT = 12;
    const MIN_TUNNEL_WIDTH = 8;
    const MAX_TUNNEL_WIDTH = 20;
    
    for (let i = 0; i < TUNNEL_COUNT; i++) {
      const startX = this.rng.int(50, this.width - 50);
      const startY = this.rng.int(50, this.height - 50);
      const endX = this.rng.int(50, this.width - 50);
      const endY = this.rng.int(50, this.height - 50);
      const tunnelWidth = this.rng.int(MIN_TUNNEL_WIDTH, MAX_TUNNEL_WIDTH);
      
      this.createTunnel(terrain, startX, startY, endX, endY, tunnelWidth);
    }
  }
  
  createTunnel(terrain, startX, startY, endX, endY, tunnelWidth) {
    let currentX = startX;
    let currentY = startY;
    
    const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
    const deltaX = (endX - startX) / steps;
    const deltaY = (endY - startY) / steps;
    
    for (let step = 0; step <= steps; step++) {
      const wanderX = currentX + this.rng.range(-tunnelWidth/2, tunnelWidth/2);
      const wanderY = currentY + this.rng.range(-tunnelWidth/2, tunnelWidth/2);
      
      this.digCircularArea(terrain, Math.floor(wanderX), Math.floor(wanderY), 
                         tunnelWidth/2 + this.rng.range(-2, 2));
      
      currentX += deltaX;
      currentY += deltaY;
    }
  }
  
  digCircularArea(terrain, centerX, centerY, radius) {
    const radiusSquared = radius * radius;
    
    for (let y = Math.max(0, centerY - radius); y <= Math.min(this.height - 1, centerY + radius); y++) {
      for (let x = Math.max(0, centerX - radius); x <= Math.min(this.width - 1, centerX + radius); x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared <= radiusSquared) {
          const index = y * this.width + x;
          terrain[index] = 0;
          
          const edgeDistance = Math.sqrt(distanceSquared) / radius;
          if (edgeDistance > 0.7 && this.rng.next() > 0.6) {
            terrain[index] = 1;
          }
        }
      }
    }
  }
  
  smoothClassicTerrain(terrain) {
    const newTerrain = [...terrain];
    
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const index = y * this.width + x;
        
        let solidNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const neighborIndex = (y + dy) * this.width + (x + dx);
            if (terrain[neighborIndex] === 1) solidNeighbors++;
          }
        }
        
        if (terrain[index] === 1) {
          if (solidNeighbors < 2) {
            newTerrain[index] = 0;
          }
        } else {
          if (solidNeighbors >= 6) {
            newTerrain[index] = 1;
          }
        }
      }
    }
    
    for (let i = 0; i < terrain.length; i++) {
      terrain[i] = newTerrain[i];
    }
  }
  
  clearBorders(terrain) {
    const borderSize = 5;
    
    // Top and bottom borders - make them rock
    for (let y = 0; y < borderSize; y++) {
      for (let x = 0; x < this.width; x++) {
        terrain[y * this.width + x] = 0; // Top border - rock
        terrain[(this.height - 1 - y) * this.width + x] = 0; // Bottom border
      }
    }
    
    // Left and right borders - make them rock (1)
    for (let x = 0; x < borderSize; x++) {
      for (let y = 0; y < this.height; y++) {
        terrain[y * this.width + x] = 0; // Left border
        terrain[y * this.width + (this.width - 1 - x)] = 0; // Right border
      }
    }
  }
  
  generateBackgroundLayer(terrain) {
    const imageData = new Array(this.width * this.height * 4);
    
    const dugColors = [
      [0x8b, 0x4f, 0x23], [0x85, 0x54, 0x1c], [0x8e, 0x54, 0x20], [0x84, 0x56, 0x24],
      [0x87, 0x53, 0x1d], [0x82, 0x51, 0x21], [0x90, 0x56, 0x22], [0x83, 0x52, 0x1f]
    ];
    
    for (let i = 0; i < terrain.length; i++) {
      const pixelIndex = i * 4;
      
      if (terrain[i] === 0) {
        // Rock areas - TRANSPARENT (so shapes layer shows through)
        imageData[pixelIndex] = 0;
        imageData[pixelIndex + 1] = 0;
        imageData[pixelIndex + 2] = 0;
        imageData[pixelIndex + 3] = 0;
      } else {
        // Diggable areas - show darker ground background
        const colorIndex = this.rng.int(0, dugColors.length - 1);
        const color = dugColors[colorIndex];
        const variation = this.rng.range(-8, 8);
        
        imageData[pixelIndex] = Math.max(0, Math.min(255, color[0] + variation));
        imageData[pixelIndex + 1] = Math.max(0, Math.min(255, color[1] + variation));
        imageData[pixelIndex + 2] = Math.max(0, Math.min(255, color[2] + variation));
        imageData[pixelIndex + 3] = 255;
      }
    }
    
    return imageData;
  }

  generateShapesLayer(terrain) {
    const imageData = new Array(this.width * this.height * 4);
    
    for (let i = 0; i < terrain.length; i++) {
      const pixelIndex = i * 4;
      
      if (terrain[i] === 0) {
        // Rock areas - WHITE for collision detection
        imageData[pixelIndex] = 255;
        imageData[pixelIndex + 1] = 255;
        imageData[pixelIndex + 2] = 255;
        imageData[pixelIndex + 3] = 255;
      } else {
        // Diggable areas - TRANSPARENT (no collision)
        imageData[pixelIndex] = 0;
        imageData[pixelIndex + 1] = 0;
        imageData[pixelIndex + 2] = 0;
        imageData[pixelIndex + 3] = 0;
      }
    }
    
    return imageData;
  }

  generateForegroundLayer(terrain) {
    const imageData = new Array(this.width * this.height * 4);
    
    const dirtColors = [
      [0xc5, 0x74, 0x34], [0xbf, 0x7a, 0x2a], [0xc8, 0x7a, 0x2f], [0xbe, 0x7d, 0x36],
      [0xc3, 0x79, 0x2c], [0xb8, 0x73, 0x30], [0xcc, 0x7e, 0x32], [0xba, 0x76, 0x2e]
    ];
    
    for (let i = 0; i < terrain.length; i++) {
      const pixelIndex = i * 4;
      
      if (terrain[i] === 0) {
        // Rock areas - TRANSPARENT (so shapes layer shows through)
        imageData[pixelIndex] = 0;
        imageData[pixelIndex + 1] = 0;
        imageData[pixelIndex + 2] = 0;
        imageData[pixelIndex + 3] = 0;
      } else {
        // Diggable areas - show light brown dirt
        const colorIndex = this.rng.int(0, dirtColors.length - 1);
        const color = dirtColors[colorIndex];
        
        imageData[pixelIndex] = color[0];
        imageData[pixelIndex + 1] = color[1];
        imageData[pixelIndex + 2] = color[2];
        imageData[pixelIndex + 3] = 255;
      }
    }
    
    return imageData;
  }
}

class MapManager {
  constructor() {
    this.currentMap = null;
  }
  
  generateMapForGame(seed) {
    if (this.currentMap && this.currentMap.seed === seed) {
      return this.currentMap; // Return existing map
    }
    
    const generator = new ServerMapGenerator(seed, 1200, 600);
    this.currentMap = generator.generateCompleteMap();
    
    console.log('Generated new map for game with seed:', seed);
    return this.currentMap;
  }
  
  getCurrentMap() {
    return this.currentMap;
  }
  
  clearMap() {
    this.currentMap = null;
  }
  
  // Apply map modifications (digging, explosions)
  modifyTerrain(x, y, type, radius = 1) {
    if (!this.currentMap) return false;
    
    const { terrain, width, height } = this.currentMap;
    
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    
    let modified = false;
    
    if (type === 'dig') {
      const index = y * width + x;
      if (terrain[index] === 1) {
        terrain[index] = 0;
        modified = true;
      }
    } else if (type === 'explode') {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance <= radius) {
              const index = ny * width + nx;
              if (terrain[index] === 1) {
                terrain[index] = 0;
                modified = true;
              }
            }
          }
        }
      }
    }
    
    return modified;
  }
}

module.exports = { MapManager, ServerMapGenerator, SeededRandom };
