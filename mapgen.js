/* mapgen.js - Classic Tunneler Map Generator
 * This module generates classic Tunneler-style terrain using fractal algorithms
 */

// Map generation parameters
const TERRAIN_ROUGHNESS = 0.4; // How rough the terrain is (0.0 to 1.0)
const INITIAL_HEIGHT_VARIATION = 0.4; // Initial height variation
const MIN_TUNNEL_WIDTH = 8; // Minimum tunnel width
const MAX_TUNNEL_WIDTH = 20; // Maximum tunnel width
const TUNNEL_COUNT = 12; // Number of main tunnels
const MIN_BASE_DISTANCE = 400; // Minimum distance between bases (STRICT - much better spacing!)
const BORDER_CLEARANCE = 80; // Clearance from map edges for bases

// Simple seeded random number generator
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

// Generate classic Tunneler terrain using fractal height generation
function generateClassicTerrain(width, height, seed) {
  const rng = new SeededRandom(seed);
  const terrain = new Array(width * height).fill(1); // Start with solid terrain
  
  // Generate height map using fractal algorithm
  const heightMap = generateHeightMap(width, height, rng);
  
  // Convert height map to terrain (create cave systems)
  createCaveSystemFromHeightMap(terrain, heightMap, width, height);
  
  // Add main tunnels for connectivity
  addMainTunnels(terrain, width, height, rng);
  
  // Smooth the terrain
  smoothClassicTerrain(terrain, width, height);
  
  // Ensure borders are clear
  clearBorders(terrain, width, height);
  
  return terrain;
}

// Generate a height map using diamond-square algorithm (simplified)
function generateHeightMap(width, height, rng) {
  const heightMap = new Array(width * height);
  
  // Initialize with random heights
  for (let i = 0; i < heightMap.length; i++) {
    heightMap[i] = rng.next();
  }
  
  // Apply fractal smoothing using midpoint displacement approach
  const iterations = 6;
  for (let iter = 0; iter < iterations; iter++) {
    const scale = Math.pow(2, iterations - iter);
    const amplitude = INITIAL_HEIGHT_VARIATION * Math.pow(TERRAIN_ROUGHNESS, iter);
    
    for (let y = 0; y < height; y += scale) {
      for (let x = 0; x < width; x += scale) {
        if (x + scale < width && y + scale < height) {
          midpointDisplacement(heightMap, width, x, y, scale, amplitude, rng);
        }
      }
    }
  }
  
  return heightMap;
}

// Midpoint displacement for fractal terrain
function midpointDisplacement(heightMap, width, x, y, size, amplitude, rng) {
  const half = size / 2;
  
  if (half < 1) return;
  
  // Get corner values
  const topLeft = getHeight(heightMap, width, x, y);
  const topRight = getHeight(heightMap, width, x + size, y);
  const bottomLeft = getHeight(heightMap, width, x, y + size);
  const bottomRight = getHeight(heightMap, width, x + size, y + size);
  
  // Calculate midpoint values with displacement
  const center = (topLeft + topRight + bottomLeft + bottomRight) / 4 + 
                 (rng.next() - 0.5) * amplitude;
  const top = (topLeft + topRight) / 2 + (rng.next() - 0.5) * amplitude;
  const left = (topLeft + bottomLeft) / 2 + (rng.next() - 0.5) * amplitude;
  const right = (topRight + bottomRight) / 2 + (rng.next() - 0.5) * amplitude;
  const bottom = (bottomLeft + bottomRight) / 2 + (rng.next() - 0.5) * amplitude;
  
  // Set the new values
  setHeight(heightMap, width, x + half, y + half, center);
  setHeight(heightMap, width, x + half, y, top);
  setHeight(heightMap, width, x, y + half, left);
  setHeight(heightMap, width, x + size, y + half, right);
  setHeight(heightMap, width, x + half, y + size, bottom);
}

function getHeight(heightMap, width, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= Math.floor(heightMap.length / width)) {
    return 0.5; // Default height for out of bounds
  }
  return heightMap[y * width + x] || 0.5;
}

function setHeight(heightMap, width, x, y, height) {
  if (x >= 0 && y >= 0 && x < width && y < Math.floor(heightMap.length / width)) {
    heightMap[y * width + x] = Math.max(0, Math.min(1, height));
  }
}

// Convert height map to cave system
function createCaveSystemFromHeightMap(terrain, heightMap, width, height) {
  const threshold = 0.45; // Height threshold for creating caves
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const heightValue = heightMap[index];
      
      // Create caves where height is below threshold
      if (heightValue < threshold) {
        terrain[index] = 0; // Diggable area
        
        // Create smoother cave walls
        const wallSmoothing = 0.15;
        if (heightValue > threshold - wallSmoothing) {
          // Probabilistic cave walls for smoother edges
          const probability = (threshold - heightValue) / wallSmoothing;
          if (Math.random() > probability * 0.7) {
            terrain[index] = 1; // Keep some wall
          }
        }
      }
    }
  }
}

// Add main tunnels to ensure connectivity
function addMainTunnels(terrain, width, height, rng) {
  for (let i = 0; i < TUNNEL_COUNT; i++) {
    const startX = rng.int(50, width - 50);
    const startY = rng.int(50, height - 50);
    const endX = rng.int(50, width - 50);
    const endY = rng.int(50, height - 50);
    const tunnelWidth = rng.int(MIN_TUNNEL_WIDTH, MAX_TUNNEL_WIDTH);
    
    createTunnel(terrain, width, height, startX, startY, endX, endY, tunnelWidth, rng);
  }
}

// Create a winding tunnel between two points
function createTunnel(terrain, width, height, startX, startY, endX, endY, tunnelWidth, rng) {
  let currentX = startX;
  let currentY = startY;
  
  const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
  const deltaX = (endX - startX) / steps;
  const deltaY = (endY - startY) / steps;
  
  for (let step = 0; step <= steps; step++) {
    // Add some randomness to tunnel path
    const wanderX = currentX + rng.range(-tunnelWidth/2, tunnelWidth/2);
    const wanderY = currentY + rng.range(-tunnelWidth/2, tunnelWidth/2);
    
    // Dig circular area around current position
    digCircularArea(terrain, width, height, Math.floor(wanderX), Math.floor(wanderY), 
                   tunnelWidth/2 + rng.range(-2, 2));
    
    currentX += deltaX;
    currentY += deltaY;
  }
}

// Dig a circular area in the terrain
function digCircularArea(terrain, width, height, centerX, centerY, radius) {
  const radiusSquared = radius * radius;
  
  for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distanceSquared = dx * dx + dy * dy;
      
      if (distanceSquared <= radiusSquared) {
        const index = y * width + x;
        terrain[index] = 0; // Diggable
        
        // Create softer edges
        const edgeDistance = Math.sqrt(distanceSquared) / radius;
        if (edgeDistance > 0.7 && Math.random() > 0.6) {
          terrain[index] = 1; // Keep some edge roughness
        }
      }
    }
  }
}

// Smooth terrain using classic Tunneler-style rules
function smoothClassicTerrain(terrain, width, height) {
  const newTerrain = [...terrain];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      
      // Count solid neighbors
      let solidNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const neighborIndex = (y + dy) * width + (x + dx);
          if (terrain[neighborIndex] === 1) solidNeighbors++;
        }
      }
      
      // Classic Tunneler smoothing rules
      if (terrain[index] === 1) {
        // Solid pixel - remove isolated pixels
        if (solidNeighbors < 2) {
          newTerrain[index] = 0;
        }
      } else {
        // Empty pixel - fill if surrounded
        if (solidNeighbors >= 6) {
          newTerrain[index] = 1;
        }
      }
    }
  }
  
  // Copy back
  for (let i = 0; i < terrain.length; i++) {
    terrain[i] = newTerrain[i];
  }
}

// Clear borders for better gameplay
function clearBorders(terrain, width, height) {
  const borderSize = 5;
  
  // Top and bottom borders
  for (let y = 0; y < borderSize; y++) {
    for (let x = 0; x < width; x++) {
      terrain[y * width + x] = 0; // Top border
      terrain[(height - 1 - y) * width + x] = 0; // Bottom border
    }
  }
  
  // Left and right borders  
  for (let x = 0; x < borderSize; x++) {
    for (let y = 0; y < height; y++) {
      terrain[y * width + x] = 0; // Left border
      terrain[y * width + (width - 1 - x)] = 0; // Right border
    }
  }
}

// Generate shapes layer (collision detection) - alpha channel used for collision
function generateShapesLayer(terrain, width, height) {
  const imageData = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < terrain.length; i++) {
    const pixelIndex = i * 4;
    
    if (terrain[i] === 1) {
      // Diggable areas - transparent
      imageData[pixelIndex] = 0;       // R
      imageData[pixelIndex + 1] = 0;   // G
      imageData[pixelIndex + 2] = 0;   // B
      imageData[pixelIndex + 3] = 0;   // A - TRANSPARENT (this allows digging)
    } else {
      // Solid rock - non-transparent (collision areas)
      imageData[pixelIndex] = 255;     // R - brown color like terrain
      imageData[pixelIndex + 1] = 255;  // G
      imageData[pixelIndex + 2] = 255;  // B  
      imageData[pixelIndex + 3] = 255; // A - OPAQUE (this blocks collision)
    }
  }
  
  return imageData;
}

// Generate foreground layer - light brown dirt with transparent diggable areas
function generateForegroundLayer(terrain, width, height, seed) {
  const rng = new SeededRandom(seed + 500);
  const imageData = new Uint8ClampedArray(width * height * 4);
  
  // Light brown dirt color variations
  const dirtColors = [
    [0xc5, 0x74, 0x34], // c57434
    [0xbf, 0x7a, 0x2a], // bf7a2a
    [0xc8, 0x7a, 0x2f], // c87a2f
    [0xbe, 0x7d, 0x36], // be7d36
    [0xc3, 0x79, 0x2c], // c3792c
    [0xb8, 0x73, 0x30], // b87330
    [0xcc, 0x7e, 0x32], // cc7e32
    [0xba, 0x76, 0x2e]  // ba762e
  ];
  
  for (let i = 0; i < terrain.length; i++) {
    const pixelIndex = i * 4;
    const x = i % width;
    const y = Math.floor(i / width);
    
    if (terrain[i] === 1) {
      // Use seeded random to select dirt color variation
      const colorIndex = rng.int(0, dirtColors.length - 1);
      const color = dirtColors[colorIndex];
      
      imageData[pixelIndex] = color[0];     // R
      imageData[pixelIndex + 1] = color[1]; // G
      imageData[pixelIndex + 2] = color[2]; // B
      imageData[pixelIndex + 3] = 255;      // A
    } else {
      // Transparent for diggable areas
      imageData[pixelIndex] = 0;
      imageData[pixelIndex + 1] = 0;
      imageData[pixelIndex + 2] = 0;
      imageData[pixelIndex + 3] = 0;
    }
  }
  
  return imageData;
}

// Generate background layer - darker brown (dug areas)
function generateBackgroundLayer(terrain, width, height, seed) {
  const rng = new SeededRandom(seed + 1000);
  const imageData = new Uint8ClampedArray(width * height * 4);
  
  // Darker brown variations for dug areas
  const dugColors = [
    [0x8b, 0x4f, 0x23], // Darker version of c57434
    [0x85, 0x54, 0x1c], // Darker version of bf7a2a
    [0x8e, 0x54, 0x20], // Darker version of c87a2f
    [0x84, 0x56, 0x24], // Darker version of be7d36
    [0x87, 0x53, 0x1d], // Darker version of c3792c
    [0x82, 0x51, 0x21], // Darker version of b87330
    [0x90, 0x56, 0x22], // Darker version of cc7e32
    [0x83, 0x52, 0x1f]  // Darker version of ba762e
  ];
  
  for (let i = 0; i < terrain.length; i++) {
    const pixelIndex = i * 4;
    
    if (terrain[i] === 1) {
      // Diggable areas - transparent
      // Use seeded random to create texture variation in dug areas
      const colorIndex = rng.int(0, dugColors.length - 1);
      const color = dugColors[colorIndex];
      
      // Add some subtle variation to each color component
      const variation = rng.range(-8, 8);
      
      imageData[pixelIndex] = Math.max(0, Math.min(255, color[0] + variation));     // R
      imageData[pixelIndex + 1] = Math.max(0, Math.min(255, color[1] + variation)); // G
      imageData[pixelIndex + 2] = Math.max(0, Math.min(255, color[2] + variation)); // B
      imageData[pixelIndex + 3] = 255; // A - always opaque
    } else {
      // Solid rock - non-transparent (collision areas)
      imageData[pixelIndex] = 255;     // R - brown color like terrain
      imageData[pixelIndex + 1] = 255;  // G
      imageData[pixelIndex + 2] = 255;  // B  
      imageData[pixelIndex + 3] = 0; // A - OPAQUE (this blocks collision)
    }
  }

  return imageData;
}

// Improved base placement system
class BaseManager {
  constructor() {
    this.existingBases = [];
    this.quadrantsUsed = [false, false, false, false]; // Track which quadrants are used
  }
  
  // Find optimal location for a new base
  findOptimalBaseLocation(id, mapWidth, mapHeight, terrainData) {
    console.log(`\n=== Finding location for base ${id} ===`);
    console.log(`Existing bases: ${this.existingBases.length}`);
    
    // For first 4 players, use quadrant-based placement for better distribution
    if (this.existingBases.length < 4) {
      console.log(`Using quadrant-based placement (player ${this.existingBases.length + 1}/4)`);
      const quadrantLocation = this.findQuadrantBasedLocation(id, mapWidth, mapHeight, terrainData);
      if (quadrantLocation) {
        this.existingBases.push(quadrantLocation);
        this.logBaseDistances(quadrantLocation);
        return quadrantLocation;
      }
    }
    
    // For 5+ players or if quadrant placement fails, use improved random placement
    console.log(`Using random placement (player ${this.existingBases.length + 1})`);
    const maxAttempts = 200; // Increased attempts for better placement
    let bestLocation = null;
    let bestScore = -1;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = {
        id: id,
        x: BORDER_CLEARANCE + Math.random() * (mapWidth - BASE_WIDTH - 2 * BORDER_CLEARANCE),
        y: BORDER_CLEARANCE + Math.random() * (mapHeight - BASE_HEIGHT - 2 * BORDER_CLEARANCE),
        w: BASE_WIDTH,
        h: BASE_HEIGHT
      };
      
      const score = this.scoreBaseLocation(candidate, mapWidth, mapHeight, terrainData);
      
      // Only consider locations with positive score
      if (score > 0 && score > bestScore) {
        bestScore = score;
        bestLocation = candidate;
      }
      
      // If we found a great spot, use it
      if (score > 0.9) {
        console.log(`Found excellent location after ${attempt + 1} attempts`);
        break;
      }
    }
    
    if (bestLocation && bestScore > 0.3) { // Require minimum quality
      console.log(`Placed base ${id} at (${Math.floor(bestLocation.x)}, ${Math.floor(bestLocation.y)}) with score ${bestScore.toFixed(2)}`);
      this.existingBases.push(bestLocation);
      this.logBaseDistances(bestLocation);
      return bestLocation;
    }
    
    console.warn('Could not find good base location after', maxAttempts, 'attempts');
    return null;
  }
  
  // Log distances from new base to all existing bases (for debugging)
  logBaseDistances(newBase) {
    if (this.existingBases.length <= 1) return;
    
    console.log('Distances from new base:');
    for (let i = 0; i < this.existingBases.length - 1; i++) {
      const base = this.existingBases[i];
      const distance = Math.sqrt(
        Math.pow(newBase.x - base.x, 2) + Math.pow(newBase.y - base.y, 2)
      );
      const status = distance >= MIN_BASE_DISTANCE ? '✓' : '✗ TOO CLOSE!';
      console.log(`  → Base ${base.id}: ${Math.floor(distance)} pixels ${status}`);
    }
  }
  
  // Place bases in quadrants for first 4 players (much better distribution)
  findQuadrantBasedLocation(id, mapWidth, mapHeight, terrainData) {
    // Determine which quadrant to use (cycle through 0-3)
    let targetQuadrant = -1;
    for (let i = 0; i < 4; i++) {
      if (!this.quadrantsUsed[i]) {
        targetQuadrant = i;
        break;
      }
    }
    
    if (targetQuadrant === -1) {
      return null; // All quadrants used
    }
    
    // Define quadrant boundaries
    const quadrantWidth = mapWidth / 2;
    const quadrantHeight = mapHeight / 2;
    
    // Define target regions within quadrant (favor corners/edges)
    // Each quadrant gets a preferred zone that's away from center
    let preferredZones = [];
    const edgeMargin = BORDER_CLEARANCE + 20;
    const zoneSize = 150; // Size of preferred placement zone
    
    switch(targetQuadrant) {
      case 0: // Top-left - favor top-left corner
        preferredZones = [
          { x: edgeMargin, y: edgeMargin, w: zoneSize, h: zoneSize, weight: 1.0 },
          { x: edgeMargin, y: edgeMargin + zoneSize, w: zoneSize * 1.5, h: zoneSize, weight: 0.7 },
          { x: edgeMargin + zoneSize, y: edgeMargin, w: zoneSize, h: zoneSize * 1.5, weight: 0.7 }
        ];
        break;
      case 1: // Top-right - favor top-right corner
        preferredZones = [
          { x: mapWidth - edgeMargin - zoneSize, y: edgeMargin, w: zoneSize, h: zoneSize, weight: 1.0 },
          { x: mapWidth - edgeMargin - zoneSize * 2.5, y: edgeMargin, w: zoneSize * 1.5, h: zoneSize, weight: 0.7 },
          { x: mapWidth - edgeMargin - zoneSize, y: edgeMargin + zoneSize, w: zoneSize, h: zoneSize * 1.5, weight: 0.7 }
        ];
        break;
      case 2: // Bottom-left - favor bottom-left corner
        preferredZones = [
          { x: edgeMargin, y: mapHeight - edgeMargin - zoneSize, w: zoneSize, h: zoneSize, weight: 1.0 },
          { x: edgeMargin, y: mapHeight - edgeMargin - zoneSize * 2.5, w: zoneSize, h: zoneSize * 1.5, weight: 0.7 },
          { x: edgeMargin + zoneSize, y: mapHeight - edgeMargin - zoneSize, w: zoneSize * 1.5, h: zoneSize, weight: 0.7 }
        ];
        break;
      case 3: // Bottom-right - favor bottom-right corner
        preferredZones = [
          { x: mapWidth - edgeMargin - zoneSize, y: mapHeight - edgeMargin - zoneSize, w: zoneSize, h: zoneSize, weight: 1.0 },
          { x: mapWidth - edgeMargin - zoneSize * 2.5, y: mapHeight - edgeMargin - zoneSize, w: zoneSize * 1.5, h: zoneSize, weight: 0.7 },
          { x: mapWidth - edgeMargin - zoneSize, y: mapHeight - edgeMargin - zoneSize * 2.5, w: zoneSize, h: zoneSize * 1.5, weight: 0.7 }
        ];
        break;
    }
    
    // Try preferred zones first (highest weight zones first)
    preferredZones.sort((a, b) => b.weight - a.weight);
    
    for (const zone of preferredZones) {
      const maxAttempts = 50;
      let bestLocation = null;
      let bestScore = -1;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = {
          id: id,
          x: zone.x + Math.random() * (zone.w - BASE_WIDTH),
          y: zone.y + Math.random() * (zone.h - BASE_HEIGHT),
          w: BASE_WIDTH,
          h: BASE_HEIGHT
        };
        
        const score = this.scoreBaseLocation(candidate, mapWidth, mapHeight, terrainData);
        
        if (score > 0 && score > bestScore) {
          bestScore = score;
          bestLocation = candidate;
        }
        
        // If we found an excellent spot in preferred zone, use it immediately
        if (score > 0.9) {
          this.quadrantsUsed[targetQuadrant] = true;
          console.log(`Placed base ${id} in quadrant ${targetQuadrant} (corner zone) at (${Math.floor(candidate.x)}, ${Math.floor(candidate.y)})`);
          return bestLocation;
        }
      }
      
      // If we found a decent spot in this zone, use it
      if (bestLocation && bestScore > 0.5) {
        this.quadrantsUsed[targetQuadrant] = true;
        console.log(`Placed base ${id} in quadrant ${targetQuadrant} (zone) at (${Math.floor(bestLocation.x)}, ${Math.floor(bestLocation.y)})`);
        return bestLocation;
      }
    }
    
    // Fallback: try anywhere in the quadrant (not preferred)
    const quadrantX = (targetQuadrant % 2) * quadrantWidth;
    const quadrantY = Math.floor(targetQuadrant / 2) * quadrantHeight;
    const margin = BASE_WIDTH + 40;
    
    const maxAttempts = 100;
    let bestLocation = null;
    let bestScore = -1;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = {
        id: id,
        x: quadrantX + margin + Math.random() * (quadrantWidth - 2 * margin - BASE_WIDTH),
        y: quadrantY + margin + Math.random() * (quadrantHeight - 2 * margin - BASE_HEIGHT),
        w: BASE_WIDTH,
        h: BASE_HEIGHT
      };
      
      const score = this.scoreBaseLocation(candidate, mapWidth, mapHeight, terrainData);
      
      if (score > 0 && score > bestScore) {
        bestScore = score;
        bestLocation = candidate;
      }
      
      if (score > 0.85) {
        break;
      }
    }
    
    if (bestLocation && bestScore > 0.3) {
      this.quadrantsUsed[targetQuadrant] = true;
      console.log(`Placed base ${id} in quadrant ${targetQuadrant} (fallback) at (${Math.floor(bestLocation.x)}, ${Math.floor(bestLocation.y)})`);
      return bestLocation;
    }
    
    console.warn(`Failed to place base ${id} in quadrant ${targetQuadrant}`);
    return null;
  }
  
  // Score a potential base location (0.0 to 1.0, higher is better)
  scoreBaseLocation(candidate, mapWidth, mapHeight, terrainData) {
    let score = 1.0;
    
    // First check: Must be placed entirely in diggable area (terrain[i] === 1, not 0!)
    // terrain[i] === 0 means ROCK (solid), terrain[i] === 1 means DIGGABLE
    let diggablePixels = 0;
    const totalPixels = candidate.w * candidate.h;
    
    for (let y = 0; y < candidate.h; y++) {
      for (let x = 0; x < candidate.w; x++) {
        const mapX = Math.floor(candidate.x + x);
        const mapY = Math.floor(candidate.y + y);
        
        if (mapX >= 0 && mapX < mapWidth && mapY >= 0 && mapY < mapHeight) {
          const terrainIndex = mapY * mapWidth + mapX;
          if (terrainData && terrainData[terrainIndex] === 1) { // 1 = diggable!
            diggablePixels++;
          }
        }
      }
    }
    
    // Require at least 95% diggable terrain
    if (diggablePixels < totalPixels * 0.95) {
      return 0; // Invalid location - too much rock
    }
    
    // STRICT distance check from other bases
    for (const base of this.existingBases) {
      const distance = Math.sqrt(
        Math.pow(candidate.x - base.x, 2) + Math.pow(candidate.y - base.y, 2)
      );
      
      // REJECT if too close (not just reduce score)
      if (distance < MIN_BASE_DISTANCE) {
        return 0; // Invalid - too close to another base
      }
      
      // Reward greater distances
      const distanceBonus = Math.min(distance / (MIN_BASE_DISTANCE * 2), 1.0);
      score = score * 0.8 + distanceBonus * 0.2;
    }
    
    // Slight preference for locations away from edges but not too centered
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(candidate.x - centerX, 2) + Math.pow(candidate.y - centerY, 2)
    );
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    
    // Prefer medium distance from center (not edges, not dead center)
    const normalizedDistance = distanceFromCenter / maxDistance;
    let positionScore;
    if (normalizedDistance < 0.3) {
      positionScore = normalizedDistance / 0.3; // Too close to center
    } else if (normalizedDistance > 0.7) {
      positionScore = (1.0 - normalizedDistance) / 0.3; // Too close to edges
    } else {
      positionScore = 1.0; // Sweet spot
    }
    
    score = score * 0.9 + positionScore * 0.1;
    
    return Math.max(0, Math.min(1, score));
  }  
  // Clear all existing bases (for new game)
  reset() {
    this.existingBases = [];
    this.quadrantsUsed = [false, false, false, false];
  }
}

// Global base manager instance
const baseManager = new BaseManager();

function generateRandomMaps(seed) {
  // If no seed provided, generate one based on a deterministic source
  // This ensures all players get the same map if they connect around the same time
  const mapSeed = seed || Math.floor(Date.now() / 60000); // Changes every minute
  console.log('Generating classic Tunneler map with seed:', mapSeed);
  
  // Store the seed for reference
  window.currentMapSeed = mapSeed;
  
  // Generate terrain data using classic algorithm
  const terrainData = generateClassicTerrain(MAP_WIDTH, MAP_HEIGHT, mapSeed);
  
  // Create canvas elements for the generated maps
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = MAP_WIDTH;
  bgCanvas.height = MAP_HEIGHT;
  const bgCtx = bgCanvas.getContext('2d');
  
  const shapesCanvas = document.createElement('canvas');
  shapesCanvas.width = MAP_WIDTH;
  shapesCanvas.height = MAP_HEIGHT;
  const shapesCtx = shapesCanvas.getContext('2d');
  
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = MAP_WIDTH;
  mapCanvas.height = MAP_HEIGHT;
  const mapCtx = mapCanvas.getContext('2d');
  
  // Generate the three layers correctly:
  
  // 1. Background layer (darker brown - dug areas)
  const bgImageData = generateBackgroundLayer(terrainData, MAP_WIDTH, MAP_HEIGHT, mapSeed);
  const bgData = new ImageData(bgImageData, MAP_WIDTH, MAP_HEIGHT);
  bgCtx.putImageData(bgData, 0, 0);
  
  // 2. Shapes layer (collision detection) - IMPORTANT: This must match the collision system
  const shapesImageData = generateShapesLayer(terrainData, MAP_WIDTH, MAP_HEIGHT);
  const shapesData = new ImageData(shapesImageData, MAP_WIDTH, MAP_HEIGHT);
  shapesCtx.putImageData(shapesData, 0, 0);
  
  // 3. Foreground layer (light brown dirt with transparent diggable areas - visual)
  const mapImageData = generateForegroundLayer(terrainData, MAP_WIDTH, MAP_HEIGHT, mapSeed);
  const mapData = new ImageData(mapImageData, MAP_WIDTH, MAP_HEIGHT);
  mapCtx.putImageData(mapData, 0, 0);
  
  // Convert canvases to images and handle loading properly
  bgImage = new Image();
  shapesImage = new Image();  
  mapImage = new Image();
  
  // Set up proper loading sequence
  let imagesLoaded = 0;
  const onImageLoad = () => {
    imagesLoaded++;
    if (imagesLoaded === 3) {
      // All images loaded, increment state counter
      state += 3;
      console.log('Classic Tunneler map generation complete');
    }
  };
  
  bgImage.onload = onImageLoad;
  shapesImage.onload = onImageLoad;
  mapImage.onload = onImageLoad;
  
  // Set the image sources (this triggers the loading)
  bgImage.src = bgCanvas.toDataURL();
  shapesImage.src = shapesCanvas.toDataURL();
  mapImage.src = mapCanvas.toDataURL();
  
  // Store terrain data for base placement
  window.gameTerrainData = terrainData;
}

// Enhanced base placement function
function generateOptimalBaseLocation(id) {
  if (!window.gameTerrainData) {
    console.warn('No terrain data available, falling back to random placement', id);
    return null; // Return null instead of calling randomBaseLocation
  }
  
  const location = baseManager.findOptimalBaseLocation(
    id, MAP_WIDTH, MAP_HEIGHT, window.gameTerrainData
  );
  
  if (!location) {
    console.warn('Could not find optimal base location, using fallback');
    return null; // Return null instead of calling randomBaseLocation
  }
  
  return location;
}

// Reset base manager when starting new game
function resetBaseManager() {
  baseManager.reset();
}

// Export functions for integration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateRandomMaps,
    generateOptimalBaseLocation,
    resetBaseManager,
    BaseManager
  };
}
