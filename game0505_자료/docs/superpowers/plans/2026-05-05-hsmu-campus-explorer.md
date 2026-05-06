# HSMU Campus Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tiny browser-playable top-down HSMU campus exploration game where the player reaches B Hall while avoiding monsters.

**Architecture:** Put deterministic movement, collision, enemy updates, respawn, and win detection in `game-core.mjs` so it can be tested with Node. Put Canvas rendering, keyboard input, timing, and browser UI state in `game.js`. Keep art lightweight and retro, with generated-asset prompt metadata in `assets/prompts/` and procedural Canvas fallback sprites for reliable loading.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Canvas 2D, Node built-in test runner.

---

### Task 1: Core Game Rules

**Files:**
- Create: `game-core.mjs`
- Create: `tests/game-core.test.mjs`

- [ ] **Step 1: Write failing tests for movement, collision, respawn, and win**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TILE_SIZE,
  createGameState,
  movePlayer,
  updateMonsters,
  checkPlayerMonsterCollision,
  checkWin,
} from '../game-core.mjs';

test('player can move onto path tiles', () => {
  const state = createGameState();
  state.player.x = 2 * TILE_SIZE;
  state.player.y = 13 * TILE_SIZE;

  movePlayer(state, { x: TILE_SIZE, y: 0 });

  assert.equal(state.player.x, 3 * TILE_SIZE);
  assert.equal(state.player.y, 13 * TILE_SIZE);
});

test('player cannot move through building collision', () => {
  const state = createGameState();
  state.player.x = 4 * TILE_SIZE;
  state.player.y = 5 * TILE_SIZE;

  movePlayer(state, { x: 0, y: -TILE_SIZE });

  assert.equal(state.player.x, 4 * TILE_SIZE);
  assert.equal(state.player.y, 5 * TILE_SIZE);
});

test('touching a monster respawns the player and increments danger count', () => {
  const state = createGameState();
  state.player.x = state.monsters[0].x;
  state.player.y = state.monsters[0].y;

  checkPlayerMonsterCollision(state);

  assert.equal(state.player.x, state.spawn.x);
  assert.equal(state.player.y, state.spawn.y);
  assert.equal(state.dangerCount, 1);
});

test('reaching B Hall sets the win flag', () => {
  const state = createGameState();
  state.player.x = 17 * TILE_SIZE;
  state.player.y = 4 * TILE_SIZE;

  checkWin(state);

  assert.equal(state.won, true);
});

test('monsters move and reverse when blocked', () => {
  const state = createGameState();
  state.monsters = [{ x: 1 * TILE_SIZE, y: 1 * TILE_SIZE, dir: { x: -1, y: 0 }, stepTimer: 0 }];

  updateMonsters(state, 250);

  assert.equal(state.monsters[0].x, 1 * TILE_SIZE);
  assert.deepEqual(state.monsters[0].dir, { x: 1, y: 0 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/game-core.test.mjs`

Expected: FAIL because `game-core.mjs` does not exist yet.

- [ ] **Step 3: Implement minimal core rules**

Create `game-core.mjs` with exported map constants, state creation, tile collision, player movement, monster updates, collision respawn, and win detection.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/game-core.test.mjs`

Expected: PASS with 5 passing tests.

### Task 2: Browser Game Shell

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `game.js`
- Create: `assets/prompts/campus-sprites.prompt.txt`

- [ ] **Step 1: Create browser files**

Create a Canvas page with a compact HUD. Use `game.js` to import core rules, draw the campus map, draw retro sprite-like characters, collect keyboard input, update monsters, respawn on contact, and show a clear message when B Hall is reached.

- [ ] **Step 2: Add sprite prompt metadata**

Create `assets/prompts/campus-sprites.prompt.txt` describing the intended 90s JRPG player, monster, and campus prop sprites so the art direction is preserved even when procedural fallback art is used.

- [ ] **Step 3: Run core tests again**

Run: `node --test tests/game-core.test.mjs`

Expected: PASS with 5 passing tests.

### Task 3: Local Verification

**Files:**
- No new files.

- [ ] **Step 1: Start a local server**

Run: `python -m http.server 8000`

Expected: server starts at `http://localhost:8000`.

- [ ] **Step 2: Open the game in the in-app browser**

Open `http://localhost:8000` and confirm the canvas renders.

- [ ] **Step 3: Verify gameplay**

Confirm keyboard movement, wall collision, monster respawn, and B Hall clear state.
