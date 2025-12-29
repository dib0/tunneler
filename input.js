/* input.js handles all input: keys, mouse clicks, and touch events.
 * Regrettably, webbrowsers don't support checking whether a given key is
 * currently pressed; they only notify when a key is pressed/released.
 * Therefore on every keydown event, we flag the key in a map ("keys") and
 * on every keyup event, we undo the flag for that key.
 */

/* globals viewport,
 * TUN_CHAT_INPUT_ID, TARGET_CANVAS_ID,
 * sendChatFromInputField
 */

// Prevent all forms of zooming
function preventZoom() {
  // Prevent Ctrl/Cmd + wheel zoom
  document.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent pinch-to-zoom on trackpads and touch devices
  document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturechange', function(e) {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gestureend', function(e) {
    e.preventDefault();
  }, { passive: false });

  // Prevent keyboard zoom shortcuts (Ctrl/Cmd + plus/minus/0)
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && 
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent double-tap zoom on mobile
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}

// Call preventZoom when the script loads
preventZoom();

// Map of pressed/unpressed key codes (true = key down, false = key up)
let keys = {length: 0};

// Direction set by mouse or touch input
let direction = 0;

// Key press for firing or quitting
let fired = false, quit = false;

// Fire button is pressed
function hasFired() {
  return fired;
}

// Escape key was pressed
function hasQuit() {
  return quit;
}

// Keypresses are set to TRUE in the [keys] array
document.onkeydown = function(e) {
  if (document.activeElement.id == TUN_CHAT_INPUT_ID) {
    if (e.key == "Enter") {
      sendChatFromInputField();
      document.getElementById(TARGET_CANVAS_ID).focus();
    }
    return;
  }
  if (e.key == "Control" || e.key == " " || e.key == "Enter" || e.key == "5") {
    fired = true;
  } else if (e.key == "/") {
    document.getElementById(TUN_CHAT_INPUT_ID).focus();
  } else if (e.key == "Escape") {
    quit = true;
  } else if (!keys[e.key]) {
    keys[e.key] = true;
  }
  e.preventDefault();
}

// Key-ups are set to FALSE from the [keys] array
document.onkeyup = function(e) {
  if (document.activeElement.id == TUN_CHAT_INPUT_ID) {
    return;
  }
  if (keys[e.key]) {
    keys[e.key] = false;
  }
  if (e.key == "Control" || e.key == " " || e.key == "Enter" || e.key == "5") {
    fired = false;
  }
}

// Translate keypresses from the [keys] array into directions (numpad style)
function getDirectionFromKeys() {
  return (direction != 0) ? direction
    : [['ArrowLeft', 'ArrowDown'], ['2', '4'], ['1'], ['a', 's'], ['z'], ].some(ks => ks.every(k => keys[k])) ? 1
    : [['ArrowRight', 'ArrowDown'], ['2', '6'], ['3'], ['s', 'd'], ['x', 'd'], ['c'],].some(ks => ks.every(k => keys[k])) ? 3
    : [['ArrowLeft', 'ArrowUp'], ['4', '8'], ['7'], ['a', 'w'], ['q']].some(ks => ks.every(k => keys[k])) ? 7
    : [['ArrowRight', 'ArrowUp'], ['6', '8'], ['9'], ['d', 'w'], ['e']].some(ks => ks.every(k => keys[k])) ? 9
    : ['ArrowDown', '2', 's', 'x'].some(k => keys[k]) ? 2
    : ['ArrowLeft', '4', 'a'].some(k => keys[k]) ? 4
    : ['ArrowRight', '6', 'd'].some(k => keys[k]) ? 6
    : ['ArrowUp', '8', 'w'].some(k => keys[k]) ? 8
    : 0;
}

// Forget all registered key presses
function resetKeys() {
  fired = false;
  direction = 0;
  keys = {length: 0};
}

// Get the position of the mouse relative to the canvas
function getEventPos(canvasDom, x, y) {
  var rect = canvasDom.getBoundingClientRect();
  return {x: x - rect.left, y: y - rect.top, w: rect.width, h: rect.height};
}

// Calculate the angle between the center of the canvas and the clicked location, and translate it into a numpad direction
function getDirectionFromAngle(rect) {
  // c = midpoint, x = scaled x coordinate of the event
  const c = rect.h/2;
  const x = rect.x * (rect.h / rect.w);
  const y = rect.y;
  
  // Calculate the angle between the midpoint of the canvas and the location of the input event
  const angle = Math.atan2(y - c, x - c) * 180 / Math.PI;

  // Translate the calculated angle into a numpad direction
  return angle < -150 ? 4
       : angle < -120 ? 7
       : angle < -60 ? 8
       : angle < -30 ? 9
       : angle < 30 ? 6
       : angle < 60 ? 3
       : angle < 120 ? 2
       : angle < 150 ? 1
       : 4;
}

// Called in case of a mouse or touch event. This will set the global variable 'direction' to a numpad direction.
function moveEvent(x, y) {
  const pos = getEventPos(viewport, x, y);
  direction = getDirectionFromAngle(pos);
}

// Add event listeners to the main gameplay canvas for mouse and touch events.
function setupEventListeners() {
  viewport.ontouchstart = function(e) {
    e.preventDefault();
    if (e.touches.length > 1) {
      fired = true;
    }
    moveEvent(e.touches[0].clientX, e.touches[0].clientY);
  }
  viewport.ontouchmove = function(e) {
    e.preventDefault();
    if (direction != 0) {
      moveEvent(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  viewport.ontouchend = function(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      fired = false;
    } else {
      resetKeys();
    }
  }
  viewport.ontouchcancel = function(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      fired = false;
    } else {
      resetKeys();
    }
  }
  viewport.onmousedown = function(e) {
    if (e.button == 2) {
      e.preventDefault();
      fired = true;
    } else {
      moveEvent(e.clientX, e.clientY);
    }
  }
  viewport.onmousemove = function(e) {
    if (direction != 0) {
      moveEvent(e.clientX, e.clientY);
    }
  }
  viewport.onmouseup = function(e) {
    if (e.button == 2) {
      e.preventDefault();
      fired = false;
    } else {
      resetKeys();
    }
  }
}
