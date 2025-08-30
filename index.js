/* This is the node.js script that is run as a server.
 * The server starts a simple HTTP server and waits for connections from a browser.
 * The HTTP server serves all game files (html, css, js, images, sounds).
 * Next, the script starts a websocket server that waits for websocket-connections.
 * All tunneler clients start a websocket connection.
 * The server then forwards all websocket messages to all other clients.
 * This is called Multicasting: https://en.wikipedia.org/wiki/Multicast
 *
 * The server also keeps a trace of all messages. When a game is in progress, and 
 * another player connects, the trace is "replayed" so the new player will become
 * up-to-date on the gameplay thus far.
 */

const webSocketServer = require('websocket').server;
const http = require('http');

const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');

// Default to port 3000
const webSocketsServerPort = 3000;

// List of all open websocket connections
let connections = [];

// Count of all open connections
let counter = 0;

// Trace of all messages, that is replayed for new players
const trace = [];

// Generate seed when server starts
let currentMapSeed = Math.floor(Date.now() / 1000); 

const MSG_MAP_SEED = 'S';

// Instantiate basic HTTP server that serves static files
var serve = serveStatic("./");
var server = http.createServer(function(request, response) {
  var done = finalhandler(request, response);
  serve(request, response, done);
});

server.listen(webSocketsServerPort, function() {
  console.log('Listening on port ' + webSocketsServerPort);
});

// Add a websocket server
var wss = new webSocketServer({ httpServer: server });

wss.on('request', function(request) {
  let ws = request.accept(null, request.origin);
  connections.push(ws);

  // Generate ID for the new player
  let id = ++counter;
  console.log('Open connection [%d]. Active connections: %d', id, connections.length);

  // Send the trace of all previous actions to the player
  trace.forEach(action => ws.sendUTF(action));

  // Send MAP_SEED message first so client can generate the correct map
  ws.sendUTF('S ' + currentMapSeed);

  // Send INIT message with the new ID, so player will join the game
  ws.sendUTF('I ' + id);

  // Multicast all messages (i.e. forward the message to all connections except the source)
  ws.on('message', function(message) {
    if (message.type == 'utf8') {
      multicast(ws, message.utf8Data);
    }
  });

  // When a connection is closed, inform the remaining players with an EXIT message
  ws.on('close', function(_reasoncode, _description) {
    for (let i = 0; i < connections.length; i ++) {
      if (connections[i] === ws) {
        connections.splice(i, 1);
      }
    }
    console.log('Close connection [%d]. Active connections: %d', id, connections.length);
    if (connections.length == 0) {
      // When the last connection is closed, we reset all state (the ID counter the trace)
      console.log('Reset game state');
      trace.length = 0;
      counter = 0;
    } else {
      // Send an EXIT message to the other players
      multicast(ws, 'X ' + id);
    }
  });
});

// Forward a message to all connections except the source
function multicast(source, message) {
  trace.push(message); // Save the message in the trace log
  connections.forEach(client => {
    if (client !== source && client.connected) {
      client.sendUTF(message);
    }
  });
}

function generateNewMapSeed() {
  currentMapSeed = Math.floor(Date.now() / 1000);
  console.log('New map seed generated:', currentMapSeed);
  
  // Broadcast new seed to all clients
  multicast(null, 'S ' + currentMapSeed);
  
  // Clear trace since old actions won't work with new map
  trace.length = 0;
}

