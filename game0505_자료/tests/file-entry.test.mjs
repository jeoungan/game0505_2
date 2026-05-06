import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('index uses a classic bundled script so direct file preview runs the game', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<script src="\.\/game-standalone\.js"><\/script>/);
  assert.doesNotMatch(html, /type="module"/);
});

test('classic bundle is self contained for file previews', async () => {
  const bundle = await readFile(new URL('../game-standalone.js', import.meta.url), 'utf8');

  assert.match(bundle, /function createGameState/);
  assert.match(bundle, /function render/);
  assert.doesNotMatch(bundle, /^\s*import\s/m);
  assert.doesNotMatch(bundle, /^\s*export\s/m);
});

test('file preview uses pre-transparent sprites without canvas pixel reads', async () => {
  const bundle = await readFile(new URL('../game-standalone.js', import.meta.url), 'utf8');

  assert.match(bundle, /student-walk-processed\/sheet-transparent\.png/);
  assert.match(bundle, /campus-monsters-processed\/sheet-transparent\.png/);
  assert.doesNotMatch(bundle, /makeMagentaTransparent\(/);
  assert.doesNotMatch(bundle, /getImageData/);
});

test('index labels inventory as water and food', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, />\uBB3C <strong id="waterCount">0<\/strong>/);
  assert.match(html, />\uC2DD\uB7C9 <strong id="tunaCount">0<\/strong>/);
  assert.doesNotMatch(html, /\uC0DD\uC218\uBCD1 <strong id="waterCount"/);
  assert.doesNotMatch(html, /\uCC38\uCE58\uCE94 <strong id="tunaCount"/);
});

test('index opens with a start briefing before play begins', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /id="startOverlay"/);
  assert.match(html, /id="startButton"/);
  assert.match(
    html,
    /\uB2F9\uC2E0\uC740 \uBAAC\uC2A4\uD130\uAC00 \uB098\uD0C0\uB098\uB294 \uD559\uAD50\uC5D0 \uAC07\uD614\uC2B5\uB2C8\uB2E4\./,
  );
});

test('game over flow can save a named survival record in file preview', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const bundle = await readFile(new URL('../game-standalone.js', import.meta.url), 'utf8');

  assert.match(html, /\uAE30\uB85D\uC744 \uC800\uC7A5\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C\?/);
  assert.match(html, /id="scoreResetButton"/);
  assert.match(html, /id="playerNameInput"/);
  assert.match(bundle, /localStorage/);
  assert.match(bundle, /campusSurvivalRecords/);
  assert.match(bundle, /scoreResetButton\.addEventListener\('click', \(\) => resetGame\(\)\)/);
});

test('mobile landscape mode shows only the playable field with touch controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const bundle = await readFile(new URL('../game-standalone.js', import.meta.url), 'utf8');

  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/);
  assert.match(html, /class="mobile-controls"/);
  assert.match(html, /id="joystickBase"/);
  assert.match(html, /id="mobileResetButton"/);
  assert.match(html, /class="mobile-reset"/);
  assert.match(html, /id="orientationOverlay"/);
  assert.match(html, /\uD734\uB300\uD3F0\uC744 \uAC00\uB85C\uB85C \uB3CC\uB824\uC8FC\uC138\uC694/);
  assert.match(html, /\.touch-device\.landscape-runtime/);
  assert.match(html, /\.touch-device\.portrait-runtime \.orientation-overlay/);
  assert.match(html, /\.topbar,\s*\.status-row\s*\{\s*display: none;/);
  assert.match(bundle, /function isTouchViewport/);
  assert.match(bundle, /function resizeCanvasForViewport/);
  assert.match(bundle, /function updateJoystickVector/);
  assert.match(bundle, /touchstart/);
  assert.match(bundle, /touchmove/);
  assert.match(bundle, /requestFullscreen/);
  assert.match(bundle, /screen\.orientation\.lock/);
  assert.match(bundle, /mobileResetButton\.addEventListener\('click', \(\) => resetGame\(\)\)/);
  assert.match(bundle, /touchVector/);
});

test('reset button restarts play without showing the first briefing again', async () => {
  const bundle = await readFile(new URL('../game-standalone.js', import.meta.url), 'utf8');

  assert.match(bundle, /function resetGame\(\{ showBriefing = false \} = \{\}\)/);
  assert.match(bundle, /if \(showBriefing\) \{/);
  assert.match(bundle, /hideStartOverlay\(\);/);
  assert.match(bundle, /resetButton\.addEventListener\('click', \(\) => resetGame\(\)\)/);
});
