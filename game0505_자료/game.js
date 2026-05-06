import {
  TILE_SIZE,
  CAMPUS_MAP,
  MAP_WIDTH,
  MAP_HEIGHT,
  createGameState,
  movePlayer,
  collectItems,
  updateSurvivalTimer,
  updateMonsters,
  checkPlayerMonsterCollision,
} from './game-core.mjs';

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
const nameRow = document.querySelector('#nameRow');
const playerNameInput = document.querySelector('#playerNameInput');
const confirmRecordButton = document.querySelector('#confirmRecordButton');
const recordMessageEl = document.querySelector('#recordMessage');
const joystickBase = document.querySelector('#joystickBase');
const joystickStick = document.querySelector('#joystickStick');
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
  requestMobileLandscapeMode();
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
  const drawSize = pickup.type === 'water'
    ? { w: 22, h: 36 }
    : { w: 34, h: 26 };
  const x = pickup.x + TILE_SIZE / 2 - drawSize.w / 2;
  const y = pickup.y + TILE_SIZE / 2 - drawSize.h / 2 + bob;

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
  const mobileLandscape = isTouchViewport() && window.innerWidth >= window.innerHeight;
  const nextWidth = mobileLandscape ? Math.floor(window.innerWidth) : DEFAULT_CANVAS_WIDTH;
  const nextHeight = mobileLandscape ? Math.floor(window.innerHeight) : DEFAULT_CANVAS_HEIGHT;

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

async function requestMobileLandscapeMode() {
  if (!isTouchViewport()) {
    return;
  }

  try {
    if (!document.fullscreenElement && rootEl.requestFullscreen) {
      await rootEl.requestFullscreen();
    }
  } catch (error) {
    console.info('Fullscreen request skipped:', error);
  }

  try {
    await screen.orientation.lock('landscape');
  } catch (error) {
    console.info('Landscape lock skipped:', error);
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
saveRecordButton.addEventListener('click', showNameInput);
skipRecordButton.addEventListener('click', skipRecord);
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
