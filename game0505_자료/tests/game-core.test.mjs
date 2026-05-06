import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TILE_SIZE,
  SURVIVAL_CYCLE_MS,
  MONSTER_SPEED_PER_MS,
  CHASER_MONSTER_SPEED_PER_MS,
  GUARD_MONSTER_AGGRO_RADIUS,
  DAILY_FOOD_COST,
  DAILY_WATER_COST,
  FIELD_ITEMS_PER_TYPE,
  createGameState,
  movePlayer,
  collectItems,
  updateSurvivalTimer,
  updateMonsters,
  checkPlayerMonsterCollision,
} from '../game-core.mjs';

test('player can move across former building tiles inside the world', () => {
  const state = createGameState();
  state.player.x = 13 * TILE_SIZE;
  state.player.y = 10 * TILE_SIZE;

  movePlayer(state, { x: 0, y: -TILE_SIZE });

  assert.equal(state.player.x, 13 * TILE_SIZE);
  assert.equal(state.player.y, 9 * TILE_SIZE);
});

test('collecting water and tuna adds them to the inventory once', () => {
  const state = createGameState();
  state.inventory.water = 0;
  state.inventory.tuna = 0;
  state.items = [
    { id: 'water-test', type: 'water', x: state.player.x, y: state.player.y, collected: false },
    { id: 'tuna-test', type: 'tuna', x: state.player.x, y: state.player.y, collected: false },
  ];

  collectItems(state);
  collectItems(state);

  assert.equal(state.inventory.water, 1);
  assert.equal(state.inventory.tuna, 1);
  assert.equal(state.items.every((item) => item.collected), true);
});

test('field starts with four water and four food items', () => {
  const state = createGameState();

  assert.equal(FIELD_ITEMS_PER_TYPE, 4);
  assert.equal(state.items.filter((pickup) => pickup.type === 'water').length, FIELD_ITEMS_PER_TYPE);
  assert.equal(state.items.filter((pickup) => pickup.type === 'tuna').length, FIELD_ITEMS_PER_TYPE);
});

test('player starts with one day of water and food so the first day can advance', () => {
  const state = createGameState();

  assert.equal(state.inventory.water, DAILY_WATER_COST);
  assert.equal(state.inventory.tuna, DAILY_FOOD_COST);
});

test('collecting every starting item adds four water and four food to the starter supplies', () => {
  const state = createGameState();

  for (const pickup of state.items) {
    state.player.x = pickup.x;
    state.player.y = pickup.y;
    collectItems(state);
  }

  assert.equal(state.inventory.water, DAILY_WATER_COST + FIELD_ITEMS_PER_TYPE);
  assert.equal(state.inventory.tuna, DAILY_FOOD_COST + FIELD_ITEMS_PER_TYPE);
});

test('survival cycle consumes three water and three food when the day ends', () => {
  const state = createGameState();
  state.inventory.water = 4;
  state.inventory.tuna = 5;

  updateSurvivalTimer(state, SURVIVAL_CYCLE_MS);

  assert.equal(DAILY_WATER_COST, 3);
  assert.equal(DAILY_FOOD_COST, 3);
  assert.equal(state.inventory.water, 1);
  assert.equal(state.inventory.tuna, 2);
  assert.equal(state.daysSurvived, 1);
  assert.match(state.message, /\uD558\uB8E8\uAC00 \uBC14\uAF08\uC2B5\uB2C8\uB2E4\./);
  assert.equal(state.cycleRemainingMs, SURVIVAL_CYCLE_MS);
  assert.equal(state.gameOver, false);
});

test('survival cycle replaces field items with four water and four food', () => {
  const state = createGameState();
  state.inventory.water = 4;
  state.inventory.tuna = 4;
  state.items[0].collected = true;
  const originalPositions = state.items.map((pickup) => `${pickup.x},${pickup.y}`);
  const fixedRandom = repeatingRandom([0.1, 0.2, 0.7, 0.8, 0.3, 0.4, 0.9, 0.6]);

  updateSurvivalTimer(state, SURVIVAL_CYCLE_MS, fixedRandom);

  const newPositions = state.items.map((pickup) => `${pickup.x},${pickup.y}`);
  assert.equal(state.items.length, FIELD_ITEMS_PER_TYPE * 2);
  assert.equal(state.items.filter((pickup) => !pickup.collected).length, FIELD_ITEMS_PER_TYPE * 2);
  assert.equal(state.items.filter((pickup) => pickup.type === 'water').length, FIELD_ITEMS_PER_TYPE);
  assert.equal(state.items.filter((pickup) => pickup.type === 'tuna').length, FIELD_ITEMS_PER_TYPE);
  assert.notDeepEqual(newPositions, originalPositions);
});

test('monster speed is faster than the first smooth chase tuning', () => {
  assert.equal(MONSTER_SPEED_PER_MS > 0.05, true);
});

test('chaser monsters are faster than guard monsters and close to player speed', () => {
  assert.equal(CHASER_MONSTER_SPEED_PER_MS > MONSTER_SPEED_PER_MS, true);
  assert.equal(CHASER_MONSTER_SPEED_PER_MS >= 0.12, true);
});

test('monster chase speed starts slower and ramps up by survived days', () => {
  const early = createGameState();
  early.player.x = 12 * TILE_SIZE;
  early.player.y = 5 * TILE_SIZE;
  early.monsters = [
    { x: 5 * TILE_SIZE, y: 5 * TILE_SIZE, role: 'chaser', dir: { x: 1, y: 0 }, stepTimer: 0 },
  ];

  updateMonsters(early, 1000);
  const earlyDelta = early.monsters[0].x - 5 * TILE_SIZE;

  const later = createGameState();
  later.daysSurvived = 4;
  later.player.x = 12 * TILE_SIZE;
  later.player.y = 5 * TILE_SIZE;
  later.monsters = [
    { x: 5 * TILE_SIZE, y: 5 * TILE_SIZE, role: 'chaser', dir: { x: 1, y: 0 }, stepTimer: 0 },
  ];

  updateMonsters(later, 1000);
  const laterDelta = later.monsters[0].x - 5 * TILE_SIZE;

  assert.equal(earlyDelta < CHASER_MONSTER_SPEED_PER_MS * 1000, true);
  assert.equal(laterDelta > earlyDelta, true);
  assert.equal(laterDelta <= CHASER_MONSTER_SPEED_PER_MS * 1000, true);
});

test('field starts with sixteen monsters split into chasers and guards', () => {
  const state = createGameState();

  assert.equal(state.monsters.length, 16);
  assert.equal(state.initialMonsterCount, 16);
  assert.equal(state.monsters.filter((monster) => monster.role === 'chaser').length, 8);
  assert.equal(state.monsters.filter((monster) => monster.role === 'guard').length, 8);
  assert.equal(state.monsters.every((monster) => Number.isFinite(monster.homeX) && Number.isFinite(monster.homeY)), true);
});

test('each survived day adds half of the initial monster count', () => {
  const state = createGameState();
  state.inventory.water = 6;
  state.inventory.tuna = 6;
  const initialMonsterCount = state.monsters.length;
  const fixedRandom = repeatingRandom([0.15, 0.15, 0.85, 0.2, 0.4, 0.85, 0.9, 0.9]);

  updateSurvivalTimer(state, SURVIVAL_CYCLE_MS, fixedRandom);

  assert.equal(state.monsters.length, initialMonsterCount + initialMonsterCount / 2);

  updateSurvivalTimer(state, SURVIVAL_CYCLE_MS, fixedRandom);

  assert.equal(state.monsters.length, initialMonsterCount + initialMonsterCount);
});

test('the first day can pass and add monsters even before collecting pickups', () => {
  const state = createGameState();
  const initialMonsterCount = state.monsters.length;
  const fixedRandom = repeatingRandom([0.15, 0.15, 0.85, 0.2, 0.4, 0.85, 0.9, 0.9]);

  updateSurvivalTimer(state, SURVIVAL_CYCLE_MS, fixedRandom);

  assert.equal(state.gameOver, false);
  assert.equal(state.daysSurvived, 1);
  assert.equal(state.inventory.water, 0);
  assert.equal(state.inventory.tuna, 0);
  assert.equal(state.monsters.length, initialMonsterCount + initialMonsterCount / 2);
});

test('guard monsters chase nearby players but return home when player is far', () => {
  const state = createGameState();
  const guard = {
    x: 10 * TILE_SIZE,
    y: 10 * TILE_SIZE,
    homeX: 10 * TILE_SIZE,
    homeY: 10 * TILE_SIZE,
    role: 'guard',
    dir: { x: 0, y: 1 },
    stepTimer: 0,
  };
  state.monsters = [guard];
  state.player.x = guard.x + GUARD_MONSTER_AGGRO_RADIUS / 2;
  state.player.y = guard.y;

  updateMonsters(state, 1000);

  assert.equal(guard.x > guard.homeX, true);

  guard.x = guard.homeX + TILE_SIZE * 4;
  guard.y = guard.homeY;
  state.player.x = guard.homeX + GUARD_MONSTER_AGGRO_RADIUS + TILE_SIZE * 6;
  state.player.y = guard.homeY;

  updateMonsters(state, 1000);

  assert.equal(guard.x < guard.homeX + TILE_SIZE * 4, true);
});

test('new daily monsters keep the same chaser and guard split', () => {
  const state = createGameState();
  state.inventory.water = 6;
  state.inventory.tuna = 6;
  const fixedRandom = repeatingRandom([0.15, 0.15, 0.85, 0.2, 0.4, 0.85, 0.9, 0.9]);

  updateSurvivalTimer(state, SURVIVAL_CYCLE_MS, fixedRandom);

  assert.equal(state.monsters.length, 24);
  assert.equal(state.monsters.filter((monster) => monster.role === 'chaser').length, 12);
  assert.equal(state.monsters.filter((monster) => monster.role === 'guard').length, 12);
});

test('monsters step toward the player like a slow chase', () => {
  const state = createGameState();
  state.player.x = 10 * TILE_SIZE;
  state.player.y = 5 * TILE_SIZE;
  state.monsters = [
    { x: 5 * TILE_SIZE, y: 5 * TILE_SIZE, dir: { x: -1, y: 0 }, stepTimer: 220 },
  ];

  updateMonsters(state, 1);

  assert.equal(state.monsters[0].x > 5 * TILE_SIZE, true);
  assert.equal(state.monsters[0].y, 5 * TILE_SIZE);
  assert.equal(state.monsters[0].dir.x > 0, true);
});

test('monsters can chase diagonally with smooth pixel movement', () => {
  const state = createGameState();
  state.daysSurvived = 4;
  state.player.x = 10 * TILE_SIZE;
  state.player.y = 10 * TILE_SIZE;
  state.monsters = [
    { x: 5 * TILE_SIZE, y: 5 * TILE_SIZE, role: 'chaser', dir: { x: 0, y: 1 }, stepTimer: 0 },
  ];

  updateMonsters(state, 1000);

  const expectedDelta = (CHASER_MONSTER_SPEED_PER_MS * 1000) / Math.SQRT2;
  assert.equal(Math.round(state.monsters[0].x), Math.round(5 * TILE_SIZE + expectedDelta));
  assert.equal(Math.round(state.monsters[0].y), Math.round(5 * TILE_SIZE + expectedDelta));
  assert.equal(state.monsters[0].dir.x > 0, true);
  assert.equal(state.monsters[0].dir.y > 0, true);
});

test('survival cycle ends the game with the starvation message when required items are missing', () => {
  const state = createGameState();
  state.inventory.water = 3;
  state.inventory.tuna = 2;

  updateSurvivalTimer(state, SURVIVAL_CYCLE_MS);

  assert.equal(state.gameOver, true);
  assert.equal(
    state.message,
    '\uD558\uB8E8\uAC00 \uC9C0\uB0AC\uC9C0\uB9CC \uB9C8\uC2E4 \uBB3C\uACFC \uBA39\uC744 \uC2DD\uB7C9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uB2F9\uC2E0\uC740 \uAD76\uC5B4\uC8FD\uC5C8\uC2B5\uB2C8\uB2E4.',
  );
});

test('touching a monster ends the game', () => {
  const state = createGameState();
  state.player.x = state.monsters[0].x;
  state.player.y = state.monsters[0].y;

  checkPlayerMonsterCollision(state);

  assert.equal(state.gameOver, true);
  assert.match(state.message, /\uBAAC\uC2A4\uD130/);
});

function repeatingRandom(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}
