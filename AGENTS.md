# Project Rules

- Games must open correctly from `index.html` by direct file launch. Do not rely only on a local dev server.
- Keep a top-level `index.html` that routes into the playable game when the game lives in a subfolder.
- For direct `file://` play, prefer a classic bundled script such as `game-standalone.js` over `type="module"` entrypoints.
- Use actual image assets for maps, characters, monsters, and item pickups. Do not leave colored rectangle fallbacks visible in the final game.
- Prefer pre-transparent PNG sprite sheets for file previews. Avoid runtime canvas pixel reads like `getImageData` for transparency cleanup in the browser.
- Before saying the game is done, verify direct `file://` launch in the browser and check that the canvas shows the map and sprites, not a blank color panel or fallback blocks.
