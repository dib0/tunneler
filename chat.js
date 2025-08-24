/* chat.js contains functions for the chat message area.
 */

/* global player, opponents, quit
 * sendMessage,
 * MSG_NAME, MSG_TEXT
 */

const TUN_CHAT_AREA_ID = 'tun_chat_area';
const TUN_CHAT_INPUT_ID = 'tun_chat_input_field';

function sendChatFromInputField() {
  const chatInputField = document.getElementById(TUN_CHAT_INPUT_ID);
  const text = chatInputField.value;
  chatInputField.value = "";

  if (text.toLowerCase().startsWith('/name ') || text.toLowerCase().startsWith('/nick ')) {
    if (text.length > 6) {
      player.name = text.substring(6);
      sendMessage(MSG_NAME, {id: player.id, name: player.name});
      displayAlert('Your name is now: <span style="color: yellow">' + player.name + '</span>');

      // Force a redraw to update the base name display immediately
      if (typeof redrawScreen === 'function') {
        redrawRequest = true; // Ensure the redraw flag is set
        redrawScreen();
      }      
    }
  } else if (text.toLowerCase().startsWith('/help')) {
    displayHelpMessage();
  } else if (text.toLowerCase().startsWith('/score')) {
    displayScores();
  } else if (text.toLowerCase().startsWith('/shout')) {
    sendChatMessage('/me is on x,y coordinates [' + Math.round(player.x / 10) + ',' + Math.round(player.y / 10) + '].');
  } else if (text.toLowerCase() == '/quit') {
    quit = true;
  } else {
    sendChatMessage(text);
  }
}

function sendChatMessage(text) {
  if (text != "") {
    sendMessage(MSG_TEXT, {name: player.name, text: text});
    chatReceived(player.name, text);
  }
}

function chatReceived(name, text) {
  let html = name + ': <span style="color: yellow">' + text + '</span><br>';
  if (text.toLowerCase().startsWith('/me ')) {
    html = '*** <span style="color: yellow">'+ name + text.slice(3) + '</span><br>';
  }
  const chatBox = document.getElementById(TUN_CHAT_AREA_ID);
  chatBox.innerHTML += html;
  chatBox.scrollTop = chatBox.scrollHeight;
}

function displayAlert(text) {
  const chatBox = document.getElementById(TUN_CHAT_AREA_ID);
  chatBox.innerHTML += '<span style="color: white">*** ' + text + "</span><br>";
  chatBox.scrollTop = chatBox.scrollHeight;
}

function displayScores() {
  displayAlert('Current scores:');
  displayAlert(player.name + ': ' + player.score);
  opponents.forEach(opponent => {
    if (opponent && opponent.name) {
      displayAlert(opponent.name + ': ' + opponent.score)
    }
  });
}

function displayHelpMessage() {
  displayAlert('<span style="color: yellow">Instructions for playing:</span><br>'
    + 'To move around, use the cursor or WASD keys, click with the mouse or drag on a touchscreen. Fire bullets '
    + 'with [CTRL], [SPACE] or [ENTER], a right-mouseclick, or two-finger tap on a touchscreen. Firing also helps '
    + 'you to dig faster. However, keep an eye on your energy (E) bar. Refuel in your base. If you are hit by an '
    + 'opponent, your shield (S) bar decreases. This is also repaired in your base. You can refuel energy in your '
    + 'opponents base, but not your shield. You can chat with other players using the input field in the lower '
    + 'left of the screen. (Using "/" will focus the chat input field so you can start typing immediately.)<br>'
    + '<span style="color: yellow">/help</span> - Display this message<br>'
    + '<span style="color: yellow">/name Diggie Dig</span> - Change your name<br>'
    + '<span style="color: yellow">/nick Diggie Dig</span> - Same as /name<br>'
    + '<span style="color: yellow">/shout</span> - Let other players know where you are<br>'
    + '<span style="color: yellow">/score</span> - Display current scores<br>'
    + '<span style="color: yellow">/quit</span> - Quit game (same as [ESC] key)');
}

function displayWelcomeMessage() {
  displayAlert('Welcome ' + player.name + '!');
  displayAlert('Change your name by typing <span style="color: yellow">/name Your Name</span> in the lower-left '
    + 'input field. Type <span style="color: yellow">/help</span> for instructions.');
  if (opponents.length == 0) {
    displayAlert('You are currently the only player in the game.');
  } else if (opponents.length == 1) {
    displayAlert('There is currently one other player in the game: ' + opponents[0].name);
  } else {
    let text = 'There are currently ' + opponents.length + ' other players in the game: ' + opponents[0].name;
    for (let c = 1; c < opponents.length - 1; c++) {
      text += ', ' + opponents[c].name;
    }
    text += ' and ' + opponents[opponents.length - 1].name;
    displayAlert(text);
  }
}
