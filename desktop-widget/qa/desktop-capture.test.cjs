const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captureIcons, readWallpaper } = require('../desktop-capture.cjs');
test('Explorer capture retains transparent background and real icon pixels', () => {
  const frame = captureIcons();
  assert.equal(frame.pixels.length, frame.rect.width * frame.rect.height * 4);
  let clear = 0, visible = 0;
  for (let i = 3; i < frame.pixels.length; i += 4) {
    if (frame.pixels[i] === 0) clear++;
    if (frame.pixels[i] > 200) visible++;
  }
  assert(clear > 1000, 'Background must retain alpha, not become an opaque black desktop');
  assert(visible > 1000, 'Actual desktop icons must be captured');
  assert(frame.ms < 2000);
});
test('Current Windows wallpaper can be loaded locally', () => {
  const wall = readWallpaper();
  assert.match(wall.dataURL, /^data:image\//);
  assert(['0', '2', '6', '10', '22'].includes(wall.style));
});
