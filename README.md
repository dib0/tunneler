# Tunneler

This project is a remake of Geoffrey Silverton's classic [Tunneler](https://tunneler.org) game for DOS. The game is developed as a HTML5 Canvas and Javascript app, with a small node.js server that facilitates communication between the players. The graphics are a bit different from the original, and some gameplay elements are changed (for example, the map is not randomly generated) but the basic gameplay is the same.

<!--You can play the game on Glitch.com: [https://tunneler.glitch.me](https://tunneler.glitch.me)-->

![screenshot](screenshot.png)

## Credits & Acknowledgments

This project builds upon and is inspired by the work of several contributors to the Tunneler legacy:

### Original Game
- **Tunneler (1991)** by **Geoffrey Silverton** - The original DOS masterpiece
- Official website: [https://tunneler.org](https://tunneler.org)
- Revolutionary for its time with CGA 160×100 graphics and split-screen multiplayer

### Inspiration & Reference Projects
- **[jwharm/tunneler](https://github.com/jwharm/tunneler)** - JavaScript/HTML5 remake that provided foundational insights for web-based implementation
- **[guyromm/tunneler](https://github.com/guyromm/tunneler/tree/master/src)** - C implementation fork that helped preserve understanding of the original game mechanics

**Special thanks** to Geoffrey Silverton for creating this timeless game, and to the open-source community for keeping it alive through modern remakes and preservation efforts.

## About the Original

The original Tunneler was groundbreaking for its innovative use of the CGA graphics adapter's undocumented 160×100 pixel, 16-color mode. This was achieved through a clever text-mode hack that allowed much richer graphics than the standard 4-color CGA graphics mode. The game featured:

- Split-screen multiplayer on a single computer
- Real-time tank combat in destructible underground environments
- Energy management and base refueling mechanics
- Authentic PC Speaker sound effects

## This Implementation

This modern web version aims to capture the essence of the original while making it accessible through modern browsers. Key features include:

- HTML5 Canvas rendering with authentic pixel art style
- WebSocket-based multiplayer networking
- Modern JavaScript with Node.js server
- Faithful recreation of core gameplay mechanics
- Browser compatibility across devices

---

*This is a fan tribute project created with respect and admiration for the original game and its creator.*
