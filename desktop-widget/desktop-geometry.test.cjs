const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resizeBounds, fitBounds } = require('./desktop-geometry.cjs');

test('northwest shrinking stops at minimum size and keeps the opposite corner fixed', () => {
  assert.deepEqual(resizeBounds({ x: 100, y: 50, width: 400, height: 500 }, 'nw', 300, 400),
    { x: 220, y: 310, width: 280, height: 240 });
});
test('southeast growth follows the pointer and supports a negative-coordinate monitor', () => {
  assert.deepEqual(resizeBounds({ x: -1200, y: 20, width: 400, height: 500 }, 'se', 450, -100),
    { x: -1200, y: 20, width: 850, height: 400 });
});
test('moving preserves size without constraining negative coordinates', () => {
  assert.deepEqual(resizeBounds({ x: 100, y: 50, width: 400, height: 500 }, 'move', -900, 80),
    { x: -800, y: 130, width: 400, height: 500 });
});
test('east edge leaves vertical position and height unchanged', () => {
  assert.deepEqual(resizeBounds({ x: 100, y: 50, width: 400, height: 500 }, 'e', -800, 200),
    { x: 100, y: 50, width: 280, height: 500 });
});
test('restoring an off-screen oversized widget fits it into the selected work area', () => {
  assert.deepEqual(fitBounds({ x: 2000, y: -500, width: 1900, height: 1100 }, { x: -1280, y: 0, width: 1280, height: 720 }),
    { x: -1280, y: 0, width: 1280, height: 720 });
});
