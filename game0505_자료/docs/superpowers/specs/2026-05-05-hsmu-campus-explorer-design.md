# HSMU Campus Explorer Design

## Goal

Build a very small browser-playable 2D exploration game inspired by 1990s Dragon Quest-style top-down movement. The player starts at the campus gate and reaches B Hall while avoiding wandering monsters.

## Map

The map is a simplified campus, not an exact survey map. It uses the official campus direction that the campus is centered around A Hall and B Hall, with a front gate, paths, grass, road/parking edges, trees, and signs. The layout is intentionally compact so it is playable in one minute.

## Gameplay

- Move with arrow keys or WASD.
- Solid tiles and buildings block movement.
- Monsters patrol on simple routes and bounce or choose a new direction when blocked.
- Touching a monster respawns the player at the gate.
- Reaching B Hall clears the game.

## Assets

Use a retro JRPG visual direction. Keep the runtime simple with Canvas rendering and small sprite-like assets. Generated sprite assets may be used for the player, monsters, and campus object sheet; procedural fallback drawing is acceptable for reliability if a generated asset cannot be saved or loaded during development.

## Files

- `index.html`: app shell.
- `styles.css`: page layout and retro presentation.
- `game.js`: map data, movement, collision, enemy patrols, rendering, and win/respawn state.
- `assets/`: generated or local game art.

## Verification

Run a local server, open the game in a browser, and verify:

- The canvas renders.
- Player movement works with keyboard input.
- Collision stops the player from walking through buildings and trees.
- Monsters move and cause respawn on contact.
- B Hall triggers the clear state.
