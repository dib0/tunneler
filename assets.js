/* assets.js contains functions to load images and sounds into global variables.
 * Sounds are played with the function playsound(), unless the game is not yet initialized.
 * The function sndDigRandom() randomly plays one of two 'dig' sounds.
 * We try to play .ogg sound files, and fallback to the larger .wav files if the browser
 * doesn't support OGG Vorbis.
 */

/* global initialized
 */

// Updated to use local asset paths
const MAPS_URL_PREFIX = './assets/maps/';
const IMAGES_URL_PREFIX = './assets/images/';
const SOUNDS_URL_PREFIX = './assets/sounds/';

// Images
let bgImage, shapesImage, mapImage;
const bulletImages = new Map();
const tankImages = new Map();

// Sounds
let sndDig1, sndDig2, sndDig3, sndFire1, sndFire2, sndHit, sndLost;

// When state == ready, all assets have loaded
let state = 0, ready = 0;

// Load an image.
// Javascript loads images in the background, so we need to wait until all images have loaded
// before we start gameplay. The variables 'ready' and 'state' are used for this:
// 'ready' is incremented before the image loading starts, and 'state' is incremented afterwards
// (as an img.onload callback). We know all images have loaded successfully when ready == state.
function loadImage(filename) {
  ready++;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => state++;
  img.onerror = () => {
    console.error('Failed to load image:', filename);
    state++; // Still increment to prevent hanging
  };
  img.src = filename;
  return img;
}

// Load map, images and sounds
function loadAssets() {
  // Use shared seed if available, otherwise use time-based seed
  const mapSeed = window.sharedMapSeed || Math.floor(Date.now() / 60000);
    
  // Load bullet images (keep existing)
  for (let i = 1; i <= 9; i++) {
    if (i % 10 != 5) {
      bulletImages.set(i, loadImage(IMAGES_URL_PREFIX + 'b' + i + '.png'));
    }
  }
  
  // Load tank images (keep existing)
  for (let i = 1; i <= 49; i++) {
    if (i % 10 != 0 && i % 10 != 5) {
      tankImages.set(i, loadImage(IMAGES_URL_PREFIX + 't' + i.toString().padStart(2, '0') + '.png'));
    }
  }

  // Load sounds (keep existing)
  let ext = '.wav';
  if (new Audio().canPlayType('audio/ogg; codecs="vorbis"') != "") {  
    ext = '.ogg';
  }

  sndDig1  = new Audio(SOUNDS_URL_PREFIX + 'dig1' + ext);
  sndDig2  = new Audio(SOUNDS_URL_PREFIX + 'dig2' + ext);
  sndDig3  = new Audio(SOUNDS_URL_PREFIX + 'dig3' + ext);
  sndFire1 = new Audio(SOUNDS_URL_PREFIX + 'fire1' + ext);
  sndFire2 = new Audio(SOUNDS_URL_PREFIX + 'fire2' + ext);
  sndHit   = new Audio(SOUNDS_URL_PREFIX + 'hit' + ext);
  sndLost  = new Audio(SOUNDS_URL_PREFIX + 'lost' + ext);
}

// Randomly choose between two "dig" sounds
function sndDigRandom() {
  if (Math.round(Math.random() * 0.75)) {
    return sndDig2;
  } else {
    return sndDig1;
  }
}

// Play sound, unless game is still initializing (rewinding the gameplay trace)
function playSound(snd) {
  if (initialized) {
    snd.play().catch(e => console.warn('Audio play failed:', e));
  }
}
