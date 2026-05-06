export const TILE_SIZE = 32;
export const MAP_WIDTH = 48;
export const MAP_HEIGHT = 32;
export const SURVIVAL_CYCLE_MS = 60_000;
export const DAILY_WATER_COST = 3;
export const DAILY_FOOD_COST = 3;
export const FIELD_ITEMS_PER_TYPE = 4;
export const ITEM_PICKUP_RADIUS = TILE_SIZE * 0.75;
export const ITEM_RESPAWN_PLAYER_SAFE_RADIUS = TILE_SIZE * 4;
export const ITEM_RESPAWN_MONSTER_SAFE_RADIUS = TILE_SIZE * 2;
export const MONSTER_SPEED_PER_MS = 0.08;
export const CHASER_MONSTER_SPEED_PER_MS = 0.12;
export const MONSTER_RESPAWN_PLAYER_SAFE_RADIUS = TILE_SIZE * 7;
export const MONSTER_RESPAWN_MONSTER_SAFE_RADIUS = TILE_SIZE * 2;
export const GUARD_MONSTER_AGGRO_RADIUS = TILE_SIZE * 8;

export const CAMPUS_MAP = buildCampusMap();

const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const INITIAL_ITEMS = [
  item('water-1', 'water', 6, 5), item('tuna-1', 'tuna', 10, 7),
  item('water-2', 'water', 16, 6), item('tuna-2', 'tuna', 21, 8),
  item('water-3', 'water', 29, 5), item('tuna-3', 'tuna', 39, 6),
  item('water-4', 'water', 44, 5), item('tuna-4', 'tuna', 35, 11),
];

const INITIAL_MONSTERS = [
  monster('chaser', 9, 15, 0, 1, 0),
  monster('chaser', 18, 13, 1, 0, 80),
  monster('chaser', 26, 16, 0, 1, 140),
  monster('chaser', 36, 18, -1, 0, 40),
  monster('chaser', 29, 24, 1, 0, 120),
  monster('chaser', 15, 23, -1, 0, 60),
  monster('chaser', 40, 13, 0, 1, 180),
  monster('chaser', 5, 26, 1, 0, 30),
  monster('guard', 7, 6, 1, 0, 20),
  monster('guard', 18, 6, 0, 1, 70),
  monster('guard', 31, 7, -1, 0, 110),
  monster('guard', 43, 8, 0, 1, 160),
  monster('guard', 8, 19, 1, 0, 50),
  monster('guard', 20, 20, 0, -1, 90),
  monster('guard', 34, 22, -1, 0, 130),
  monster('guard', 44, 25, 0, -1, 170),
];

export function createGameState() {
  const spawn = { x: 24 * TILE_SIZE, y: 28 * TILE_SIZE };

  return {
    spawn,
    player: { x: spawn.x, y: spawn.y, facing: 'up' },
    monsters: INITIAL_MONSTERS.map((enemy) => cloneMonster(enemy)),
    initialMonsterCount: INITIAL_MONSTERS.length,
    monsterCycle: 0,
    items: INITIAL_ITEMS.map((pickup) => ({ ...pickup })),
    itemCycle: 0,
    inventory: { water: 0, tuna: 0 },
    survivedMs: 0,
    daysSurvived: 0,
    cycleRemainingMs: SURVIVAL_CYCLE_MS,
    gameOver: false,
    gameOverReason: '',
    message: '\uBB3C\uACFC \uC2DD\uB7C9\uC744 \uC8FC\uC6B0\uBA70 \uD558\uB8E8\uB9C8\uB2E4 \uD558\uB098\uC529 \uC18C\uBE44\uD574 \uC0B4\uC544\uB0A8\uC73C\uC138\uC694.',
  };
}

export function tileAtPixel(x, y) {
  const tileX = Math.round(x / TILE_SIZE);
  const tileY = Math.round(y / TILE_SIZE);

  if (tileY < 0 || tileY >= MAP_HEIGHT || tileX < 0 || tileX >= MAP_WIDTH) {
    return '#';
  }

  return CAMPUS_MAP[tileY][tileX];
}

export function isBlockedPixel(x, y) {
  return x < 0
    || y < 0
    || x > (MAP_WIDTH - 1) * TILE_SIZE
    || y > (MAP_HEIGHT - 1) * TILE_SIZE;
}

export function movePlayer(state, delta) {
  if (state.gameOver) {
    return;
  }

  const nextX = state.player.x + delta.x;
  const nextY = state.player.y + delta.y;

  if (!isBlockedPixel(nextX, nextY)) {
    state.player.x = nextX;
    state.player.y = nextY;
  }

  if (delta.x > 0) state.player.facing = 'right';
  if (delta.x < 0) state.player.facing = 'left';
  if (delta.y > 0) state.player.facing = 'down';
  if (delta.y < 0) state.player.facing = 'up';
}

export function collectItems(state) {
  if (state.gameOver) {
    return [];
  }

  const collected = [];
  for (const pickup of state.items) {
    if (pickup.collected) {
      continue;
    }

    if (distance(state.player, pickup) <= ITEM_PICKUP_RADIUS) {
      pickup.collected = true;
      state.inventory[pickup.type] += 1;
      collected.push(pickup);
    }
  }

  if (collected.length > 0) {
    const waterCount = collected.filter((pickup) => pickup.type === 'water').length;
    const tunaCount = collected.filter((pickup) => pickup.type === 'tuna').length;
    const parts = [];
    if (waterCount > 0) parts.push(`\uBB3C +${waterCount}`);
    if (tunaCount > 0) parts.push(`\uC2DD\uB7C9 +${tunaCount}`);
    state.message = `${parts.join(', ')} \uD68D\uB4DD!`;
  }

  return collected;
}

export function updateSurvivalTimer(state, elapsedMs, rng = Math.random) {
  if (state.gameOver) {
    return;
  }

  state.survivedMs += elapsedMs;
  state.cycleRemainingMs -= elapsedMs;

  while (state.cycleRemainingMs <= 0 && !state.gameOver) {
    consumeSurvivalItems(state);
    if (!state.gameOver) {
      respawnFieldItems(state, rng);
      addDailyMonsters(state, rng);
      state.cycleRemainingMs += SURVIVAL_CYCLE_MS;
    }
  }
}

export function updateMonsters(state, elapsedMs) {
  if (state.gameOver) {
    return;
  }

  for (const monster of state.monsters) {
    const target = chooseMonsterTarget(monster, state.player);
    const speed = monsterSpeed(monster);
    const nextDir = chooseChaseDirection(monster, target, monster.dir, speed);
    const distanceThisFrame = elapsedMs * speed;
    const nextX = monster.x + nextDir.x * distanceThisFrame;
    const nextY = monster.y + nextDir.y * distanceThisFrame;

    if (isBlockedPixel(nextX, nextY)) {
      monster.dir = reverseDirection(monster.dir);
      continue;
    }

    monster.dir = nextDir;
    monster.x = nextX;
    monster.y = nextY;
  }
}

export function checkPlayerMonsterCollision(state) {
  if (state.gameOver) {
    return false;
  }

  const touching = state.monsters.some((monster) => (
    Math.abs(monster.x - state.player.x) < TILE_SIZE * 0.65
    && Math.abs(monster.y - state.player.y) < TILE_SIZE * 0.65
  ));

  if (!touching) {
    return false;
  }

  endGame(state, '\uBAAC\uC2A4\uD130\uC5D0\uAC8C \uC7A1\uD614\uC2B5\uB2C8\uB2E4.', '\uBAAC\uC2A4\uD130');
  return true;
}

function consumeSurvivalItems(state) {
  if (state.inventory.water < DAILY_WATER_COST || state.inventory.tuna < DAILY_FOOD_COST) {
    endGame(
      state,
      '\uD558\uB8E8\uAC00 \uC9C0\uB0AC\uC9C0\uB9CC \uB9C8\uC2E4 \uBB3C\uACFC \uBA39\uC744 \uC2DD\uB7C9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uB2F9\uC2E0\uC740 \uAD76\uC5B4\uC8FD\uC5C8\uC2B5\uB2C8\uB2E4.',
      '\uC790\uC6D0 \uBD80\uC871',
    );
    return;
  }

  state.inventory.water -= DAILY_WATER_COST;
  state.inventory.tuna -= DAILY_FOOD_COST;
  state.daysSurvived += 1;
  state.message = `\uD558\uB8E8\uAC00 \uBC14\uAF08\uC2B5\uB2C8\uB2E4. \uBB3C ${DAILY_WATER_COST}\uAC1C\uC640 \uC2DD\uB7C9 ${DAILY_FOOD_COST}\uAC1C\uB97C \uC18C\uBE44\uD588\uC2B5\uB2C8\uB2E4.`;
}

function respawnFieldItems(state, rng) {
  const typeCounts = { tuna: FIELD_ITEMS_PER_TYPE, water: FIELD_ITEMS_PER_TYPE };
  const occupied = new Set();
  const nextItems = [];

  state.itemCycle += 1;

  for (const type of Object.keys(typeCounts).sort()) {
    for (let index = 0; index < typeCounts[type]; index += 1) {
      const position = randomItemPosition(state, rng, occupied);
      occupied.add(`${position.x},${position.y}`);
      nextItems.push({
        id: `${type}-${state.itemCycle}-${index + 1}`,
        type,
        x: position.x,
        y: position.y,
        collected: false,
      });
    }
  }

  state.items = nextItems;
}

function randomItemPosition(state, rng, occupied) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const tileX = 1 + Math.floor(rng() * (MAP_WIDTH - 2));
    const tileY = 1 + Math.floor(rng() * (MAP_HEIGHT - 2));
    const candidate = { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE };
    const key = `${candidate.x},${candidate.y}`;

    if (!occupied.has(key) && isGoodItemSpawn(state, candidate)) {
      return candidate;
    }
  }

  for (let tileY = 1; tileY < MAP_HEIGHT - 1; tileY += 1) {
    for (let tileX = 1; tileX < MAP_WIDTH - 1; tileX += 1) {
      const candidate = { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE };
      const key = `${candidate.x},${candidate.y}`;
      if (!occupied.has(key) && isGoodItemSpawn(state, candidate)) {
        return candidate;
      }
    }
  }

  return { x: TILE_SIZE, y: TILE_SIZE };
}

function isGoodItemSpawn(state, candidate) {
  if (isBlockedPixel(candidate.x, candidate.y)) {
    return false;
  }

  if (distance(state.player, candidate) < ITEM_RESPAWN_PLAYER_SAFE_RADIUS) {
    return false;
  }

  return state.monsters.every((monster) => (
    distance(monster, candidate) >= ITEM_RESPAWN_MONSTER_SAFE_RADIUS
  ));
}

function addDailyMonsters(state, rng) {
  const countToAdd = Math.floor(state.initialMonsterCount / 2);
  const occupied = new Set(state.monsters.map((monster) => `${Math.round(monster.x)},${Math.round(monster.y)}`));

  state.monsterCycle += 1;

  for (let index = 0; index < countToAdd; index += 1) {
    const position = randomMonsterPosition(state, rng, occupied);
    const role = index < countToAdd / 2 ? 'chaser' : 'guard';
    occupied.add(`${Math.round(position.x)},${Math.round(position.y)}`);
    state.monsters.push({
      x: position.x,
      y: position.y,
      homeX: position.x,
      homeY: position.y,
      role,
      dir: randomDirection(rng),
      stepTimer: 0,
      spawnedDay: state.monsterCycle,
    });
  }
}

function randomMonsterPosition(state, rng, occupied) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const tileX = 1 + Math.floor(rng() * (MAP_WIDTH - 2));
    const tileY = 1 + Math.floor(rng() * (MAP_HEIGHT - 2));
    const candidate = { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE };
    const key = `${Math.round(candidate.x)},${Math.round(candidate.y)}`;

    if (!occupied.has(key) && isGoodMonsterSpawn(state, candidate)) {
      return candidate;
    }
  }

  for (let tileY = 1; tileY < MAP_HEIGHT - 1; tileY += 1) {
    for (let tileX = 1; tileX < MAP_WIDTH - 1; tileX += 1) {
      const candidate = { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE };
      const key = `${Math.round(candidate.x)},${Math.round(candidate.y)}`;
      if (!occupied.has(key) && isGoodMonsterSpawn(state, candidate)) {
        return candidate;
      }
    }
  }

  return { x: TILE_SIZE, y: TILE_SIZE };
}

function isGoodMonsterSpawn(state, candidate) {
  if (isBlockedPixel(candidate.x, candidate.y)) {
    return false;
  }

  if (distance(state.player, candidate) < MONSTER_RESPAWN_PLAYER_SAFE_RADIUS) {
    return false;
  }

  return state.monsters.every((monster) => (
    distance(monster, candidate) >= MONSTER_RESPAWN_MONSTER_SAFE_RADIUS
  ));
}

function randomDirection(rng) {
  return DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)] ?? DIRECTIONS[0];
}

function monster(role, tileX, tileY, dirX, dirY, stepTimer) {
  const x = tileX * TILE_SIZE;
  const y = tileY * TILE_SIZE;
  return {
    x,
    y,
    homeX: x,
    homeY: y,
    role,
    dir: { x: dirX, y: dirY },
    stepTimer,
  };
}

function cloneMonster(enemy) {
  return {
    ...enemy,
    dir: { ...enemy.dir },
  };
}

function endGame(state, message, reason) {
  state.gameOver = true;
  state.gameOverReason = reason;
  state.message = message;
}

function item(id, type, tileX, tileY) {
  return {
    id,
    type,
    x: tileX * TILE_SIZE,
    y: tileY * TILE_SIZE,
    collected: false,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildCampusMap() {
  const map = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill('#'));

  fillRect(map, 1, 1, MAP_WIDTH - 2, MAP_HEIGHT - 2, 'g');
  fillRect(map, 1, 1, MAP_WIDTH - 2, 3, 'L');
  fillRect(map, 1, 28, MAP_WIDTH - 2, 3, 'R');
  fillRect(map, 2, 11, 9, 11, 'K');

  fillRect(map, 23, 24, 3, 5, 'P');
  fillRect(map, 23, 11, 3, 14, 'P');
  fillRect(map, 11, 11, 24, 2, 'P');
  fillRect(map, 28, 19, 12, 2, 'P');
  fillRect(map, 29, 10, 7, 3, 'S');
  setTile(map, 32, 10, 'E');

  fillRect(map, 13, 5, 8, 5, 'A');
  fillRect(map, 27, 3, 15, 7, 'B');
  fillRect(map, 37, 16, 5, 4, 'V');
  fillRect(map, 13, 16, 9, 6, 'F');

  fillRect(map, 3, 9, 9, 1, 'H');
  fillRect(map, 12, 14, 10, 1, 'H');
  fillRect(map, 26, 14, 10, 1, 'H');
  fillRect(map, 29, 22, 8, 1, 'H');

  [
    [7, 7], [12, 8], [17, 13], [25, 8], [36, 12],
    [8, 23], [16, 24], [28, 18], [33, 23], [41, 22],
    [5, 27], [19, 27], [35, 27], [43, 26],
  ].forEach(([x, y]) => setTile(map, x, y, 'C'));

  [
    [2, 4], [45, 4], [2, 24], [45, 24],
  ].forEach(([x, y]) => setTile(map, x, y, 'T'));

  return map.map((row) => row.join(''));
}

function fillRect(map, x, y, width, height, tile) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      setTile(map, col, row, tile);
    }
  }
}

function setTile(map, x, y, tile) {
  if (y <= 0 || y >= MAP_HEIGHT - 1 || x <= 0 || x >= MAP_WIDTH - 1) {
    return;
  }

  map[y][x] = tile;
}

function monsterSpeed(monster) {
  return monster.role === 'chaser' ? CHASER_MONSTER_SPEED_PER_MS : MONSTER_SPEED_PER_MS;
}

function chooseChaseDirection(monster, player, fallback, speed = monsterSpeed(monster)) {
  const dx = player.x - monster.x;
  const dy = player.y - monster.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return fallback;
  }

  const direct = { x: dx / length, y: dy / length };
  const candidates = [
    direct,
    { x: direct.x, y: 0 },
    { x: 0, y: direct.y },
    fallback,
    ...DIRECTIONS,
  ];

  for (const direction of candidates) {
    if (!isBlockedPixel(
      monster.x + direction.x * speed,
      monster.y + direction.y * speed,
    )) {
      return direction;
    }
  }

  return reverseDirection(fallback);
}

function chooseMonsterTarget(monster, player) {
  if (monster.role !== 'guard') {
    return player;
  }

  if (distance(monster, player) <= GUARD_MONSTER_AGGRO_RADIUS) {
    return player;
  }

  return { x: monster.homeX, y: monster.homeY };
}

function chooseOpenDirection(x, y, fallback) {
  const openDirections = DIRECTIONS.filter((direction) => (
    !isBlockedPixel(x + direction.x * TILE_SIZE, y + direction.y * TILE_SIZE)
  ));

  if (openDirections.length === 0) {
    return fallback;
  }

  return openDirections[Math.floor(Math.random() * openDirections.length)];
}

function reverseDirection(direction) {
  return {
    x: direction.x === 0 ? 0 : -direction.x,
    y: direction.y === 0 ? 0 : -direction.y,
  };
}
