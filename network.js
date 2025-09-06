/* network.js creates a websocket connection with the server,
 * and has functions to send and receive messages to and from the
 * other players (distributed by the server).
 * 
 * Messages are a command ("F" for fire, for example) followed
 * by one or more parameters (space-separated). Text strings are 
 * base-64 encoded to make sure that they don't contain spaces.
 */

// Automatically detect WebSocket protocol based on page protocol
const getWebSocketURL = () => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = location.host;
  return `${protocol}//${host}/`;
};

const SERVER_URL = getWebSocketURL();

// Communication protocol
const MSG_INIT = 'I';
const MSG_JOIN = 'J';
const MSG_MOVE = 'M';
const MSG_BASE = 'B';
const MSG_DIG  = 'D';
const MSG_FIRE = 'F';
const MSG_LOST = 'L';
const MSG_TEXT = 'T';
const MSG_NAME = 'N';
const MSG_EXIT = 'X';
const MSG_MAP_SEED = 'S';
const MSG_MAP_DATA = 'M';

// Connection to the server
let socket;

// Flag to signal connection/disconnect
let connected = false;

// Received/sent messages from/to other players are put on these queues
const inbox = [];
const outbox = [];

// Connect to server. Push incoming messages on the queue
function connect() {
  console.log(`Connecting to: ${SERVER_URL}`); // Debug log to show which protocol is being used
  
  socket = new WebSocket(SERVER_URL);
  
  // Set flag to wait for server map
  if (typeof window !== 'undefined') {
    window.expectingServerMap = true;
  }

  // Listen for messages
  socket.addEventListener('message', function (event) {
    console.log('📥 Message received from server:', event.data.substring(0, 30) + '...');
    inbox.push(event.data);
    console.log('📮 Inbox now has', inbox.length, 'messages');
  });

  socket.addEventListener('open', function (event) {
    console.log("Connected to " + SERVER_URL);
    connected = true;

    while (outbox.length > 0) {
      const msg = outbox.shift();
      socket.send(msg);
    }
  });

  socket.addEventListener('close', function (event) {
    connected = false;
  });

  socket.addEventListener('error', function (event) {
    console.error('WebSocket error:', event);
    connected = false;
  });
}

function messageReceived() {
  const hasMessage = inbox.length > 0;
  if (hasMessage) {
    console.log('📬 messageReceived() returning true, inbox length:', inbox.length);
  }
  return hasMessage;
}

function getMessage() {
  console.log('📨 getMessage() called, inbox length:', inbox.length);
  if (inbox.length > 0) {
    const s = inbox.shift();
    console.log("Raw message:", s.charAt(0), s.substring(0, 20)); // DEBUG
    const arr = s.split(" ");
    const action = arr[0];
    
    if (action == MSG_MAP_SEED) {
      return {type: MSG_MAP_SEED, seed: parseInt(arr[1])};
    } else if (action == 'M' && s.substring(2, 3) == '{') {
      // Handle map data messages (JSON format)
      const mapDataJson = s.substring(2); // Everything after "M "
      try {
        const mapData = JSON.parse(mapDataJson);
        console.log('Received map data from server - Size:', mapData.width, 'x', mapData.height);
        return {type: 'MAP_DATA', mapData: mapData};
      } catch (e) {
        console.error('Error parsing map data:', e);
        return null;
      }
    } else if (action == MSG_INIT) {
      return {type: MSG_INIT, id: arr[1]};
    } else if (action == MSG_JOIN) {
      return {type: MSG_JOIN, id: arr[1]};
    } else if (action == MSG_MOVE) {
      return {type: MSG_MOVE, player: {id: arr[1], x: parseInt(arr[2]), y: parseInt(arr[3]), dir: parseInt(arr[4]), energy: parseInt(arr[5]), health: parseInt(arr[6]), score: parseInt(arr[7]), name: atob(arr[8])}};
    } else if (action == MSG_BASE) {
      return {type: MSG_BASE, base: {id: arr[1], x: parseInt(arr[2]), y: parseInt(arr[3]), w: parseInt(arr[4]), h: parseInt(arr[5])}};
    } else if (action == MSG_DIG) {
      return {type: MSG_DIG, area: {x: parseInt(arr[1]), y: parseInt(arr[2]), w: parseInt(arr[3]), h: parseInt(arr[4])}};
    } else if (action == MSG_FIRE) {
      return {type: MSG_FIRE, id: arr[1]};
    } else if (action == MSG_LOST) {
      return {type: MSG_LOST, player: {id: arr[1], by: arr[2]}};
    } else if (action == MSG_TEXT) {
      return {type: MSG_TEXT, message: {name: atob(arr[1]), text: atob(arr[2])}};
    } else if (action == MSG_NAME) {
      return {type: MSG_NAME, player: {id: arr[1], name: atob(arr[2])}};
    } else if (action == MSG_EXIT) {
      return {type: MSG_EXIT, id: arr[1]};
    }
  }  
  return null;
}

function sendMessage(action, data) {
  let msg = "";
  if (action == MSG_JOIN) {
    msg = MSG_JOIN + " " + data;
  } else if (action == MSG_MOVE) {
    msg = MSG_MOVE + " " + data.id + " " + data.x + " " + data.y + " " + data.dir + " " + data.energy + " " + data.health + " " + data.score + " " + btoa(data.name);
  } else if (action == MSG_BASE) {
    msg = MSG_BASE + " " + data.id + " " + data.x + " " + data.y + " " + data.w + " " + data.h;
  } else if (action == MSG_DIG) {
    msg = MSG_DIG + " " + data.x + " " + data.y + " " + data.w + " " + data.h;
  } else if (action == MSG_FIRE) {
    msg = MSG_FIRE + " " + data;
  } else if (action == MSG_LOST) {
    msg = MSG_LOST + " " + data.id + " " + data.by;
  } else if (action == MSG_TEXT) {
    msg = MSG_TEXT + " " + btoa(data.name) + " " + btoa(data.text);
  } else if (action == MSG_NAME) {
    msg = MSG_NAME + " " + data.id + " " + btoa(data.name);
  }
  // console.log("> " + msg);
  if (connected) {
    socket.send(msg);
  } else {
    outbox.push(msg);
  }
}
