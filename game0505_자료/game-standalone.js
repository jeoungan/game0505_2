(() => {
'use strict';

const TILE_SIZE = 32;
const MAP_WIDTH = 48;
const MAP_HEIGHT = 32;
const SURVIVAL_CYCLE_MS = 60_000;
const DAILY_WATER_COST = 3;
const DAILY_FOOD_COST = 3;
const FIELD_ITEMS_PER_TYPE = 4;
const ITEM_PICKUP_RADIUS = TILE_SIZE * 0.75;
const ITEM_RESPAWN_PLAYER_SAFE_RADIUS = TILE_SIZE * 4;
const ITEM_RESPAWN_MONSTER_SAFE_RADIUS = TILE_SIZE * 2;
const MONSTER_SPEED_PER_MS = 0.08;
const CHASER_MONSTER_SPEED_PER_MS = 0.12;
const MONSTER_START_SPEED_SCALE = 0.7;
const MONSTER_DAILY_SPEED_SCALE = 0.075;
const MONSTER_RESPAWN_PLAYER_SAFE_RADIUS = TILE_SIZE * 7;
const MONSTER_RESPAWN_MONSTER_SAFE_RADIUS = TILE_SIZE * 2;
const GUARD_MONSTER_AGGRO_RADIUS = TILE_SIZE * 8;

const CAMPUS_MAP = buildCampusMap();

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

function createGameState() {
  const spawn = { x: 24 * TILE_SIZE, y: 28 * TILE_SIZE };

  return {
    spawn,
    player: { x: spawn.x, y: spawn.y, facing: 'up' },
    monsters: INITIAL_MONSTERS.map((enemy) => cloneMonster(enemy)),
    initialMonsterCount: INITIAL_MONSTERS.length,
    monsterCycle: 0,
    items: INITIAL_ITEMS.map((pickup) => ({ ...pickup })),
    itemCycle: 0,
    inventory: { water: DAILY_WATER_COST, tuna: DAILY_FOOD_COST },
    survivedMs: 0,
    daysSurvived: 0,
    cycleRemainingMs: SURVIVAL_CYCLE_MS,
    gameOver: false,
    gameOverReason: '',
    message: '\uD558\uB8E8\uCE58 \uBB3C\uACFC \uC2DD\uB7C9\uC744 \uAC00\uC9C0\uACE0 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uB9E4\uC77C 3\uAC1C\uC529 \uBAA8\uC544 \uC0B4\uC544\uB0A8\uC73C\uC138\uC694.',
  };
}

function tileAtPixel(x, y) {
  const tileX = Math.round(x / TILE_SIZE);
  const tileY = Math.round(y / TILE_SIZE);

  if (tileY < 0 || tileY >= MAP_HEIGHT || tileX < 0 || tileX >= MAP_WIDTH) {
    return '#';
  }

  return CAMPUS_MAP[tileY][tileX];
}

function isBlockedPixel(x, y) {
  return x < 0
    || y < 0
    || x > (MAP_WIDTH - 1) * TILE_SIZE
    || y > (MAP_HEIGHT - 1) * TILE_SIZE;
}

function movePlayer(state, delta) {
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

function collectItems(state) {
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

function updateSurvivalTimer(state, elapsedMs, rng = Math.random) {
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

function updateMonsters(state, elapsedMs) {
  if (state.gameOver) {
    return;
  }

  for (const monster of state.monsters) {
    const target = chooseMonsterTarget(monster, state.player);
    const speed = monsterSpeed(monster, state.daysSurvived);
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

function checkPlayerMonsterCollision(state) {
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

function monsterSpeed(monster, daysSurvived = 0) {
  const baseSpeed = monster.role === 'chaser' ? CHASER_MONSTER_SPEED_PER_MS : MONSTER_SPEED_PER_MS;
  const speedScale = Math.min(1, MONSTER_START_SPEED_SCALE + daysSurvived * MONSTER_DAILY_SPEED_SCALE);
  return baseSpeed * speedScale;
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


const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const rootEl = document.documentElement;
const messageEl = document.querySelector('#message');
const waterCountEl = document.querySelector('#waterCount');
const tunaCountEl = document.querySelector('#tunaCount');
const timerEl = document.querySelector('#timer');
const survivalTimeEl = document.querySelector('#survivalTime');
const resetButton = document.querySelector('#resetButton');
const startOverlay = document.querySelector('#startOverlay');
const startButton = document.querySelector('#startButton');
const scoreOverlay = document.querySelector('#scoreOverlay');
const scoreSummaryEl = document.querySelector('#scoreSummary');
const scoreActions = document.querySelector('#scoreActions');
const saveRecordButton = document.querySelector('#saveRecordButton');
const skipRecordButton = document.querySelector('#skipRecordButton');
const scoreResetButton = document.querySelector('#scoreResetButton');
const nameRow = document.querySelector('#nameRow');
const playerNameInput = document.querySelector('#playerNameInput');
const confirmRecordButton = document.querySelector('#confirmRecordButton');
const recordMessageEl = document.querySelector('#recordMessage');
const joystickBase = document.querySelector('#joystickBase');
const joystickStick = document.querySelector('#joystickStick');
const mobileResetButton = document.querySelector('#mobileResetButton');
const PLAYER_SPEED_PER_MS = 0.14;
const RECORD_STORAGE_KEY = 'campusSurvivalRecords';
const DEFAULT_CANVAS_WIDTH = 640;
const DEFAULT_CANVAS_HEIGHT = 480;

const assetSources = {
  map: 'assets/generated/hsmu-large-campus-map.png',
  player: 'assets/generated/student-walk-processed/sheet-transparent.png',
  monsters: 'assets/generated/campus-monsters-processed/sheet-transparent.png',
  items: 'assets/generated/survival-items.png',
};

const assets = {
  map: null,
  player: null,
  monsters: null,
  items: null,
  itemFrames: null,
};

const fallbackColors = {
  '#': '#1a2421',
  g: '#3f8b4e',
  P: '#d6c48a',
  R: '#6c7477',
  K: '#50575d',
  A: '#375eaa',
  B: '#4b6f9f',
  S: '#9a9a9a',
  T: '#235b37',
  C: '#eeb1cf',
  H: '#2d6d39',
  F: '#3e9f54',
  V: '#f3f0de',
  L: '#37633b',
  E: '#c58b3f',
};

let state = createGameState();
let lastTime = performance.now();
let playerFrame = 0;
let gameStarted = false;
let scorePromptShown = false;
let touchVector = { x: 0, y: 0 };
const pressedKeys = new Set();

function resetGame({ showBriefing = false } = {}) {
  state = createGameState();
  lastTime = performance.now();
  playerFrame = 0;
  gameStarted = !showBriefing;
  scorePromptShown = false;
  pressedKeys.clear();
  clearJoystickVector();
  if (showBriefing) {
    showStartOverlay();
  } else {
    hideStartOverlay();
  }
  hideScoreOverlay();
  updateHud();
  render();
}

function startGame() {
  gameStarted = true;
  scorePromptShown = false;
  lastTime = performance.now();
  hideStartOverlay();
  hideScoreOverlay();
  refreshMobileViewport();
}

function showStartOverlay() {
  startOverlay.classList.remove('hidden');
}

function hideStartOverlay() {
  startOverlay.classList.add('hidden');
}

function hideScoreOverlay() {
  scoreOverlay.classList.add('hidden');
  nameRow.classList.add('hidden');
  recordMessageEl.classList.add('hidden');
  scoreActions.classList.remove('hidden');
  playerNameInput.value = '';
}

function showScoreOverlay() {
  if (scorePromptShown) {
    return;
  }

  scorePromptShown = true;
  gameStarted = false;
  scoreSummaryEl.textContent = `살아남은 날 수: ${state.daysSurvived}일`;
  scoreOverlay.classList.remove('hidden');
  scoreActions.classList.remove('hidden');
  nameRow.classList.add('hidden');
  recordMessageEl.classList.add('hidden');
}

function showNameInput() {
  scoreActions.classList.add('hidden');
  nameRow.classList.remove('hidden');
  recordMessageEl.classList.add('hidden');
  playerNameInput.focus();
}

function skipRecord() {
  scoreActions.classList.add('hidden');
  nameRow.classList.add('hidden');
  recordMessageEl.textContent = '기록 저장을 건너뛰었습니다.';
  recordMessageEl.classList.remove('hidden');
}

function confirmRecord() {
  const name = playerNameInput.value.trim() || '플레이어';
  const record = {
    name,
    daysSurvived: state.daysSurvived,
    survivedMs: Math.floor(state.survivedMs),
    savedAt: new Date().toISOString(),
  };

  const saved = saveSurvivalRecord(record);
  nameRow.classList.add('hidden');
  recordMessageEl.textContent = saved
    ? `${record.name} / ${record.daysSurvived}일 기록 저장 완료`
    : '기록을 저장하지 못했습니다.';
  recordMessageEl.classList.remove('hidden');
}

function saveSurvivalRecord(record) {
  try {
    const raw = localStorage.getItem(RECORD_STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(records)) {
      localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify([record]));
      return true;
    }

    records.push(record);
    localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (error) {
    console.warn('Could not save survival record:', error);
    return false;
  }
}

function updateHud() {
  messageEl.textContent = state.message;
  waterCountEl.textContent = String(state.inventory.water);
  tunaCountEl.textContent = String(state.inventory.tuna);
  timerEl.textContent = formatClock(Math.ceil(state.cycleRemainingMs / 1000));
  survivalTimeEl.textContent = formatDuration(state.survivedMs);
}

function drawMap() {
  if (assets.map) {
    ctx.drawImage(assets.map, 0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    return;
  }

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const tile = CAMPUS_MAP[y][x];
      ctx.fillStyle = fallbackColors[tile] ?? fallbackColors.g;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

function drawItems() {
  for (const pickup of state.items) {
    if (pickup.collected) {
      continue;
    }

    drawItem(pickup);
  }
}

function drawItem(pickup) {
  const bob = Math.sin((performance.now() / 320) + pickup.x) * 2;
  const pulse = (Math.sin((performance.now() / 220) + pickup.y) + 1) / 2;
  const drawSize = pickup.type === 'water'
    ? { w: 22, h: 36 }
    : { w: 34, h: 26 };
  const x = pickup.x + TILE_SIZE / 2 - drawSize.w / 2;
  const y = pickup.y + TILE_SIZE / 2 - drawSize.h / 2 + bob;
  const centerX = pickup.x + TILE_SIZE / 2;
  const centerY = pickup.y + TILE_SIZE / 2 + bob;

  drawItemGlow(pickup, centerX, centerY, pulse);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(pickup.x + TILE_SIZE / 2, pickup.y + TILE_SIZE - 3, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (assets.items && assets.itemFrames) {
    const source = assets.itemFrames[pickup.type];
    ctx.drawImage(assets.items, source.x, source.y, source.w, source.h, x, y, drawSize.w, drawSize.h);
    return;
  }

  if (pickup.type === 'water') {
    ctx.fillStyle = '#7cc9ff';
    ctx.fillRect(x + 6, y + 5, 10, 28);
    ctx.fillStyle = '#1f63c6';
    ctx.fillRect(x + 4, y, 14, 6);
    return;
  }

  ctx.fillStyle = '#b9b08a';
  ctx.fillRect(x + 2, y + 4, 30, 18);
  ctx.fillStyle = '#29a5a3';
  ctx.fillRect(x + 4, y + 10, 26, 8);
}

function drawItemGlow(pickup, centerX, centerY, pulse) {
  const glowColor = pickup.type === 'water'
    ? 'rgba(121, 201, 255, '
    : 'rgba(97, 210, 182, ';
  const radius = 20 + pulse * 5;
  const gradient = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, radius);

  gradient.addColorStop(0, `${glowColor}0.38)`);
  gradient.addColorStop(0.55, `${glowColor}0.2)`);
  gradient.addColorStop(1, `${glowColor}0)`);

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `${glowColor}${0.36 + pulse * 0.24})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  if (!assets.player) {
    ctx.fillStyle = '#1a5fb4';
    ctx.fillRect(state.player.x + 8, state.player.y + 8, 16, 20);
    return;
  }

  const rowByFacing = { down: 0, left: 1, right: 2, up: 3 };
  const row = rowByFacing[state.player.facing] ?? 0;
  const source = spriteFrame(assets.player, 4, 4, row, Math.floor(playerFrame) % 4, 0.16);

  ctx.drawImage(
    assets.player,
    source.x,
    source.y,
    source.w,
    source.h,
    state.player.x - 4,
    state.player.y - 14,
    TILE_SIZE + 8,
    TILE_SIZE + 12,
  );
}

function drawMonster(monster, index) {
  if (!assets.monsters) {
    ctx.fillStyle = '#c2413d';
    ctx.fillRect(monster.x + 6, monster.y + 8, 20, 20);
    return;
  }

  const row = Math.floor((index % 9) / 3);
  const col = index % 3;
  const source = spriteFrame(assets.monsters, 3, 3, row, col, 0.12);
  const bob = Math.sin((performance.now() / 260) + index) * 2;

  ctx.drawImage(
    assets.monsters,
    source.x,
    source.y,
    source.w,
    source.h,
    monster.x - 7,
    monster.y - 12 + bob,
    TILE_SIZE + 14,
    TILE_SIZE + 12,
  );
}

function spriteFrame(image, cols, rows, row, col, insetRatio) {
  const cellW = image.width / cols;
  const cellH = image.height / rows;
  const insetX = cellW * insetRatio;
  const insetY = cellH * insetRatio;

  return {
    x: col * cellW + insetX,
    y: row * cellH + insetY,
    w: cellW - insetX * 2,
    h: cellH - insetY * 2,
  };
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const camera = getCamera();

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawMap();
  drawItems();
  state.monsters.forEach(drawMonster);
  drawPlayer();
  ctx.restore();

  if (state.gameOver) {
    drawGameOver();
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(16, 22, 28, 0.88)';
  ctx.fillRect(52, 154, 536, 172);
  ctx.strokeStyle = '#f0e3b2';
  ctx.lineWidth = 2;
  ctx.strokeRect(52, 154, 536, 172);
  ctx.fillStyle = '#f7f1dc';
  ctx.font = '32px "Courier New", monospace';
  ctx.fillText('GAME OVER', 226, 210);
  ctx.font = '17px "Courier New", monospace';
  ctx.fillText(`Survived ${formatDuration(state.survivedMs)}`, 224, 248);
  ctx.fillText('\uB2E4\uC2DC \uC2DC\uC791 \uBC84\uD2BC\uC73C\uB85C \uC7AC\uB3C4\uC804', 176, 284);
}

function getCamera() {
  const worldWidth = MAP_WIDTH * TILE_SIZE;
  const worldHeight = MAP_HEIGHT * TILE_SIZE;
  const targetX = state.player.x - canvas.width / 2 + TILE_SIZE / 2;
  const targetY = state.player.y - canvas.height / 2 + TILE_SIZE / 2;

  return {
    x: clamp(targetX, 0, Math.max(0, worldWidth - canvas.width)),
    y: clamp(targetY, 0, Math.max(0, worldHeight - canvas.height)),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resizeCanvasForViewport() {
  syncViewportModeClasses();
  const mobile = isTouchViewport();
  const nextWidth = mobile ? Math.floor(window.innerWidth) : DEFAULT_CANVAS_WIDTH;
  const nextHeight = mobile ? Math.floor(window.innerHeight) : DEFAULT_CANVAS_HEIGHT;

  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return;
  }

  canvas.width = nextWidth;
  canvas.height = nextHeight;
  ctx.imageSmoothingEnabled = false;
  render();
}

function isTouchViewport() {
  return navigator.maxTouchPoints > 0
    || 'ontouchstart' in window
    || window.matchMedia('(pointer: coarse)').matches;
}

function syncViewportModeClasses() {
  const touch = isTouchViewport();
  const landscape = window.innerWidth >= window.innerHeight;

  rootEl.classList.toggle('touch-device', touch);
  rootEl.classList.toggle('landscape-runtime', touch && landscape);
  rootEl.classList.toggle('portrait-runtime', touch && !landscape);
}

function refreshMobileViewport() {
  if (!isTouchViewport()) {
    return;
  }

  setTimeout(resizeCanvasForViewport, 160);
}

function tick(now) {
  const elapsedMs = now - lastTime;
  lastTime = now;

  if (gameStarted && !state.gameOver) {
    updatePlayerInput(elapsedMs);
    updateSurvivalTimer(state, elapsedMs);
    updateMonsters(state, elapsedMs);
    collectItems(state);
    checkPlayerMonsterCollision(state);
  }

  if (state.gameOver) {
    showScoreOverlay();
  }

  updateHud();
  render();
  requestAnimationFrame(tick);
}

function updatePlayerInput(elapsedMs) {
  const vector = keyToVector();
  if (vector.x === 0 && vector.y === 0) {
    return;
  }

  const length = Math.hypot(vector.x, vector.y) || 1;
  const distanceThisFrame = elapsedMs * PLAYER_SPEED_PER_MS;
  movePlayer(state, {
    x: (vector.x / length) * distanceThisFrame,
    y: (vector.y / length) * distanceThisFrame,
  });
  playerFrame = (playerFrame + elapsedMs / 90) % 4;
}

function keyToVector() {
  const left = pressedKeys.has('ArrowLeft') || pressedKeys.has('a');
  const right = pressedKeys.has('ArrowRight') || pressedKeys.has('d');
  const up = pressedKeys.has('ArrowUp') || pressedKeys.has('w');
  const down = pressedKeys.has('ArrowDown') || pressedKeys.has('s');

  return {
    x: (right ? 1 : 0) - (left ? 1 : 0) + touchVector.x,
    y: (down ? 1 : 0) - (up ? 1 : 0) + touchVector.y,
  };
}

function updateJoystickVector(event) {
  updateJoystickVectorFromPoint(event.clientX, event.clientY);
}

function updateJoystickVectorFromTouch(event) {
  const touch = event.touches[0] ?? event.changedTouches[0];
  if (!touch) {
    return;
  }

  updateJoystickVectorFromPoint(touch.clientX, touch.clientY);
}

function updateJoystickVectorFromPoint(clientX, clientY) {
  if (!joystickBase) {
    return;
  }

  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxDistance = rect.width * 0.34;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const length = Math.hypot(dx, dy);
  const scale = length > maxDistance ? maxDistance / length : 1;
  const stickX = dx * scale;
  const stickY = dy * scale;

  touchVector = {
    x: maxDistance === 0 ? 0 : stickX / maxDistance,
    y: maxDistance === 0 ? 0 : stickY / maxDistance,
  };

  joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
}

function clearJoystickVector() {
  touchVector = { x: 0, y: 0 };
  if (joystickStick) {
    joystickStick.style.transform = 'translate(-50%, -50%)';
  }
}

function isMoveKey(key) {
  return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(key);
}

function normalizeMoveKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

window.addEventListener('keydown', (event) => {
  if (!isMoveKey(event.key)) {
    return;
  }

  event.preventDefault();
  pressedKeys.add(normalizeMoveKey(event.key));
});

window.addEventListener('keyup', (event) => {
  if (!isMoveKey(event.key)) {
    return;
  }

  event.preventDefault();
  pressedKeys.delete(normalizeMoveKey(event.key));
});

if (joystickBase) {
  joystickBase.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    joystickBase.setPointerCapture(event.pointerId);
    updateJoystickVector(event);
  });

  joystickBase.addEventListener('pointermove', (event) => {
    if (!joystickBase.hasPointerCapture(event.pointerId)) {
      return;
    }

    event.preventDefault();
    updateJoystickVector(event);
  });

  joystickBase.addEventListener('pointerup', (event) => {
    event.preventDefault();
    clearJoystickVector();
  });

  joystickBase.addEventListener('pointercancel', clearJoystickVector);

  joystickBase.addEventListener('touchstart', (event) => {
    event.preventDefault();
    updateJoystickVectorFromTouch(event);
  }, { passive: false });

  joystickBase.addEventListener('touchmove', (event) => {
    event.preventDefault();
    updateJoystickVectorFromTouch(event);
  }, { passive: false });

  joystickBase.addEventListener('touchend', (event) => {
    event.preventDefault();
    clearJoystickVector();
  }, { passive: false });

  joystickBase.addEventListener('touchcancel', clearJoystickVector);
}

window.addEventListener('resize', resizeCanvasForViewport);
window.addEventListener('orientationchange', resizeCanvasForViewport);

startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', () => resetGame());
mobileResetButton.addEventListener('click', () => resetGame());
saveRecordButton.addEventListener('click', showNameInput);
skipRecordButton.addEventListener('click', skipRecord);
scoreResetButton.addEventListener('click', () => resetGame());
confirmRecordButton.addEventListener('click', confirmRecord);
playerNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    confirmRecord();
  }
});

loadGameAssets()
  .catch((error) => {
    console.error('Asset loading failed:', error);
    state.message = '\uC790\uC0B0 \uB85C\uB4DC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68\uD558\uAC70\uB098 \uC11C\uBC84\uB97C \uB2E4\uC2DC \uC2DC\uC791\uD574\uC8FC\uC138\uC694.';
  })
  .finally(() => {
    resizeCanvasForViewport();
    updateHud();
    requestAnimationFrame(tick);
  });

async function loadGameAssets() {
  const [map, player, monsters, items] = await Promise.all([
    loadImage(assetSources.map),
    loadImage(assetSources.player),
    loadImage(assetSources.monsters),
    loadImage(assetSources.items),
  ]);

  assets.map = map;
  assets.player = player;
  assets.monsters = monsters;
  assets.items = items;
  assets.itemFrames = extractItemFrames(items);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function extractItemFrames(image) {
  const cellWidth = image.width / 2;
  return {
    water: { x: 0, y: 0, w: cellWidth, h: image.height },
    tuna: { x: cellWidth, y: 0, w: cellWidth, h: image.height },
  };
}

function formatClock(totalSeconds) {
  const clamped = Math.max(0, Math.min(60, totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

})();
